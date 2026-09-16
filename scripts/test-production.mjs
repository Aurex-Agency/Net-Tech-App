/** Run against `npm run start -- --port 3100`, without external credentials. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = process.env.SMOKE_URL ?? "http://localhost:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("This smoke test is local-only.");
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(base + "/demo/client");
  await page
    .getByRole("heading", { name: "Good to see you, Jamie." })
    .waitFor();
  assert.ok(
    response.headers()["content-security-policy"].includes("object-src 'none'"),
  );
  assert.ok(
    !response.headers()["content-security-policy"].includes("'unsafe-eval'"),
  );
  const manifest = await (
    await context.request.get(base + "/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/workspace");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page
    .getByRole("heading", { name: "Good to see you, Jamie." })
    .waitFor();
  const cached = await page.evaluate(async () => {
    const result = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys())
        result.push(new URL(req.url).pathname);
    }
    return result;
  });
  assert.deepEqual(cached, ["/offline.html"]);
  await page.goto(base + "/workspace");
  await page.waitForURL("**/sign-in?next=*");
  assert.ok(new URL(page.url()).pathname === "/sign-in");
  const job = await context.request.get(base + "/api/jobs");
  assert.equal(job.status(), 401);
  assert.ok(job.headers()["cache-control"].includes("no-store"));
  await context.setOffline(true);
  await page.goto(base + "/workspace");
  assert.match(await page.textContent("body"), /offline|connection/i);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: production rendering, CSP, protected redirect, worker authorization, manifest, and public-only offline cache.",
  );
} finally {
  await browser.close();
}
