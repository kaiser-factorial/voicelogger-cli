/**
 * Build a friendly, filesystem-safe name for a cleaned voice log, e.g.
 * "test_with_music_27June2026" — from the LLM-chosen title plus the record date.
 */

/** Lowercase, ASCII, underscore-separated slug. Falls back to "voice_log" if empty. */
export function slugify(text: string, maxLen = 60): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop combining diacritics (déjà → deja)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen)
    .replace(/_+$/g, "");
  return s || "voice_log";
}

/** Date like "27June2026" from an ISO timestamp, in local time. */
export function dateStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "undated";
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${d.getDate()}${month}${d.getFullYear()}`;
}

/** Friendly cleaned-file base name (no extension): `<slug>_<DDMonthYYYY>`. */
export function cleanedBaseName(title: string, startedAtIso: string): string {
  return `${slugify(title)}_${dateStamp(startedAtIso)}`;
}
