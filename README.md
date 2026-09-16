# Net-Tech Connect

A responsive client portal and service workspace for Net-Tech: support, estimates, canonical request conversations, dispatch, field visits, client records, and employee operations. Built from [the product brief](NET-TECH-APP-PLAN.md).

**Status: GitHub checks pass; the designated Supabase test backend is migrated.** Vercel configuration, test-account bootstrap and connected acceptance remain pending. No real invitations, email deliveries, production launch, DNS changes, or marketing-site changes have been made.

## Review the application

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No credentials are needed for the clearly labeled synthetic demo:

- [Client](http://localhost:3000/demo/client): support/estimate intake, messages, visits, organization, account.
- [Technician](http://localhost:3000/demo/technician): assigned work, internal notes, field updates, availability, time entries.
- [Owner](http://localhost:3000/demo/owner): queue, scheduling, client/location records, team, reports, settings.
- [Sign-in](http://localhost:3000/sign-in) and [public estimate](http://localhost:3000/estimate): integration/setup states until configured.

Use the role switch to review the same synthetic work from different perspectives. Demo changes persist in this browser and synchronize between its tabs. Account → Reset demo restores fixtures. Demo records are **not** connected to Supabase; files, invitations, and email are deliberately unavailable in demo. Do not enter actual client information into the demo.

## What is implemented

- Original Net-Tech light/blue design, current brand mark, responsive navigation, accessible dialogs/forms, reduced motion, offline and recovery states.
- Trusted role/membership model with PostgreSQL RLS, transactional command APIs, idempotent requests/messages, private internal notes and site context, assignment/sharing boundaries.
- Client intake and canonical conversations; client cancellation/change requests leave confirmed bookings intact; completion summaries, reopening and linked follow-ups.
- Serialized booking conflict checks, individual working hours, travel buffers, reviewed availability, reasoned overrides and audit history; independent visit/request states.
- Owner/dispatcher client maintenance, contacts/memberships, collaborators, employee roles/deactivation, manual time and materials; reports and formula-safe CSV.
- Supabase Auth/Storage adapters, MFA flow, single-use invitations, quarantined direct file uploads, durable email outbox/reminders, protected worker, limited public estimate intake with Turnstile.
- Installable manifest and a service worker that caches only a public offline page. No private offline data cache.

## Stack and verification

Next.js App Router, React, strict TypeScript, Supabase/Postgres/Auth/Storage, Zod, Sharp, custom CSS, Lucide, Vitest, Playwright/axe. Exact dependencies and lockfile are committed. Use Node 24 (tested locally); `.nvmrc` records the major.

```sh
npm run check              # lint, TypeScript, unit tests, SQL/RLS integration, production build
npm run test:e2e           # desktop + phone-sized Chromium journeys and axe checks
npm run test:concurrency   # disposable real Postgres; port 55437 must be free
# With `npm run start -- --port 3100` running after a build:
npm run test:production    # rendering, CSP, Auth redirect, PWA/offline cache
```

Install Chromium once with `npx playwright install chromium`. The concurrency suite uses a bundled local Postgres executable and must run as a non-root user. If your package manager blocks its install script, inspect the installed `@embedded-postgres/<your-platform>/scripts/hydrate-symlinks.js` script and run that platform script before testing (for this Intel Mac: `node node_modules/@embedded-postgres/darwin-x64/scripts/hydrate-symlinks.js`). PGlite tests run without Docker. The optional full local Supabase stack needs Docker; see setup.

## Handoff

- [Milestone checklist](docs/IMPLEMENTATION-CHECKLIST.md)
- [Supabase and integration setup](docs/SETUP.md)
- [Vercel import and launch checklist](docs/DEPLOYMENT.md)
- [Access model and security](docs/SECURITY.md)
- [Verification results and limits](docs/VERIFICATION.md)
- [Owner and technician quick start](docs/QUICKSTART.md)
- [Operations, delivery, backup and restore](docs/OPERATIONS.md)

`lib/seed.ts` contains fictional fixture data. SQL migrations live in `supabase/migrations/`; `tests/database-bootstrap.sql` is a **test shim**, never a hosted migration. `.env.example` contains no secrets.
