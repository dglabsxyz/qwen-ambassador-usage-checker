import { CACHE_TTL_MS } from './config.js';

function cloneResult(value, cached = value.cached) {
  return {
    ...value,
    cached,
    probeTokens: { ...value.probeTokens }
  };
}

export function createQuotaService({ probe, now = () => Date.now(), ttlMs = CACHE_TTL_MS }) {
  let cachedResult = null;
  let cachedAt = 0;
  let inFlight = null;

  async function check() {
    const currentTime = now();
    if (cachedResult && currentTime - cachedAt < ttlMs) {
      return cloneResult(cachedResult, true);
    }

    if (inFlight) return cloneResult(await inFlight);

    inFlight = (async () => {
      const fresh = await probe();
      cachedResult = cloneResult(fresh, false);
      cachedAt = now();
      return cloneResult(cachedResult, false);
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  return { check };
}
