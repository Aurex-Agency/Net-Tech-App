# Operations runbook

## Daily ownership

Assign a named owner for Unassigned/Waiting work, inactive-employee reassignment, missed visits, failed email and public inquiries. Keep the existing support phone/contact available during pilot. No response-time guarantee, emergency coverage, network monitoring or live chat service is implied by the application.

## Email worker

Run the authenticated `/api/jobs` endpoint on the reviewed cadence. Every call can claim up to 10 jobs. SQL uses `FOR UPDATE SKIP LOCKED`, unique deduplication keys and expiring leases; concurrent workers cannot both own the same claim. Lease recovery occurs after 10 minutes. The email provider receives the stable outbox UUID as its idempotency key. Provider errors remain pending with bounded exponential retries; after eight attempts jobs fail for review. Retries older than 23 hours after the **first attempt** fail for manual reconciliation so delivery does not escape the provider's deduplication window. Do not simply mint a new job UUID for an uncertain send.

Rescheduling/canceling a visit invalidates old reminder jobs. Recipient checks run again immediately before sending. A request stays saved when email fails. Jobs remain queued if email settings are incomplete. In-app notifications do not depend on email delivery. A database/send race cannot recall a message already accepted by the provider; minimal templates limit exposure.

Inspect from a trusted administrative SQL session (do not expose this schema to the client API):

```sql
select status, count(*) from private.outbox group by status;
select id, kind, attempts, due_at, last_error
from private.outbox
where status in ('pending','failed') order by due_at limit 100;
select outbox_id, attempted_at, ok, error_code
from private.delivery_attempts order by attempted_at desc limit 100;
```

Never export recipient email, tokens or message bodies to an unapproved monitoring service. If an email was accepted but persistence failed, allow the same-ID retry within the safe window. For a failed job outside that window, reconcile its ID against provider logs before any manual resend. Record operator/reason in the incident record.

The worker also cleans stale upload reservations and conditionally closes resolved requests only when `auto_close=true`. Check worker responses for closure errors. Alert on worker non-2xx, pending job age, failed deliveries, repeated policy/API errors and upload failures. Error tracking/log-drain credentials and external alert destinations are **not configured**. Configure redaction and retention before enabling them. No arbitrary retry should send email to removed members.

## Staff deactivation / access recovery

Use Team → Deactivate. Subsequent protected requests fail with the existing session. Open assignments/visits remain visible; reassign them in the request and calendar. Check collaborators and future visits as part of handover. Supabase session revocation can be an additional trusted administrative step, not a substitute for current database access checks. Retain profile authorship and service history. Do not delete Auth users to offboard employees.

For recovery, verify identity through an established channel, check the exact Auth UUID, record authorization, reset only the necessary Auth factors/credentials, and retest role/memberships. Owner changes require this trusted process; there is no UI owner-elevation switch.

## Backups and restore exercise (required before pilot)

Database backup and file-object backup are distinct. Supabase database backups do not include Storage object bytes. Select retention/recovery objectives and provider plans with the owner; none are invented here.

1. Record current app commit, migration versions, configuration and counts. Verify the selected project's database backup/PITR coverage and retention. Export an encrypted database backup using supported Supabase tooling; restrict access and separately protect the decryption key.
2. Export private Storage object bytes, object paths and checksums through an authorized server process. Include both bucket policy/configuration metadata and application attachment metadata. Do not publish a bucket or signed URL list as a backup.
3. Restore into an **isolated disposable project**, with email worker, public intake and invitations disabled. Apply the provider's supported Auth/Storage restore procedure; preserve account UUIDs and check identity linkage. Never assume restoring application tables alone restores Auth identities or MFA.
4. Restore object bytes and metadata, then compare request/message/attachment counts and checksums. Verify FK consistency, RLS/grants, migrations and indexes. Use synthetic test users to verify both allowed and denied reads/downloads.
5. Run request/message/reassignment/reschedule checks, confirm no queued production email can escape, and test app rollback. Record elapsed recovery time, data loss window, failures and corrective actions.
6. Destroy the disposable restore project only after retaining the approved evidence securely. Do not mark the exercise complete until it has actually run.

No backup/restore exercise has been performed during this build. Monitoring, file backup automation and recovery ownership are launch prerequisites.

## Retention / operational export

Reports → Export CSV provides an authorized request register with spreadsheet-formula protection. It is not a full backup or a complete subject-data export. Until an owner-approved policy exists, no automated deletion of service history, messages, notes or audits runs. Technical command receipts, rate-limit rows, delivery attempts and upload reservation rows also need a reviewed housekeeping policy at scale. Stale uploaded object bytes are cleaned by the worker; their audit/registration rows remain.

Document retention separately for Auth identities, service records, attachments, internal notes, audit/delivery records, logs and backups. Before implementing deletion, evaluate foreign keys, preserved authorship and backup expiry; verify with a restore test. Account deactivation does not delete records. Keep exports encrypted and restrict access. Approve vendor costs and spending alerts before enabling paid features.
