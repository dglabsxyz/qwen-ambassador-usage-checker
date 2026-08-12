import assert from 'node:assert/strict';
import test from 'node:test';

import {
  scanContent,
  scanTrackedFileNames
} from '../scripts/verify-repository.mjs';
import {
  classifyAccessResponse,
  findSensitiveResponseRule,
  validateDeploymentUrl,
  verifySecurityHeaders
} from '../scripts/verify-deployment.mjs';

test('repository scanner reports rule names without echoing secret values', () => {
  const bearerValue = `Bearer ${'a'.repeat(20)}`;
  const modelScopeValue = `ms-${'b'.repeat(24)}`;
  const findings = scanContent('fixture.txt', `${bearerValue}\n${modelScopeValue}`);

  assert.deepEqual(findings, [
    { file: 'fixture.txt', rule: 'bearer-token-pattern' },
    { file: 'fixture.txt', rule: 'modelscope-token-pattern' }
  ]);
  assert.doesNotMatch(JSON.stringify(findings), /a{16}|b{16}/);
});

test('repository scanner rejects tracked environment filenames', () => {
  assert.deepEqual(scanTrackedFileNames(['src/server.js', '.env.production', 'config/.dev.vars']), [
    { file: '.env.production', rule: 'tracked-secret-file' },
    { file: 'config/.dev.vars', rule: 'tracked-secret-file' }
  ]);
});

test('deployment URL must use HTTPS', () => {
  assert.equal(validateDeploymentUrl('https://quota.example.test').href, 'https://quota.example.test/');
  assert.throws(() => validateDeploymentUrl('http://quota.example.test'), /HTTPS/);
});

test('deployment response scanner identifies sensitive response patterns', () => {
  assert.equal(findSensitiveResponseRule('MODELSCOPE_TOKEN'), 'environment-variable-name');
  assert.equal(findSensitiveResponseRule(`Authorization: Bearer ${'x'.repeat(20)}`), 'authorization-header');
  assert.equal(findSensitiveResponseRule(`ms-${'f'.repeat(24)}`), 'modelscope-token-pattern');
  assert.equal(findSensitiveResponseRule('safe dashboard content'), null);
});

test('deployment verifier requires the complete security header contract', () => {
  const headers = new Headers({
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': 'no-store'
  });

  assert.deepEqual(verifySecurityHeaders(headers), []);
  headers.delete('x-frame-options');
  assert.deepEqual(verifySecurityHeaders(headers), ['x-frame-options']);
});

test('deployment access classification accepts private redirects and authorized pages', () => {
  assert.equal(classifyAccessResponse({ status: 200, url: 'https://quota.example.test/' }), 'authorized');
  assert.equal(classifyAccessResponse({ status: 302, url: 'https://replit.com/login' }), 'private-login');
  assert.equal(classifyAccessResponse({ status: 401, url: 'https://quota.example.test/' }), 'private-denied');
  assert.equal(classifyAccessResponse({ status: 503, url: 'https://quota.example.test/' }), 'unexpected');
});
