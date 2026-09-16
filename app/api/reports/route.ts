import { requireUser, errorResponse } from "@/lib/server";
export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("service_report");
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
