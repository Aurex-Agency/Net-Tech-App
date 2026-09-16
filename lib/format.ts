import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export const TIMEZONE = "America/Chicago";
export const dateLabel = (date: string, pattern = "MMM d, yyyy") =>
  formatInTimeZone(new Date(date), TIMEZONE, pattern);
export const timeLabel = (date: string) => dateLabel(date, "h:mm a");
export const localToUtc = (date: string) =>
  fromZonedTime(date, TIMEZONE).toISOString();
export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function download(name: string, body: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function calendarFile(
  visit: { id: string; starts_at: string; ends_at: string; purpose: string },
  address: string,
) {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Net-Tech//Connect//EN",
    "BEGIN:VEVENT",
    `UID:${visit.id}@nettech.ms`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(visit.starts_at)}`,
    `DTEND:${stamp(visit.ends_at)}`,
    `SUMMARY:${escape(visit.purpose)}`,
    `LOCATION:${escape(address)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
