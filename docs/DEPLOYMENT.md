# Vercel import and launch

**Review first.** The application can be imported as a Next.js project. This repository does not configure automatic production migrations, invite users, enable public intake, or schedule outbound email. No Vercel project has been deployed by this implementation.

## Current test backend

Use `sorblhbsciedhyihjaum` for this review, as authorized by the owner. Its six migrations and private buckets are already installed; do not reset it or reapply migrations manually. Public Auth signup is disabled. The ignored local `.env.vercel-testing` file contains the correct URL/publishable key, including the server-only secret key; only `NEXT_PUBLIC_APP_URL` still needs replacement. Import these variables into the intended Vercel test project. Replace the origin placeholder with the exact Vercel project URL, then rebuild. Never commit this environment file.

The synthetic test owner is already created: `taylor@example.test`. Its password and the other test-account emails are in the ignored `.env.test-accounts` file; do not upload that account file to Vercel. Configure Auth → URL Configuration with the deployed Site URL and its `/auth/callback` redirect. Keep `PUBLIC_INTAKE_ENABLED=false`; leave email-provider and scheduler credentials unset. `/demo/client`, `/demo/technician`, and `/demo/owner` continue to use browser-only fictional fixtures even when the connected workspace is configured.

## Review deployment

1. Connect the intended GitHub repository to Vercel when ready. Framework: **Next.js**. Root: repository root. Install: `npm ci`. Build: `npm run build`. Output directory: framework default. Node: **24.x**. No static export; the Auth/API routes need server functions.
2. For a visual review, leave Supabase/email keys unset. The root opens the explicit synthetic demo. Set `NEXT_PUBLIC_APP_URL` to the exact review origin. Enable Vercel deployment protection before sharing the review URL.
3. For connected staging, follow `SETUP.md` using staging credentials only, then set the approved staging URL, Auth redirects and Turnstile hostname. Rebuild after changing public environment variables. Avoid broad wildcard Auth redirects to every preview.
4. Run the connected acceptance matrix in `VERIFICATION.md`. Review SQL policies and Supabase advisors, actual Auth/Storage behavior, email delivery, and install behavior on real devices.
5. Obtain owner approval before any production import/deploy, real account invitations, domain/DNS cutover or marketing-site changes. Vercel's first import may create a Production deployment automatically; keep this limited to synthetic review configuration until approval.

`vercel.json` only declares the framework/build/install commands. No cron is installed. Once authorized, configure a scheduler separately and set its secret. Vercel can send `CRON_SECRET` as the worker authorization header; confirm the chosen plan supports the needed frequency. [Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Files upload directly to a private Supabase quarantine bucket, then the server validates/processes them. This avoids routing a 10 MB upload through Vercel's incoming function-body limit. Validate the hosting plan's execution/memory limits with maximum-size camera images and concurrent uploads. [Function limits](https://vercel.com/docs/functions/limitations). Node 24 is supported for Vercel builds/functions. [Node runtime versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Production approval checklist

- [ ] Owner reviews all three experiences and outstanding limitations.
- [ ] Existing ticketing/calendar systems inventoried; service source of truth chosen.
- [ ] Production Supabase project explicitly identified; staging tests signed off.
- [ ] Migration dry-run, backups, file backup and restore exercise completed.
- [ ] Owner identity bootstrap and emergency recovery process verified; MFA enforced in app and database.
- [ ] Secret keys set in correct environment scopes; least-privilege access reviewed.
- [ ] Auth signup disabled, SMTP sender and redirects verified; invitation/recovery flows tested.
- [ ] Actual private Storage/10 MB upload/revocation checks pass on phones.
- [ ] Email sender, retry worker and operational alerting verified using test recipients.
- [ ] Public intake abuse checks pass before enabling; closure worker tested before auto-close.
- [ ] Contact details, hours, travel buffers, service area and response commitments approved.
- [ ] Retention policy, backup recovery objectives, privacy notice and access review owner recorded.
- [ ] Real Safari/iPhone and Chrome/Android checks pass, including PWA install and camera/library selection.
- [ ] Hosting/database/email/monitoring plans, spending alerts and budget approved.
- [ ] Explicit pilot authorization obtained; invite only the approved small group.
- [ ] DNS `app.nettech.ms`, HTTPS and marketing links updated only after launch approval.

## Release / rollback

CI checks each push/PR using only synthetic data. Deploy the reviewed commit to staging first. Production migrations are manual review gates; CI has no database credentials. Record app commit, migration versions and operator. Restore the previous Vercel deployment for an app-only regression. For a schema regression, assess compatibility and use a reviewed forward fix or the tested backup procedure; do not blindly reverse migrations with live data. Pause email/public intake during incident triage.
