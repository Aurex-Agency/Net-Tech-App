/** Synthetic fixtures for the owner-approved Net-Tech TEST project only. Never sends email. */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { seedStore } from "../lib/seed";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (
  url !== "https://sorblhbsciedhyihjaum.supabase.co" ||
  process.env.NET_TECH_TEST_PROJECT !== "sorblhbsciedhyihjaum"
)
  throw new Error(
    "Test seeding requires the exact owner-approved Net-Tech test project and NET_TECH_TEST_PROJECT confirmation.",
  );
const key = process.env.SUPABASE_SECRET_KEY;
const password = process.env.DEMO_SEED_PASSWORD;
if (!key || !password || password.length < 12)
  throw new Error(
    "Provide the TEST project server key and a DEMO_SEED_PASSWORD of at least 12 characters.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = await db
  .from("requests")
  .select("id", { count: "exact", head: true });
if (existing.error)
  throw new Error("Apply migrations to the test project first.");
if (existing.count)
  throw new Error(
    "This script requires an empty disposable database. Do not reset or overwrite a database containing requests.",
  );
const s = seedStore();
for (const p of s.profiles) {
  const old = await db.auth.admin.getUserById(p.id);
  if (!old.data.user) {
    const created = await db.auth.admin.createUser({
      id: p.id,
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { name: p.name },
    });
    if (created.error) throw created.error;
  } else if (old.data.user.email !== p.email)
    throw new Error(
      "An existing account does not match the synthetic fixture.",
    );
  const saved = await db
    .from("profiles")
    .update({ ...p, email_notifications: false })
    .eq("id", p.id);
  if (saved.error) throw saved.error;
}
const uuid = (value: string) => {
  const h = createHash("sha256")
    .update("net-tech-synthetic:" + value)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
for (const table of [
  "organizations",
  "locations",
  "memberships",
  "requests",
  "messages",
  "notes",
  "appointments",
  "events",
  "notifications",
] as const) {
  const rows = s[table].map((item) => {
    const row = { ...item } as Record<string, unknown>;
    if (
      ["memberships", "messages", "notes", "events", "notifications"].includes(
        table,
      )
    )
      row.id = uuid(table + String(row.id));
    if (table === "requests") delete row.reference; // Let the real sequence allocate references.
    return row;
  });
  const result = await db.from(table).upsert(rows);
  if (result.error) throw result.error;
}
console.log(
  "Hosted TEST synthetic data installed. No invitations or email sent. Sign in using DEMO_SEED_PASSWORD and one of:",
);
for (const p of s.profiles) console.log(`${p.role}: ${p.email}`);
