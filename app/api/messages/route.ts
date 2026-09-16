import { requireUser, errorResponse } from "@/lib/server";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const p = new URL(request.url).searchParams;
    const id = z.uuid().parse(p.get("request"));
    const page = Math.max(0, Math.min(100000, Number(p.get("page")) || 0));
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * 30, page * 30 + 29);
    if (error) throw new Error("Unable to load earlier replies.");
    return Response.json({ messages: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
