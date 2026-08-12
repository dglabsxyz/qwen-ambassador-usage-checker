const LIMIT_HEADER = 'modelscope-ratelimit-model-month-requests-limit';
const REMAINING_HEADER = 'modelscope-ratelimit-model-month-requests-remaining';

export class QuotaHeaderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaHeaderError';
    this.code = 'INVALID_QUOTA_HEADERS';
  }
}

function getHeader(headers, name) {
  if (headers && typeof headers.get === 'function') return headers.get(name);
  return headers?.[name] ?? null;
}

function parseIntegerHeader(headers, name, { positive = false, clampAtZero = false } = {}) {
  const raw = getHeader(headers, name);
  if (typeof raw !== 'string' || !/^-?\d+$/.test(raw.trim())) {
    throw new QuotaHeaderError('ModelScope did not return valid monthly quota headers.');
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || (positive && value <= 0)) {
    throw new QuotaHeaderError('ModelScope did not return valid monthly quota headers.');
  }

  return clampAtZero ? Math.max(0, value) : value;
}

export function parseQuotaHeaders(headers, checkedAt = new Date().toISOString()) {
  const limit = parseIntegerHeader(headers, LIMIT_HEADER, { positive: true });
  const remaining = parseIntegerHeader(headers, REMAINING_HEADER, { clampAtZero: true });

  if (remaining > limit) {
    throw new QuotaHeaderError('Remaining quota exceeds the monthly limit.');
  }

  const used = limit - remaining;
  return {
    limit,
    remaining,
    used,
    usedPercent: Number(((used / limit) * 100).toFixed(2)),
    checkedAt,
    cached: false
  };
}
