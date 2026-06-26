import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { VoiceLogSession } from "./types.js";

/** All sessions on disk, newest first. */
export async function listSessions(): Promise<VoiceLogSession[]> {
  let files: string[];
  try {
    files = await readdir(config.sessionsDir);
  } catch {
    return [];
  }
  const sessions: VoiceLogSession[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(config.sessionsDir, f), "utf8");
      sessions.push(JSON.parse(raw) as VoiceLogSession);
    } catch {
      // skip malformed index files
    }
  }
  sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return sessions;
}

/**
 * Resolve a session by id, the literal "latest", or a unique id prefix.
 * Returns null if nothing matches (or a prefix is ambiguous).
 */
export async function resolveSession(idOrLatest: string): Promise<VoiceLogSession | null> {
  const sessions = await listSessions();
  if (!sessions.length) return null;
  if (idOrLatest === "latest") return sessions[0];
  const exact = sessions.find((s) => s.id === idOrLatest);
  if (exact) return exact;
  const matches = sessions.filter((s) => s.id.startsWith(idOrLatest));
  return matches.length === 1 ? matches[0] : null;
}

export async function writeSession(session: VoiceLogSession): Promise<void> {
  const p = path.join(config.sessionsDir, `${session.id}.json`);
  await writeFile(p, JSON.stringify(session, null, 2) + "\n");
}

/** The transcript body of a raw log, with the metadata header stripped. */
export async function readRawBody(session: VoiceLogSession): Promise<string> {
  const raw = await readFile(session.rawPath, "utf8");
  const sep = raw.indexOf("\n---\n");
  return (sep >= 0 ? raw.slice(sep + 5) : raw).trim();
}
