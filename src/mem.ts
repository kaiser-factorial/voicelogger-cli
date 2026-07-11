import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import type { VoiceLogSession } from "./types.js";

const execFileAsync = promisify(execFile);

// Memory Hub integration — env-gated (VOICELOGGER_MEM_BIN or `voicelogger config mem <path>`).
// Always fails open: a mem error never blocks or crashes the clean pipeline.

function binParts(): { cmd: string; base: string[] } | null {
  if (!config.memBin) return null;
  const parts = config.memBin.split(" ");
  return { cmd: parts[0], base: parts.slice(1) };
}

interface MemQueryResponse {
  results?: Array<{ content?: string }>;
}

/**
 * Query the Memory Hub for context relevant to this session's project.
 * Called before cleaning — injects project-specific memory into the LLM prompt
 * so the cleaner understands domain terms and recent work on this project.
 * Returns undefined when the Hub is not configured, the project is unlinked,
 * or no relevant memories are found.
 *
 * `limit` defaults to 3 (plain voice logs); test-log mode passes a higher limit
 * since it leans more heavily on project context (see docs/TEST_LOG_PLAN.md).
 */
export async function queryProjectContext(
  session: VoiceLogSession,
  limit = 3,
): Promise<string | undefined> {
  const bin = binParts();
  if (!bin || !session.projectId) return undefined;

  try {
    const { stdout } = await execFileAsync(
      bin.cmd,
      [
        ...bin.base,
        "query", session.projectId,
        "--limit", String(limit),
        "--json",
        "--tags", session.projectId,
      ],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(stdout);
    // mem query --json returns { query, count, results: [...] }, not a raw array.
    const rows: Array<{ content?: string }> = Array.isArray(parsed)
      ? parsed
      : ((parsed as MemQueryResponse).results ?? []);

    const snippets = rows.map((r) => r?.content?.slice(0, 400)).filter(Boolean);
    return snippets.length ? snippets.join("\n---\n") : undefined;
  } catch {
    return undefined; // fail open
  }
}

/**
 * Ingest a freshly-cleaned voice log into the Memory Hub.
 * Called after cleaning — seeds the flywheel so future sessions and BULWORK
 * adjudication have project-specific context to draw from.
 * Fire-and-forget: errors are swallowed so the caller doesn't need to await this.
 */
export async function ingestCleanedLog(
  session: VoiceLogSession,
  cleanedPath: string,
): Promise<void> {
  const bin = binParts();
  if (!bin) return;

  const tags = ["voicelog", ...(session.projectId ? [session.projectId] : [])].join(",");
  try {
    await execFileAsync(
      bin.cmd,
      [...bin.base, "ingest", cleanedPath, "--tags", tags, "--source", "voicelogger"],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
  } catch {
    // Fail open — mem being unreachable never invalidates a successful clean.
  }
}
