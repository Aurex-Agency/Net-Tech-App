import { requireUser, assertOrigin, errorResponse } from "@/lib/server";
import { z } from "zod";
export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("list_inquiries");
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { supabase } = await requireUser();
    const p = z
      .object({ inquiry_id: z.uuid(), location_id: z.uuid() })
      .parse(await request.json());
    const { data, error } = await supabase.rpc("convert_inquiry", p);
    if (error) throw new Error(error.message);
    return Response.json({ id: data });
  } catch (e) {
    return errorResponse(e);
  }
}
