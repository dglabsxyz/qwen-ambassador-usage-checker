import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotaHeaders, QuotaHeaderError } from '../src/quota.js';

const limitHeader = 'modelscope-ratelimit-model-month-requests-limit';
const remainingHeader = 'modelscope-ratelimit-model-month-requests-remaining';

test('normalizes the confirmed monthly ModelScope quota headers', () => {
  const snapshot = parseQuotaHeaders(new Headers({
    [limitHeader]: '5500',
    [remainingHeader]: '5441'
  }), '2026-08-12T12:00:00.000Z');

  assert.deepEqual(snapshot, {
    limit: 5500,
    remaining: 5441,
    used: 59,
    usedPercent: 1.07,
    checkedAt: '2026-08-12T12:00:00.000Z',
    cached: false
  });
});

test('supports plain lower-case header objects', () => {
  const snapshot = parseQuotaHeaders({
    [limitHeader]: '100',
    [remainingHeader]: '75'
  });

  assert.equal(snapshot.used, 25);
  assert.equal(snapshot.usedPercent, 25);
});

test('clamps a negative remaining quota to zero', () => {
  const snapshot = parseQuotaHeaders(new Headers({
    [limitHeader]: '10',
    [remainingHeader]: '-2'
  }));

  assert.equal(snapshot.remaining, 0);
  assert.equal(snapshot.used, 10);
});

test('rejects missing quota headers without exposing values', () => {
  assert.throws(
    () => parseQuotaHeaders(new Headers()),
    (error) => error instanceof QuotaHeaderError && error.code === 'INVALID_QUOTA_HEADERS'
  );
});

test('rejects non-integer quota headers', () => {
  assert.throws(() => parseQuotaHeaders(new Headers({
    [limitHeader]: 'many',
    [remainingHeader]: '5'
  })), QuotaHeaderError);
});

test('rejects a remaining quota larger than the limit', () => {
  assert.throws(() => parseQuotaHeaders(new Headers({
    [limitHeader]: '5',
    [remainingHeader]: '6'
  })), /Remaining quota exceeds the monthly limit/);
});
