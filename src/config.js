export const MODEL_ID = 'Qwen-Ambassador/Qwen3.8-Max';
export const MODELSCOPE_URL = 'https://api-inference.modelscope.ai/v1/chat/completions';
export const CACHE_TTL_MS = 60_000;
export const UPSTREAM_TIMEOUT_MS = 20_000;
export const PORT = Number.parseInt(process.env.PORT || '3000', 10);
