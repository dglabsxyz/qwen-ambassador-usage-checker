import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ],
  'referrer-policy': ['no-referrer'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
  'permissions-policy': ['camera=()', 'microphone=()', 'geolocation=()'],
  'cache-control': ['no-store']
};

export function validateDeploymentUrl(value) {
  if (!value) throw new Error('DEPLOYMENT_URL is required.');
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('DEPLOYMENT_URL must use HTTPS.');
  return url;
}

export function findSensitiveResponseRule(content) {
  if (/MODELSCOPE_TOKEN/.test(content)) return 'environment-variable-name';
  if (/Authorization:\s*Bearer/i.test(content)) return 'authorization-header';
  if (/ms-[0-9a-f-]{20,}/i.test(content)) return 'modelscope-token-pattern';
  return null;
}

export function verifySecurityHeaders(headers) {
  const missing = [];
  for (const [name, expectedParts] of Object.entries(SECURITY_HEADERS)) {
    const value = headers.get(name) || '';
    if (!expectedParts.every((part) => value.includes(part))) missing.push(name);
  }
  return missing;
}

export function classifyAccessResponse({ status, url, location = '' }) {
  if (status === 200) return 'authorized';
  if (status === 401 || status === 403) return 'private-denied';
  const target = `${url || ''} ${location}`;
  if (status >= 300 && status < 400 && /(?:login|signin|auth|replit\.com)/i.test(target)) {
    return 'private-login';
  }
  return 'unexpected';
}

async function fetchWithoutFollowing(url, options = {}) {
  return fetch(url, { ...options, redirect: 'manual' });
}

async function inspectGet(baseUrl, pathname, { requireDashboard = false } = {}) {
  const target = new URL(pathname, baseUrl);
  const response = await fetchWithoutFollowing(target);
  const location = response.headers.get('location') || '';
  const access = classifyAccessResponse({ status: response.status, url: response.url, location });
  const body = await response.text();
  const sensitiveRule = findSensitiveResponseRule(`${body}\n${location}`);
  if (sensitiveRule) throw new Error(`${pathname} exposed forbidden response content: ${sensitiveRule}.`);

  if (access === 'authorized') {
    const missingHeaders = verifySecurityHeaders(response.headers);
    if (missingHeaders.length) {
      throw new Error(`${pathname} is missing security headers: ${missingHeaders.join(', ')}.`);
    }
    if (requireDashboard && !body.includes('Each live check consumes one ModelScope request')) {
      throw new Error('Dashboard warning text was not found.');
    }
    if (!requireDashboard && !body.includes('"ok":true')) {
      throw new Error('Health response did not contain the expected contract.');
    }
  } else if (access === 'unexpected') {
    throw new Error(`${pathname} returned unexpected status ${response.status}.`);
  }

  return access;
}

export async function verifyDeployment({
  deploymentUrl = process.env.DEPLOYMENT_URL,
  allowLiveProbe = process.env.ALLOW_LIVE_PROBE === '1'
} = {}) {
  const baseUrl = validateDeploymentUrl(deploymentUrl);
  const healthAccess = await inspectGet(baseUrl, '/healthz');
  const pageAccess = await inspectGet(baseUrl, '/', { requireDashboard: true });

  let probe = 'skipped';
  if (allowLiveProbe) {
    const response = await fetchWithoutFollowing(new URL('/api/quota', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const body = await response.text();
    const sensitiveRule = findSensitiveResponseRule(body);
    if (sensitiveRule) throw new Error(`Live probe exposed forbidden response content: ${sensitiveRule}.`);
    if (!response.ok) throw new Error(`Live probe returned status ${response.status}.`);
    probe = 'performed-once';
  }

  return { healthAccess, pageAccess, probe };
}

async function run() {
  try {
    const result = await verifyDeployment();
    console.log(`Deployment verification passed: health=${result.healthAccess}; page=${result.pageAccess}; live-probe=${result.probe}.`);
  } catch (error) {
    console.error(`Deployment verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await run();
}
