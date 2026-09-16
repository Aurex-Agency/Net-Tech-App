# Access boundaries and implementation notes

## Authority model

Supabase Auth verifies identity. Application roles live in `public.profiles`; organization access lives in `public.memberships`. Registration metadata and email domains never grant a role. Every protected read/mutation reevaluates active status and current membership/assignment in the database. Staff MFA is enforced in PostgreSQL when enabled, as well as in the application. The app uses verified `getUser()` and never trusts browser session data alone.

| Actor | Requests, search, conversation, files | Internal notes/site context/time | Administration |
| --- | --- | --- | --- |
| Anonymous | No service-record access; limited verified public inquiry only | None | None |
| Contact | Own and explicitly shared requests in active member organizations | None | Own contact/preferences only |
| Client administrator | Requests in organizations where membership is active and admin | None | Request corrections; no membership self-grant |
| Technician | Assigned/collaborating work and relevant location context | Assigned work; own editable time | Request/visit updates and own availability |
| Dispatcher | All Net-Tech operational records | All operational context; own editable time | Queue, schedules, client records, client memberships, staff hours |
| Owner | All operational records | All; audited time corrections | Staff technician/dispatcher roles, deactivation, invitations, settings |

Owner role changes require a separate verified administrative process. At least one active owner is protected against demotion/deactivation. A scheduled technician must already be the request assignee/collaborator or have dispatcher/owner access: assign/share first so field work is not scheduled into an inaccessible request. Removing access does not erase historical authorship or automatically cancel visits.

## Database/API protections

- Every application table in `public` and `private` has RLS. Ordinary browser tokens have no direct insert/update/delete grants on service tables.
- Mutations go through a transactional, role-checked command boundary. Narrow `SECURITY DEFINER` implementations live in the unexposed `private` schema with empty search paths and explicit execution grants; public wrappers are `SECURITY INVOKER`.
- Request location/organization, attachment request/note, references and membership relations have foreign keys/constraints. Privileged changes preserve audit rows.
- Request/message idempotency keys are bound to actor and payload fingerprint. Replaying different content under one key is rejected. Booking mutations serialize with a database lock, then recheck overlaps, travel buffers, hours and approved absence. Concurrent edits require the current version. Overrides require a reason; approved absence cannot be overridden silently.
- Public messages, internal notes, site notes, work entries and audits use separate projections/policies. Clients never receive staff-only content for the UI to hide. Public exports exclude internal bodies and labor.
- Authenticated API reads are `private, no-store`. Writes require the configured exact Origin. Server keys are confined to server modules. CSP/frame restrictions, MIME-sniff prevention and same-origin forms are configured. The current Next.js CSP allows inline framework scripts/styles; nonce-based CSP is a future hardening option.
- No Realtime publication/subscription is enabled. Focus/20-second refresh fetches apply current RLS; background-tab polling pauses. Already rendered records cannot be made unread retroactively, but revoked accounts lose subsequent protected access; 403/401 clears the in-memory workspace.

## Uploads

Files go directly to a reserved private quarantine object, avoiding large request bodies through Vercel. Finalization checks identity/access again, file size and magic bytes. Images must decode within 40 million pixels and are re-encoded by Sharp, stripping metadata. SVG/HTML/Office/executable files are unsupported. PDFs require a complete trailer; active action names (including hex-escaped names), encrypted PDFs and compressed object dictionaries are rejected conservatively. Some ordinary modern PDFs will therefore require export as a simpler PDF or image.

Only validated bytes enter `request-files`. Public and internal paths/metadata stay separate. Authorized downloads use short-lived (60-second) signed URLs with download disposition. An already issued URL remains usable until that expiry even after membership removal. A quarantine upload token may remain usable for its provider-defined lifetime, but cannot read the object and finalization rechecks current access. The worker removes stale quarantine/orphan files after one day.

This is a validation/quarantine gate, **not an antivirus service or a proof that every PDF is harmless**. Keep allowed formats narrow and add a managed malware/content-disarm scanner before expanding formats or broader rollout. Defaults are five files per submission, 10 MB each, and a defensive 50 reservations per request/uploader; limits are currently code/database constants, not an owner settings control. Change them coherently across UI, server, SQL constraints and buckets.

## Notification privacy and abuse controls

In-app records/outbox jobs commit with the business action. Own-action alerts are suppressed; explicit submission receipts are the exception. Before every email attempt, current active membership/access and preferences are rechecked. Reminders also verify appointment version/status/time. Templates contain only a generic update and authorized sign-in link. Logs use error codes, not message bodies, addresses or tokens.

Database throttles protect messages/commands, invitations, uploads and public inquiry writes. Auth service rate limits/SMTP protections must be configured and tested in staging. Turnstile is verified server-side against the exact hostname; a honeypot, length limits and salted IP-rate key supplement it. Public intake is disabled by default. Do not expose private schemas or service keys to clients to bypass a policy failure.

## Test boundary

SQL tests verify real PostgreSQL RLS/grants/functions using lightweight test Auth/Storage schemas; they do not prove the hosted Auth service, Storage HTTP endpoints, SMTP, or a particular Supabase configuration. Complete the staging matrix before client use. There is no certification/compliance claim, penetration-test claim, or completed restore claim.

## Initial static-analysis triage

GitHub CodeQL completed on the initial build. Alerts #1 and #2 (`js/clear-text-storage-of-sensitive-data`) identified the two intentional `localStorage` writes in `components/provider.tsx` because the synthetic store includes an `appointments` field. Both writes are inside explicit demo-only branches, populated from fictional fixtures and browser-entered demo interactions. The separate connected route never writes its authenticated payload to local storage. These findings were reviewed and dismissed as false positives with this reasoning; no scanner rule was disabled. Keep the demo labeling and this storage separation intact. Do not enter real client information in demo mode.
