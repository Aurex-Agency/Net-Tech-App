import { z } from "zod";
import sharp from "sharp";
import {
  adminClient,
  requireUser,
  assertOrigin,
  errorResponse,
  HttpError,
} from "@/lib/server";
import { detectFile, MAX_FILE_SIZE, safeFilename } from "@/lib/uploads";
import { isStaff } from "@/lib/types";
export const maxDuration = 60;
const schema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("begin"),
    id: z.uuid(),
    request_id: z.uuid(),
    note_id: z.uuid().nullable(),
    name: z.string().min(1).max(255),
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    size: z.number().int().min(1).max(MAX_FILE_SIZE),
  }),
  z.object({ phase: z.literal("complete"), id: z.uuid() }),
]);
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { supabase, user, profile } = await requireUser();
    const p = schema.parse(await request.json());
    const admin = adminClient();
    if (p.phase === "begin") {
      const { data: record } = await supabase
        .from("requests")
        .select("id")
        .eq("id", p.request_id)
        .single();
      if (!record || (p.note_id && !isStaff(profile.role)))
        throw new HttpError(403, "Attachment access denied.");
      const { data: reservation, error } = await admin.rpc("begin_upload", {
        who: user.id,
        rid: p.request_id,
        nid: p.note_id,
        aid: p.id,
        filename: safeFilename(p.name),
        mime_type: p.mime,
        bytes: p.size,
      });
      if (error) throw new Error(error.message);
      if (reservation.complete)
        return Response.json({ id: p.id, complete: true });
      const { data, error: signError } = await admin.storage
        .from("upload-quarantine")
        .createSignedUploadUrl(p.id, { upsert: false });
      if (signError || !data)
        throw new Error("Could not prepare your upload. Please retry.");
      return Response.json({
        id: p.id,
        token: data.token,
        path: data.path,
        complete: false,
      });
    }
    const { data: upload, error: lookupError } = await admin.rpc("get_upload", {
      who: user.id,
      aid: p.id,
    });
    if (lookupError || !upload)
      throw new HttpError(403, "Upload unavailable or access removed.");
    const { data: record } = await supabase
      .from("requests")
      .select("id")
      .eq("id", upload.request_id)
      .single();
    if (!record) throw new HttpError(403, "Attachment access denied.");
    if (upload.completed_at)
      return Response.json({ id: p.id, name: upload.name });
    const { data: blob, error: downloadError } = await admin.storage
      .from("upload-quarantine")
      .download(p.id);
    if (downloadError || !blob)
      throw new Error(
        "The file has not finished uploading. Retry when connected.",
      );
    if (blob.size !== upload.size || blob.size > MAX_FILE_SIZE)
      throw new Error("The uploaded file does not match its declared size.");
    const original = new Uint8Array(await blob.arrayBuffer());
    const mime = detectFile(original);
    if (mime !== upload.mime)
      throw new Error("The file format does not match its contents.");
    let bytes: Uint8Array = original;
    if (mime.startsWith("image/")) {
      try {
        bytes = await sharp(original, {
          limitInputPixels: 40000000,
          failOn: "warning",
        })
          .rotate()
          .toFormat(
            mime === "image/jpeg"
              ? "jpeg"
              : mime === "image/png"
                ? "png"
                : "webp",
          )
          .toBuffer();
      } catch {
        throw new Error(
          "This image could not be decoded safely. Try a different photo.",
        );
      }
    }
    if (bytes.length > MAX_FILE_SIZE)
      throw new Error("The validated image is too large. Try a smaller photo.");
    const path = `${upload.request_id}/${upload.note_id ? "internal" : "public"}/${p.id}`;
    const { error: saveError } = await admin.storage
      .from("request-files")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (saveError)
      throw new Error(
        "Could not save the validated file. Retry this attachment.",
      );
    const { error: metadataError } = await admin.rpc("complete_upload", {
      who: user.id,
      aid: p.id,
      mime_type: mime,
      bytes: bytes.length,
    });
    if (metadataError) throw new Error(metadataError.message);
    await admin.storage.from("upload-quarantine").remove([p.id]);
    return Response.json({ id: p.id, name: upload.name });
  } catch (e) {
    return errorResponse(e);
  }
}
