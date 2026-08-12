export const HISTORY_LIMIT = 31;

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.checkedAt !== 'string' || Number.isNaN(Date.parse(value.checkedAt))) return null;
  for (const key of ['limit', 'remaining', 'used', 'usedPercent']) {
    if (!isFiniteNonNegative(value[key])) return null;
  }
  if (value.remaining > value.limit || value.used > value.limit) return null;
  return {
    checkedAt: value.checkedAt,
    limit: value.limit,
    remaining: value.remaining,
    used: value.used,
    usedPercent: value.usedPercent
  };
}

export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeEntry)
    .filter(Boolean)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, HISTORY_LIMIT)
    .map(item => ({ ...item }));
}

export function addHistoryEntry(history, result) {
  const entry = normalizeEntry(result);
  if (!entry) return normalizeHistory(history);
  const withoutDuplicate = normalizeHistory(history).filter(item => item.checkedAt !== entry.checkedAt);
  return normalizeHistory([entry, ...withoutDuplicate]);
}
