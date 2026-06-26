import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { cleanTranscript } from "../cleaner.js";
import { readRawBody, resolveSession, writeSession } from "../store.js";
import { firstPositional } from "./util.js";

/**
 * Clean a raw transcript with the LLM and write cleaned/<id>.md.
 *
 *   voicelog clean <session|latest>
 */
export async function cleanCommand(args: string[]): Promise<void> {
  const id = firstPositional(args);
  if (!id) {
    console.error("usage: voicelog clean <session|latest>");
    process.exit(1);
  }

  const session = await resolveSession(id);
  if (!session) {
    console.error(`no session matching '${id}'`);
    process.exit(20);
  }

  const body = await readRawBody(session);
  if (!body) {
    console.error("raw transcript is empty — nothing to clean");
    process.exit(40);
  }

  const [glossary, template] = await Promise.all([
    readFile(config.glossaryPath, "utf8").catch(() => ""),
    readFile(config.templatePath, "utf8").catch(() => ""),
  ]);

  console.log(`cleaning ${session.id} with ${config.anthropicModel}…`);
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
  await writeFile(cleanedPath, header + cleaned.trim() + "\n");

  session.cleanedPath = cleanedPath;
  session.status = "cleaned";
  session.summary = summary;
  await writeSession(session);

  console.log(`\n✓ cleaned → ${cleanedPath}`);
  console.log(`  summary: ${summary}`);
  if (!session.projectId) {
    console.log(`\nNext: voicelog link ${session.id} <projectId>`);
  }
}
