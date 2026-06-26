import { config } from "../config.js";
import { runClean } from "../cleanSession.js";
import { renderMarkdown } from "../markdown.js";
import { resolveSession } from "../store.js";
import { firstPositional } from "./util.js";

/**
 * Clean a raw transcript with the LLM and write cleaned/<id>.md, then print the
 * edited markdown styled for the terminal.
 *
 *   voicelogger clean <session|latest> [--plain]
 */
export async function cleanCommand(args: string[]): Promise<void> {
  const id = firstPositional(args);
  if (!id) {
    console.error("usage: voicelogger clean <session|latest> [--plain]");
    process.exit(1);
  }

  const session = await resolveSession(id);
  if (!session) {
    console.error(`no session matching '${id}'`);
    process.exit(20);
  }

  console.log(`cleaning ${session.id} with ${config.anthropicModel}…`);
  let cleaned;
  try {
    cleaned = await runClean(session);
  } catch (err) {
    // empty raw body is a usage error (exit 40); anything else bubbles up
    if (err instanceof Error && err.message.includes("nothing to clean")) {
      console.error(err.message);
      process.exit(40);
    }
    throw err;
  }

  console.log(`\n✓ cleaned → ${cleaned.cleanedPath}\n`);
  // --plain forces no color; otherwise renderMarkdown auto-detects the TTY.
  const color = args.includes("--plain") ? false : undefined;
  console.log(renderMarkdown(cleaned.markdown, { color }));
  if (!session.projectId) {
    console.log(`\nNext: voicelogger link ${session.id} <projectId>`);
  }
}
