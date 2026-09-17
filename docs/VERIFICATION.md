# Verification and remaining gates

Verified locally September 16, 2026 on macOS with Node 24.19.0. These results cover the checked-in application and local SQL; they do not assert a connected production installation.

## Automated results

| Check                       | Result                                           | Evidence/scope                                                                                                                                                   |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                      | Pass, zero warnings                              | `npm run lint`                                                                                                                                                   |
| Strict TypeScript           | Pass                                             | `npm run typecheck`                                                                                                                                              |
| Domain tests                | 21 pass                                          | `tests/domain.test.ts`: scope, transitions, idempotency, buffers, calendar/CSV escaping, file signatures/PDF rejection                                           |
| PostgreSQL integration      | 98 assertions pass                               | Actual migrations/RLS/PLpgSQL in PGlite; `scripts/test-database.ts`                                                                                              |
| Real PostgreSQL concurrency | Pass                                             | PostgreSQL 17.6; 8 independent simultaneous booking transactions → 1 success, 7 denied; 8 repeated submissions → 1 request/reference                             |
| Browser workflows           | 26 pass                                          | Thirteen journeys each at desktop 1440×1000 and phone 390×664 logical viewport; Chromium desktop and iPhone-device emulation (not Safari)                        |
| Accessibility               | Pass on five representative screens per viewport | axe WCAG 2 A/AA + 2.1 AA; no serious/critical automated findings after contrast/form/heading fixes                                                               |
| Production smoke            | Pass                                             | Built app on localhost:3100: rendering, CSP without unsafe-eval, sign-in redirect, protected worker, manifest, offline fallback, only public offline HTML cached |
| Production build            | Pass                                             | `npm run build`: all routes compile and static/dynamic output generated                                                                                          |

Browser journeys cover persisted intake/reply/inbox, internal-note separation and guessed-ID denial, client reschedule request preserving a booking, field completion independent of request status, booking conflict/deactivation, keyboard/offline/unauthorized endpoint behavior, client/site edits, request sharing and employee role changes, audience-specific conversation copy, independent public/internal drafts, technician navigation restrictions, staff intake contact identity, employee work links, dispatcher identity, and shared-visit action ownership. Screenshots and failure traces are generated under ignored `test-results/` and `playwright-report/`. CI repeats lint/type/unit/SQL/build/browser checks without external credentials. The initial hosted application check passed. CodeQL completed; two synthetic-demo-storage false positives were reviewed as documented in SECURITY.md.

SQL assertions include ordinary versus admin client visibility, cross-organization requests/objects, direct-mutation denial, assignment/removal/deactivation, current-token MFA, trusted/reused/expired invitations, independent visits, override audit, optimistic versions, idempotent finalization, inaccessible quarantine, per-technician days, staff-only site context and notes, scoped pagination/counts, recipient reauthorization, failed-provider retry, delayed-reminder retry and no exposed `SECURITY DEFINER` functions. Test Auth/Storage schemas are shims; hosted HTTP behavior requires separate verification.

## Owner onboarding and business routing review

Verified the dedicated technician form and business controls on desktop/mobile. The 26 browser checks include adding a synthetic technician with a business, automatic assignment of a subsequent client request, preserving historical assignments, transferring/removing defaults from either Team or Clients, and keeping these controls out of client views. The final dialog layout was rechecked with four focused browser passes and an axe accessibility scan.

SQL verification includes owner-only invitation preparation, dispatch-only business connections, no historical access grant, inactive fallback, trusted acceptance details, expired/reused links, and preserving newer business assignments when an older invitation is accepted. Real Postgres simultaneous connection writes retain one default and do not move existing work. `RUN_DB_ADVISORS=true npm run test:concurrency` runs advisors against the disposable local database; final result: no warnings or errors. Four existing identity-per-row policy warnings were fixed without changing access predicates.

The migration is committed and applied to the designated hosted test project. Actual Supabase Auth link generation and acceptance still require the connected staging checks below.

## Connected acceptance matrix — core API checks pass; extended scenarios remain

1. **Auth and identity:** configure actual Auth/SMTP; create controlled test owner/technician/client A/contact A/client B. Verify invite expiry/reuse/wrong email, password recovery, magic link, original-record redirect, TOTP enrollment, session expiry, recovery and database AAL2 enforcement.
2. **Request with photo:** create from real iPhone/Android camera/library, submit/retry/refresh, receive one reference and one readable sanitized attachment. Test 10 MB boundary, >10 MB, five files, mismatched MIME, active/encoded/compressed/encrypted PDF, interrupted signed upload, repeated completion and orphan cleanup. HEIC is not currently accepted: export JPEG/PNG if the browser supplies HEIC.
3. **Cross-tenant HTTP access:** using user JWTs (never a service key), attempt A→B list/search/direct read/write/RPC/report/export/Storage download. Ordinary A cannot read another unshared contact's request; A admin can. Remove sharing/membership/assignment and repeat with the same token. Unassigned technicians cannot access or be booked onto a request.
4. **Private content:** inspect network responses, downloads, notifications and exports for internal notes, site context, time/materials and internal attachments. They must never appear in a client response. RLS tests already pass; inspect actual hosted traffic as well.
5. **Messaging:** two independent authenticated sessions must reconcile unread counts on refresh/poll/focus. Simulate a lost response after commit, retry with the same key, and confirm one message; verify drafts survive a recoverable failure without local-storage persistence.
6. **Scheduling:** intake windows reserve nothing. Test simultaneous requests through the deployed API, working hours, absence, buffers, overrides, version conflicts, reschedule history and obsolete reminders. Technician must see the assigned/shared request and complete the visit without resolving it automatically.
7. **Access/offboarding:** owner role change/deactivation immediately blocks subsequent protected operations from an old token; history stays readable to authorized staff; all remaining open assignments/visits can be reassigned.
8. **Delivery:** with controlled recipients and a verified sender, exercise provider 503/timeout, lease expiry, reauthorization after removal, deduplication, stale appointment reminders and configuration failure. Request remains saved; no content leak and no duplicate email. Verify scheduler alerts and optional closure/reopening.
9. **Public inquiry:** Turnstile wrong-host/reuse/expired tokens, honeypot, rate limiting, unavailable provider, idempotent submission, conversion into the correct existing organization/location. Do not turn on public intake without this check.
10. **Real devices / usability:** Safari/iPhone and Chrome/Android, phone keyboards, file selection, reduced motion, screen reader, manual keyboard traversal, install/uninstall/update and offline shell. Device emulation does not replace these tests.
11. **Operations:** restore database and file objects into an isolated environment, compare counts/checksums, rerun boundaries, verify logs redact tokens/content, alert on worker failure, approve retention/source-of-truth/hosting costs.

## Performance and known limits

Queries are indexed, request/message/calendar lists page on the server, report/dashboard aggregates operate in PostgreSQL, and heavy calendar/operations screens load on demand. The initial workspace intentionally bounds card/inbox/directory payloads; full queues/history use dedicated endpoints. Authenticated responses and service-worker data are never cached publicly. There are no fonts or analytics fetched from third parties during routine workspace browsing.

Current snapshot limits, remaining mention/response-target controls and operational gaps are listed in `IMPLEMENTATION-CHECKLIST.md`. No production-scale load test, Core Web Vitals field measurement, antivirus integration, real-provider email delivery, real phone upload or backup restore has been claimed. Test at expected concurrent staff and file volume before increasing the pilot size. Production migrations, invitations and deployments remain pending owner review.

## Hosted test backend — September 16, 2026

- All six migrations applied to `sorblhbsciedhyihjaum`; remote migration versions aligned to repository filenames. Five synthetic Auth users and fictional fixture records installed without sending email.
- Both Storage buckets remain private, with a 10 MB object limit.
- Supabase security advisor: no WARN/ERROR after revoking browser execution of the hosted administrative `rls_auto_enable()` helper. Nine INFO notices are intentional private tables with RLS and no browser policies ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
- Performance advisor: no WARN/ERROR; INFO findings include unused indexes on the empty database, optional foreign-key indexes, and Auth's fixed connection allocation. Review indexes against staging workload before scale ([foreign-key guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)).
- Public signup disabled; anonymous sign-in and manual identity linking remain disabled. Email/password enabled with email confirmation required.
- GitHub application checks passed at `88b7fdc`, including production build and desktop/mobile browser journeys. SQL suite rerun after the sixth migration: 98 assertions pass.
- Hosted HTTP smoke checks passed: owner, technician, client administrator and separate-business client password login; active roles; scoped requests; client internal-note and routing-directory denial; direct table write denial; anonymous request denial. There are five synthetic Auth users, eight fixture requests, no application tables without RLS, and no profiles with email notifications enabled. Full signed-in app/Storage/Vercel acceptance remains pending; these smoke checks are not a substitute for those journeys.

## Vercel connected verification — September 17, 2026

The live test deployment is `https://net-tech-app.vercel.app`. Rebuilt with the designated backend URL/publishable key, server-only secret and exact canonical app origin. Supabase Auth Site URL/callback updated. Root now opens connected sign-in; `/demo/*` remains browser-only.

`npm run test:deployed` uses fresh synthetic Auth sessions and the actual Vercel HTTP endpoints; no service key is used by its assertions. It creates clearly labeled fictional records and small generated PNGs. Never run against real-client environments. Credentials remain in ignored local files.

Passed through Vercel:

- Owner, technician, client administrator and separate-business client workspace loading.
- Client intake/retry deduplication and owner assignment.
- Technician reply/retry deduplication, internal-note privacy and denied cross-business reads/writes.
- Actual private quarantine uploads, server image processing, repeated completion, signed downloads, internal-file client denial and cross-business file denial.
- Confirmed booking, overlapping booking rejection, technician progression/completion and independence from request resolution.
- Owner technician invitation preparation without email, real Auth callback cookie creation, wrong-email and reused-invitation rejection, accepted technician identity, default business routing of new requests, historical access isolation, connection removal and immediate deactivation using the same session. The extra synthetic technician is left inactive.

This supplements the existing SQL/concurrency/browser suites. It does not claim mobile camera testing, SMTP delivery, password recovery, public Turnstile intake, production load or backup restore.

## Email configuration checks — September 17, 2026

- Resend accepted a message from the configured sender to its delivery simulator. The send-only key cannot enumerate domains; a DNS dashboard audit or human inbox receipt is not claimed.
- Supabase custom SMTP accepted a password-reset request for the inactive simulator account. No staff/client message was sent.
- Generated synthetic recovery and magic-link tokens were redeemed through the deployed callback without an existing browser session. Verified cookies, authenticated identity, return destination, password update and continued denial of workspace access for the inactive account.
- The original exact callback allowlist omitted query-bearing redirects. Added the scoped `/auth/callback?next=**` pattern and retested the preserved redirect.
- Branded templates are saved in the hosted Auth dashboard and `supabase/templates/`. They are manual configuration artifacts, not automatically applied by migrations.

## Custom domain and authorized staff emails — September 17, 2026

- Current canonical app: `https://app.nettech.ms`. Vercel app URL, Supabase Site URL/callback allowlist, hosted recovery template and deployed test target updated. Prior-domain references above record earlier verification runs.
- Re-ran the full `test:deployed` synthetic suite against the new domain: all checks passed, including authenticated mutations and invitation acceptance.
- Recovery and magic-link callbacks on the custom domain verified one-use synthetic tokens, cookies, destination, password update and inactive-account denial.
- Regenerated both approved staff setup links on the new domain without consuming them. Resend accepted both branded emails from `staff@team.nettech.ms`; private delivery IDs/idempotency keys are stored locally. Human inbox receipt and actual staff acceptance are not yet confirmed.
- The original synthetic backend remains in use. Automated request email delivery and real-client rollout are still pending the documented operational review.
