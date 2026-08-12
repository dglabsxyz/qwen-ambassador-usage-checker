import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotaService } from '../src/quota-service.js';

function result(remaining = 90) {
  return {
    limit: 100,
    remaining,
    used: 100 - remaining,
    usedPercent: 100 - remaining,
    checkedAt: '2026-08-12T12:00:00.000Z',
    cached: false,
    probeTokens: { prompt: 1, completion: 1, total: 2 }
  };
}

test('caches successful results for exactly 60 seconds', async () => {
  let clock = 0;
  let calls = 0;
  const service = createQuotaService({
    now: () => clock,
    ttlMs: 60_000,
    probe: async () => {
      calls += 1;
      return result(100 - calls);
    }
  });

  const first = await service.check();
  clock = 59_999;
  const cached = await service.check();
  clock = 60_000;
  const refreshed = await service.check();

  assert.equal(calls, 2);
  assert.equal(first.cached, false);
  assert.equal(cached.cached, true);
  assert.equal(cached.remaining, first.remaining);
  assert.equal(refreshed.cached, false);
  assert.notEqual(refreshed.remaining, first.remaining);
});

test('coalesces simultaneous checks into one probe', async () => {
  let calls = 0;
  let resolveProbe;
  const probePromise = new Promise(resolve => { resolveProbe = resolve; });
  const service = createQuotaService({
    probe: async () => {
      calls += 1;
      return probePromise;
    }
  });

  const first = service.check();
  const second = service.check();
  resolveProbe(result());

  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
});

test('does not cache failed probes', async () => {
  let calls = 0;
  const service = createQuotaService({
    probe: async () => {
      calls += 1;
      if (calls === 1) throw new Error('failed');
      return result();
    }
  });

  await assert.rejects(service.check(), /failed/);
  assert.equal((await service.check()).cached, false);
  assert.equal(calls, 2);
});

test('returns clones so callers cannot mutate the cache', async () => {
  const service = createQuotaService({ probe: async () => result() });
  const first = await service.check();
  first.remaining = 0;
  first.probeTokens.total = 999;

  const cached = await service.check();
  assert.equal(cached.remaining, 90);
  assert.equal(cached.probeTokens.total, 2);
});
