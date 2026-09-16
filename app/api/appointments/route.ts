import { requireUser, errorResponse } from "@/lib/server";
import { z } from "zod";
import { localToUtc } from "@/lib/format";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const params = new URL(request.url).searchParams;
    const page = Math.max(
      0,
      Math.min(100000, Math.floor(Number(params.get("page")) || 0)),
    );
    const history = params.get("history") === "true";
    const from = z.iso.date().safeParse(params.get("from")).data;
    const to = z.iso.date().safeParse(params.get("to")).data;
    const technician = z.uuid().safeParse(params.get("technician")).data;
    let query = supabase.from("appointments").select("*", { count: "exact" });
    if (technician) query = query.eq("technician_id", technician);
    if (from) query = query.gte("starts_at", localToUtc(from + "T00:00:00"));
    if (to) query = query.lte("starts_at", localToUtc(to + "T23:59:59.999"));
    if (!history)
      query = query
        .not("status", "in", "(completed,canceled,no_show)")
        .gte("ends_at", new Date().toISOString());
    const { data, count, error } = await query
      .order("starts_at", { ascending: !history || !!from })
      .order("id")
      .range(page * 50, page * 50 + 49);
    if (error) throw new Error("Unable to load visits.");
    const ids = [...new Set((data ?? []).map((a) => a.request_id))];
    const related = ids.length
      ? await supabase.from("requests").select("*").in("id", ids)
      : { data: [], error: null };
    if (related.error) throw new Error("Unable to load visit context.");
    return Response.json({
      appointments: data ?? [],
      requests: related.data ?? [],
      total: count ?? 0,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
