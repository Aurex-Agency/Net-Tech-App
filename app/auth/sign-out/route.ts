import { serverClient, assertOrigin, errorResponse } from "@/lib/server";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const s = await serverClient();
    await s.auth.signOut();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
