/**
 * Build a friendly, filesystem-safe name for a cleaned voice log, e.g.
 * "test_with_music_27June2026" — from the LLM-chosen title plus the record date.
 */
/** Lowercase, ASCII, underscore-separated slug. Falls back to "voice_log" if empty. */
export declare function slugify(text: string, maxLen?: number): string;
/** Date like "27June2026" from an ISO timestamp, in local time. */
export declare function dateStamp(iso: string): string;
/** Friendly cleaned-file base name (no extension): `<slug>_<DDMonthYYYY>`. */
export declare function cleanedBaseName(title: string, startedAtIso: string): string;
