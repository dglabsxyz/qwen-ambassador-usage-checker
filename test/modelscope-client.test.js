import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelScopeClient, PublicAppError } from '../src/modelscope-client.js';
import { MODELSCOPE_URL } from '../src/config.js';

const quotaHeaders = {
  'modelscope-ratelimit-model-month-requests-limit': '5500',
  'modelscope-ratelimit-model-month-requests-remaining': '5441'
};

function response(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

test('sends one minimal request and normalizes quota and token usage', async () => {
  const calls = [];
  const client = createModelScopeClient({
    token: 'test-token',
    now: () => new Date('2026-08-12T12:00:00.000Z'),
    fetchImpl: async (...args) => {
      calls.push(args);
      return response(200, {
        usage: { prompt_tokens: 65, completion_tokens: 26, total_tokens: 91 }
      }, quotaHeaders);
    }
  });

  const result = await client.probe();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], MODELSCOPE_URL);
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    model: 'Qwen-Ambassador/Qwen3.8-Max',
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    max_tokens: 1,
    stream: false
  });
  assert.deepEqual(result.probeTokens, { prompt: 65, completion: 26, total: 91 });
  assert.equal(result.used, 59);
  assert.equal(result.checkedAt, '2026-08-12T12:00:00.000Z');
});

test('normalizes absent token usage fields to zero', async () => {
  const client = createModelScopeClient({
    token: 'test-token',
    fetchImpl: async () => response(200, {}, quotaHeaders)
  });

  assert.deepEqual((await client.probe()).probeTokens, { prompt: 0, completion: 0, total: 0 });
});

test('rejects a missing token without calling upstream', async () => {
  let called = false;
  const client = createModelScopeClient({ token: '', fetchImpl: async () => { called = true; } });

  await assert.rejects(client.probe(), error => {
    assert.equal(error.code, 'SERVER_NOT_CONFIGURED');
    assert.equal(error.status, 503);
    return true;
  });
  assert.equal(called, false);
});

for (const status of [401, 403]) {
  test(`maps upstream ${status} to a sanitized access error`, async () => {
    const client = createModelScopeClient({
      token: 'test-token',
      fetchImpl: async () => response(status, { error: { message: 'Bearer test-token private details' } })
    });

    await assert.rejects(client.probe(), error => {
      assert.equal(error.code, 'MODELSCOPE_ACCESS_DENIED');
      assert.equal(error.status, 502);
      assert.doesNotMatch(error.message, /test-token|Bearer/i);
      assert.doesNotMatch(JSON.stringify(error), /test-token|Bearer/i);
      return true;
    });
  });
}

test('maps a 429 without leaking the upstream body', async () => {
  const client = createModelScopeClient({
    token: 'test-token',
    fetchImpl: async () => response(429, { private: 'Bearer test-token' })
  });

  await assert.rejects(client.probe(), error => {
    assert.equal(error.code, 'MODELSCOPE_QUOTA_UNAVAILABLE');
    assert.equal(error.status, 429);
    assert.doesNotMatch(JSON.stringify(error), /test-token|Bearer/i);
    return true;
  });
});

test('maps an upstream server failure', async () => {
  const client = createModelScopeClient({
    token: 'test-token',
    fetchImpl: async () => response(500, { error: 'private upstream details' })
  });

  await assert.rejects(client.probe(), error => {
    assert.equal(error.code, 'MODELSCOPE_UNAVAILABLE');
    assert.equal(error.status, 502);
    return true;
  });
});

test('maps aborts to a sanitized timeout', async () => {
  const client = createModelScopeClient({
    token: 'test-token',
    timeoutMs: 1,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })
  });

  await assert.rejects(client.probe(), error => {
    assert.equal(error.code, 'MODELSCOPE_TIMEOUT');
    assert.equal(error.status, 504);
    return true;
  });
});

test('maps invalid JSON and missing headers to safe public errors', async () => {
  const invalidJsonClient = createModelScopeClient({
    token: 'test-token',
    fetchImpl: async () => new Response('not-json', { status: 200, headers: quotaHeaders })
  });
  await assert.rejects(invalidJsonClient.probe(), error => error.code === 'MODELSCOPE_UNAVAILABLE');

  const missingHeadersClient = createModelScopeClient({
    token: 'test-token',
    fetchImpl: async () => response(200, { usage: {} })
  });
  await assert.rejects(missingHeadersClient.probe(), error => {
    assert.equal(error.code, 'INVALID_QUOTA_HEADERS');
    assert.equal(error.status, 502);
    return true;
  });
});

test('PublicAppError JSON contains only public fields', () => {
  const error = new PublicAppError('SAFE', 'Safe message.', 400, new Error('Bearer test-token'));
  assert.deepEqual(error.toJSON(), { code: 'SAFE', message: 'Safe message.' });
  assert.doesNotMatch(JSON.stringify(error), /test-token|Bearer/i);
});
