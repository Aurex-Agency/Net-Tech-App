import { requireUser, errorResponse } from "@/lib/server";
import { z } from "zod";
import { localToUtc } from "@/lib/format";
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const p = new URL(request.url).searchParams;
    const page = Math.max(0, Math.min(100000, Number(p.get("page")) || 0));
    let query = supabase.from("requests").select("*", { count: "exact" });
    const search = (p.get("q") ?? "")
      .slice(0, 200)
      .replace(/[,()%\\]/g, " ")
      .trim();
    if (search) {
      const { data: organizations } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", `%${search}%`)
        .limit(100);
      query = query.or(
        `title.ilike.%${search}%,reference.ilike.%${search}%${organizations?.length ? ",organization_id.in.(" + organizations.map((o) => o.id).join(",") + ")" : ""}`,
      );
    }
    const filter = p.get("filter");
    if (filter === "unassigned") {
      const { data: inactive } = await supabase
        .from("directory")
        .select("id")
        .eq("active", false);
      query = query.or(
        "assignee_id.is.null" +
          (inactive?.length
            ? ",assignee_id.in.(" + inactive.map((x) => x.id).join(",") + ")"
            : ""),
      );
    } else if (filter === "mine") query = query.eq("assignee_id", user.id);
    else if (filter && filter !== "all") query = query.eq("status", filter);
    const priority = p.get("priority");
    if (priority === "high") query = query.in("priority", ["high", "urgent"]);
    else if (priority && priority !== "all")
      query = query.eq("priority", priority);
    for (const [param, column] of [
      ["client", "organization_id"],
      ["tech", "assignee_id"],
    ] as const) {
      const value = z.uuid().safeParse(p.get(param)).data;
      if (value) query = query.eq(column, value);
    }
    if (p.get("category") && p.get("category") !== "all")
      query = query.eq("category", p.get("category")!.slice(0, 120));
    const date = z.iso.date();
    const from = date.safeParse(p.get("from")).data;
    const to = date.safeParse(p.get("to")).data;
    if (from) query = query.gte("created_at", localToUtc(from + "T00:00:00"));
    if (to) query = query.lte("created_at", localToUtc(to + "T23:59:59.999"));
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 10, page * 10 + 9);
    if (error) throw new Error("Unable to load requests.");
    return Response.json({ requests: data ?? [], total: count ?? 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
