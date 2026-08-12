# Qwen Ambassador Usage Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, publish, and verify a low-cost private Replit web app, backed by a shareable public source repository, that reads the live monthly request quota for `Qwen-Ambassador/Qwen3.8-Max`, then deliver a screenshot-based standalone HTML guide that teaches the verified setup.

**Architecture:** A zero-runtime-dependency Node.js server will serve a vanilla HTML/CSS/JavaScript dashboard and a same-origin `POST /api/quota` endpoint. The endpoint will read `MODELSCOPE_TOKEN` only from the server environment, make one minimal ModelScope inference request, normalize the two confirmed monthly quota headers, and cache the result in memory for 60 seconds. Replit Autoscale will host the app with private Replit-login access, one maximum server, no database, and scale-to-zero behavior; GitHub will hold only non-secret source.

**Tech Stack:** Node.js 22+, built-in `node:http`, built-in `fetch`, built-in `node:test`, ES modules, vanilla HTML/CSS/JavaScript, GitHub, Replit Autoscale, Replit Secrets, Chrome-based deployment verification, standalone HTML documentation with embedded WebP screenshots.

## Global Constraints

- The only supported model is `Qwen-Ambassador/Qwen3.8-Max`.
- The only upstream API endpoint is `https://api-inference.modelscope.ai/v1/chat/completions`.
- Read quota from `modelscope-ratelimit-model-month-requests-limit` and `modelscope-ratelimit-model-month-requests-remaining`.
- Every uncached manual check consumes one ModelScope request; page loads, health checks, and asset requests must consume none.
- Store the credential only as the server-side Replit secret `MODELSCOPE_TOKEN`; never place it in Git, HTML, browser JavaScript, browser storage, screenshots, responses, or logs.
- Use a Replit Autoscale deployment, lowest suitable machine size, maximum one server, scale to zero, private access restricted to the owner's Replit login, and strict spending controls.
- Use no runtime npm dependencies, database, scheduled task, background worker, WebSocket, analytics, external font, or third-party browser script.
- Cache successful quota responses for exactly 60 seconds and prevent concurrent duplicate probes.
- Browser history is non-sensitive, device-local, and stored only in `localStorage`.
- Maintain `work/action-log.md` throughout execution and capture only redacted, reproducible screenshots in `work/guide/screenshots/`.
- Deliver the final portable guide at `outputs/qwen-usage-checker-guide.html` with embedded optimized screenshots.
- Use test-driven development for application behavior and verify before claiming completion.

## Planned File Structure

```text
.
├── .gitignore                         # Secret, temporary, coverage, and guide-source exclusions
├── .replit                            # Replit run command and deployment entry point
├── package.json                       # Node version, scripts, and zero runtime dependencies
├── README.md                          # Project purpose and safe local/deployment setup
├── src/
│   ├── config.js                      # Immutable model, endpoint, cache, and timeout constants
│   ├── quota.js                       # Header parsing and normalized quota calculation
│   ├── modelscope-client.js           # Minimal upstream request and sanitized error mapping
│   ├── quota-service.js               # Cache and in-flight request coalescing
│   ├── http-app.js                    # Routes, static serving, JSON helpers, security headers
│   └── server.js                      # Environment validation and HTTP listener startup
├── public/
│   ├── index.html                     # Accessible dashboard structure
│   ├── styles.css                     # Responsive local-only visual design
│   ├── history.js                     # Pure local history normalization and retention functions
│   └── app.js                         # UI states, POST action, rendering, localStorage integration
├── test/
│   ├── quota.test.js                  # Quota header parsing tests
│   ├── modelscope-client.test.js      # Upstream request and error sanitation tests
│   ├── quota-service.test.js          # Cache and concurrent request tests
│   ├── http-app.test.js               # Route, method, headers, and secret-leak tests
│   └── history.test.js                # Browser-history pure function tests
├── scripts/
│   ├── verify-repository.mjs          # Secret-pattern and required-file audit
│   ├── verify-deployment.mjs          # Public/private endpoint and no-probe-on-GET checks
│   ├── optimize-screenshots.mjs       # Screenshot metadata/redaction guard and WebP conversion
│   └── build-guide.mjs                # Embed approved screenshots into one portable HTML guide
├── docs/
│   └── operations.md                  # Token rotation, cost controls, and maintenance
└── work/
    ├── action-log.md                  # Chronological click/action/evidence record
    └── guide/
        ├── guide-content.json         # Structured verified instructions and screenshot captions
        └── screenshots/               # Raw/redacted screenshots excluded from Git
```

---

### Task 1: Establish the secure zero-dependency project baseline

**Files:**
- Create: `.gitignore`
- Create: `.replit`
- Create: `package.json`
- Create: `README.md`
- Create: `src/config.js`
- Create: `work/action-log.md`
- Modify: `docs/superpowers/specs/2026-08-11-qwen-usage-checker-design.md` only if implementation discovers a contradiction

**Interfaces:**
- Produces: `MODEL_ID`, `MODELSCOPE_URL`, `CACHE_TTL_MS`, `UPSTREAM_TIMEOUT_MS`, and `PORT` exports from `src/config.js`.
- Produces: npm scripts `start`, `test`, `test:watch`, `verify:repo`, `verify:deployment`, `screenshots:optimize`, and `guide:build`.

- [ ] **Step 1: Record the implementation start in the action log**

Create `work/action-log.md` with this exact structure and append one row after every meaningful terminal or browser action:

```markdown
# Qwen Usage Checker Action Log

| # | Time (ET) | Surface | Action | Selection/Input | Observed Result | Evidence |
|---:|---|---|---|---|---|---|
| 1 | 2026-08-12 | Codex workspace | Began implementation from approved design | Commit `4e4c6d1` | Clean source baseline confirmed | `git status --short` |

## Redaction rules

- Never record token values, authorization headers, email addresses, or unrelated tabs.
- Replace account-specific identifiers in teaching text with neutral labels.
- Capture screenshots only after secret fields are masked or outside the viewport.
```

- [ ] **Step 2: Add ignore rules before any secret can enter the worktree**

Create `.gitignore`:

```gitignore
node_modules/
coverage/
.env
.env.*
!.env.example
.dev.vars*
npm-debug.log*
work/guide/screenshots/
work/guide/generated/
outputs/
```

- [ ] **Step 3: Add package and Replit configuration**

Create `package.json`:

```json
{
  "name": "qwen-ambassador-usage-checker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test --test-reporter=spec",
    "test:watch": "node --test --watch",
    "verify:repo": "node scripts/verify-repository.mjs",
    "verify:deployment": "node scripts/verify-deployment.mjs",
    "screenshots:optimize": "node scripts/optimize-screenshots.mjs",
    "guide:build": "node scripts/build-guide.mjs"
  }
}
```

Create `.replit`:

```toml
run = "npm start"

[[ports]]
localPort = 3000
externalPort = 80
```

- [ ] **Step 4: Add immutable application configuration**

Create `src/config.js`:

```js
export const MODEL_ID = 'Qwen-Ambassador/Qwen3.8-Max';
export const MODELSCOPE_URL = 'https://api-inference.modelscope.ai/v1/chat/completions';
export const CACHE_TTL_MS = 60_000;
export const UPSTREAM_TIMEOUT_MS = 20_000;
export const PORT = Number.parseInt(process.env.PORT || '3000', 10);
```

- [ ] **Step 5: Document safe startup without including a real token**

Create `README.md` with: purpose; prerequisites; the `MODELSCOPE_TOKEN` environment requirement without showing any token-shaped example; `npm test`; `npm run verify:repo`; Replit Autoscale/private-access summary; statement that each uncached check consumes one request; statement that no token belongs in Git. Direct local developers to set the environment variable through their operating-system secret workflow and clear it after use.

- [ ] **Step 6: Verify the baseline**

Run: `node --version; npm test; git diff --check; git status --short`

Expected: Node 22 or later; the test command exits successfully with zero tests; no whitespace errors; only intended files are untracked.

- [ ] **Step 7: Commit the baseline**

```powershell
git add .gitignore .replit package.json README.md src/config.js work/action-log.md
git commit -m "chore: establish secure Qwen checker baseline"
```

---

### Task 2: Parse and normalize ModelScope quota headers

**Files:**
- Create: `src/quota.js`
- Create: `test/quota.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Consumes: the standard `Headers` interface or a plain lower-case-key object.
- Produces: `parseQuotaHeaders(headers, checkedAt): QuotaSnapshot` where `QuotaSnapshot` has `limit`, `remaining`, `used`, `usedPercent`, `checkedAt`, and `cached`.

- [ ] **Step 1: Write failing happy-path and validation tests**

Create `test/quota.test.js` covering exact values `5500`, `5441`, `59`, and `1.07`; clamping a negative remaining value; rejecting missing headers; rejecting non-integer headers; and rejecting `remaining > limit`. Use `assert.deepEqual` and `assert.throws` from `node:assert/strict`.

The primary test must assert:

```js
const snapshot = parseQuotaHeaders(new Headers({
  'modelscope-ratelimit-model-month-requests-limit': '5500',
  'modelscope-ratelimit-model-month-requests-remaining': '5441'
}), '2026-08-12T12:00:00.000Z');

assert.deepEqual(snapshot, {
  limit: 5500,
  remaining: 5441,
  used: 59,
  usedPercent: 1.07,
  checkedAt: '2026-08-12T12:00:00.000Z',
  cached: false
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/quota.test.js`

Expected: FAIL because `src/quota.js` does not exist.

- [ ] **Step 3: Implement strict quota parsing**

Create `src/quota.js` with constants for the two header names, a private integer parser, support for `Headers#get` and plain objects, and:

```js
export function parseQuotaHeaders(headers, checkedAt = new Date().toISOString()) {
  const limit = readPositiveInteger(headers, LIMIT_HEADER);
  const remaining = readNonNegativeInteger(headers, REMAINING_HEADER);
  if (remaining > limit) throw new QuotaHeaderError('Remaining quota exceeds the monthly limit.');
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
```

Export `QuotaHeaderError` with the stable code `INVALID_QUOTA_HEADERS`. Do not include raw header values in error messages.

- [ ] **Step 4: Run the focused and full tests**

Run: `node --test test/quota.test.js; npm test`

Expected: all quota tests PASS.

- [ ] **Step 5: Record evidence and commit**

Append the test command and pass count to `work/action-log.md`, then:

```powershell
git add src/quota.js test/quota.test.js work/action-log.md
git commit -m "feat: parse ModelScope monthly quota headers"
```

---

### Task 3: Implement the minimal ModelScope client with sanitized failures

**Files:**
- Create: `src/modelscope-client.js`
- Create: `test/modelscope-client.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Consumes: `{ token, fetchImpl, now, timeoutMs }` constructor options.
- Produces: `createModelScopeClient(options).probe(): Promise<QuotaResult>`.
- Produces: `QuotaResult = QuotaSnapshot & { probeTokens: { prompt, completion, total } }`.
- Produces: `PublicAppError` with stable `code`, safe `message`, and HTTP `status`.

- [ ] **Step 1: Write failing request-shape tests**

Use an injected fake `fetchImpl` and assert exactly one call to `MODELSCOPE_URL` with `POST`, `Authorization: Bearer test-token`, JSON content type, `stream: false`, `max_tokens: 1`, the configured model ID, and one short user message. Assert that the returned object includes parsed quota and normalized token usage.

- [ ] **Step 2: Write failing sanitized-error tests**

Cover missing token, 401/403 authentication or model access, 429 quota/rate limit, upstream 500, timeout/abort, invalid JSON, and missing headers. For every case, assert `JSON.stringify(error)` and `error.message` do not contain `test-token`, raw authorization values, or upstream response bodies.

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `node --test test/modelscope-client.test.js`

Expected: FAIL because the client module does not exist.

- [ ] **Step 4: Implement the client**

Create `src/modelscope-client.js` with an `AbortController`, the configured 20-second timeout, and this upstream body:

```js
{
  model: MODEL_ID,
  messages: [{ role: 'user', content: 'Reply with OK.' }],
  max_tokens: 1,
  stream: false
}
```

Map failures to these public codes and statuses:

```text
SERVER_NOT_CONFIGURED -> 503
MODELSCOPE_ACCESS_DENIED -> 502
MODELSCOPE_QUOTA_UNAVAILABLE -> 429
MODELSCOPE_TIMEOUT -> 504
MODELSCOPE_UNAVAILABLE -> 502
INVALID_QUOTA_HEADERS -> 502
```

Normalize absent usage fields to zero and clear the timeout in `finally`.

- [ ] **Step 5: Run tests and inspect output for leakage**

Run: `node --test test/modelscope-client.test.js; npm test`

Expected: all tests PASS; searching test output for `test-token` returns no application-generated occurrence.

- [ ] **Step 6: Commit the client**

```powershell
git add src/modelscope-client.js test/modelscope-client.test.js work/action-log.md
git commit -m "feat: add sanitized ModelScope quota client"
```

---

### Task 4: Add the 60-second cache and duplicate-probe protection

**Files:**
- Create: `src/quota-service.js`
- Create: `test/quota-service.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Consumes: `createQuotaService({ probe, now, ttlMs })`.
- Produces: `quotaService.check(): Promise<QuotaResult>`.
- Behavior: cached responses have `cached: true`; the original successful probe has `cached: false`.

- [ ] **Step 1: Write failing cache tests with a fake clock**

Test that the first call invokes `probe` once, a second call at 59,999 ms reuses the result with `cached: true`, and a call at 60,000 ms invokes `probe` again.

- [ ] **Step 2: Write failing concurrency and failure tests**

Test that two simultaneous `check()` calls share one in-flight probe; failed probes are not cached; and the last successful cache remains available only until its original expiry.

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `node --test test/quota-service.test.js`

Expected: FAIL because `src/quota-service.js` does not exist.

- [ ] **Step 4: Implement the service**

Use one closure-scoped `cachedResult`, `cachedAt`, and `inFlight`. Set `inFlight` before awaiting the probe and clear it in `finally`. Clone returned objects so callers cannot mutate the cache.

- [ ] **Step 5: Run tests and commit**

Run: `node --test test/quota-service.test.js; npm test`

Expected: all tests PASS.

```powershell
git add src/quota-service.js test/quota-service.test.js work/action-log.md
git commit -m "feat: cache and coalesce quota probes"
```

---

### Task 5: Build the secure HTTP application and static server

**Files:**
- Create: `src/http-app.js`
- Create: `src/server.js`
- Create: `test/http-app.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Consumes: `createHttpApp({ quotaService, publicDir, logger })`.
- Produces: a Node request listener for `http.createServer`.
- Routes: `GET /`, `GET /styles.css`, `GET /history.js`, `GET /app.js`, `GET /healthz`, and `POST /api/quota`.

- [ ] **Step 1: Write failing route and security-header tests**

Start the listener on an ephemeral local port. Assert `GET /` returns HTML without invoking `quotaService.check`; `GET /healthz` returns `{"ok":true}` without probing; `GET /api/quota` returns 405; unknown paths return 404; `POST /api/quota` invokes the service exactly once.

Assert all responses include:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store
```

- [ ] **Step 2: Write failing leak and body-limit tests**

Inject an error whose private cause contains a runtime-constructed fake bearer value. Assert the JSON response contains only `code` and safe `message`. Send a request body over 1 KiB and assert 413 without calling ModelScope.

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `node --test test/http-app.test.js`

Expected: FAIL because the HTTP application does not exist.

- [ ] **Step 4: Implement routes, safe MIME types, and JSON responses**

Serve only the four allowlisted public files; do not map arbitrary URL paths to filesystem paths. Return `{ ok: true }` from `/healthz`. Accept only a zero-length or `{}` JSON body for the quota endpoint. Log only request method, pathname, response status, duration, and public error code.

- [ ] **Step 5: Implement startup composition**

Create `src/server.js` to read `process.env.MODELSCOPE_TOKEN`, create the ModelScope client and quota service, bind to `0.0.0.0:${PORT}`, and handle `SIGTERM`/`SIGINT` with `server.close()`. Do not print environment variables.

- [ ] **Step 6: Run all tests and a secret-pattern search**

Run:

```powershell
npm test
rg -n "Authorization|MODELSCOPE_TOKEN|ms-[0-9a-f-]{20,}" src public test README.md .replit package.json
```

Expected: tests PASS; matches are limited to intentional environment-variable references, request construction, and test fixtures—never a real token.

- [ ] **Step 7: Commit the HTTP server**

```powershell
git add src/http-app.js src/server.js test/http-app.test.js work/action-log.md
git commit -m "feat: serve the private quota checker API"
```

---

### Task 6: Build browser-local history as a tested pure module

**Files:**
- Create: `public/history.js`
- Create: `test/history.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Produces: `normalizeHistory(value)`, `addHistoryEntry(history, result)`, and `HISTORY_LIMIT`.
- History entry fields: `checkedAt`, `limit`, `remaining`, `used`, and `usedPercent`; never probe tokens or credentials.

- [ ] **Step 1: Write failing history tests**

Cover invalid JSON-like input, validation of numeric fields, newest-first ordering, replacement of duplicate timestamps, retention capped at 31 snapshots, and no mutation of caller arrays.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/history.test.js`

Expected: FAIL because `public/history.js` does not exist.

- [ ] **Step 3: Implement the pure history functions**

Set `HISTORY_LIMIT = 31`, discard malformed entries, sort descending by ISO timestamp, and return fresh arrays/objects.

- [ ] **Step 4: Run tests and commit**

Run: `node --test test/history.test.js; npm test`

Expected: all tests PASS.

```powershell
git add public/history.js test/history.test.js work/action-log.md
git commit -m "feat: add browser-local quota history"
```

---

### Task 7: Implement the responsive dashboard and manual-check workflow

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`
- Modify: `test/http-app.test.js`
- Modify: `work/action-log.md`

**Interfaces:**
- Consumes: `POST /api/quota` response contract and history helpers.
- Produces: UI states `idle`, `loading`, `success`, `cached`, and `error` using accessible live regions.

- [ ] **Step 1: Extend HTTP tests to require UI assets and critical accessible labels**

Assert that `GET /` contains one `h1`, the model ID, button text `Check Usage`, note text `Each live check consumes one ModelScope request`, an `aria-live` status node, and module script `/app.js`. Assert CSS and JS routes have correct MIME types.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/http-app.test.js`

Expected: FAIL because UI assets do not exist.

- [ ] **Step 3: Create semantic HTML**

Build one main landmark containing: header; warning callout; action button; status live region; three quota metric cards; accessible progress element; last-check and cache badge; probe-token details; history table with a visually persistent empty state; and `Clear Local History` button. Do not include inline scripts or styles.

- [ ] **Step 4: Create a restrained responsive visual system**

Use system fonts, CSS custom properties, a dark navy/teal palette with high contrast, a max-width content shell, responsive metric grid, visible focus styles, reduced-motion support, and no remote assets. The layout must remain usable at 360 px width and 200% zoom.

- [ ] **Step 5: Implement the browser controller**

In `public/app.js`:

- Read history safely from the key `qwen-quota-history-v1`.
- Render the last saved snapshot on load without fetching.
- On button click, disable the button, set `aria-busy=true`, and call `fetch('/api/quota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })` exactly once.
- On success, render metrics, store a validated snapshot, and show whether it was cached.
- On error, retain the last successful metrics and show only the server's safe message.
- On clear, remove only `qwen-quota-history-v1` after a browser-native confirmation.
- Re-enable the button in `finally`.

- [ ] **Step 6: Run automated tests**

Run: `npm test; git diff --check`

Expected: all tests PASS and no whitespace errors.

- [ ] **Step 7: Run local browser verification using a fake upstream**

Add a temporary test-only Node launcher under `work/` that injects a fake quota service; do not commit it. Open the local app, verify idle/load/success/cache/error/history/clear states, 360 px viewport, keyboard focus order, and refresh-without-probe behavior. Record every browser action and observation in `work/action-log.md`.

- [ ] **Step 8: Capture the first safe dashboard screenshot**

Read the browser screenshot guidance before capture. Save a screenshot with fake quota data to `work/guide/screenshots/01-local-dashboard.png`; inspect it and verify it contains no token, email, unrelated tab, or account identifier.

- [ ] **Step 9: Commit the dashboard**

```powershell
git add public/index.html public/styles.css public/app.js test/http-app.test.js work/action-log.md
git commit -m "feat: add the Qwen quota dashboard"
```

---

### Task 8: Add repository, deployment, and secret-safety verification scripts

**Files:**
- Create: `scripts/verify-repository.mjs`
- Create: `scripts/verify-deployment.mjs`
- Create: `docs/operations.md`
- Modify: `README.md`
- Modify: `work/action-log.md`

**Interfaces:**
- `npm run verify:repo` exits nonzero on a suspected secret or missing required file.
- `DEPLOYMENT_URL=https://... npm run verify:deployment` checks the deployed public contract without possessing the ModelScope token.

- [ ] **Step 1: Write the repository verifier**

The script must use only Node built-ins, enumerate tracked files via `git ls-files -z`, reject filenames matching `.env*` or `.dev.vars*`, reject content matching `Bearer\s+[A-Za-z0-9._-]{16,}` or `ms-[0-9a-f-]{20,}`, confirm all planned runtime files exist, and print only filenames and rule names—not matched secret text.

- [ ] **Step 2: Run the verifier against a controlled failing fixture**

Create an ignored temporary fixture in `work/` and exercise the scanner's exported content-check function from a Node test invocation. Confirm it reports the rule without echoing the fixture value, then remove the fixture using `Remove-Item -LiteralPath` after verifying its resolved path is inside `work/`.

- [ ] **Step 3: Write the deployment verifier**

The script must:

- Require an HTTPS `DEPLOYMENT_URL`.
- `GET /healthz` and `GET /` without ModelScope credentials.
- Verify security headers and the dashboard warning text.
- Reject any response containing `MODELSCOPE_TOKEN`, `Authorization: Bearer`, or a token-shaped `ms-...` value.
- Accept either a Replit authentication redirect/login response for an unauthenticated private URL or a 200 when the supplied verification environment already has authorized access; print which condition occurred.
- Never invoke `POST /api/quota` unless `ALLOW_LIVE_PROBE=1` is explicitly set.

- [ ] **Step 4: Document operations and cost controls**

Create `docs/operations.md` with exact procedures for token rotation, checking Replit usage, setting budget alerts/spend caps, confirming Autoscale/max-one-server, reviewing logs safely, replacing a revoked token, and updating dependencies (currently none). Add links from `README.md`.

- [ ] **Step 5: Run verification and commit**

Run: `npm test; npm run verify:repo; git diff --check`

Expected: all commands PASS.

```powershell
git add scripts/verify-repository.mjs scripts/verify-deployment.mjs docs/operations.md README.md work/action-log.md
git commit -m "test: add deployment and secret safety checks"
```

---

### Task 9: Create and publish the GitHub repository with evidence

**Files:**
- Modify: `work/action-log.md`
- Create screenshots: `work/guide/screenshots/02-github-repository.png`, `03-github-security-check.png`

**Interfaces:**
- Produces: one GitHub repository URL and an `origin` remote.
- Consumes: the complete locally verified Git history.

- [ ] **Step 1: Run the pre-publication gate**

Run:

```powershell
npm test
npm run verify:repo
git status --short
git log --oneline --decorate -10
```

Expected: tests and secret scan PASS; only ignored screenshots and user-facing `outputs/` files are outside source control; commits are focused and descriptive.

- [ ] **Step 2: Inspect the user's existing GitHub session without changing state**

Open GitHub in the explicitly selected Chrome session, confirm the signed-in account and repository-name availability, and record the visible navigation steps. Do not capture an account menu, email, or token.

- [ ] **Step 3: Create the repository after confirming the exact mutation in the action log**

Use the repository name `qwen-ambassador-usage-checker`, public visibility, no generated README, no generated `.gitignore`, and no generated license. Record: GitHub home → **New repository** → name → **Public** → **Create repository**. The public source must pass the repository and Git-history credential scans before creation.

- [ ] **Step 4: Add the remote and push**

Resolve the exact repository URL from the authenticated GitHub account after browser creation, then add it as the remote:

```powershell
$qwenRepoUrl = gh repo view qwen-ambassador-usage-checker --json url -q .url
if (-not $qwenRepoUrl) { throw 'GitHub did not return the new repository URL.' }
git remote add origin $qwenRepoUrl
git branch -M main
git push -u origin main
```

Compare `$qwenRepoUrl` with the visible browser address before pushing; never guess the owner or URL.

- [ ] **Step 5: Verify the remote repository**

Confirm the default branch is `main`, repository visibility is Public, source files render, Actions/secrets are not required, and GitHub's code search returns no result for credential assignments or token-shaped values.

- [ ] **Step 6: Capture redacted GitHub evidence**

Capture repository overview and the clean secret-search result. Crop to the content area and save the two named screenshots. Inspect both images before proceeding.

---

### Task 10: Import into Replit and configure the private low-cost deployment

**Files:**
- Modify: `work/action-log.md`
- Create screenshots: `work/guide/screenshots/04-replit-import.png` through `09-replit-spending-controls.png`

**Interfaces:**
- Consumes: the public GitHub repository and the user's existing Replit login.
- Produces: one private Replit app and one private Autoscale deployment URL.

- [ ] **Step 1: Import the GitHub repository**

In Replit, record and perform: README → **Run on Replit** → confirm the public GitHub source → import. Capture the imported file tree without opening any token-related settings.

- [ ] **Step 2: Run tests in Replit before adding the real secret**

Open Replit Shell and run `npm test` followed by `npm run verify:repo`. Confirm both pass. Capture the result with only command names and pass summaries visible.

- [ ] **Step 3: Add the ModelScope token through Replit Secrets**

Open **Tools → Secrets**, add key `MODELSCOPE_TOKEN`, and enter the current ModelScope token. Do not record, copy into the action log, expose, screenshot, print, or inspect the value after entry. Capture only the post-save secret-name list where the value is masked/hidden.

- [ ] **Step 4: Run the app and perform one live check in the development preview**

Press **Run**, open the preview, confirm page load performs no check, then press **Check Usage** exactly once. Verify the response displays limit, used, remaining, timestamp, and probe token count. Record the visible numbers but no credentials. Capture the working dashboard.

- [ ] **Step 5: Configure Autoscale publishing**

Open **Publish/Deploy** and select:

```text
Deployment type: Autoscale
Run command: npm start
Machine size: lowest available suitable size
Maximum servers: 1
Access: Workspace only or Invite only, whichever visibly restricts access solely to the owner
```

Capture the Autoscale, machine/max-server, and private-access settings as separate cropped screenshots.

- [ ] **Step 6: Configure spending protection**

Open Replit account/workspace billing controls and set the strictest available spend cap or usage alert that prevents or warns before usage exceeds the included Core credits. Prefer a hard cap at included-credit exhaustion if available. Record the exact option Replit exposes and capture it without payment details.

- [ ] **Step 7: Publish and record the exact deployment URL**

Publish the app, wait for success, and copy only the deployment URL into `work/action-log.md`. Do not make the deployment public to bypass access checks.

---

### Task 11: Verify the deployed behavior, privacy, caching, and cost posture

**Files:**
- Modify: `work/action-log.md`
- Create screenshots: `work/guide/screenshots/10-live-dashboard.png`, `11-private-access.png`, `12-autoscale-summary.png`

**Interfaces:**
- Consumes: the private deployment URL.
- Produces: recorded verification evidence and final live quota values.

- [ ] **Step 1: Run non-probing deployment verification**

Set `DEPLOYMENT_URL` to the exact Replit URL and run `npm run verify:deployment` without `ALLOW_LIVE_PROBE`. Confirm the page/health behavior and security headers while ensuring no ModelScope request is made.

- [ ] **Step 2: Verify signed-in private access**

Open the deployment while signed in to Replit. Confirm the dashboard loads and browser storage contains only `qwen-quota-history-v1`, with no credential-shaped values.

- [ ] **Step 3: Verify one live request and the 60-second cache**

Press **Check Usage** once and record the result. Press it once more within 60 seconds and verify the UI marks the second result as cached and the remaining ModelScope count does not decrement again. Do not make additional live checks unless a failed verification requires one documented retry.

- [ ] **Step 4: Verify unauthenticated access protection**

Use a cookie-free HTTP request or a signed-out browser context without copying cookies or session data. Confirm Replit redirects to authentication or denies access. Capture the generic login/access screen with account identifiers excluded.

- [ ] **Step 5: Verify Git and runtime secret safety**

Run:

```powershell
npm test
npm run verify:repo
git grep -n -E "ms-[0-9a-f-]{20,}|Bearer [A-Za-z0-9._-]{16,}" $(git rev-list --all)
git status --short
```

Expected: tests and verifier PASS; Git history search returns no real token; only approved deliverables are untracked/ignored.

- [ ] **Step 6: Verify Replit resource configuration**

Reopen deployment settings and confirm Autoscale, lowest suitable machine, maximum one server, private access, and spending controls. Capture the summary.

- [ ] **Step 7: Capture and inspect final live evidence**

Capture the live dashboard, private-access result, and Autoscale summary. Inspect every screenshot at original resolution for secrets, emails, payment details, unrelated tabs, notification content, and other identifiers. Recrop or redact before approving it for the guide.

---

### Task 12: Build and verify the standalone screenshot-based HTML guide

**Files:**
- Create: `work/guide/guide-content.json`
- Create: `scripts/optimize-screenshots.mjs`
- Create: `scripts/build-guide.mjs`
- Create: `outputs/qwen-usage-checker-guide.html`
- Modify: `work/action-log.md`

**Interfaces:**
- `guide-content.json` maps ordered action-log steps to headings, instructions, expected results, warnings, and approved screenshot filenames.
- `scripts/build-guide.mjs` produces one self-contained HTML file with inline CSS and `data:image/webp;base64,...` images.

- [ ] **Step 1: Create the structured guide content from verified evidence**

Include these sections in order: overview; architecture; prerequisites; create GitHub repository; import into Replit; run tests; add secret; configure private access; configure Autoscale and one-server maximum; configure spending controls; publish; run a manual quota check; interpret limit/used/remaining; verify cache; verify privacy; rotate the token; monitor Core usage; troubleshoot authentication, missing headers, quota exhaustion, timeout, and deployment wake-up; teach-another-user checklist.

Each procedural item must contain: step number, exact visible control label, action, non-secret selection/input, expected result, screenshot reference, and a note when the live UI differed from documentation.

- [ ] **Step 2: Implement screenshot optimization and safety checks**

Use the bundled workspace image runtime discovered by `codex_app__load_workspace_dependencies`. The optimizer must convert approved screenshots to WebP at a readable maximum width, strip metadata, and fail if the filename is not explicitly referenced by `guide-content.json`. Before conversion, manually inspect every source image; automated pixel OCR is supplementary and not a substitute for inspection.

- [ ] **Step 3: Implement the guide builder**

Generate accessible semantic HTML with a table of contents, numbered steps, figure captions, warning/callout styles, print stylesheet, responsive images, keyboard-visible links, and an appendix containing the verified response header names. Escape all content before interpolation. Embed screenshots as data URLs and include no external network resources.

- [ ] **Step 4: Build the guide**

Run:

```powershell
npm run screenshots:optimize
npm run guide:build
```

Expected: `outputs/qwen-usage-checker-guide.html` is created as one portable file and the builder reports the number of embedded screenshots.

- [ ] **Step 5: Run sensitive-data scans on the deliverable**

Run a script-based scan over the HTML and decoded embedded-image OCR output for token shapes, `Authorization`, email-address patterns, local absolute paths, payment-card patterns, and unrelated site titles. Any match must be manually reviewed and removed before continuing.

- [ ] **Step 6: Visually verify the guide**

Open the HTML in a browser and inspect at desktop width, 360 px width, and print preview. Follow the guide from beginning to end against the live app/repository without performing another quota probe. Verify screenshots are legible, ordered, correctly captioned, and fully embedded.

- [ ] **Step 7: Final project verification**

Run:

```powershell
npm test
npm run verify:repo
git diff --check
git status --short
```

Expected: all tests and scans PASS; source changes are understood; the output guide exists and contains no secret.

- [ ] **Step 8: Commit source and documentation generators**

Do not commit `outputs/` or raw screenshots. Commit the guide content only after removing account-specific details:

```powershell
git add scripts/optimize-screenshots.mjs scripts/build-guide.mjs work/guide/guide-content.json work/action-log.md
git commit -m "docs: add verified Replit setup guide generator"
git push origin main
```

- [ ] **Step 9: Perform the completion review**

Confirm all completion criteria from the design: tests pass; private deployment works; values derive from confirmed headers; page load does not probe; duplicate checks cache; Git contains no secret; Replit cost controls are configured; and the standalone HTML guide accurately reproduces the verified process.
