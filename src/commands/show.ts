import { readFile } from "node:fs/promises";
import { resolveSession } from "../store.js";
import { firstPositional } from "./util.js";

/**
 * Print a session's transcript. Defaults to the cleaned version if it exists,
 * otherwise raw.
 *
 *   voicelogger show <session|latest> [--raw | --cleaned]
 */
export async function showCommand(args: string[]): Promise<void> {
  const id = firstPositional(args);
  if (!id) {
    console.error("usage: voicelogger show <session|latest> [--raw | --cleaned]");
    process.exit(1);
  }

  const session = await resolveSession(id);
  if (!session) {
    console.error(`no session matching '${id}'`);
    process.exit(20);
  }

  let target: string;
  if (args.includes("--raw")) {
    target = session.rawPath;
  } else if (args.includes("--cleaned")) {
    if (!session.cleanedPath) {
      console.error(`no cleaned version — run: voicelogger clean ${session.id}`);
      process.exit(20);
    }
    target = session.cleanedPath;
  } else {
    target = session.cleanedPath ?? session.rawPath;
  }

  const content = await readFile(target, "utf8");
  process.stdout.write(content.endsWith("\n") ? content : content + "\n");
}
