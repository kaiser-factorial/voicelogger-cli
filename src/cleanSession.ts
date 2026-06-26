import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { cleanTranscript } from "./cleaner.js";
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

  const { summary, cleaned } = await cleanTranscript(body, { glossary, template });

  await mkdir(config.cleanedDir, { recursive: true });
  const cleanedPath = path.join(config.cleanedDir, `${session.id}.md`);
  const header = [
    `# Cleaned voice log — ${session.id}`,
    "",
    `> ${summary}`,
    "",
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
