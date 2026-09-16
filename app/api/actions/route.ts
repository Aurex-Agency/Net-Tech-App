import { z } from "zod";
import { assertOrigin, requireUser, errorResponse } from "@/lib/server";
const actionSchema = z.object({
  type: z.enum([
    "create_request",
    "connect_businesses",
    "reply",
    "note",
    "read",
    "update_request",
    "client_action",
    "schedule",
    "visit",
    "work_entry",
    "availability",
    "review_availability",
    "employee",
    "staff_hours",
    "profile",
    "settings",
    "organization",
    "edit_organization",
    "edit_location",
    "location",
    "share",
    "membership",
  ]),
  id: z.uuid().optional(),
  key: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
});
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 50000)
      throw new Error("Request is too large.");
    const action = actionSchema.parse(await request.json());
    if (JSON.stringify(action.payload).length > 40000)
      throw new Error("Request is too large.");
    const { supabase } = await requireUser();
    if (action.type === "connect_businesses") {
      const ids = z.array(z.uuid()).max(100).parse(action.payload.business_ids);
      const { data, error } = await supabase.rpc("connect_businesses", {
        tech_id: z.uuid().parse(action.id),
        business_ids: ids,
        retry_key: action.key,
      });
      if (error) throw new Error(error.message);
      return Response.json(data);
    }
    const { data, error } = await supabase.rpc("command", {
      action_type: action.type,
      record_id: action.id ?? null,
      idempotency_key: action.key,
      payload: action.payload,
    });
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
