import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/server";
export const maxDuration = 60;
function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const actual = "Bearer " + expected;
  return (
    supplied.length === actual.length &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(actual))
  );
}
export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = adminClient();
  const { data: stale } = await db.rpc("stale_uploads");
  for (const upload of stale ?? []) {
    const { error: removeError } = await db.storage
      .from("upload-quarantine")
      .remove([upload.id]);
    let finalError = false;
    if (!upload.completed_at) {
      const result = await db.storage
        .from("request-files")
        .remove([
          `${upload.request_id}/${upload.note_id ? "internal" : "public"}/${upload.id}`,
        ]);
      finalError = !!result.error;
    }
    if (!removeError && !finalError)
      await db.rpc("ack_upload_cleanup", { ids: [upload.id] });
  }
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.NEXT_PUBLIC_APP_URL
  )
    return Response.json(
      { error: "Email worker configuration incomplete. Jobs remain queued." },
      { status: 503 },
    );
  const { data: jobs, error } = await db.rpc("claim_jobs", { batch_size: 10 });
  if (error)
    return Response.json({ error: "Unable to claim jobs" }, { status: 500 });
  let sent = 0,
    failed = 0,
    canceled = 0;
  for (const job of jobs ?? []) {
    const { data: context, error: contextError } = await db.rpc(
      "delivery_context",
      { job_id: job.id, lease: job.lease_token },
    );
    if (contextError) {
      failed++;
      await db.rpc("finish_job", {
        job_id: job.id,
        lease: job.lease_token,
        ok: false,
        error_code: "context_check_failed",
      });
      continue;
    }
    if (!context) {
      canceled++;
      continue;
    }
    let ok = false,
      errorCode = "provider_unavailable";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": job.id,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: context.email,
          subject: "An update from Net-Tech",
          text: `There is an update in your secure Net-Tech workspace. Sign in to view it:\n\n${process.env.NEXT_PUBLIC_APP_URL}/workspace/requests/${context.request_id}\n\nFor your privacy, service details are available only after sign-in.\n\nThis address sends notifications only. Please reply through your Net-Tech workspace.`,
        }),
        signal: AbortSignal.timeout(4000),
      });
      ok = response.ok;
      errorCode = ok ? "" : `provider_http_${response.status}`;
    } catch {
      /* No recipient or message details in logs. */
    }
    const { error: finishError } = await db.rpc("finish_job", {
      job_id: job.id,
      lease: job.lease_token,
      ok,
      error_code: errorCode,
    });
    if (finishError)
      return Response.json(
        {
          error:
            "Job result persistence failed; lease recovery will retry safely.",
        },
        { status: 503 },
      );
    if (ok) sent++;
    else failed++;
  }
  const { data: closed, error: closeError } = await db.rpc("close_resolved");
  return Response.json({
    sent,
    failed,
    canceled,
    closed: closed ?? 0,
    closureError: !!closeError,
  });
}
