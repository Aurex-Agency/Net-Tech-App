import { requireUser, errorResponse } from "@/lib/server";
import { isStaff, isDispatch, type ServiceRequest } from "@/lib/types";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { supabase, profile } = await requireUser();
    const params = new URL(request.url).searchParams;
    const rid = z.uuid().safeParse(params.get("request")).data;
    const screen = params.get("screen") ?? "";
    const { data: requests, error: requestError } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .limit(100);
    if (requestError) throw new Error("The workspace schema needs setup.");
    const selected: ServiceRequest[] = [...(requests ?? [])];
    let visitQuery = supabase.from("appointments").select("*");
    visitQuery = rid
      ? visitQuery.eq("request_id", rid)
      : visitQuery
          .gte("ends_at", new Date().toISOString())
          .in("status", ["proposed", "confirmed", "en_route", "on_site"]);
    const { data: appointments, error: visitError } = await visitQuery
      .order("starts_at")
      .limit(200);
    if (visitError) throw new Error("Unable to load appointments.");
    const extraIds = [
      ...new Set([
        ...(appointments ?? []).map((v) => v.request_id),
        ...(rid ? [rid] : []),
      ]),
    ].filter((id) => !selected.some((r) => r.id === id));
    if (extraIds.length) {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .in("id", extraIds);
      if (error) throw new Error("Unable to load request details.");
      selected.push(...(data ?? []));
    }
    const ids = selected.map((r) => r.id);
    const staff = isStaff(profile.role);
    const queries = [
      [
        "organizations",
        supabase.from("organizations").select("*").order("name").limit(1000),
      ],
      [
        "locations",
        supabase.from("locations").select("*").order("name").limit(1000),
      ],
      ["memberships", supabase.from("memberships").select("*").limit(1000)],
      [
        "notifications",
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ],
      ["read_cursors", supabase.from("read_cursors").select("*").limit(1000)],
      [
        "events",
        rid
          ? supabase
              .from("events")
              .select("*")
              .eq("request_id", rid)
              .order("created_at", { ascending: false })
              .limit(100)
          : supabase
              .from("events")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(20),
      ],
      [
        "messages",
        supabase.rpc("recent_messages", {
          request_ids: rid ? [rid] : ids,
          per_request: rid ? 30 : 1,
        }),
      ],
      ["unread_counts", supabase.rpc("unread_counts")],
      ["summary", supabase.rpc("workspace_counts")],
      ["profiles", supabase.rpc("visible_people")],
    ] as const;
    const entries = await Promise.all(
      queries.map(async ([key, query]) => {
        const { data, error } = await query;
        if (error)
          throw new Error("Unable to load workspace records. " + error.message);
        return [key, data ?? []];
      }),
    );
    const optional: Record<string, unknown[]> = {
      notes: [],
      attachments: [],
      work_entries: [],
      availability: [],
      participants: [],
      collaborators: [],
    };
    if (rid) {
      for (const table of [
        "attachments",
        "participants",
        ...(staff ? ["notes", "collaborators"] : []),
      ]) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("request_id", rid)
          .limit(table === "notes" ? 100 : 200);
        if (error) throw new Error("Unable to load request records.");
        optional[table] = data ?? [];
      }
    }
    if (staff) {
      const context = await supabase.rpc("site_context");
      if (context.error) throw new Error("Unable to load staff site context.");
      optional.site_notes = context.data ?? [];
      const { data, error } = await supabase
        .from("availability")
        .select("*")
        .gte("ends_at", new Date().toISOString())
        .limit(200);
      if (error) throw new Error("Unable to load availability.");
      optional.availability = data ?? [];
      if (screen === "time" || screen === "reports") {
        const { data, error } = await supabase
          .from("work_entries")
          .select("*")
          .order("date", { ascending: false })
          .limit(1000);
        if (error) throw new Error("Unable to load work entries.");
        optional.work_entries = data ?? [];
      }
    }
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("data")
      .single();
    if (settingsError) throw new Error("Workspace settings need setup.");
    return Response.json(
      {
        store: {
          ...optional,
          ...Object.fromEntries(entries),
          requests: selected,
          appointments: appointments ?? [],
          settings: settings.data,
        },
        user: profile,
        capabilities: { dispatch: isDispatch(profile.role) },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
