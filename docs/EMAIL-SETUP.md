# Email and staff setup

Updated September 17, 2026. This deployment remains the designated review/test environment, with fictional clients and requests.

## Configured

- Sender: **Net-Tech Staff <staff@team.nettech.ms>**. This is send-only; conversations stay in the workspace.
- Vercel: `RESEND_API_KEY` and `EMAIL_FROM` set as Secrets for Production and Preview. The provider key is restricted to sending. Secrets and setup links are only in ignored, private local files; never commit them.
- Supabase Auth custom SMTP: `smtp.resend.com`, port 465, username `resend`, supplied API key as the password. Same sender identity as the application.
- Recovery subject: `Reset your Net-Tech password`; source: `supabase/templates/recovery.html`.
- Magic-link subject: `Your Net-Tech sign-in link`; source: `supabase/templates/magic-link.html`.
- Canonical Auth Site URL: `https://net-tech-app.vercel.app`. Callback allowlist includes the exact `/auth/callback` plus `/auth/callback?next=**` for the app's return destination. Existing integration-managed preview entries remain unchanged. Recheck these settings after changing the Vercel integration.

The templates are installed manually in Authentication → Emails; they are not database migrations. Recovery uses the canonical token-hash callback. The magic-link template appends the hash/type to `RedirectTo`: callers must supply the app's `/auth/callback?next=<encoded relative workspace path>` URL, as the sign-in form does. This keeps the destination and works without a browser-local PKCE verifier. Update the canonical origin in the recovery template before using another deployment/domain.

## Prepared staff access

The designated owner account is created with the owner role. One technician invitation is prepared; the technician role takes effect only after the matching recipient accepts. Neither recipient has a shared password or a confirmed email created on their behalf. Private setup links and exact message drafts are in the ignored `.env.staff-onboarding.json`; do not upload this file to Vercel or share it publicly. Regenerate expired links before sending. No business was assigned without a real business selection.

Prepared email subjects are “Set up your Net-Tech owner account” and “Set up your Net-Tech technician account.” Each message includes the recipient's private setup link, asks them to choose a password, and explains that the workspace currently contains fictional test records. No human recipient has been contacted. Account notification preferences remain off until staff review.

## Verified and remaining

Resend accepted a message to `delivered@resend.dev`, its delivery simulator. Supabase also accepted a recovery-email request through custom SMTP for that inactive synthetic account. Live callback tests verified recovery, password update, magic-link cookies, preserved return destinations and inactive-account access denial. These checks do not prove human inbox placement or email-client rendering.

The scheduler is still not installed, and request-update emails/reminders do not automatically dispatch yet. In-app notifications work. Before activating the worker, approve recipients, review the queue, configure `CRON_SECRET` and the schedule described in `SETUP.md`, then confirm inbox delivery and retry/alert behavior. Do not enable notifications on fictional fixture addresses. Real-client invitations and launch remain pending review.

References: [Resend SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp), [Resend simulator](https://resend.com/changelog/sending-test-emails), [Supabase Auth templates](https://supabase.com/docs/guides/auth/auth-email-templates).
