#!/usr/bin/env node
/**
 * voicelogger — local Whisper voice-logger CLI.
 *
 *   voicelogger record [--project <id>]            capture mic → raw/<id>.md
 *   voicelogger clean  <session|latest>            LLM clean → cleaned/<id>.md
 *   voicelogger list                               browse sessions
 *   voicelogger show   <session|latest> [--raw|--cleaned]
 *   voicelogger link   <session|latest> <projectId> [--touch] [--no-ledger]
 *   voicelogger download-model [--force]           fetch the Whisper model
 *   voicelogger version
 *
 * Installed as the `voicelogger` binary; also runnable from source via
 * `npm run voicelogger -- <command> …` (or the per-command scripts).
 */
import { readFileSync } from "node:fs";
import { cleanCommand } from "./commands/clean.js";
import { configCommand } from "./commands/config.js";
import { downloadModelCommand } from "./commands/downloadModel.js";
import { linkCommand } from "./commands/link.js";
import { listCommand } from "./commands/list.js";
import { recordCommand } from "./commands/record.js";
import { showCommand } from "./commands/show.js";

const HELP = `voicelogger — local Whisper voice-logger

commands:
  record [--project <id>]                  record the mic until Enter/Ctrl-C
  clean  <session|latest>                  clean a raw transcript with the LLM
  list                                     list all sessions (newest first)
  show   <session|latest> [--raw|--cleaned]  print a transcript
  link   <session|latest> <projectId>      attach to a project (drops a ledger note)
           [--touch] [--reason <r>] [--note <n>] [--no-ledger]
  config [show]                            set the Anthropic API key (wizard) / show config
  download-model [--force]                 download the Whisper model
  version                                  print the installed version

a <session> can be a full id, a unique id prefix, or "latest".`;

function version(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case "record":
      return recordCommand(rest);
    case "clean":
      return cleanCommand(rest);
    case "list":
      return listCommand();
    case "show":
      return showCommand(rest);
    case "link":
      return linkCommand(rest);
    case "config":
      return configCommand(rest);
    case "download-model":
      return downloadModelCommand(rest);
    case "version":
    case "-v":
    case "--version":
      console.log(`voicelogger ${version()}`);
      return;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      return;
    default:
      console.error(`unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
