import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assertOrigin,
  getSessionUser,
  errorResponse,
  HttpError,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(await request.json());
    const session = await getSessionUser();
    if (!session)
      throw new HttpError(401, "Sign in using the invitation link first.");
    const { error } = await session.supabase.rpc("accept_invitation", {
      hash: createHash("sha256").update(token).digest("hex"),
    });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
