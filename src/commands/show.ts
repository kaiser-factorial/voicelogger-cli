import { readFile } from "node:fs/promises";
import { renderMarkdown } from "../markdown.js";
import { resolveSession } from "../store.js";
import { firstPositional } from "./util.js";

/**
 * Print a session's transcript. Defaults to the cleaned version if it exists,
 * otherwise raw. The cleaned view is rendered with styled markdown; raw is
 * printed verbatim. `--plain` prints the cleaned markdown unstyled.
 *
 *   voicelogger show <session|latest> [--raw | --cleaned] [--plain]
 */
export async function showCommand(args: string[]): Promise<void> {
  const id = firstPositional(args);
  if (!id) {
    console.error("usage: voicelogger show <session|latest> [--raw | --cleaned] [--plain]");
    process.exit(1);
  }

  const session = await resolveSession(id);
  if (!session) {
    console.error(`no session matching '${id}'`);
    process.exit(20);
  }

  let target: string;
  let isRaw: boolean;
  if (args.includes("--raw")) {
    target = session.rawPath;
    isRaw = true;
  } else if (args.includes("--cleaned")) {
    if (!session.cleanedPath) {
      console.error(`no cleaned version — run: voicelogger clean ${session.id}`);
      process.exit(20);
    }
    target = session.cleanedPath;
    isRaw = false;
  } else {
    target = session.cleanedPath ?? session.rawPath;
    isRaw = !session.cleanedPath;
  }

  const content = await readFile(target, "utf8");
  // Raw is the untouched source — print verbatim. Cleaned renders styled unless
  // --plain (renderMarkdown also drops color for non-TTY pipes / NO_COLOR).
  if (isRaw || args.includes("--plain")) {
    process.stdout.write(content.endsWith("\n") ? content : content + "\n");
  } else {
    console.log(renderMarkdown(content));
  }
}
