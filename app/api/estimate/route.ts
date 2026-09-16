import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assertOrigin,
  adminClient,
  errorResponse,
  HttpError,
} from "@/lib/server";
const schema = z.object({
  key: z.uuid(),
  name: z.string().trim().min(1).max(120),
  organization: z.string().trim().min(1).max(160),
  email: z.email().max(254),
  phone: z.string().max(40).default(""),
  address: z.string().trim().min(5).max(500),
  description: z.string().trim().min(10).max(10000),
  preferences: z.array(z.string().max(120)).max(3),
  website: z.string().max(0),
  "cf-turnstile-response": z.string().min(1).max(2048),
});
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (
      process.env.PUBLIC_INTAKE_ENABLED !== "true" ||
      !process.env.TURNSTILE_SECRET_KEY
    )
      throw new HttpError(
        503,
        "Online intake is not enabled. Please contact Net-Tech by phone.",
      );
    if (Number(request.headers.get("content-length") ?? 0) > 20000)
      throw new HttpError(413, "Submission is too large.");
    const p = schema.parse(await request.json());
    const check = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: p["cf-turnstile-response"],
          idempotency_key: p.key,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    const verification = await check.json();
    if (
      !verification.success ||
      verification.hostname !==
        new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname
    )
      throw new Error("Please complete the verification and try again.");
    const ip =
      request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      "unknown";
    const rateKey = createHash("sha256")
      .update(process.env.TURNSTILE_SECRET_KEY + ip)
      .digest("hex");
    const { data, error } = await adminClient().rpc("public_inquiry", {
      inquiry_id: p.key,
      rate_key: rateKey,
      details: {
        name: p.name,
        organization: p.organization,
        email: p.email,
        phone: p.phone,
        address: p.address,
        description: p.description,
        preferences: p.preferences,
      },
    });
    if (error) throw new Error(error.message);
    return Response.json({ id: data });
  } catch (e) {
    return errorResponse(e);
  }
}
