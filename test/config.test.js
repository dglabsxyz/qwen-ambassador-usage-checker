import test from 'node:test';
import assert from 'node:assert/strict';

test('exports the fixed ModelScope endpoint and conservative runtime limits', async () => {
  const config = await import('../src/config.js');

  assert.equal(config.MODEL_ID, 'Qwen-Ambassador/Qwen3.8-Max');
  assert.equal(config.MODELSCOPE_URL, 'https://api-inference.modelscope.ai/v1/chat/completions');
  assert.equal(config.CACHE_TTL_MS, 60_000);
  assert.equal(config.UPSTREAM_TIMEOUT_MS, 20_000);
  assert.equal(config.PORT, 3000);
});
