# Qwen Usage Checker Operations

This app is deliberately manual and stateless. The server keeps only a 60-second in-memory cache, while the browser stores up to 31 non-sensitive quota snapshots in `localStorage`.

## Rotate or replace the ModelScope token

1. Create or select the replacement token in ModelScope.
2. In the Replit App, open **Tools** → **Secrets**.
3. Edit `MODELSCOPE_TOKEN`, paste the replacement value, and save it.
4. Restart the development app. Republish the production app if Replit indicates the deployment still uses the previous secret version.
5. Open the dashboard and make one manual check. Do not paste or print the token in Shell, Console, logs, Git, or browser storage.
6. Revoke the previous token in ModelScope after the replacement succeeds.

If a token is revoked before replacement, the app returns the safe `MODELSCOPE_ACCESS_DENIED` error. Add a valid replacement secret and retry once.

## Keep Replit Core usage low

1. Open the Replit account menu and select **Usage** or **Billing**.
2. Review the current billing-cycle credit balance and the **Publishing** or deployment category.
3. Open **Usage limits** or **Budgets** and set the strictest available limit at or below the included Core credits. Prefer a hard spending limit; otherwise configure an alert before the included credits are exhausted.
4. In the App editor, open **Publishing** and select the production deployment.
5. Confirm **Deployment type** is **Autoscale**.
6. Open machine settings, choose the lowest machine size that runs the Node server reliably, and set **Maximum machines** to `1`.
7. Confirm the deployment reports that it can scale to zero while idle.

Autoscale is request-billed and can scale to zero, so the dashboard creates no compute use while idle. Replit's current billing controls and labels may change; record the exact option visible in the account when configuring it. See the official [Publishing costs](https://docs.replit.com/billing/deployment-pricing), [Autoscale Deployments](https://docs.replit.com/cloud-services/deployments/autoscale-deployments), and [usage-based billing](https://docs.replit.com/billing/about-usage-based-billing) documentation.

## Confirm private access

1. In **Publishing**, open the deployment's access settings.
2. Choose **Only you** when available. If the workspace UI exposes **Workspace only**, use it only when the workspace has no other members who should be excluded.
3. Save the setting.
4. Verify the dashboard while signed in.
5. Verify the same URL from a signed-out or cookie-free request; it must redirect to Replit login or deny access.

Do not make the app public to simplify testing. Replit documents **Only you** and **Workspace only** as private deployment modes; use the narrowest visible choice.

## Review logs safely

1. Open the deployment in **Publishing** and select **Logs**.
2. Look only for method, path, status, duration, and public error code.
3. Stop and rotate the token if logs ever show an authorization header or credential-shaped value.
4. Do not add request-body, environment, or header logging while debugging.

The application logger intentionally excludes response bodies, environment variables, headers, and account identifiers.

## Verify after a change

Run locally or in Replit Shell:

```text
npm test
npm run verify:repo
```

For a production URL, run the non-probing verifier from a trusted shell:

```text
DEPLOYMENT_URL=https://your-private-app.example npm run verify:deployment
```

On PowerShell, set `DEPLOYMENT_URL` through the current process environment before running the command. The verifier performs only `GET` checks unless `ALLOW_LIVE_PROBE=1` is explicitly set. An unauthenticated private deployment may validly return a Replit login redirect or access denial.

## Dependencies and maintenance

There are currently no runtime or development npm dependencies. Node's built-in HTTP server, `fetch`, test runner, and browser APIs provide the full application. Before changing the Node major version, run all tests and verify the local dashboard. After any source change, run the repository verifier before pushing. The source repository may be public because it contains no credentials; keep the deployed application private.

## Expected ModelScope behavior

- The app reads the monthly request quota from `modelscope-ratelimit-model-month-requests-limit` and `modelscope-ratelimit-model-month-requests-remaining`.
- ModelScope does not currently expose a fixed daily Qwen Ambassador allowance in these response headers.
- Every uncached check consumes one ModelScope request.
- A successful result is cached for exactly 60 seconds; page loads and health checks consume none.
- Missing quota headers produce `INVALID_QUOTA_HEADERS`; exhausted or rate-limited access produces `MODELSCOPE_QUOTA_UNAVAILABLE`; upstream timeouts produce `MODELSCOPE_TIMEOUT`.
