import { daysSince } from "./stages";

export function relativeDay(date) {
  const d = daysSince(date);
  if (d === Infinity) return "";
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function longDate(date) {
  return new Date(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function timeOf(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Combine a calendar row's `date` (timestamptz at midnight) and `time` ("15:00:00" or "15:00:00+01"). */
export function calendarStart(row) {
  const day = String(row.date).slice(0, 10);
  let time = row.time || "09:00:00";
  const offset = time.match(/([+-]\d{2})(:?\d{2})?$/);
  if (offset) {
    time = time.slice(0, offset.index) + `${offset[1]}:${(offset[2] || "00").replace(":", "")}`;
  }
  return new Date(`${day}T${time}`);
}

const AVATAR_COLOURS = ["bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700"];

export function avatarColour(name = "") {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

/** "Jane Doe <jane@x.com>" -> "Jane Doe" */
export function senderName(from = "") {
  const m = from.match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1] : from;
}
