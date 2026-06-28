import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { cleanTranscript } from "./cleaner.js";
import { ingestCleanedLog, queryProjectContext } from "./mem.js";
import { cleanedBaseName } from "./slug.js";
import { readRawBody, writeSession } from "./store.js";
/** Whether credentials are available for the cleaning pass (Anthropic or a configured LLM endpoint). */
export function hasAnthropicAuth() {
    if (config.llmBaseUrl)
        return true; // endpoint configured — key optional (e.g. Ollama)
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
/** `cleaned/<base>.md`, bumping with -2, -3, … if a different file already has that name. */
function uniqueCleanedPath(base) {
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
export async function runClean(session) {
    const body = await readRawBody(session);
    if (!body)
        throw new Error("raw transcript is empty — nothing to clean");
    const [glossary, template, projectContext] = await Promise.all([
        readFile(config.glossaryPath, "utf8").catch(() => ""),
        readFile(config.templatePath, "utf8").catch(() => ""),
        queryProjectContext(session),
    ]);
    const { title, summary, cleaned } = await cleanTranscript(body, { glossary, template, projectContext });
    await mkdir(config.cleanedDir, { recursive: true });
    // Name the cleaned file from the LLM title + date (e.g. test_with_music_27June2026.md).
    // Keep an already-friendly name on re-clean; but if it's still the legacy timestamp name
    // (<id>.md), migrate to the friendly name and drop the stale file.
    const isLegacyName = session.cleanedPath && path.basename(session.cleanedPath) === `${session.id}.md`;
    let cleanedPath;
    if (session.cleanedPath && !isLegacyName) {
        cleanedPath = session.cleanedPath;
    }
    else {
        cleanedPath = uniqueCleanedPath(cleanedBaseName(title, session.startedAt));
        if (session.cleanedPath && session.cleanedPath !== cleanedPath) {
            await rm(session.cleanedPath, { force: true });
        }
    }
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
    // Seed the Memory Hub flywheel: index this cleaned log so future sessions and
    // BRICK adjudication have richer context about this project. Fire-and-forget.
    if (config.memEnabled) {
        ingestCleanedLog(session, cleanedPath).catch(() => { });
    }
    return { cleanedPath, summary, markdown };
}
//# sourceMappingURL=cleanSession.js.map