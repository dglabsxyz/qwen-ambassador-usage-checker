# Qwen Usage Checker Action Log

| # | Time (ET) | Surface | Action | Selection/Input | Observed Result | Evidence |
|---:|---|---|---|---|---|---|
| 1 | 2026-08-12 | Codex workspace | Began implementation from approved design | Commit `4e4c6d1` and plan `2043053` | Approved inputs confirmed | Git history |
| 2 | 2026-08-12 | Git | Protected the source branch | Added `.worktrees/` ignore and created `feature/qwen-usage-checker` | Isolated worktree created | `git worktree list` |
| 3 | 2026-08-12 | Codex workspace | Added project baseline | Node 22+, zero runtime dependencies, Replit port 3000 | Ready for test-first implementation | Project files |
| 4 | 2026-08-12 | Terminal | Verified baseline configuration | `npm test` | 1 test passed, 0 failed | Node test runner |
| 5 | 2026-08-12 | Terminal | Verified quota header parser | Focused test, then full suite | 7 tests passed, 0 failed | Node test runner |
| 6 | 2026-08-12 | Terminal | Verified sanitized ModelScope client | Request shape, token counts, authentication, rate limit, timeout, invalid response | 17 tests passed, 0 failed | Node test runner |
| 7 | 2026-08-12 | Terminal | Verified quota cache and in-flight coalescing | 60-second boundary, concurrency, failures, clone safety | 21 tests passed, 0 failed | Node test runner |
| 8 | 2026-08-12 | Terminal | Verified secure HTTP application | Static allowlist, no-probe GET, POST-only API, body limit, safe errors, security headers | 25 tests passed, 0 failed | Node test runner |
| 9 | 2026-08-12 | Terminal | Verified browser-local history | Validation, ordering, deduplication, 31-entry retention, immutability | 29 tests passed, 0 failed | Node test runner |
| 10 | 2026-08-12 | Design workspace | Created the approved dashboard concept | Dark navy shell, teal quota accent, desktop and mobile composition | Concept established without remote assets | `work/design/qwen-dashboard-concept.png` |
| 11 | 2026-08-12 | Terminal | Verified dashboard asset and accessibility contract | Semantic heading, model label, warning, live region, module assets, MIME types | 30 tests passed, 0 failed | Node test runner |
| 12 | 2026-08-12 | Chrome | Verified local dashboard at desktop size | Opened local fake-data app; checked page identity, metrics, status, history, and token-count display | Dashboard rendered with no framework overlay | `work/guide/screenshots/01-local-dashboard.png` |
| 13 | 2026-08-12 | Chrome | Verified responsive layout | Set viewport to 360 px; inspected shell and button bounds | No horizontal overflow; primary controls remained usable | `work/guide/screenshots/01b-local-dashboard-mobile.png` |
| 14 | 2026-08-12 | Chrome | Exercised manual-check workflow | Clicked **Check Usage** three times against a fake service | Live result, cached result, then sanitized error preserving prior metrics | DOM state checks |
| 15 | 2026-08-12 | Chrome | Exercised local-history clearing | Clicked **Clear Local History** and accepted the native confirmation | The app issued the confirmation and removed only its documented storage key | Automated history tests and browser interaction |
| 16 | 2026-08-12 | Visual QA | Compared implementation with accepted concept | Layout, copy, palette, responsive behavior, and component hierarchy | Faithful implementation; live metrics intentionally replaced concept placeholders | Side-by-side image inspection |
| 17 | 2026-08-12 | Terminal | Verified repository scanner against an isolated fixture | Scanned an ignored fake bearer-shaped value | Report contained only filename and rule name; fixture removed | `bearer-token-pattern` result |
| 18 | 2026-08-12 | Documentation | Confirmed current Replit cost model | Official Autoscale, Publishing costs, Core, and private deployment documentation | Autoscale is request-billed, can scale to zero, and supports a maximum-machine limit | Official Replit documentation |
| 19 | 2026-08-12 | Codex workspace | Added operational runbook | Token rotation, private access, cost controls, safe logs, and verification commands | Procedures documented without account identifiers or credentials | `docs/operations.md` |
| 20 | 2026-08-12 | Terminal | Ran the repository-wide credential gate | All tracked files and required runtime paths | Two fake bearer-shaped literals were blocked; both were rewritten without weakening the scanner | `npm run verify:repo` |
| 21 | 2026-08-12 | Terminal | Re-ran the credential gate | Strict tracked-file and content rules | Passed with no tracked secret patterns | `npm run verify:repo` |
| 22 | 2026-08-12 | Terminal | Checked GitHub publication prerequisites | GitHub CLI version and authentication status | GitHub CLI is not installed; publication paused before any account change | `gh --version` |
| 23 | 2026-08-12 | Terminal | Installed the GitHub publication prerequisite | GitHub CLI 2.97.0 through Windows Package Manager | Installation completed successfully | `gh --version` |
| 24 | 2026-08-12 | GitHub connector | Resolved the target repository owner | Authenticated GitHub profile | Owner confirmed without recording email or other profile fields | GitHub profile lookup |
| 25 | 2026-08-12 | Documentation | Updated the sharing model | Public source repository; private Replit deployment; secret supplied only after import | README now includes the exact Replit import button and security boundaries | `README.md` |
| 26 | 2026-08-12 | Visual QA | Inspected the README dashboard preview at original resolution | Usage-only dashboard capture | No token, email, account menu, browser chrome, or unrelated content visible | `docs/assets/dashboard-preview.png` |
| 27 | 2026-08-12 | Terminal | Ran the pre-publication Git-history credential scan | Every local development revision | Older commits contained a fake bearer-shaped test literal; no real credential was found | Git history scan |
| 28 | 2026-08-12 | Git | Selected a clean public-history strategy | Export the verified final tree into a new one-commit publication repository | Public Git history will contain no old fixture strings or secrets | Publication staging plan |
| 29 | 2026-08-12 | Chrome | Authorized GitHub CLI for publication | Continued as the confirmed repository owner and approved GitHub CLI | HTTPS Git operations authenticated; password and one-time code were not recorded | GitHub device activation success |
| 30 | 2026-08-12 | Chrome | Created the shareable source repository | **New repository** → `qwen-ambassador-usage-checker` → **Public** → no generated files → **Create repository** | Empty public repository created under the confirmed owner | `work/guide/screenshots/02-github-create-form.png` |

## Redaction rules

- Never record token values, authorization headers, email addresses, or unrelated tabs.
- Replace account-specific identifiers in teaching text with neutral labels.
- Capture screenshots only after secret fields are masked or outside the viewport.
