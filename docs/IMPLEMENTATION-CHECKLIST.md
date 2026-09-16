# Implementation checklist

Specification: `NET-TECH-APP-PLAN.md`. Updated September 16, 2026. Checked items are implemented and locally verified unless qualified. **Connected staging gates are not marked complete; production and real invitations remain pending review.**

## 1 — Foundation and representative UI

- [x] Shared Net-Tech design system, responsive shell, typography, current brand mark and restrained motion
- [x] Client home/request detail, technician Today, owner queue/calendar
- [x] Clear synthetic demo with browser persistence and role switch
- [x] Loading, empty, error, offline and access-denied states
- [x] Keyboard dialogs, mobile touch controls, reduced motion and representative axe checks

## 2 — Working support workflow

- [x] Supabase SSR Auth adapter, sign-in/recovery, trusted invitations and staff MFA flow
- [x] Current role/membership/assignment policies and direct database/API boundaries
- [x] Support/general intake, unique receipt/reference, idempotent writes
- [x] Public conversation, internal notes/attachments, read cursors, paginated requests/messages
- [x] Assignment, priority, kind conversion, target dates, collaborators and explicit contact sharing
- [x] Private quarantined file pipeline with signature/size validation and safe downloads
- [x] Resolve/reopen/close/cancel-review/linked-follow-up behavior
- [ ] Hosted Auth/Storage and cross-account HTTP checks, including actual photo upload/retry

## 3 — Estimates and field work

- [x] Client estimate preferences, optional budget/date and photos; explicit pending confirmation
- [x] Limited public Turnstile inquiry adapter and dispatcher conversion; disabled until configured
- [x] Calendar week/agenda, history pagination, proposals/confirmation, change requests and `.ics`
- [x] Server-serialized conflicts, travel buffers, individual working hours, approved absence and audited override
- [x] Optimistic appointment version checks and invalidated obsolete reminders
- [x] Manual field progression, checklist/summary, maps/call, independent request state
- [x] Manual time/materials, own edits and audited owner correction
- [ ] Connected end-to-end inquiry → assignment → booking → completion test

## 4 — Operations

- [x] Transactional in-app notifications/outbox; retries, deduplication, leases and send-time reauthorization
- [x] Protected scheduled worker for reminders, upload cleanup and optional automatic closure
- [x] Client/location edits, services/tags, contact membership management and staff-only site context
- [x] Employee invitations, technician/dispatcher role changes, deactivation and hours
- [x] Queue search/filters/date ranges; all-history dashboard totals and report aggregates; safe CSV
- [x] Contact/category/business settings and configurable product metadata
- [x] PWA manifest/icons/public offline shell, no private caching
- [ ] SMTP/Resend sender verification, external scheduler, monitoring/error tracking
- [ ] Device installation verification; secure staff MFA recovery drill

## 5 — Verification and launch preparation

- [x] Domain and PostgreSQL policy/workflow tests
- [x] Real Postgres simultaneous booking and idempotency race tests
- [x] Desktop/phone Chromium journeys, representative visual/keyboard/accessibility checks
- [x] Strict TypeScript, lint and production build
- [x] CI, setup/Vercel/security/operations/owner-technician documentation
- [x] Local-only synthetic Auth/data seed script provided (Docker execution pending)
- [ ] Full connected staging acceptance matrix and external abuse tests
- [ ] Real Safari/iPhone and Chrome/Android checks, maximum file and poor-network tests
- [ ] Database + attachment restore exercise and approved retention policy
- [ ] Owner review, support process/source of truth and pilot authorization
- [ ] Production environment, domain, spending alerts and approved pilot invitations

## Role clarity review — September 16, 2026

- [x] Audited shared dashboard, request intake/detail, inbox, calendar, directory, team, settings and account screens for client/technician/dispatcher/owner assumptions
- [x] Client-facing support copy appears only for clients; staff conversation empty states, composer labels and assignment labels identify the correct audience
- [x] Separate public-reply and internal-note drafts and retry keys; changing the audience cannot carry internal draft text into a public reply
- [x] Technician navigation excludes dispatch intake and organization-management actions; direct restricted routes show a role denial
- [x] Dispatch intake collects the client's contact instead of pre-filling the operator's identity; employee work links filter to the selected assignee
- [x] Dispatcher workspace identity is distinct from owner; staff account descriptions match their access
- [x] Personal next-stop cards select the technician's own visit; shared visits retain context without exposing another technician's update action
- [x] 22 desktop/mobile browser checks, 18 domain tests, lint, TypeScript and production build pass; local port 3100 preview rebuilt

Database/API access rules are unchanged by this review. Existing policy checks remain applicable; connected staging acceptance and real-device verification below remain pending.

## Owner technician setup — September 16, 2026

- [x] Dedicated Add technician flow with name, email, optional phone and searchable business selection
- [x] Business connections visible on technician cards; editable from either Team or Clients
- [x] One default technician per business, automatic routing for new requests and inactive-staff fallback
- [x] Historical requests/appointments stay assigned; business connections do not grant historical access
- [x] Synthetic demo creation separated from connected invitation preparation/acceptance; no emails sent
- [x] Trusted pending invitation metadata, late-acceptance protection and database audit history
- [x] 21 domain tests, 98 SQL assertions, 26 desktop/mobile journeys, simultaneous connections and local database advisors
- [x] Apply technician business-routing migration to the designated hosted test backend
- [ ] Verify connected onboarding with controlled test recipients in staging

## Remaining implementation scope / deliberate limits

- Interface refresh uses authenticated focus/20-second polling; no WebSocket/push, external calendar sync, two-way email ingestion, SMS or native stores.
- Overview cards/inbox load up to 100 recent requests plus visit context. Dashboard totals, Reports, request search, request history and calendar paging use server queries over full authorized data. Larger teams need a fully paginated inbox/directory/time-log view; current directory/membership/time snapshots cap at 1,000. Detail loads latest 100 internal notes/events and up to 200 attachments/visits. These bounds are documented, not represented as unlimited history.
- Internal mentions are ordinary note text; there is no structured @mention picker/notification workflow yet. Before/after photos are request attachments, not a separate visit-gallery feature.
- Company/contact settings are editable; logo replacement is a reviewed asset change in `public/`. Optional response-target configuration/display is not implemented; there is no SLA promise. Upload size/count limits are shared code/SQL settings, not a runtime owner control.
- PDFs are conservatively restricted; malware/content-disarm scanning is not connected. Public inquiry photos are deferred until authenticated onboarding.
- No full backup exporter, retention-deletion worker, external error-tracking integration or completed restore drill. These are explicit launch prerequisites/operational setup.
- No production-scale load benchmark or real-device validation has been claimed. Review performance with realistic staging volume before expanding the pilot.

## Environment observations

The initial directory held only the plan and was not a Git checkout. GitHub returned no refs and is a public repository. The supplied Supabase project initially had an empty public schema. The owner subsequently designated it for testing; all six migrations are now applied, private Storage is configured, and public Auth signup is disabled. Five synthetic Auth test accounts and fictional fixtures are installed. No invitations, outbound messages, paid purchases or deployments were performed.

## Vercel testing handoff

- [x] Push current application to GitHub and confirm application CI passes
- [x] Initialize the owner-approved Supabase test backend and check hosted advisors
- [x] Prepare ignored `.env.vercel-testing` with project URL and publishable key
- [x] Prepare the server secret key in the ignored local Vercel environment file
- [ ] Import environment variables into Vercel and set the exact deployment origin
- [x] Create verified synthetic test accounts with the intended roles and private test credentials
- [ ] Set deployed Auth redirects and run connected acceptance
- [ ] Complete production review before real-client invitations or launch
