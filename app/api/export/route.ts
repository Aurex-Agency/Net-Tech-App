import { requireUser, errorResponse, HttpError } from "@/lib/server";
import { isDispatch } from "@/lib/types";
import { csvCell } from "@/lib/format";
export async function GET() {
  try {
    const { supabase, profile } = await requireUser();
    if (!isDispatch(profile.role))
      throw new HttpError(403, "Dispatcher access required.");
    const lines = [
      [
        "Reference",
        "Title",
        "Status",
        "Priority",
        "Created",
        "Resolved",
        "Reopened",
      ]
        .map(csvCell)
        .join(","),
    ];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("requests")
        .select(
          "reference,title,status,priority,created_at,resolved_at,reopen_count",
        )
        .order("id")
        .range(offset, offset + 499);
      if (error) throw new Error("Export failed.");
      for (const r of data ?? [])
        lines.push(
          [
            r.reference,
            r.title,
            r.status,
            r.priority,
            r.created_at,
            r.resolved_at,
            r.reopen_count,
          ]
            .map(csvCell)
            .join(","),
        );
      if (!data || data.length < 500) break;
      offset += 500;
    }
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="net-tech-requests.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
