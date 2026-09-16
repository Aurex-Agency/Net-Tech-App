"use client";
import { browserClient } from "./browser";
const MAX = 10 * 1024 * 1024;
export async function uploadAttachment(
  file: File,
  requestId: string,
  userId: string,
  noteId: string | null = null,
) {
  if (file.size > MAX || file.size < 1)
    throw new Error("Choose a file no larger than 10 MB.");
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${userId}:${requestId}:${noteId}:${file.name}:${digest}`,
        ),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const call = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error ??
          "Upload failed. Retry this file; your request is already saved.",
      );
    return result;
  };
  const reservation = await call({
    phase: "begin",
    id,
    request_id: requestId,
    note_id: noteId,
    name: file.name,
    mime: file.type,
    size: file.size,
  });
  if (reservation.complete) return { id };
  const s = browserClient();
  const { error } = await s.storage
    .from("upload-quarantine")
    .uploadToSignedUrl(reservation.path, reservation.token, file, {
      contentType: file.type,
      upsert: false,
    });
  // An existing quarantine object can be the result of a previous attempt whose
  // response was lost. Finalization verifies ownership, size and actual bytes.
  if (error && !error.message.toLowerCase().includes("already exists"))
    throw new Error(
      "Upload interrupted. Your request is saved; retry this file.",
    );
  return call({ phase: "complete", id });
}
