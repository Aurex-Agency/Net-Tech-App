import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  assertOrigin,
  requireUser,
  adminClient,
  errorResponse,
  HttpError,
} from "@/lib/server";
const schema = z.object({
  email: z.email(),
  role: z.enum(["client", "client_admin", "technician", "dispatcher"]),
  organization_id: z.union([z.uuid(), z.literal("")]).default(""),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().max(40).default(""),
  business_ids: z.array(z.uuid()).max(100).default([]),
});
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { supabase, profile } = await requireUser();
    if (profile.role !== "owner")
      throw new HttpError(403, "Owner access required.");
    const p = schema.parse(await request.json());
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const { error } =
      p.role === "technician" && p.name
        ? await supabase.rpc("prepare_technician_invitation", {
            token_hash: hash,
            target_email: p.email,
            display_name: p.name,
            contact_phone: p.phone,
            business_ids: p.business_ids,
          })
        : await supabase.rpc("create_invitation", {
            token_hash: hash,
            target_email: p.email,
            intended_role: p.role,
            org_id: p.organization_id || null,
          });
    if (error) throw new Error(error.message);
    const admin = adminClient();
    let generated = await admin.auth.admin.generateLink({
      type: "invite",
      email: p.email,
    });
    if (generated.error?.code === "email_exists")
      generated = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: p.email,
      });
    if (generated.error || !generated.data.properties)
      throw new Error(
        "Could not prepare the authentication link. Check Auth configuration.",
      );
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    const url = new URL("/auth/callback", base);
    url.searchParams.set("token_hash", generated.data.properties.hashed_token);
    url.searchParams.set("type", generated.data.properties.verification_type);
    url.searchParams.set("invite", token);
    return Response.json({ url: url.toString(), sent: false });
  } catch (e) {
    return errorResponse(e);
  }
}
