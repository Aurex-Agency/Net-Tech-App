import { requireUser, errorResponse, HttpError } from "@/lib/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireUser();
    const { id } = await params;
    const { data: file } = await supabase
      .from("attachments")
      .select("object_key,name")
      .eq("id", id)
      .single();
    if (!file) throw new HttpError(404, "Attachment unavailable.");
    const { data, error } = await supabase.storage
      .from("request-files")
      .createSignedUrl(file.object_key, 60, { download: file.name });
    if (error || !data) throw new Error("Download failed. Please try again.");
    return Response.redirect(data.signedUrl, 303);
  } catch (e) {
    return errorResponse(e);
  }
}
