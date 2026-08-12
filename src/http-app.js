import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PublicAppError } from './modelscope-client.js';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store'
};

const ASSETS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/history.js', ['history.js', 'text/javascript; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);

function send(response, status, body, contentType) {
  response.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': contentType });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

async function readSmallBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024) {
      const error = new PublicAppError('REQUEST_TOO_LARGE', 'The request body is too large.', 413);
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text && text !== '{}') {
    throw new PublicAppError('INVALID_REQUEST', 'The request body must be empty.', 400);
  }
}

export function createHttpApp({ quotaService, publicDir, logger = console }) {
  return async function requestListener(request, response) {
    const started = Date.now();
    const pathname = new URL(request.url, 'http://localhost').pathname;
    let status = 500;
    let publicCode = null;

    try {
      if (request.method === 'GET' && ASSETS.has(pathname)) {
        const [filename, contentType] = ASSETS.get(pathname);
        const body = await readFile(join(publicDir, filename));
        status = 200;
        send(response, status, body, contentType);
        return;
      }

      if (request.method === 'GET' && pathname === '/healthz') {
        status = 200;
        sendJson(response, status, { ok: true });
        return;
      }

      if (pathname === '/api/quota' && request.method !== 'POST') {
        status = 405;
        sendJson(response, status, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to check quota.' });
        return;
      }

      if (pathname === '/api/quota') {
        await readSmallBody(request);
        const result = await quotaService.check();
        status = 200;
        sendJson(response, status, result);
        return;
      }

      status = 404;
      sendJson(response, status, { code: 'NOT_FOUND', message: 'The requested resource was not found.' });
    } catch (error) {
      const safe = error instanceof PublicAppError
        ? error
        : new PublicAppError('SERVER_ERROR', 'The server could not complete the request.', 500);
      status = safe.status;
      publicCode = safe.code;
      sendJson(response, status, safe.toJSON());
    } finally {
      logger.info?.({ method: request.method, pathname, status, durationMs: Date.now() - started, code: publicCode });
    }
  };
}
