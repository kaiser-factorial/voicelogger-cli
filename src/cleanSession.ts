import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { cleanTranscript } from "./cleaner.js";
import { cleanedBaseName } from "./slug.js";
import { readRawBody, writeSession } from "./store.js";
import type { VoiceLogSession } from "./types.js";

export interface CleanOutcome {
  cleanedPath: string;
  summary: string;
  /** Full cleaned-file markdown (header + body), ready to render. */
  markdown: string;
}

/** Whether Anthropic credentials are available for the cleaning pass. */
export function hasAnthropicAuth(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** `cleaned/<base>.md`, bumping with -2, -3, … if a different file already has that name. */
function uniqueCleanedPath(base: string): string {
  let candidate = path.join(config.cleanedDir, `${base}.md`);
  for (let n = 2; existsSync(candidate); n++) {
    candidate = path.join(config.cleanedDir, `${base}-${n}.md`);
  }
  return candidate;
}

/**
 * LLM cleaning pass for a session: read its raw body, apply the shared
 * glossary+template, write cleaned/<id>.md, update the session index, and return
 * the cleaned markdown. Throws if the raw transcript is empty.
 *
 * Shared by the `clean` command and `record`'s auto-clean step so both produce
 * identical output.
 */
export async function runClean(session: VoiceLogSession): Promise<CleanOutcome> {
  const body = await readRawBody(session);
  if (!body) throw new Error("raw transcript is empty — nothing to clean");

  const [glossary, template] = await Promise.all([
    readFile(config.glossaryPath, "utf8").catch(() => ""),
    readFile(config.templatePath, "utf8").catch(() => ""),
  ]);

  const { title, summary, cleaned } = await cleanTranscript(body, { glossary, template });

  await mkdir(config.cleanedDir, { recursive: true });
  // First clean → a friendly name from the LLM title + date (e.g.
  // test_with_music_27June2026.md); re-clean → keep the existing file/name.
  const cleanedPath =
    session.cleanedPath ?? uniqueCleanedPath(cleanedBaseName(title, session.startedAt));
  const header = [
    `# ${title}`,
    "",
    `> ${summary}`,
    "",
    `- session: ${session.id}`,
    `- source: ${session.source}`,
    `- project: ${session.projectId ?? "(unlinked)"}`,
    `- cleaned from: ${session.rawPath}`,
    "",
    "---",
    "",
    "",
  ].join("\n");
  const markdown = header + cleaned.trim() + "\n";
  await writeFile(cleanedPath, markdown);

  session.cleanedPath = cleanedPath;
  session.status = "cleaned";
  session.summary = summary;
  await writeSession(session);

  return { cleanedPath, summary, markdown };
}
