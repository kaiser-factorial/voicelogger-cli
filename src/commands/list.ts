import { listSessions } from "../store.js";

/**
 * List all voice-log sessions, newest first.
 *
 *   voicelog list
 */
export async function listCommand(): Promise<void> {
  const sessions = await listSessions();
  if (!sessions.length) {
    console.log("no voice log sessions yet — record one with: voicelog record");
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
  const sec = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}
