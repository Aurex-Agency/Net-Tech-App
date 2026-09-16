/** Read-only Auth/RLS smoke checks against the explicitly approved test backend. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { DEMO_IDS } from "../lib/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.DEMO_SEED_PASSWORD;
if (url !== "https://sorblhbsciedhyihjaum.supabase.co" || !key || !password)
  throw new Error(
    "Provide the designated test backend and synthetic test credentials.",
  );
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const sessions = [];
try {
  for (const [email, role] of [
    ["taylor@example.test", "owner"],
    ["alex@example.test", "technician"],
    ["jamie@example.test", "client_admin"],
    ["sam@example.test", "client"],
  ]) {
    const db = client();
    sessions.push(db);
    const login = await db.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    const profile = await db
      .from("profiles")
      .select("role,active")
      .eq("id", login.data.user!.id)
      .single();
    assert.ifError(profile.error);
    assert.equal(profile.data.role, role);
    assert.equal(profile.data.active, true);
    const requests = await db
      .from("requests")
      .select("id,organization_id,assignee_id");
    assert.ifError(requests.error);
    assert.ok(requests.data.length > 0);
    if (role === "technician")
      assert.ok(
        requests.data.every((r) => r.assignee_id === DEMO_IDS.technician),
      );
    if (role === "client_admin")
      assert.ok(
        requests.data.every(
          (r) => r.organization_id === "10000000-0000-4000-8000-000000000001",
        ),
      );
    if (role === "client")
      assert.ok(
        requests.data.every(
          (r) => r.organization_id === "10000000-0000-4000-8000-000000000002",
        ),
      );
    if (role.startsWith("client")) {
      const notes = await db.from("notes").select("id");
      assert.ok(
        notes.error || notes.data?.length === 0,
        "Client cannot read internal notes",
      );
      const routing = await db
        .from("business_technicians")
        .select("organization_id");
      assert.ok(
        routing.error || routing.data?.length === 0,
        "Client cannot read technician directory",
      );
    }
    const mutation = await db
      .from("requests")
      .update({ title: "Unauthorized mutation" })
      .eq("id", "00000000-0000-4000-8000-999999999999");
    assert.ok(mutation.error, "Direct table writes must fail");
    console.log(
      `PASS hosted ${role}: password login, active profile, scoped requests, direct-write denial`,
    );
  }
  const anon = client();
  const requests = await anon.from("requests").select("id");
  assert.ok(requests.error || requests.data?.length === 0);
  console.log("PASS hosted anonymous request access denied");
} finally {
  await Promise.all(sessions.map((db) => db.auth.signOut()));
}
