/** Creates clearly labeled synthetic test records through the deployed application. No email is sent. */
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { DEMO_IDS } from "../lib/seed";

const origin = process.env.NEXT_PUBLIC_APP_URL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.DEMO_SEED_PASSWORD;
if (
  origin !== "https://net-tech-app.vercel.app" ||
  url !== "https://sorblhbsciedhyihjaum.supabase.co" ||
  !key ||
  !password ||
  process.env.NET_TECH_TEST_PROJECT !== "sorblhbsciedhyihjaum"
)
  throw new Error(
    "This test is restricted to the explicitly approved hosted test app and synthetic accounts.",
  );

const sessions: Awaited<ReturnType<typeof login>>[] = [];
async function login(email?: string) {
  const jar = new Map<string, string>();
  const db = createServerClient(url!, key!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const item of items) jar.set(item.name, item.value);
      },
    },
  });
  if (email) {
    const signed = await db.auth.signInWithPassword({
      email,
      password: password!,
    });
    assert.ifError(signed.error);
  }
  return { db, jar };
}
type Session = Awaited<ReturnType<typeof login>>;
async function call(session: Session, path: string, body?: unknown) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      Cookie: [...session.jar]
        .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
        .join("; "),
      Origin: origin!,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
}
async function json(session: Session, path: string, body?: unknown) {
  const response = await call(session, path, body);
  const result = await response.json();
  assert.ok(
    response.ok,
    `${path}: ${response.status}: ${result.error ?? "unexpected response"}`,
  );
  return result;
}
const action = (
  s: Session,
  type: string,
  id: string | undefined,
  payload: object,
  key = crypto.randomUUID(),
) => json(s, "/api/actions", { type, id, key, payload });
const pass = (label: string) => console.log("PASS deployed", label);

try {
  for (const email of [
    "taylor@example.test",
    "alex@example.test",
    "jamie@example.test",
    "sam@example.test",
  ])
    sessions.push(await login(email));
  const [owner, tech, client, other] = sessions;
  if (process.env.NET_TECH_ONBOARDING_ONLY !== "true") {
    for (const s of sessions) {
      const workspace = await json(s, "/api/workspace");
      assert.ok(workspace.user.active);
      assert.ok(workspace.store.requests.length);
    }
    pass("four authenticated role workspaces load through Vercel");

    const rid = crypto.randomUUID();
    const payload = {
      location_id: "20000000-0000-4000-8000-000000000001",
      kind: "support",
      title: "TEST — connected Vercel workflow",
      description:
        "Synthetic deployment verification. No client service is requested.",
    };
    await action(client, "create_request", undefined, payload, rid);
    await action(client, "create_request", undefined, payload, rid);
    const created = await json(client, `/api/workspace?request=${rid}`);
    assert.equal(
      created.store.requests.filter((r: { id: string }) => r.id === rid).length,
      1,
    );
    await action(owner, "update_request", rid, {
      assignee_id: DEMO_IDS.technician,
    });
    pass("client intake, retry deduplication and owner assignment");

    const messageKey = crypto.randomUUID();
    await action(
      tech,
      "reply",
      rid,
      { body: "TEST — public technician reply." },
      messageKey,
    );
    await action(
      tech,
      "reply",
      rid,
      { body: "TEST — public technician reply." },
      messageKey,
    );
    const noteId = crypto.randomUUID();
    await action(
      tech,
      "note",
      rid,
      { body: "TEST — staff-only deployment note." },
      noteId,
    );
    const visible = await json(client, `/api/workspace?request=${rid}`);
    assert.equal(
      visible.store.messages.filter((m: { id: string }) => m.id === messageKey)
        .length,
      1,
    );
    assert.equal(visible.store.notes.length, 0);
    const blocked = await call(other, "/api/actions", {
      type: "reply",
      id: rid,
      key: crypto.randomUUID(),
      payload: { body: "Forbidden" },
    });
    assert.ok(!blocked.ok);
    const otherView = await json(other, `/api/workspace?request=${rid}`);
    assert.ok(
      !otherView.store.requests.some((r: { id: string }) => r.id === rid),
    );
    pass(
      "shared replies, retry deduplication, internal-note privacy and cross-business denial",
    );

    const bytes = await sharp({
      create: { width: 24, height: 24, channels: 3, background: "#16866b" },
    })
      .png()
      .toBuffer();
    for (const internal of [false, true]) {
      const actor = internal ? tech : client;
      const aid = crypto.randomUUID();
      const begun = await json(actor, "/api/attachments", {
        phase: "begin",
        id: aid,
        request_id: rid,
        note_id: internal ? noteId : null,
        name: "synthetic-test.png",
        mime: "image/png",
        size: bytes.length,
      });
      const upload = await actor.db.storage
        .from("upload-quarantine")
        .uploadToSignedUrl(begun.path, begun.token, bytes, {
          contentType: "image/png",
        });
      assert.ifError(upload.error);
      await json(actor, "/api/attachments", { phase: "complete", id: aid });
      await json(actor, "/api/attachments", { phase: "complete", id: aid });
      const download = await call(actor, `/api/attachments/${aid}`);
      assert.equal(download.status, 303);
      const location = download.headers.get("location")!;
      assert.equal(new URL(location).origin, url);
      const file = await fetch(location);
      assert.equal(file.status, 200);
      assert.ok((await file.arrayBuffer()).byteLength > 0);
      assert.equal((await call(other, `/api/attachments/${aid}`)).status, 404);
      if (internal)
        assert.equal(
          (await call(client, `/api/attachments/${aid}`)).status,
          404,
        );
    }
    pass(
      "public/internal upload, server image processing, idempotent completion and private downloads",
    );

    const starts = new Date();
    starts.setUTCDate(starts.getUTCDate() + 7);
    while (starts.getUTCDay() !== 2) starts.setUTCDate(starts.getUTCDate() + 1);
    starts.setUTCHours(16, 0, 0, 0);
    const visitId = crypto.randomUUID();
    const booking = {
      technician_id: DEMO_IDS.technician,
      starts_at: starts.toISOString(),
      ends_at: new Date(+starts + 3600000).toISOString(),
      status: "confirmed",
      purpose: "TEST — synthetic deployment verification",
    };
    await action(owner, "schedule", rid, booking, visitId);
    const conflict = await call(owner, "/api/actions", {
      type: "schedule",
      id: rid,
      key: crypto.randomUUID(),
      payload: booking,
    });
    assert.ok(!conflict.ok);
    await action(tech, "visit", visitId, { status: "en_route" });
    await action(tech, "visit", visitId, { status: "on_site" });
    await action(tech, "visit", visitId, {
      status: "completed",
      summary: "TEST completed successfully; no actual site visit occurred.",
    });
    const completed = await json(tech, `/api/workspace?request=${rid}`);
    assert.equal(
      completed.store.appointments.find((v: { id: string }) => v.id === visitId)
        .status,
      "completed",
    );
    assert.notEqual(
      completed.store.requests.find((r: { id: string }) => r.id === rid).status,
      "resolved",
    );
    pass(
      "booking, conflict rejection and independent technician visit completion",
    );
    console.log("Synthetic verification request:", rid);
  }

  const orgId = crypto.randomUUID();
  await action(
    owner,
    "organization",
    undefined,
    {
      name: "TEST — technician onboarding",
      location_name: "Synthetic test location",
      address: "Test fixture; no service visit",
    },
    orgId,
  );
  const directory = await json(owner, "/api/workspace?screen=team");
  const location = directory.store.locations.find(
    (l: { organization_id: string }) => l.organization_id === orgId,
  );
  assert.ok(location);
  const oldRequest = crypto.randomUUID();
  const intake = {
    location_id: location.id,
    kind: "support",
    title: "TEST — business routing",
    description: "Synthetic routing verification. No actual service requested.",
  };
  await action(owner, "create_request", undefined, intake, oldRequest);
  const invitation = await json(owner, "/api/invitations", {
    email: `test-tech-${orgId}@example.test`,
    role: "technician",
    name: "TEST — onboarding technician",
    business_ids: [orgId],
    phone: "",
  });
  assert.equal(invitation.sent, false);
  const inviteUrl = new URL(invitation.url);
  assert.equal(inviteUrl.origin, origin);
  const token = inviteUrl.searchParams.get("invite");
  assert.ok(token);
  assert.ok(!(await call(client, "/api/invitations/accept", { token })).ok);
  const invited = await login();
  sessions.push(invited);
  const callback = await call(invited, inviteUrl.pathname + inviteUrl.search);
  assert.equal(callback.status, 307);
  assert.ok(callback.headers.get("location")?.startsWith(origin + "/invite?"));
  for (const cookie of callback.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const equals = pair.indexOf("=");
    invited.jar.set(
      pair.slice(0, equals),
      decodeURIComponent(pair.slice(equals + 1)),
    );
  }
  await json(invited, "/api/invitations/accept", { token });
  assert.ok(!(await call(invited, "/api/invitations/accept", { token })).ok);
  await action(invited, "profile", undefined, {
    name: "TEST — onboarding technician",
    phone: "",
    email_notifications: false,
  });
  const welcome = await json(invited, "/api/workspace");
  assert.equal(welcome.user.role, "technician");
  assert.ok(
    !welcome.store.requests.some((r: { id: string }) => r.id === oldRequest),
  );
  const newRequest = crypto.randomUUID();
  await action(owner, "create_request", undefined, intake, newRequest);
  const routed = await json(invited, `/api/workspace?request=${newRequest}`);
  assert.equal(
    routed.store.requests.find((r: { id: string }) => r.id === newRequest)
      .assignee_id,
    welcome.user.id,
  );
  assert.ok(
    !routed.store.requests.some((r: { id: string }) => r.id === oldRequest),
  );
  await action(owner, "connect_businesses", welcome.user.id, {
    business_ids: [],
  });
  await action(owner, "employee", welcome.user.id, { active: false });
  assert.equal((await call(invited, "/api/workspace")).status, 403);
  pass(
    "technician invitation, verified callback, wrong-email/reuse denial, new-request business routing, historical isolation and immediate deactivation",
  );
} finally {
  await Promise.all(sessions.map((s) => s.db.auth.signOut()));
}
