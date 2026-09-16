# Net-Tech Client & Team App — Product and Build Brief

Prepared September 16, 2026. This is a self-contained brief to paste into Codex in a new GitHub repository. The working product name is **Net-Tech Connect**; make the name configurable.

**Instructions to the implementing agent**

Build the application described below in ordered milestones. Begin by inspecting the repository, documenting the implementation checklist, and building milestone 1. Continue through the authorized milestones when possible. Produce working software, migrations, setup instructions, and meaningful verification—not only screen mockups. Keep the milestone checklist accurate. If an external account or credential is missing, complete independent work and document the exact configuration required. Never represent simulated messages, appointments, notifications, or integrations as live. Use the defaults in this brief for routine choices; ask only when a missing decision blocks consequential work. This brief authorizes local implementation and reviewable previews, not invitations to real clients, production migrations, paid purchases, or changes to the existing marketing website.

**1. Product purpose and research context**

Create one responsive application that gives Net-Tech clients an easy way to request support, request on-site estimates, and communicate with the team. Give technicians a practical daily work screen and give the owner visibility into requests, scheduling, clients, and employee workload.

The primary experience is: **request help → receive a response → schedule a visit if needed → complete the work → retain a useful service history.**

Net-Tech's indexed website describes managed IT, networking and security, cloud solutions, and security camera services in New Albany, Mississippi. These support the proposed intake categories. The indexed copy may predate the user's recent website update; verify current copy and brand assets before final visual implementation. [Net-Tech website](https://nettech.ms/).

Ubiquiti's public homepage emphasizes intuitive management and multi-site organization, while its help center separates support requests, documentation, and other resources. These are useful references for clear navigation. The user specifically requests Ubiquiti's clean appearance and polished animation. [Ubiquiti](https://ui.com/), [Ubiquiti Help Center](https://help.ui.com/hc/en-us).

Research limitation: browser inspection was blocked by an unavailable browser security check. Public text and indexed content were available, but exact colors, page transitions, and current Net-Tech layouts were not visually verified. The design values below are proposed directions, not measured Ubiquiti design tokens. Inspect the live references when browser access is available; use Net-Tech branding with an original interface.

**2. Platform and launch assumptions**

- Build a responsive, installable progressive web app (PWA) with one shared codebase. Clients can open a link in a browser and, where supported, add it to their home screen or install it on desktop. Installation and notification support vary by browser and operating system. [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
- Proposed address: `app.nettech.ms`, subject to DNS and hosting setup. The existing website remains the marketing entry point; its support and consultation buttons can link to the app at launch.
- Three experiences after sign-in: Client, Technician, and Owner/Dispatcher. They share the same underlying records and permissions.
- One service provider, Net-Tech, supporting many client organizations and locations. This is not a platform for unrelated IT businesses to register as providers.
- Existing clients join by invitation. Prospective clients can submit an estimate inquiry through a limited public form.
- Appointment requests require staff confirmation. Do not imply a requested time is booked.
- Working timezone: `America/Chicago`; store timestamps in UTC and display clear local times with daylight-saving support.
- Notifications at launch: in-app and email. Web push is an enhancement after the core system works.
- Employee management means accounts, assignments, availability, work notes, and workload. Payroll, performance reviews, and HR records are outside the initial scope.

**3. Roles and access**

| Role | Main abilities | Access boundary |
|---|---|---|
| Client contact | Create requests; message Net-Tech; attach files; view appointments; confirm resolution | Own requests and requests explicitly shared with them within their organization |
| Client administrator | Client contact abilities; view organization service history; request contact changes | Only their organization and its locations; staff approve membership changes in v1 |
| Technician | Work assigned requests and visits; communicate with clients; write internal notes; log time and completion | Assigned work and the client/location context necessary for it |
| Dispatcher | Triage and assign requests; manage calendar; maintain client records | Operational records across Net-Tech clients; cannot grant owner privileges |
| Owner | Dispatcher abilities plus employee access, settings, reporting, and exports | All Net-Tech operational data |

The owner can perform dispatch without a separate dispatcher employee. Client administrator status and staff roles must be granted through a trusted administrative process. A user must never choose a privileged role during registration. Client membership must never be inferred from an email domain alone.

Apply these boundaries to pages, direct URLs, database/API calls, search, attachments, exports, email recipients, and live subscriptions. Hiding a button is not access control. When staff are deactivated or a membership is removed, subsequent protected operations must fail even if an old session token remains valid. Keep historical authorship visible.

**4. Client experience — launch features**

**Home.** Show three prominent actions: **Get support**, **Request an on-site estimate**, and **Message Net-Tech**. Below them, show requests needing the client's response, the next confirmed appointment, recent activity, and a configured contact/help option. Prefer plain language such as “We need a little more information” over internal queue terminology.

**Support intake.** A short, mobile-friendly flow asks for location, category, a brief summary, what happened, when it began, and business impact. Contact information comes from the signed-in profile but can be reviewed. Categories start with Internet/Wi-Fi, Network equipment, Computers/IT support, Email/Cloud services, Security cameras, and Other/Not sure. These are editable proposals, not claims about every service contract.

Impact choices: one person affected, several people affected, or business/site unable to operate. Staff set operational priority after reviewing impact. Let clients attach photos, screenshots, or PDFs. Start with five files per submission and 10 MB per file, configurable. Make uploads usable from a phone camera/library where supported. Failed uploads should be retryable without losing the form.

Submission creates a unique reference, such as `NT-10042`, and a visible receipt. Prevent duplicate records from repeated taps or network retries. Send a confirmation email containing a secure sign-in link to the record, not sensitive problem details. Do not promise a response time unless the owner has configured one.

**Request details.** Show the summary, status, location, assigned technician when available, public message thread, attachments, upcoming visits, and public activity timeline. Clients can provide requested information, add a reply, request cancellation, and indicate whether the problem is fixed. A cancellation request is reviewed by staff; it does not silently cancel a dispatched visit.

**Estimate requests.** Ask whether the client wants new equipment, installation, upgrades, or other services; collect the location, project description, optional photos, on-site contact, and up to three preferred dates/time windows. Optional budget and target completion date should never block submission. The flow says **Request a visit**, then **Awaiting scheduling confirmation**. Scheduling an estimate visit does not create a price quote or authorize paid work.

**Messages.** Provide one inbox listing conversations across support requests, estimate requests, and general questions. Each conversation has a clear subject and related record. “Message Net-Tech” lets the user select an existing request or start a general question, which creates a lightweight service request. Staff can convert a general question into support or estimate work without duplicating its conversation. Messages are asynchronous; do not show “live chat” or “online now” unless that service is actually staffed and implemented.

Messages show author, time, unread state, and attachment status. Use sent/failed states with retry. Do not label a message as read by a person based only on email delivery. Keep one canonical conversation per request so replies are visible consistently from the inbox and the request screen.

**Appointments.** Show upcoming and past visits with purpose, address, confirmed time or arrival window, technician, and preparation instructions. Allow clients to request rescheduling or cancellation. Keep the existing booking active until staff confirms a change, and explain that in the UI. Offer “Add to calendar” as a calendar file; external calendar synchronization is a later integration.

**Organization and profile.** Clients can update their own contact details and notification preferences and view authorized locations. Client administrators can request organization/contact corrections. Membership changes go through Net-Tech in v1 to keep onboarding straightforward.

**5. Technician experience — launch features**

**Today.** A mobile-first agenda shows assigned visits, urgent assigned requests, replies waiting on the technician, and the next useful action. Each appointment includes tap-to-call and an address link that opens the user's mapping app.

**My work.** Search and filter assigned requests by status, priority, client, and visit date. Request detail brings together the issue, public conversation, internal notes, site contact, relevant service history, and visit tasks.

**Field workflow.** Technicians can mark a visit En route, On site, and Completed; record a work summary; add before/after photos; check off tasks; and note follow-up work. This is a manually updated status, with no background GPS tracking. A completed visit does not automatically resolve the related support request.

**Internal notes.** Provide a visibly separate internal-note composer and storage path. Default the composer to client reply with an explicit mode switch, clear audience label, and persistent contrasting treatment for internal notes. Internal notes, labor details, staff mentions, and internal attachments must never appear in client payloads or notification templates.

**Time and work logs.** Allow manual time entries tied to a request or visit, with date, duration, and short description. Staff can record materials used as simple text. These are service records, not payroll or invoices. Technicians can edit their own entries; owner corrections preserve an audit history. Start with manual time entry; a running timer can follow later.

**Availability.** Show the technician's schedule. Let them submit unavailable periods for dispatcher review; confirmed blocks prevent new conflicting appointments. Avoid collecting reasons beyond an optional operational note.

**6. Owner and dispatcher experience — launch features**

**Operations overview.** Show unassigned requests, high-impact issues, requests waiting on Net-Tech, client replies, upcoming visits, and aged open work. Use actionable lists before charts. Distinguish an old request from an actual contractual service-level breach.

**Shared request queue.** Include list views for New, Unassigned, Mine, Waiting on client, Waiting on parts/vendor, and Resolved. Filter by client, technician, category, priority, and date. Allow staff-created requests from phone calls so the app is the service record even when the client calls directly. Record the original intake channel.

**Dispatch.** Assign a responsible technician, set priority, add internal notes and target dates, schedule a visit, and transfer work with a visible history. Permit collaborators when needed while retaining one clear primary owner. Avoid creating a full team-chat system; use request notes and mentions for coordination.

**Calendar.** Provide day/week views by technician and a mobile agenda. Show confirmed visits, tentative proposals, working hours, unavailable blocks, and configurable travel buffers. Detect overlapping assignments on the server, including simultaneous booking attempts. A dispatcher override requires an explicit reason and an audit event. Use a form as the dependable editing path; drag-and-drop calendar editing is optional polish.

**Clients and locations.** Maintain organization name, contacts, addresses, locations, category tags, and service history. Support multiple contacts and multiple locations from launch. Record selected installed services and a brief internal site summary. Do not use this app as a password vault. Staff-only links to external management tools can be added without storing their credentials.

**Team.** Invite/deactivate employees, grant allowed roles, set working hours, review workload and time entries, and reassign work. Deactivation should flag all open assignments and upcoming visits for reassignment; never leave them invisible in the queue. Keep at least one active owner and protect owner changes with additional authentication.

**Reports.** Provide request volume, open backlog age, first staff response time, time to resolution, work by category, visit count, and logged service time. Define first response as the first human public staff reply, excluding automated receipts. Define resolution time from creation to the relevant resolution event; show reopened requests separately. Use calendar time initially and label it; business-hours/SLA accounting requires additional configuration. Offer permission-scoped CSV exports with spreadsheet formula injection protection.

**Settings.** Configure company name/logo, categories, working hours, notification preferences, support contact details, service area, appointment duration/buffers, and optional response targets. Do not copy emergency coverage promises from indexed website copy into the app without owner validation.

**7. Request and appointment rules**

Use a shared service-request model with kinds `support`, `estimate`, and `general`. Each request owns its public conversation. An estimate request can later be linked to a support/install request while retaining its history.

Request statuses: **New → Triaged → In progress → Resolved → Closed**, with **Waiting on client**, **Waiting on parts/vendor**, and **Canceled** branches. Staff may move between appropriate working states. Clients can respond and request cancellation, but cannot assign technicians, change priority, or close work on another contact's behalf without the required access.

Resolution requires a public completion summary. The client can confirm success or report that the issue remains. During a proposed seven-day window, a reply to Resolved reopens the request as In progress and notifies its assignee. After Closed, offer a linked follow-up request with copied context. The closure window is configurable and requires a scheduled worker; do not claim automatic closure before that worker exists. If automatic closure is disabled, staff close manually.

Appointment statuses: **Proposed → Confirmed → En route → On site → Completed**, with **Canceled** and **No show** alternatives. An estimate inquiry's preferred windows are intake data, not reserved appointments. A staff proposal is visible as unconfirmed; staff confirm after agreeing a time with the client. Store one canonical start/end and timezone per visit. Preserve appointment change history and cancel obsolete reminders whenever a booking changes.

Maintain independent request and appointment statuses: one request may require several visits, and a visit can finish while the request waits for parts.

Notifications cover receipt, new public reply, assignment, confirmed/changed/canceled appointment, appointment reminder, and resolution. In-app records are durable. Email sends run through a durable outbox with retry, idempotency, failure logging, and deduplication. Do not send a notification to the author of their own action. Recipient selection must follow current permissions at send time. Use minimal email/lock-screen content, with the full conversation behind sign-in.

**8. Navigation and screen inventory**

| Experience | Desktop navigation | Mobile navigation |
|---|---|---|
| Client | Home, Requests, Messages, Appointments, Organization, Account | Home, Requests, Messages, More; prominent Get support action |
| Technician | Today, My work, Messages, Calendar, Time entries, Account | Today, Work, Messages, More |
| Owner/Dispatcher | Overview, Requests, Calendar, Clients, Team, Reports, Settings | Today/Overview, Requests, Calendar, More |

Required screens: sign-in, invitation acceptance, recovery, expired invite, public estimate form and receipt, each role's home, request list, request creation, request detail, inbox, estimate intake, appointments, client/location detail, technician work log, team management, settings, and access-denied/not-found states.

Use desktop list/detail panels for request handling. On mobile, use full-screen detail views with a reachable reply composer and clear back navigation. Unread badges should agree across the inbox, navigation, and request detail.

**9. Visual direction and interaction specification**

The desired character is calm, precise, polished technology service. Keep Net-Tech's identity recognizable. Adopt Ubiquiti as an inspiration for clarity and restraint, with an original design suited to daily support work.

- Default to a light interface: near-white page background, white surfaces, dark neutral text, fine gray borders, and one confident blue accent. Provisional tokens: background `#F7F8FA`, surface `#FFFFFF`, text `#17212B`, muted text `#596579`, border `#E2E7ED`, action blue `#0067D8`. Verify contrast and reconcile these with Net-Tech's actual brand before finalizing.
- Use a system sans-serif or properly licensed Inter, clear hierarchy, comfortable reading sizes, consistent spacing, restrained corner radii, and simple line icons. Tables can be compact on desktop; mobile controls need comfortable touch targets.
- Preserve visual breathing room while making the next action obvious. Avoid decorative metrics, large promotional hero sections inside the app, and excessive floating cards.
- Show status through text and icons as well as color. Use consistent semantic colors across request badges, calendars, and notifications.
- Proposed motion: 120–180 ms for hover/press feedback, 180–240 ms for menus and panels, and 200–280 ms for small page/content transitions. These are recommendations, not measured Ubiquiti values.
- Animate opacity and small transforms. Keep layout stable, avoid scroll hijacking, preserve focus, and honor reduced-motion preferences. No long animated sequence between a customer and their support form.
- Include designed loading, empty, error, offline, permission-denied, and upload-failure states. Optimistic updates need failure recovery. A failed request must not show a successful receipt.
- Target WCAG 2.2 AA: keyboard access, visible focus, accessible labels, contrast, error associations, dialog focus management, and adequate targets. Verify rather than declaring compliance based on component choice.

Design these four representative screens first: client home, client request detail, technician Today, and owner queue/calendar. Use them to establish shared patterns before expanding the app.

**10. Recommended technical approach**

Recommended default: **Next.js + TypeScript**, Tailwind CSS, accessible component primitives such as shadcn/ui, and a small shared design system. Use CSS transitions for simple motion and Motion for interactions that benefit from it. Verify current stable versions at implementation time and commit a lockfile.

Use **Supabase** for Postgres, authentication, private attachment storage, and authorized live updates. Its database supports row-level security for organization and assignment boundaries. Apply both least-privilege grants and explicit policies; service/secret keys remain server-only. These are chosen architectural defaults, not existing Net-Tech infrastructure. [Supabase data security](https://supabase.com/docs/guides/database/secure-data), [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Use a transactional email provider behind an adapter, with Resend as a proposed default, and a scheduler/worker for reminders and outbox delivery. Reuse an existing suitable Net-Tech mail provider if confirmed. Do not infer mail-delivery configuration from the public email address. Select a Next.js-compatible host, with Vercel as a proposed default; pricing and account fit must be checked before paid deployment.

Keep core business rules in shared server/domain modules: authorization, status transitions, appointment conflicts, audience filtering, and notification creation. Commit migrations and realistic synthetic seed data. Prefer a straightforward application architecture over microservices.

Suggested repository areas: app routes by role; shared UI components; request, appointment, and messaging domain modules; auth/access helpers; database migrations and policy tests; email templates and worker handlers; seed fixtures; end-to-end tests; and product/setup documentation. Keep documentation synchronized with actual behavior.

Model these entities explicitly:

| Entity | Purpose |
|---|---|
| Profiles and staff memberships | Identity, active status, trusted staff role |
| Organizations, client memberships, locations | Client ownership and authorized access |
| Invitations | Hashed single-use token, intended recipient/role, expiration, acceptance |
| Service requests | Type, organization/location, creator, primary assignee, priority, status, reference |
| Request participants and assignments | Explicit contact visibility and technician collaborators |
| Public messages | Client-visible conversation linked to a request |
| Internal notes | Separate staff-only conversation and mentions |
| Attachments | Private object key, parent record, uploader, audience, validated type/size |
| Appointments and availability | Visit interval, technician, location, state, working/unavailable periods |
| Work entries | Time, checklist progress, materials notes, completion records |
| Notifications and read cursors | Recipient alerts and per-user conversation unread state |
| Outbox/delivery attempts | Durable email jobs, reminders, retries, failure state |
| Request events and audit log | Status transitions and privileged changes |
| Business settings | Validated operational configuration |

Use foreign keys and constraints to prevent cross-organization relationships, duplicate references, invalid durations, and inconsistent parent/attachment audiences. Index the organization, membership, assignment, status, and appointment-time lookups used for access and queues. Pagination is required for request lists and messages.

**11. Reliability and access requirements**

- Use invited accounts with a supported managed sign-in flow. Require MFA for staff before production. Rate-limit public intake, authentication-related endpoints, and message/upload creation.
- Validate authorization on the server and in database/storage policies. Use trusted membership records; never authorize from user-editable profile metadata. Test both permitted and denied operations.
- Keep public messages and internal notes distinct across queries, realtime events, exports, and notifications. Never serialize internal notes into a client page and merely hide them with CSS.
- Keep attachments private and issue short-lived authorized download URLs. Validate file signatures, sizes, and allowed formats; use safe filenames and delivery headers. Reject executable/active document types. Incorporate scanning/quarantine before broader file-format support. Internal-note attachments inherit staff-only access.
- Use transactions or database-level constraints for appointment booking and request/notification event creation. Check authorization again on mutations and validate state transitions. Use idempotency keys on operations prone to retry.
- Cache only public static assets and an offline shell initially. Do not cache authenticated pages, messages, API responses, or attachments in a service worker. Offline mode should explain that connection is required; never pretend to send queued work. Do not persist sensitive drafts on shared devices by default.
- Keep preview/test data separate from production, use synthetic fixtures, redact sensitive content from logs, and configure error tracking. Scheduled jobs must be authenticated and observable.
- Document database and attachment backup/restore separately. Database backups do not include Supabase Storage file objects. Confirm provider coverage and perform a restore exercise before client rollout. [Supabase database overview](https://supabase.com/docs/guides/database/overview).
- Provide an owner-approved retention policy, an operational export path, and a documented account deactivation/recovery process. Retention duration is a launch decision, not an invented legal requirement.

**12. Build order and acceptance gates**

| Milestone | Deliverable | Ready when |
|---|---|---|
| 1. Foundation and representative UI | App shell, shared design, roles/routes, client home, request detail, technician Today, owner queue/calendar, synthetic data | Works at phone and desktop sizes; keyboard navigation and all major UI states are demonstrated; demo mode is unmistakable |
| 2. Working support workflow | Real auth, invitations, organization/location model, requests, public messages, internal notes, private uploads, assignment | Client creates a request; assigned technician replies; client sees only allowed public content; owner manages the request |
| 3. Estimate and field workflow | Public/client estimate intake, schedule requests, dispatch calendar, booking conflict rules, visit updates, work logs | Inquiry becomes a confirmed visit; conflicting bookings are rejected; technician completes work and client receives the summary |
| 4. Operational completion | Email/in-app notifications, durable jobs, reminders, employee controls, filters/reports, PWA shell | Notifications retry safely; rescheduling cancels old reminders; deactivated accounts lose access; eligible devices can install the app |
| 5. Pilot and launch preparation | End-to-end tests, access tests, backup/restore check, setup/runbook, production configuration checklist | Owner and a small group of real invited pilot users can complete the core workflows without critical failures |

Milestone 1 is a design foundation, not the finished application. Launch requires the applicable gates through milestone 5. Track incomplete integrations explicitly. Do not deploy or message real users simply because a demo looks complete.

Acceptance scenarios that must be verified:

1. A client creates a request on a phone with a photo, receives one reference, and sees it after refresh.
2. Organization A cannot read, update, subscribe to, search for, export, or download Organization B's records, including by guessing IDs.
3. An ordinary client contact cannot see another contact's unshared request; a client administrator can see authorized organization requests.
4. An unassigned technician cannot inspect a request; assignment grants the intended access, and removal revokes it.
5. Internal notes and their attachments never reach client responses, messages, notifications, or exports.
6. Message retries do not duplicate posts; unread indicators reconcile across two sessions.
7. An estimate request creates no confirmed reservation until staff confirmation; concurrent conflicting bookings cannot both succeed without an authorized recorded override.
8. Rescheduling preserves history and removes obsolete reminders; completing a visit does not automatically close unresolved work.
9. The owner can reassign open work and deactivate an employee; the employee's existing session cannot continue protected operations.
10. Email-provider failure leaves a retryable delivery record while the request itself remains saved.
11. Expired/reused invitations fail safely; a valid invitation creates exactly the intended membership and cannot escalate privileges.
12. Loss of connection, expired sign-in, empty queues, long messages, and failed uploads have usable recovery states on mobile and desktop.

Use targeted unit/integration tests for permissions, state changes, booking conflicts, and notification jobs; end-to-end tests for the main role journeys; and visual/keyboard checks on representative screens. Check Safari/iPhone and Chrome/Android behavior on real devices when available. Record device gaps honestly. Run type checking, linting, tests, and a production build before handoff.

**13. Useful later additions**

| Phase | Features | Reason to defer |
|---|---|---|
| After a successful pilot | Web push, saved replies, knowledge articles, client satisfaction feedback, recurring visits, better labor reporting | Improve a proven support workflow |
| Business integrations | Two-way email intake/replies, Microsoft 365/Google calendar sync, SMS with opt-in/preferences, customer/contact imports | Require external credentials, mapping, delivery and conflict handling |
| Service expansion | Structured equipment inventory, service agreements, quote preparation/approval, invoice links, parts tracking | Each introduces its own data and operating rules |
| Only when justified | UniFi monitoring integrations, outage-generated tickets, AI-assisted summaries, native app-store distribution | Require separate scope, permission, reliability, and maintenance decisions |

Do not include live network dashboards, remote device control, automated AI answers, payroll, inventory purchasing, or payment processing in the initial release. Do not display invented device health or pretend an integration is connected. A Ubiquiti-inspired appearance does not imply a Ubiquiti integration.

**14. Owner decisions and launch preparation**

These decisions do not block a first build. Expose configurable defaults and record unresolved items rather than repeatedly interrupting development.

| Decision | Working default | Needed by |
|---|---|---|
| Product name and brand assets | Net-Tech Connect; provisional light/blue style | Final visual pass |
| Who can access the portal | Invited existing clients; public estimate inquiry only | Pilot onboarding |
| Business hours and emergency process | Configurable; no unverified response guarantee | Client pilot |
| Scheduling policy | Staff confirm; configurable duration/travel buffer | Scheduling pilot |
| Client-wide visibility | Client admin sees organization; ordinary contacts see own/shared requests | Membership setup |
| Existing ticketing/calendar tools | No assumed integration | Before introducing duplicate live workflows |
| Staff list and responsibilities | Owner also acts as dispatcher | Pilot assignments |
| Email sender, hosting, database accounts | Proposed providers above; separate test and production | Live integration setup |
| Retention and backups | Document policy; cover database plus files | Production readiness |
| App address and marketing-site links | Proposed `app.nettech.ms` | Launch |

Before live rollout, inventory any existing ticketing system and choose a source of truth. If one already handles all service work, decide whether this app should be its client interface before building a second independent queue. Do not assume the existing website's support button is connected to a specific system.

Plan operating costs around app hosting, database/auth/storage, transactional email, scheduled processing, monitoring, backups, and optional SMS. Do not promise a free production system or quote unverified vendor prices. Set spending alerts and document the chosen plans before enabling paid services.

Pilot with the owner, a small technician group, and a handful of clients. Watch for unassigned requests, missing replies, scheduling confusion, failed delivery, and mobile friction. Keep existing support contact methods available during the transition. Broader rollout follows actual workflow verification.

**15. Final implementation handoff**

The finished repository must contain the working application, schema migrations and access policies, synthetic seed data, example environment variables without secrets, test coverage for the critical scenarios, setup/deployment documentation, and an owner/technician quick-start guide. Include a precise list of configured integrations, remaining external setup, known limitations, verification results, and launch decisions.

Success means a client can request help without calling, Net-Tech can take ownership and organize a visit, the technician can finish the job from a phone, and everyone can find the correct conversation and service history afterward.
