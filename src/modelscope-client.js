import { MODEL_ID, MODELSCOPE_URL, UPSTREAM_TIMEOUT_MS } from './config.js';
import { parseQuotaHeaders, QuotaHeaderError } from './quota.js';

export class PublicAppError extends Error {
  constructor(code, message, status, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PublicAppError';
    this.code = code;
    this.status = status;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

function publicError(code, message, status, cause) {
  return new PublicAppError(code, message, status, cause);
}

function normalizeTokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function checkedAtFrom(now) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function createModelScopeClient({
  token,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = UPSTREAM_TIMEOUT_MS
} = {}) {
  async function probe() {
    if (typeof token !== 'string' || token.trim() === '') {
      throw publicError(
        'SERVER_NOT_CONFIGURED',
        'The server is missing its ModelScope credential.',
        503
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetchImpl(MODELSCOPE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          max_tokens: 1,
          stream: false
        }),
        signal: controller.signal
      });

      if (upstream.status === 401 || upstream.status === 403) {
        throw publicError(
          'MODELSCOPE_ACCESS_DENIED',
          'ModelScope rejected the credential or model access.',
          502
        );
      }
      if (upstream.status === 429) {
        throw publicError(
          'MODELSCOPE_QUOTA_UNAVAILABLE',
          'ModelScope temporarily rejected the quota probe.',
          429
        );
      }
      if (!upstream.ok) {
        throw publicError(
          'MODELSCOPE_UNAVAILABLE',
          'ModelScope is temporarily unavailable.',
          502
        );
      }

      let body;
      try {
        body = await upstream.json();
      } catch (cause) {
        throw publicError(
          'MODELSCOPE_UNAVAILABLE',
          'ModelScope returned an unreadable response.',
          502,
          cause
        );
      }

      let quota;
      try {
        quota = parseQuotaHeaders(upstream.headers, checkedAtFrom(now));
      } catch (cause) {
        if (cause instanceof QuotaHeaderError) {
          throw publicError(
            'INVALID_QUOTA_HEADERS',
            'ModelScope did not return usable quota information.',
            502,
            cause
          );
        }
        throw cause;
      }

      return {
        ...quota,
        probeTokens: {
          prompt: normalizeTokenCount(body?.usage?.prompt_tokens),
          completion: normalizeTokenCount(body?.usage?.completion_tokens),
          total: normalizeTokenCount(body?.usage?.total_tokens)
        }
      };
    } catch (cause) {
      if (cause instanceof PublicAppError) throw cause;
      if (cause?.name === 'AbortError') {
        throw publicError(
          'MODELSCOPE_TIMEOUT',
          'ModelScope did not respond before the timeout.',
          504,
          cause
        );
      }
      throw publicError(
        'MODELSCOPE_UNAVAILABLE',
        'The server could not reach ModelScope.',
        502,
        cause
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return { probe };
}
