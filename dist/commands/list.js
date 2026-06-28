import { listSessions } from "../store.js";
/**
 * List all voice-log sessions, newest first.
 *
 *   voicelogger list [--json]
 *
 * --json prints the raw VoiceLogSession array (for scripting / other tools).
 */
export async function listCommand(args = []) {
    const sessions = await listSessions();
    if (args.includes("--json")) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
    }
    if (!sessions.length) {
        console.log("no voice log sessions yet — record one with: voicelogger record");
        return;
    }
    for (const s of sessions) {
        const dur = s.endedAt ? durationStr(s.startedAt, s.endedAt) : "…";
        const project = s.projectId ?? "-";
        console.log(`${s.id}  [${s.status}]  project:${project}  ${dur}`);
        if (s.summary)
            console.log(`    ${s.summary}`);
    }
}
function durationStr(start, end) {
    const ms = Date.parse(end) - Date.parse(start);
    if (!Number.isFinite(ms))
        return "?"; // un-parseable timestamp in a hand-edited index
    const sec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m${s.toString().padStart(2, "0")}s`;
}
//# sourceMappingURL=list.js.map