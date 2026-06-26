import { listSessions } from "../store.js";

/**
 * List all voice-log sessions, newest first.
 *
 *   voicelogger list
 */
export async function listCommand(): Promise<void> {
  const sessions = await listSessions();
  if (!sessions.length) {
    console.log("no voice log sessions yet — record one with: voicelogger record");
    return;
  }

  for (const s of sessions) {
    const dur = s.endedAt ? durationStr(s.startedAt, s.endedAt) : "…";
    const project = s.projectId ?? "-";
    console.log(`${s.id}  [${s.status}]  project:${project}  ${dur}`);
    if (s.summary) console.log(`    ${s.summary}`);
  }
}

function durationStr(start: string, end: string): string {
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms)) return "?"; // un-parseable timestamp in a hand-edited index
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}
