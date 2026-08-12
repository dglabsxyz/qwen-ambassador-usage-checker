import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHttpApp } from '../src/http-app.js';
import { PublicAppError } from '../src/modelscope-client.js';

const assets = {
  'index.html': '<!doctype html><h1>Test</h1>',
  'styles.css': 'body{}',
  'history.js': 'export const value = 1;',
  'app.js': 'console.log("test");'
};

async function startApp({ quotaService, logger = { info() {}, error() {} } }) {
  const publicDir = await mkdtemp(join(tmpdir(), 'qwen-http-test-'));
  await Promise.all(Object.entries(assets).map(([name, body]) => writeFile(join(publicDir, name), body)));
  const server = createServer(createHttpApp({ quotaService, publicDir, logger }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

function assertSecurityHeaders(response) {
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

test('serves allowlisted assets and health without probing ModelScope', async (t) => {
  let checks = 0;
  const app = await startApp({ quotaService: { check: async () => { checks += 1; } } });
  t.after(app.close);

  for (const [path, type] of [['/', 'text/html'], ['/styles.css', 'text/css'], ['/history.js', 'text/javascript'], ['/app.js', 'text/javascript']]) {
    const response = await fetch(`${app.baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), new RegExp(type));
    assertSecurityHeaders(response);
  }

  const health = await fetch(`${app.baseUrl}/healthz`);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(checks, 0);
});

test('accepts POST quota checks and rejects other methods and paths', async (t) => {
  let checks = 0;
  const quota = { limit: 100, remaining: 90, used: 10, usedPercent: 10, checkedAt: 'now', cached: false, probeTokens: { prompt: 1, completion: 1, total: 2 } };
  const app = await startApp({ quotaService: { check: async () => { checks += 1; return quota; } } });
  t.after(app.close);

  const method = await fetch(`${app.baseUrl}/api/quota`);
  assert.equal(method.status, 405);
  assert.equal(checks, 0);

  const missing = await fetch(`${app.baseUrl}/missing`);
  assert.equal(missing.status, 404);

  const response = await fetch(`${app.baseUrl}/api/quota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), quota);
  assert.equal(checks, 1);
});

test('returns only public error fields', async (t) => {
  const privateCause = new Error(`Bearer ${['secret', 'test', 'value'].join('-')}`);
  const app = await startApp({
    quotaService: {
      check: async () => { throw new PublicAppError('SAFE_CODE', 'Safe message.', 502, privateCause); }
    }
  });
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/api/quota`, { method: 'POST', body: '{}' });
  const text = await response.text();
  assert.equal(response.status, 502);
  assert.deepEqual(JSON.parse(text), { code: 'SAFE_CODE', message: 'Safe message.' });
  assert.doesNotMatch(text, /Bearer|secret-test-value/);
});

test('rejects quota request bodies over 1 KiB before probing', async (t) => {
  let checks = 0;
  const app = await startApp({ quotaService: { check: async () => { checks += 1; } } });
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/api/quota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(1100) })
  });
  assert.equal(response.status, 413);
  assert.equal(checks, 0);
});

test('ships an accessible manual-check dashboard and local assets', async (t) => {
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const server = createServer(createHttpApp({
    quotaService: { check: async () => { throw new Error('GET must not probe'); } },
    publicDir: join(projectRoot, 'public'),
    logger: { info() {} }
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const html = await (await fetch(`${baseUrl}/`)).text();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Qwen-Ambassador\/Qwen3\.8-Max/);
  assert.match(html, />Check Usage</);
  assert.match(html, /Each live check consumes one ModelScope request/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);

  assert.match((await fetch(`${baseUrl}/styles.css`)).headers.get('content-type'), /text\/css/);
  assert.match((await fetch(`${baseUrl}/app.js`)).headers.get('content-type'), /text\/javascript/);
});
