import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, addHistoryEntry, normalizeHistory } from '../public/history.js';

function entry(day, used = day) {
  return {
    checkedAt: `2026-08-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    limit: 100,
    remaining: 100 - used,
    used,
    usedPercent: used
  };
}

test('normalizes only valid history entries newest first', () => {
  const normalized = normalizeHistory([entry(1), { nope: true }, entry(3), null]);
  assert.deepEqual(normalized, [entry(3), entry(1)]);
  assert.deepEqual(normalizeHistory('not-an-array'), []);
});

test('adds entries without mutating the caller array', () => {
  const original = [entry(1)];
  const next = addHistoryEntry(original, entry(2));
  assert.deepEqual(original, [entry(1)]);
  assert.deepEqual(next, [entry(2), entry(1)]);
});

test('replaces duplicate timestamps', () => {
  const replacement = { ...entry(1), used: 9, remaining: 91, usedPercent: 9 };
  assert.deepEqual(addHistoryEntry([entry(1)], replacement), [replacement]);
});

test('retains at most 31 snapshots', () => {
  let history = [];
  for (let day = 1; day <= 40; day += 1) {
    const date = new Date(Date.UTC(2026, 6, day, 12)).toISOString();
    history = addHistoryEntry(history, { ...entry(1), checkedAt: date });
  }
  assert.equal(HISTORY_LIMIT, 31);
  assert.equal(history.length, 31);
});
