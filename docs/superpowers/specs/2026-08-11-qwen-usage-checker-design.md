# Qwen Ambassador Usage Checker Design

## Objective

Create a private, low-cost Replit web application that lets one authenticated Replit user manually check the live ModelScope API quota for `Qwen-Ambassador/Qwen3.8-Max` without exposing the ModelScope access token.

The completed project must also include a standalone HTML teaching guide. The guide will document the complete GitHub and Replit setup process with a chronological click-by-click procedure and screenshots captured during the verified deployment.

## Confirmed ModelScope behavior

A successful probe against `https://api-inference.modelscope.ai/v1/chat/completions` returned these authoritative headers:

- `modelscope-ratelimit-model-month-requests-limit`
- `modelscope-ratelimit-model-month-requests-remaining`

At the time of the probe, the monthly limit was 5,500 requests and the remaining count after the probe was 5,441. The checker calculates monthly usage as `limit - remaining`.

ModelScope does not expose the Qwen Ambassador quota through its account dashboard. Reading the live headers requires an inference request, so every manual quota check consumes one ModelScope request.

## Chosen architecture

Use one Replit Autoscale deployment connected to a GitHub repository.

The application consists of:

1. A small server-side application that serves the UI and exposes one protected quota-check endpoint.
2. A static browser interface served by the same application.
3. Replit Secrets for the ModelScope access token.
4. Replit private deployment access restricted to the owner's Replit login.
5. Browser `localStorage` for non-sensitive check history.

The application will not use a database, scheduled deployment, background worker, WebSocket connection, Reserved VM, or client-side ModelScope credential.

## Request flow

1. The user signs in through Replit and opens the private deployment.
2. The initial page load displays the last locally saved result without contacting ModelScope.
3. The user presses **Check Usage**.
4. The browser sends a `POST` request to the application's `/api/quota` endpoint.
5. The server reads `MODELSCOPE_TOKEN` from the Replit environment.
6. The server sends one minimal, non-streaming inference request to `Qwen-Ambassador/Qwen3.8-Max`.
7. The server reads the two confirmed monthly quota headers and the response token-usage object.
8. The server returns only normalized quota values, probe token counts, and a timestamp.
9. The browser renders the result and saves a non-sensitive snapshot to `localStorage`.

## Server API contract

### `POST /api/quota`

Successful response:

```json
{
  "limit": 5500,
  "remaining": 5441,
  "used": 59,
  "usedPercent": 1.07,
  "probeTokens": {
    "prompt": 65,
    "completion": 26,
    "total": 91
  },
  "checkedAt": "2026-08-11T18:00:00.000Z",
  "cached": false
}
```

The endpoint must never return the ModelScope token, the full upstream response, upstream authorization headers, or unrestricted diagnostic output.

## Replit usage controls

- Use an Autoscale deployment, not a Reserved VM.
- Allow the deployment to scale to zero while idle.
- Configure the lowest suitable machine size.
- Set the maximum server count to one.
- Do not contact ModelScope on page load, refresh, health checks, or asset requests.
- Require an explicit button press for a quota probe.
- Cache a successful result in server memory for 60 seconds to prevent accidental double-clicks.
- Disable the button and show an in-progress state while a request is active.
- Apply a small server-side request throttle in addition to the cache.
- Use no Replit database or persistent server storage.
- Configure Replit budget alerts and the strictest available spending control that prevents paid overages beyond included Core credits.

The expected workload is approximately one short application execution and one ModelScope request per manual daily check. Actual Replit charges remain governed by the user's plan and Replit's current billing rules.

## Security design

- Store the ModelScope credential only as the Replit secret `MODELSCOPE_TOKEN`.
- Never commit `.env`, `.dev.vars`, tokens, screenshots containing tokens, or copied secret values.
- Restrict the deployment to the owner's Replit login using Replit's private Workspace-only or Invite-only access option.
- Keep the quota endpoint same-origin and accept only `POST`.
- Return sanitized error codes and messages.
- Add standard security headers suitable for the small application.
- Avoid third-party browser scripts, analytics, trackers, and external fonts.
- Do not place any secret or credential in browser storage.
- Redact account identifiers, token values, email addresses, and unrelated browser content from guide screenshots.

## Interface design

The interface is a single responsive page containing:

- Application title and the model name.
- A **Check Usage** button.
- Monthly limit, used requests, and remaining requests.
- A progress bar with the percentage used.
- The last successful check time.
- Probe prompt, completion, and total token counts.
- A clear note that every live check consumes one ModelScope request.
- A compact browser-local history table with date, used, remaining, and percentage.
- A **Clear Local History** control that affects only browser storage.
- Accessible status and error messages.

The history is device- and browser-specific. Cross-device history is explicitly out of scope because it would require persistent hosted storage.

## Error handling

The server will distinguish these cases without leaking upstream details:

- Missing server secret.
- Invalid or expired ModelScope token.
- Loss of access to the private Ambassador model.
- ModelScope rate limit or exhausted quota.
- Upstream timeout or network failure.
- Successful inference response with missing or invalid quota headers.
- Unexpected server failure.

The browser preserves the most recent successful result when a later check fails.

## GitHub and deployment workflow

- Maintain the source in a dedicated GitHub repository.
- Keep deployment configuration and non-secret documentation in version control.
- Connect or import the repository into Replit.
- Add `MODELSCOPE_TOKEN` through Replit Secrets after repository import.
- Publish as an Autoscale deployment with private Replit access.
- Set maximum servers to one and configure spending controls.
- Verify the live private URL while signed in and verify that unauthorized access is rejected.

## Test and verification strategy

Automated tests will cover:

- Parsing valid quota headers.
- Calculating used requests and percentages.
- Missing and malformed headers.
- Upstream authentication, quota, timeout, and generic errors.
- Secret non-disclosure in API responses.
- Sixty-second cache behavior and request throttling.
- Browser history serialization and clearing.
- UI rendering for success, loading, cached, and error states.

Deployment verification will confirm:

- The page requires the owner's Replit login.
- Opening or refreshing the page does not invoke ModelScope.
- One button press creates exactly one upstream probe.
- A repeated press within 60 seconds returns the cached value without another probe.
- Limit, remaining, and used values match the live response headers.
- No secret appears in page source, browser storage, network responses, logs, Git history, screenshots, or the final guide.
- The deployment scales down when idle and uses a maximum of one server.
- Replit spending controls are enabled.

## Action log and teaching guide

During implementation and deployment, maintain a chronological action log recording:

- The page or tool being used.
- Each meaningful navigation and button or menu selection.
- Values selected in configuration screens, excluding secrets.
- The observed result and verification evidence.
- Any deviation from the planned flow and its resolution.

Capture screenshots at meaningful reproducible checkpoints, including:

- GitHub repository creation and relevant repository settings.
- Replit repository import or connection.
- Replit Secret creation with the value hidden.
- Run and test results.
- Autoscale publishing configuration.
- Private access selection.
- Server-count and spending-control configuration.
- The working dashboard and its live quota result.
- Verification that unauthenticated access is blocked, where safely demonstrable.

The final guide will be a standalone HTML file with embedded, optimized screenshots so it remains portable. It will include prerequisites, architecture, the click-by-click procedure, code/configuration explanations, validation checks, troubleshooting, security warnings, cost-control guidance, maintenance steps, and instructions for rotating the token. All screenshots and guide content will be reviewed for sensitive data before delivery.

## Out of scope

- Automatic or scheduled quota checks.
- Public or shared access.
- A server-side database or cross-device history.
- Multiple ModelScope accounts or models.
- General ModelScope billing or Magicube tracking.
- Storing or displaying the ModelScope token.
- Guaranteed zero Replit cost beyond included plan credits.

## Completion criteria

The project is complete when:

1. Automated tests pass.
2. The private Replit deployment works from the owner's signed-in account.
3. Live quota values are derived from the confirmed ModelScope headers.
4. Manual-check, caching, security, and cost-control behavior are verified.
5. The GitHub repository contains no secrets.
6. The final standalone HTML guide accurately reproduces the verified process with redacted screenshots.
