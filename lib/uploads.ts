export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export function detectFile(bytes: Uint8Array) {
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10")
    return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") {
    const body = Buffer.from(bytes)
      .toString("latin1")
      .replace(/#([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    if (!/%%EOF\s*$/.test(body))
      throw new Error(
        "This PDF is incomplete. Upload the original file or a screenshot.",
      );
    if (
      /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|ObjStm|Encrypt|GoToR|GoToE|SubmitForm|ImportData|Sound|Movie|AcroForm)\b/i.test(
        body,
      )
    )
      throw new Error(
        "Interactive, encrypted, or compressed-object PDFs are not accepted. Upload a screenshot instead.",
      );
    return "application/pdf";
  }
  throw new Error(
    "Use a JPEG, PNG, WebP, or non-active PDF. The file contents must match the format.",
  );
}
export function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 140) || "attachment"
  );
}
