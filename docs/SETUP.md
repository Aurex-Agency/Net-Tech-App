# Connected environment setup

The application runs in demo without external services. The linked project `sorblhbsciedhyihjaum` was inspected read-only on September 16, 2026: healthy, PostgreSQL 17.6, region us-west-2, empty public schema. **It has not been migrated or connected to this build.** Confirm whether it is the intended staging or production project before writing to it. Use separate projects and environment scopes for staging and production.

## 1. Local development

Use Node 24 and `npm ci`. Copy `.env.example` to `.env.local`. Keep that file outside Git. Optional full Supabase development requires Docker:

```sh
npx supabase start
npx supabase db reset --local
npx supabase status
```

The reset command destroys only the local stack's data. The test suites use disposable databases and do not run it. `supabase/seed.sql` intentionally creates no accounts automatically.

For a disposable local stack, set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, its local publishable/anon key, local secret/service key, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and a temporary `DEMO_SEED_PASSWORD` of at least 12 characters. Then run `npm run seed:local`. The script rejects hosted URLs, requires an empty request table, creates synthetic `.test` users without sending invitations, and disables their email preferences. It prints account emails, never the password. Use the same fixture identities shown in the demo. This full Auth seed path remains to be verified with Docker.

## 2. Hosted staging schema

After selecting a disposable staging project, use the pinned CLI and review its migration plan:

```sh
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase db push --dry-run
# Apply only after verifying the selected project and reviewing the SQL:
npx supabase db push
```

Apply all four migrations in timestamp order. Do not expose the `private` schema through the Data API. Every public/private table has RLS; authenticated clients have only explicit read grants and protected RPC commands for writes. Inspect Supabase security/performance advisors after migration and review findings before pilot.

Migrations create private buckets `request-files` and `upload-quarantine`; retain their MIME/10 MB limits and all policies. Never make either bucket public. The quarantine bucket has no authenticated read policy; signed upload capabilities authorize the single reserved object. Verify actual Storage policies with both public and internal attachments, not just SQL mocks.

## 3. Environment variables

| Variable | Purpose | Where it may be exposed |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Product title / install manifest; default Net-Tech Connect | Public |
| `NEXT_PUBLIC_APP_URL` | Exact canonical origin, callbacks, same-origin write checks, email links | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | Environment's Supabase API | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (local legacy anon key also supported) | Public; protected by RLS |
| `SUPABASE_SECRET_KEY` | Secret/service key for server-side file processing, Auth link preparation, jobs, public inquiries | Server only |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verified transactional sender | Server only |
| `CRON_SECRET` | Random high-entropy worker bearer secret | Server only |
| `PUBLIC_INTAKE_ENABLED` | Set `true` only after Turnstile + abuse tests | Server only; default false |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget | Public |
| `TURNSTILE_SECRET_KEY` | Server verification and salted intake rate key | Server only |
| `REQUIRE_STAFF_MFA` | App enforcement, paired with database setting below | Server only; default false during setup |

Never put a secret/service key in a `NEXT_PUBLIC_` variable. Never use production keys in an untrusted preview. Public Next.js variables are built into the browser bundle, so redeploy after changing them. Supabase client custom domains/local origins require a deliberate update to the CSP `connect-src` allowlist in `next.config.ts`.

## 4. Auth, initial owner, invitations and MFA

Disable public signup in hosted Auth settings (local config already does). Enable email/password and email sign-in; require email verification. Configure a verified SMTP sender for Supabase Auth messages, separate from the application's Resend outbox. Enable leaked-password protection if available on the chosen plan. Set the exact Site URL and approved `/auth/callback` redirect URLs for the environment; test password recovery and magic links in both the original and another browser.

Initial owner bootstrap is a trusted admin operation after readiness review, not public signup:

1. Create a verified owner Auth account through the Supabase administrative interface; do not use a real recipient while testing. Record its exact UUID.
2. Verify the person/account identity, then run trusted SQL with the actual UUID:

```sql
update public.profiles
set role = 'owner', active = true
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

3. Confirm exactly the intended account changed. Sign in, create a client/location, and use Team → Prepare invitation for **test accounts only** until pilot approval.

The app generates an acceptance link but never automatically emails an invitation. Custom invitations expire after seven days; the Supabase authentication token in the same link may expire sooner according to Auth settings. Reprepare an expired link. Acceptance requires the verified matching email, unused invitation, and exact intended role/membership. Existing staff/owner/inactive accounts cannot gain privileges through a stale client invitation. Owner elevation/demotion is unavailable in the app, and a trigger protects the last active owner.

Enable Auth TOTP enrollment. Test enrollment/recovery with the owner first, then enforce both layers:

```sql
update public.settings
set data = jsonb_set(data, '{require_staff_mfa}', 'true'::jsonb)
where id;
```

Set `REQUIRE_STAFF_MFA=true` too. The database checks AAL2 from the verified token on protected queries/RPCs; app redirects alone are insufficient. Document a verified, audited owner recovery process and factor reset before enabling enforcement. Do not reset factors on an email-only request.

## 5. Email, scheduling and public estimates

Verify the Resend sender domain (SPF/DKIM and chosen DMARC policy), configure the environment variables, and use controlled test recipients. Receipt/reply/assignment/visit/resolution events save in-app notifications and email jobs transactionally. Email contains a minimal sign-in link; it never contains public message bodies, internal notes, labor, attachments or site context.

Configure a trusted scheduler to call `GET /api/jobs` with `Authorization: Bearer <CRON_SECRET>` every 1–5 minutes at a cadence supported by the selected hosting plan. The route is already implemented; no external schedule is installed. It handles reminders, retries, stale quarantine cleanup and optional closure. Automatic closure starts disabled. Do not enable it until scheduler/reopening tests pass.

Public estimates need a Turnstile widget restricted to the exact app hostname and matching server secret. Enable only after hostname validation, repeated-submit, rate-limit and failure tests. Public intake creates a private inquiry, no Auth account and no booking. Dispatch converts it into an existing client/location record through the request queue. Public photos are intentionally unavailable; signed-in clients can attach photos after onboarding.

## Integration references

[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
