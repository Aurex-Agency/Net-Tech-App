import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { seedStore, DEMO_IDS } from "../lib/seed";
const db = new PGlite();
let assertions = 0;
await db.exec(await readFile("tests/database-bootstrap.sql", "utf8"));
for (const file of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  console.log("Applied", file);
}
const seed = seedStore();
for (const p of seed.profiles) {
  await db.query<Record<string, unknown>>(
    "insert into auth.users(id,email) values($1,$2)",
    [p.id, p.email],
  );
  await db.query<Record<string, unknown>>(
    "update public.profiles set name=$2,role=$3 where id=$1",
    [p.id, p.name, p.role],
  );
}
for (const table of [
  "organizations",
  "locations",
  "memberships",
  "requests",
  "messages",
  "notes",
  "appointments",
] as const) {
  for (const input of seed[table]) {
    const row = { ...input } as Record<string, unknown>;
    if (["memberships", "messages", "notes"].includes(table))
      row.id = crypto.randomUUID();
    const keys = Object.keys(row);
    await db.query<Record<string, unknown>>(
      `insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
      keys.map((k) => (k === "tasks" ? JSON.stringify(row[k]) : row[k])),
    );
  }
}
await db.exec("select setval('public.request_reference_seq',10049,true)");
const client = DEMO_IDS.client,
  tech = DEMO_IDS.technician,
  owner = DEMO_IDS.owner,
  other = DEMO_IDS.other;
const req = seed.requests[0].id,
  otherReq = seed.requests[4].id;
async function as(id: string, sql: string, params: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query<Record<string, unknown>>(
    "select set_config('request.jwt.claim.sub',$1,false)",
    [id],
  );
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function command(
  id: string,
  type: string,
  rid: string | null,
  payload: Record<string, unknown>,
  key = crypto.randomUUID(),
) {
  return as(id, "select public.command($1,$2,$3,$4) result", [
    type,
    rid,
    key,
    JSON.stringify(payload),
  ]);
}
async function denied(fn: () => Promise<unknown>, label: string) {
  await assert.rejects(fn);
  assertions++;
  console.log("PASS denied:", label);
}
async function count(
  id: string,
  table: string,
  where = "",
  params: unknown[] = [],
) {
  const r = await as(
    id,
    `select count(*)::int n from ${table} ${where}`,
    params,
  );
  return (r.rows[0] as { n: number }).n;
}
function pass(condition: unknown, label: string) {
  assert.ok(condition, label);
  assertions++;
  console.log("PASS", label);
}
pass(
  (await count(client, "public.requests")) === 6,
  "client administrator sees only own organization",
);
pass(
  (await count(client, "public.requests", "where id=$1", [otherReq])) === 0,
  "guessed cross-organization request ID is invisible",
);
pass(
  (await count(other, "public.requests", "where id=$1", [req])) === 0,
  "organization B cannot inspect A",
);
await denied(
  () =>
    as(client, "update public.requests set assignee_id=$1 where id=$2", [
      client,
      req,
    ]),
  "direct request mutation",
);
await denied(
  () => command(client, "update_request", req, { priority: "urgent" }),
  "client priority escalation",
);
pass(
  (await count(client, "public.notes")) === 0,
  "internal notes never enter client SELECT payloads",
);
await denied(
  () => command(client, "note", req, { body: "secret" }),
  "client internal note write",
);
await denied(
  () => as(client, "select email from public.profiles"),
  "client cannot scrape profile emails",
);
await denied(
  () => as(client, "select * from private.outbox"),
  "outbox inaccessible",
);
const before = await count(tech, "public.requests");
pass(before === 5, "technician sees only assigned work");
await denied(
  () => command(tech, "reply", otherReq, { body: "cannot see" }),
  "unassigned technician reply",
);
await command(owner, "update_request", otherReq, { assignee_id: tech });
pass(
  (await count(tech, "public.requests")) === before + 1,
  "assignment grants access",
);
await command(owner, "update_request", otherReq, { assignee_id: "" });
pass(
  (await count(tech, "public.requests")) === before,
  "removal revokes access using same session",
);
const contact = crypto.randomUUID();
await db.query<Record<string, unknown>>(
  "insert into auth.users(id,email) values($1,$2)",
  [contact, "contact@example.test"],
);
await db.query<Record<string, unknown>>(
  "insert into public.memberships(user_id,organization_id) values($1,$2)",
  [contact, seed.organizations[0].id],
);
pass(
  (await count(contact, "public.requests")) === 0,
  "ordinary contact cannot read unshared colleague requests",
);
await command(owner, "share", req, { user_id: contact });
pass(
  (await count(contact, "public.requests")) === 1,
  "explicit sharing grants only intended request",
);
await db.query<Record<string, unknown>>(
  "update public.memberships set active=false where user_id=$1",
  [contact],
);
pass(
  (await count(contact, "public.requests")) === 0,
  "membership removal revokes existing session",
);
const createKey = crypto.randomUUID();
const payload = {
  location_id: seed.locations[0].id,
  kind: "support",
  title: "Synthetic support test",
  description: "A real transaction tested against Postgres.",
};
await command(client, "create_request", null, payload, createKey);
await command(client, "create_request", null, payload, createKey);
pass(
  (await count(client, "public.requests", "where id=$1", [createKey])) === 1,
  "request retries create exactly one reference",
);
await denied(
  () =>
    command(
      client,
      "create_request",
      null,
      { ...payload, title: "Different payload" },
      createKey,
    ),
  "idempotency key reuse with different content",
);
const messageKey = crypto.randomUUID();
await command(
  tech,
  "reply",
  req,
  { body: "A verified public reply." },
  messageKey,
);
await command(
  tech,
  "reply",
  req,
  { body: "A verified public reply." },
  messageKey,
);
pass(
  (await count(client, "public.messages", "where id=$1", [messageKey])) === 1,
  "message retry deduplicated",
);
await command(client, "read", req, {});
pass(
  (await count(client, "public.read_cursors", "where request_id=$1", [req])) ===
    1,
  "read cursor is durable",
);
await denied(
  () => command(tech, "update_request", req, { status: "resolved" }),
  "resolution without public summary",
);
await command(tech, "update_request", req, {
  status: "resolved",
  completion_summary: "Replaced and tested the faulty access point.",
});
await command(client, "reply", req, { body: "The issue is still happening." });
pass(
  (
    await as(
      client,
      "select status,reopen_count from public.requests where id=$1",
      [req],
    )
  ).rows[0]?.status === "in_progress",
  "reply reopens resolved work",
);
const schedule = {
  technician_id: tech,
  starts_at: "2026-10-06T15:00:00Z",
  ends_at: "2026-10-06T16:00:00Z",
  status: "confirmed",
  purpose: "Test site visit",
};
const appointmentKey = crypto.randomUUID();
await command(owner, "schedule", req, schedule, appointmentKey);
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      starts_at: "2026-10-06T15:30:00Z",
    }),
  "overlapping confirmed booking",
);
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      starts_at: "2026-10-06T16:10:00Z",
      ends_at: "2026-10-06T17:00:00Z",
    }),
  "travel buffer conflict",
);
await command(owner, "schedule", req, { ...schedule, status: "proposed" });
pass(true, "proposal does not reserve time");
await command(owner, "schedule", req, {
  ...schedule,
  override_reason: "Two technicians will work together; dispatcher approved.",
});
pass(
  Number(
    (
      await db.query<Record<string, unknown>>(
        "select count(*) n from private.audit_log where action='schedule' and reason is not null",
      )
    ).rows[0].n,
  ) === 1,
  "conflict override has audit history",
);
await command(owner, "schedule", req, {
  ...schedule,
  appointment_id: appointmentKey,
  version: 1,
  starts_at: "2026-10-07T15:00:00Z",
  ends_at: "2026-10-07T16:00:00Z",
});
pass(
  Number(
    (
      await db.query<Record<string, unknown>>(
        "select count(*) n from private.outbox where appointment_id=$1 and appointment_version=1 and status='pending'",
        [appointmentKey],
      )
    ).rows[0].n,
  ) === 0,
  "reschedule cancels old reminders",
);
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      appointment_id: appointmentKey,
      version: 1,
    }),
  "stale appointment edit",
);
await command(tech, "visit", appointmentKey, { status: "en_route" });
await command(tech, "visit", appointmentKey, { status: "on_site" });
await denied(
  () => command(tech, "visit", appointmentKey, { status: "completed" }),
  "visit completion without summary",
);
await command(tech, "visit", appointmentKey, {
  status: "completed",
  summary: "Checked all devices. More parts are needed.",
});
pass(
  (await as(client, "select status from public.requests where id=$1", [req]))
    .rows[0].status === "in_progress",
  "visit completion does not resolve request",
);
const publicFile = crypto.randomUUID(),
  internalFile = crypto.randomUUID(),
  noteId = (
    await db.query<Record<string, unknown>>(
      "select id from public.notes limit 1",
    )
  ).rows[0].id;
await db.query<Record<string, unknown>>(
  "select private.register_attachment($1,$2,null,$3,$4,$5,$6,100)",
  [tech, req, publicFile, "photo.png", "test/public", "image/png"],
);
await db.query<Record<string, unknown>>(
  "select private.register_attachment($1,$2,$3,$4,$5,$6,$7,100)",
  [
    tech,
    req,
    noteId,
    internalFile,
    "internal.png",
    "test/internal",
    "image/png",
  ],
);
await db.exec(
  "insert into storage.objects(bucket_id,name) values('request-files','test/public'),('request-files','test/internal')",
);
pass(
  (await count(client, "public.attachments")) === 1,
  "client sees only public attachment metadata",
);
pass(
  (await count(client, "storage.objects")) === 1,
  "storage policies exclude internal objects",
);
pass(
  (await count(other, "storage.objects")) === 0,
  "cross-organization downloads denied",
);
await command(owner, "employee", tech, { active: false });
pass(
  (await count(tech, "public.requests")) === 0,
  "inactive technician loses SELECT access immediately",
);
await denied(
  () => command(tech, "reply", req, { body: "old session" }),
  "inactive technician cannot mutate with old session",
);
pass(
  (await count(owner, "public.requests", "where assignee_id=$1", [tech])) > 0,
  "deactivated employee work stays visible",
);
await command(owner, "employee", tech, { active: true });
await db.query<Record<string, unknown>>(
  "update public.settings set data=jsonb_set(data,'{require_staff_mfa}','true')",
);
pass(
  (await count(tech, "public.requests")) === 0,
  "staff MFA required by database, not only UI",
);
await db.exec("select set_config('request.jwt.claim.aal','aal2',false)");
pass(
  (await count(tech, "public.requests")) > 0,
  "AAL2 restores authorized staff access",
);
await denied(
  () => command(owner, "employee", owner, { active: false }),
  "owner change blocked in application",
);
await denied(
  () =>
    db.query<Record<string, unknown>>(
      "update public.profiles set active=false where id=$1",
      [owner],
    ),
  "last owner cannot be deactivated",
);
const inviteUser = crypto.randomUUID();
await db.query<Record<string, unknown>>(
  "insert into auth.users(id,email) values($1,$2)",
  [inviteUser, "invite@example.test"],
);
await as(owner, "select public.create_invitation($1,$2,$3,$4)", [
  "hash-test",
  "invite@example.test",
  "client_admin",
  seed.organizations[0].id,
]);
await as(inviteUser, "select public.accept_invitation($1)", ["hash-test"]);
pass(
  (await count(inviteUser, "public.requests")) > 0,
  "valid invitation grants intended organization admin membership",
);
await denied(
  () => as(inviteUser, "select public.accept_invitation($1)", ["hash-test"]),
  "reused invitation fails",
);
await denied(
  () =>
    as(client, "select public.create_invitation($1,$2,$3,$4)", [
      "x",
      "bad@example.test",
      "owner",
      null,
    ]),
  "client cannot grant roles",
);
await as(owner, "select public.create_invitation($1,$2,$3,$4)", [
  "expired",
  "invite@example.test",
  "client",
  seed.organizations[0].id,
]);
await db.exec(
  "update private.invitations set expires_at=now()-interval '1 day' where token_hash='expired'",
);
await denied(
  () => as(inviteUser, "select public.accept_invitation($1)", ["expired"]),
  "expired invite fails",
);
const jobs = (
  await db.query<Record<string, unknown>>("select private.claim_jobs(50) jobs")
).rows[0].jobs as { id: string; lease_token: string }[];
pass(jobs.length > 0, "outbox jobs created in request transactions");
const job = jobs[0];
await db.query<Record<string, unknown>>(
  "select private.finish_job($1,$2,false,$3)",
  [job.id, job.lease_token, "provider_http_503"],
);
pass(
  (
    await db.query<Record<string, unknown>>(
      "select status,attempts,last_error from private.outbox where id=$1",
      [job.id],
    )
  ).rows[0].status === "pending",
  "provider failure retains retryable job",
);
await db.exec("set role anon");
await denied(
  () => db.query<Record<string, unknown>>("select * from public.requests"),
  "anonymous request reads",
);
await denied(
  () => db.query<Record<string, unknown>>("select public.claim_jobs(10)"),
  "anonymous job claims",
);
await db.exec("reset role");
pass(
  Number(
    (
      await db.query<Record<string, unknown>>(
        "select count(*) n from pg_tables where schemaname in ('public','private') and not rowsecurity",
      )
    ).rows[0].n,
  ) === 0,
  "all application tables have RLS enabled",
);
// Regression checks for null-role authorization, upload quarantine and paging.
pass(
  (await count(client, "public.organizations")) === 1,
  "organization policy resolves the outer organization ID",
);
await db.query<Record<string, unknown>>(
  "update public.profiles set active=false where id=$1",
  [tech],
);
await denied(
  () =>
    as(tech, "select public.create_invitation($1,$2,$3,$4)", [
      "inactive-escape",
      "escape@example.test",
      "dispatcher",
      null,
    ]),
  "inactive user cannot bypass owner check through SQL NULL",
);
await denied(
  () => as(tech, "select public.list_inquiries()"),
  "inactive user cannot inspect public inquiries",
);
await db.query<Record<string, unknown>>(
  "update public.profiles set active=true where id=$1",
  [tech],
);
const reserved = crypto.randomUUID();
await db.query<Record<string, unknown>>(
  "select private.begin_upload($1,$2,null,$3,$4,$5,100)",
  [client, req, reserved, "proof.png", "image/png"],
);
await db.exec(
  "insert into storage.objects(bucket_id,name) values('upload-quarantine','reserved-file')",
);
pass(
  (await count(
    client,
    "storage.objects",
    "where bucket_id='upload-quarantine'",
  )) === 0,
  "quarantine cannot be read by authenticated clients",
);
await denied(
  () =>
    as(client, "select public.begin_upload($1,$2,null,$3,$4,$5,100)", [
      client,
      req,
      crypto.randomUUID(),
      "x.png",
      "image/png",
    ]),
  "direct upload registration is server-only",
);
await denied(
  () =>
    db.query<Record<string, unknown>>(
      "select private.begin_upload($1,$2,null,$3,$4,$5,100)",
      [other, req, crypto.randomUUID(), "x.png", "image/png"],
    ),
  "cross-organization upload reservation",
);
await db.query<Record<string, unknown>>(
  "select private.complete_upload($1,$2,$3,100)",
  [client, reserved, "image/png"],
);
await db.query<Record<string, unknown>>(
  "select private.complete_upload($1,$2,$3,100)",
  [client, reserved, "image/png"],
);
pass(
  (await count(client, "public.attachments", "where id=$1", [reserved])) === 1,
  "upload finalization is idempotent",
);
const recent = await as(client, "select * from public.recent_messages($1,1)", [
  [req, otherReq],
]);
pass(
  recent.rows.length === 1 && recent.rows[0].request_id === req,
  "message window is bounded and preserves request RLS",
);
const unread = await as(client, "select * from public.unread_counts()");
pass(
  unread.rows.every((r) => r.request_id !== otherReq),
  "unread aggregate does not leak another organization",
);
await command(owner, "staff_hours", tech, {
  working_start: "09:00",
  working_end: "12:00",
  working_days: [1],
});
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      starts_at: "2026-10-13T15:00:00Z",
      ends_at: "2026-10-13T16:00:00Z",
    }),
  "individual technician working days are enforced",
);
await command(owner, "staff_hours", tech, {
  working_start: "08:00",
  working_end: "17:00",
  working_days: [1, 2, 3, 4, 5],
});
const beforeJobs = Number(
  (
    await db.query<Record<string, unknown>>(
      "select count(*) n from private.outbox",
    )
  ).rows[0].n,
);
await command(tech, "note", req, {
  body: "This must never produce a client email or event.",
});
pass(
  Number(
    (
      await db.query<Record<string, unknown>>(
        "select count(*) n from private.outbox",
      )
    ).rows[0].n,
  ) === beforeJobs,
  "internal notes produce no client outbox jobs",
);
// Reauthorize an already-leased job, including membership removal between claim and send.
const pending = jobs.find(
  (j) => (j as { recipient_id?: string }).recipient_id === client,
);
assert.ok(pending, "A client delivery must be present in this fixture");
await db.query("update public.memberships set active=false where user_id=$1", [
  client,
]);
const context = await db.query<{ data: unknown }>(
  "select private.delivery_context($1,$2) data",
  [pending.id, pending.lease_token],
);
pass(
  context.rows[0].data === null,
  "email recipients are reauthorized at send time",
);
await db.query("update public.memberships set active=true where user_id=$1", [
  client,
]);
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      appointment_id: appointmentKey,
    }),
  "appointment edit without version fails closed",
);
await command(owner, "employee", tech, { role: "dispatcher" });
pass(
  (await as(tech, "select public.my_profile() p")).rows[0].p &&
    (await count(tech, "public.requests")) > before,
  "owner can grant dispatcher role without deactivating employee",
);
await command(owner, "employee", tech, { role: "technician" });
await command(owner, "edit_location", seed.locations[0].id, {
  ...seed.locations[0],
  site_summary: "Internal switch room context",
  management_url: "https://example.test/management",
});
pass(
  JSON.stringify(
    (await as(client, "select public.site_context() notes")).rows[0].notes,
  ) === "[]",
  "client cannot fetch internal site context by direct RPC",
);
pass(
  JSON.stringify(
    (await as(tech, "select public.site_context() notes")).rows[0].notes,
  ).includes("Internal switch room"),
  "assigned technician can read authorized site context",
);
await denied(
  () =>
    command(client, "edit_location", seed.locations[0].id, seed.locations[0]),
  "client cannot edit site records",
);
await denied(
  () => as(client, "select public.service_report()"),
  "client cannot access operational report aggregates",
);
pass(
  Number(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
      )
    ).rows[0].n,
  ) === 0,
  "exposed API functions are all security invoker",
);
// A reminder may be created days before its first delivery attempt; the retry window starts at delivery.
const delayed = crypto.randomUUID();
await db.query(
  "insert into private.outbox(id,dedup_key,request_id,recipient_id,kind,created_at) values($1::uuid,$1::text,$2,$3,'Synthetic delayed reminder',now()-interval '5 days')",
  [delayed, req, client],
);
const delayedJobs = (
  await db.query<{ jobs: { id: string; lease_token: string }[] }>(
    "select private.claim_jobs(50) jobs",
  )
).rows[0].jobs;
const delayedJob = delayedJobs.find((j) => j.id === delayed);
assert.ok(delayedJob);
await db.query("select private.finish_job($1,$2,false,'provider_http_503')", [
  delayedJob.id,
  delayedJob.lease_token,
]);
await db.query("update private.outbox set due_at=now() where id=$1", [delayed]);
const retry = (
  await db.query<{ jobs: { id: string }[] }>(
    "select private.claim_jobs(50) jobs",
  )
).rows[0].jobs;
pass(
  retry.some((j) => j.id === delayed),
  "old reminder can retry within first delivery idempotency window",
);
await denied(
  () =>
    command(owner, "schedule", req, {
      ...schedule,
      technician_id: seed.profiles[4].id,
      starts_at: "2026-10-20T15:00:00Z",
      ends_at: "2026-10-20T16:00:00Z",
    }),
  "cannot book a technician who lacks request access",
);
const counters = (await as(client, "select public.workspace_counts() data"))
  .rows[0].data as { open: number };
pass(
  counters.open ===
    (await count(
      client,
      "public.requests",
      "where status not in ('resolved','closed','canceled')",
    )),
  "dashboard totals match all authorized open work",
);
// Business defaults route future work without expanding historical access.
const businessA = seed.organizations[0].id,
  businessB = seed.organizations[1].id;
const routingTech = seed.profiles[4].id;
await db.query<Record<string, unknown>>(
  "update public.profiles set active=true,role='technician' where id=$1",
  [routingTech],
);
const connect = (
  actor: string,
  target: string,
  ids: string[],
  key = crypto.randomUUID(),
) =>
  as(actor, "select public.connect_businesses($1,$2,$3)", [target, ids, key]);
for (const actor of [client, routingTech]) {
  await denied(
    () => connect(actor, routingTech, [businessA]),
    "client/technician cannot change business routing",
  );
}
await denied(
  () =>
    as(
      owner,
      "insert into public.business_technicians(organization_id,technician_id) values($1,$2)",
      [businessA, routingTech],
    ),
  "routing table cannot be mutated directly",
);
const routingKey = crypto.randomUUID();
await connect(owner, routingTech, [businessA], routingKey);
await connect(owner, routingTech, [businessA], routingKey);
pass(
  (await count(owner, "public.business_technicians")) === 1,
  "connection retry creates one business default",
);
await denied(
  () => connect(owner, routingTech, [businessB], routingKey),
  "routing retry key rejects different content",
);
pass(
  (await count(client, "public.business_technicians")) === 0 &&
    (await count(routingTech, "public.business_technicians")) === 0,
  "business routing directory is restricted to dispatch",
);
pass(
  (await count(routingTech, "public.requests", "where id=$1", [req])) === 0,
  "business connection grants no historical request access",
);
const routedRequest = crypto.randomUUID();
await command(
  client,
  "create_request",
  null,
  {
    location_id: seed.locations[0].id,
    kind: "support",
    title: "Automatically routed support",
    description: "A new request should reach the business default technician.",
  },
  routedRequest,
);
pass(
  (
    await db.query<{ assignee_id: string }>(
      "select assignee_id from public.requests where id=$1",
      [routedRequest],
    )
  ).rows[0].assignee_id === routingTech,
  "new client request automatically assigns the business technician",
);
pass(
  (await count(routingTech, "public.requests", "where id=$1", [
    routedRequest,
  ])) === 1,
  "automatic assignment grants the intended request access",
);
pass(
  Number(
    (
      await db.query<Record<string, unknown>>(
        "select count(*) n from private.outbox where request_id=$1 and recipient_id=$2",
        [routedRequest, routingTech],
      )
    ).rows[0].n,
  ) > 0,
  "automatically assigned technician receives authorized notification",
);
await command(owner, "employee", routingTech, { active: false });
const unassignedRequest = crypto.randomUUID();
await command(
  client,
  "create_request",
  null,
  {
    location_id: seed.locations[0].id,
    kind: "support",
    title: "Inactive default fallback",
    description: "Inactive technicians must never receive new routed requests.",
  },
  unassignedRequest,
);
pass(
  (
    await db.query<Record<string, unknown>>(
      "select assignee_id from public.requests where id=$1",
      [unassignedRequest],
    )
  ).rows[0].assignee_id === null,
  "inactive default leaves new work in unassigned queue",
);
await denied(
  () => connect(owner, routingTech, [businessB]),
  "inactive technician cannot receive new business connections",
);
await connect(owner, routingTech, []);
pass(
  (await count(owner, "public.business_technicians")) === 0,
  "inactive technician connections can be cleared",
);
await command(owner, "employee", routingTech, { active: true });

const setup = (actor: string, hash: string, email: string, ids: string[]) =>
  as(actor, "select public.prepare_technician_invitation($1,$2,$3,$4,$5)", [
    hash,
    email,
    "Morgan Davis",
    "555-0100",
    ids,
  ]);
await denied(
  () => setup(client, "invalid-setup", "morgan@example.test", [businessA]),
  "client cannot prepare a technician account",
);
await denied(
  () => setup(owner, "duplicate-staff", "jordan@example.test", [businessA]),
  "existing staff cannot be re-onboarded",
);
await denied(
  () => setup(owner, "duplicate-client", "jamie@example.test", [businessA]),
  "client identity cannot be accidentally reused as a new technician",
);
await setup(owner, "tech-setup", "morgan@example.test", [businessA, businessB]);
pass(
  (await count(owner, "public.business_technicians")) === 0,
  "preparing invitation does not route work before acceptance",
);
const pendingSetups = (
  await as(owner, "select public.pending_technicians() data")
).rows[0].data as { email: string }[];
pass(
  pendingSetups.some((p) => p.email === "morgan@example.test") &&
    !JSON.stringify(pendingSetups).includes("tech-setup"),
  "pending technician list contains contact details but no invitation token",
);
await denied(
  () => as(routingTech, "select public.pending_technicians()"),
  "technician cannot read pending invitations",
);
await connect(owner, routingTech, [businessB]);
const newTech = crypto.randomUUID();
await db.query<Record<string, unknown>>(
  "insert into auth.users(id,email) values($1,$2)",
  [newTech, "morgan@example.test"],
);
await as(newTech, "select public.accept_invitation($1)", ["tech-setup"]);
const onboarded = (
  await db.query<Record<string, unknown>>(
    "select name,phone,role from public.profiles where id=$1",
    [newTech],
  )
).rows[0];
pass(
  onboarded.name === "Morgan Davis" &&
    onboarded.phone === "555-0100" &&
    onboarded.role === "technician",
  "acceptance applies trusted technician identity",
);
pass(
  (
    await db.query<Record<string, unknown>>(
      "select technician_id from public.business_technicians where organization_id=$1",
      [businessA],
    )
  ).rows[0].technician_id === newTech,
  "acceptance activates the selected business connection",
);
pass(
  (
    await db.query<Record<string, unknown>>(
      "select technician_id from public.business_technicians where organization_id=$1",
      [businessB],
    )
  ).rows[0].technician_id === routingTech,
  "late acceptance preserves a newer business assignment",
);
pass(
  !JSON.stringify(
    (await as(owner, "select public.pending_technicians() data")).rows[0].data,
  ).includes("morgan@example.test"),
  "accepted technician leaves the pending list",
);
await denied(
  () => as(newTech, "select public.accept_invitation($1)", ["tech-setup"]),
  "technician acceptance link cannot be reused",
);
pass(
  (await count(newTech, "public.requests")) === 0,
  "newly accepted technician cannot browse historical business requests",
);
const dispatcherId = crypto.randomUUID();
await db.query<Record<string, unknown>>(
  "insert into auth.users(id,email) values($1,$2)",
  [dispatcherId, "dispatcher-test@example.test"],
);
await db.query<Record<string, unknown>>(
  "update public.profiles set role='dispatcher' where id=$1",
  [dispatcherId],
);
await connect(dispatcherId, routingTech, [businessA, businessB]);
pass(
  (await count(dispatcherId, "public.business_technicians")) === 2,
  "dispatcher can manage business routing",
);
await denied(
  () => setup(dispatcherId, "dispatch-invite", "other-tech@example.test", []),
  "dispatcher cannot add employees",
);

console.log(
  `\n${assertions} database assertions passed. PGlite executes real Postgres RLS/PLpgSQL; separate real Postgres concurrency tests cover races; hosted Auth/Storage still require staging checks.`,
);
await db.close();
