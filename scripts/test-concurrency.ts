import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { seedStore, DEMO_IDS } from "../lib/seed";
const dir = await mkdtemp(join(tmpdir(), "net-tech-postgres-test-"));
const databasePassword = crypto.randomUUID();
const pg = new EmbeddedPostgres({
  databaseDir: join(dir, "data"),
  user: "postgres",
  password: databasePassword,
  port: 55437,
  persistent: false,
  createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message: unknown) => {
    if (String(message).includes("FATAL")) console.error(message);
  },
});
const clients: ReturnType<typeof pg.getPgClient>[] = [];
try {
  await pg.initialise();
  await pg.start();
  const db = pg.getPgClient();
  clients.push(db);
  await db.connect();
  await db.query(await readFile("tests/database-bootstrap.sql", "utf8"));
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.query(await readFile("supabase/migrations/" + file, "utf8"));
  const s = seedStore();
  for (const p of s.profiles) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      p.id,
      p.email,
    ]);
    await db.query("update public.profiles set role=$2,name=$3 where id=$1", [
      p.id,
      p.role,
      p.name,
    ]);
  }
  for (const table of [
    "organizations",
    "locations",
    "memberships",
    "requests",
  ] as const)
    for (const item of s[table]) {
      const row = { ...item } as Record<string, unknown>;
      if (table === "memberships") row.id = crypto.randomUUID();
      const keys = Object.keys(row);
      await db.query(
        `insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
        keys.map((k) => row[k]),
      );
    }
  await db.query("select setval('public.request_reference_seq',10049,true)");
  const connections = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const client = pg.getPgClient();
      clients.push(client);
      await client.connect();
      await client.query("set role authenticated");
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [DEMO_IDS.owner],
      );
      return client;
    }),
  );
  const payload = {
    technician_id: DEMO_IDS.technician,
    starts_at: "2026-10-06T15:00:00Z",
    ends_at: "2026-10-06T16:00:00Z",
    status: "confirmed",
    purpose: "Concurrent booking test",
  };
  const attempts = await Promise.allSettled(
    connections.map((c) =>
      c.query("select public.command($1,$2,$3,$4)", [
        "schedule",
        s.requests[0].id,
        crypto.randomUUID(),
        JSON.stringify(payload),
      ]),
    ),
  );
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((a) => a.status === "rejected").length, 7);
  console.log(
    "PASS: eight simultaneous bookings, exactly one confirmed and seven conflicts rejected.",
  );
  const key = crypto.randomUUID(),
    create = {
      location_id: s.locations[0].id,
      kind: "support",
      title: "Concurrent retry test",
      description: "The same request submitted simultaneously eight times.",
    };
  const replies = await Promise.all(
    connections.map((c) =>
      c.query("select public.command($1,$2,$3,$4)", [
        "create_request",
        null,
        key,
        JSON.stringify(create),
      ]),
    ),
  );
  assert.equal(new Set(replies.map((r) => r.rows[0].command.id)).size, 1);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.requests where id=$1",
        [key],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: eight simultaneous retries produce exactly one request and reference.",
  );
  await Promise.all(
    connections.map((c, i) =>
      c.query("select public.connect_businesses($1,$2,$3)", [
        i % 2 ? DEMO_IDS.technician : s.profiles[4].id,
        [s.organizations[0].id],
        crypto.randomUUID(),
      ]),
    ),
  );
  const route = await db.query(
    "select technician_id from public.business_technicians where organization_id=$1",
    [s.organizations[0].id],
  );
  assert.equal(route.rowCount, 1);
  assert.equal(
    (
      await db.query("select assignee_id from public.requests where id=$1", [
        s.requests[0].id,
      ])
    ).rows[0].assignee_id,
    DEMO_IDS.technician,
  );
  const routedKey = crypto.randomUUID();
  await connections[0].query("select public.command($1,$2,$3,$4)", [
    "create_request",
    null,
    routedKey,
    JSON.stringify(create),
  ]);
  assert.equal(
    (
      await db.query("select assignee_id from public.requests where id=$1", [
        routedKey,
      ])
    ).rows[0].assignee_id,
    route.rows[0].technician_id,
  );
  console.log(
    "PASS: simultaneous business connections retain one default; new requests use it without moving existing work.",
  );
  if (process.env.RUN_DB_ADVISORS === "true") {
    const result = await promisify(execFile)(
      "node_modules/.bin/supabase",
      [
        "db",
        "advisors",
        "--db-url",
        `postgresql://postgres:${databasePassword}@127.0.0.1:55437/postgres?sslmode=disable`,
        "--type",
        "all",
        "--level",
        "warn",
        "--fail-on",
        "error",
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    console.log(result.stdout);
  }
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  await pg.stop();
}
