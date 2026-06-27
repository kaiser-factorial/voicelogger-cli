#!/usr/bin/env node
/**
 * voicelogger — local Whisper voice-logger CLI.
 *
 * Commands are declared once in COMMANDS below, which drives both dispatch and help.
 * Run `voicelogger --help`, or `voicelogger <command> --help` for options.
 */
import { readFileSync } from "node:fs";
import { appCommand } from "./commands/app.js";
import { cleanCommand } from "./commands/clean.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { downloadModelCommand } from "./commands/downloadModel.js";
import { linkCommand } from "./commands/link.js";
import { listCommand } from "./commands/list.js";
import { recordCommand } from "./commands/record.js";
import { showCommand } from "./commands/show.js";

type Group = "Record" | "Browse" | "Integrate" | "Setup";
const GROUPS: Group[] = ["Record", "Browse", "Integrate", "Setup"];

interface Command {
  name: string;
  group: Group;
  summary: string;
  usage: string;
  options?: string;
  run: (args: string[]) => void | Promise<void>;
}

const COMMANDS: Command[] = [
  {
    name: "record",
    group: "Record",
    summary: "record the mic until Enter/Ctrl-C, then auto-clean",
    usage: "voicelogger record [--project <id>] [--app <name>] [--no-clean | --clean <mode>]",
    options: `  --project <id>   tag the session with a project id
  --app <name>     after cleanup, push the logs into a registered app (see 'app')
  --no-clean       keep the raw transcript only (skip the LLM clean)
  --clean <mode>   cleanup mode: auto (default) | prompt | off`,
    run: recordCommand,
  },
  {
    name: "clean",
    group: "Record",
    summary: "LLM-clean a raw transcript → cleaned/<name>.md",
    usage: "voicelogger clean <session|latest> [--plain]",
    options: "  --plain          print the cleaned markdown unstyled",
    run: cleanCommand,
  },
  {
    name: "list",
    group: "Browse",
    summary: "list sessions, newest first",
    usage: "voicelogger list [--json]",
    options: "  --json           output the raw session list as JSON",
    run: listCommand,
  },
  {
    name: "show",
    group: "Browse",
    summary: "print a transcript (cleaned by default)",
    usage: "voicelogger show <session|latest> [--raw | --cleaned] [--plain]",
    options: `  --raw            show the untouched raw transcript
  --cleaned        show the cleaned version (errors if not cleaned yet)
  --plain          don't style the markdown`,
    run: showCommand,
  },
  {
    name: "link",
    group: "Integrate",
    summary: "attach a session to a project (drops a ledger note)",
    usage:
      "voicelogger link <session|latest> <projectId> [--touch] [--reason <r>] [--note <n>] [--no-ledger]",
    options: `  --touch          also record a 'ledger touch' on the project
  --reason <r>     reason for the touch
  --note <n>       note text (default: the session summary)
  --no-ledger      save the local link only; skip the ledger CLI`,
    run: linkCommand,
  },
  {
    name: "app",
    group: "Integrate",
    summary: "push session logs into a registered app dir",
    usage: "voicelogger app <add|list|push|rm> …",
    options: `  add <name> <path>              register an app + create <path>/voicelogs/
  list                           list registered apps
  push <session|latest> <name>   copy a session's logs into the app
  rm <name>                      unregister an app`,
    run: appCommand,
  },
  {
    name: "config",
    group: "Setup",
    summary: "set the Anthropic API key (wizard) / show config",
    usage: "voicelogger config [show]",
    options: `  (no arg)         run the wizard to set your API key (input hidden)
  show             print the resolved config (key masked)`,
    run: configCommand,
  },
  {
    name: "doctor",
    group: "Setup",
    summary: "check ffmpeg / whisper / model / key / ledger",
    usage: "voicelogger doctor",
    run: () => doctorCommand(),
  },
  {
    name: "download-model",
    group: "Setup",
    summary: "download the Whisper model (~141 MB)",
    usage: "voicelogger download-model [--force]",
    options: "  --force          re-download even if the model is already present",
    run: downloadModelCommand,
  },
];

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

function topLevelHelp(): string {
  const pad = Math.max(...COMMANDS.map((c) => c.name.length));
  const lines = [
    "voicelogger — local Whisper voice-logger",
    "",
    "usage: voicelogger <command> [options]",
  ];
  for (const group of GROUPS) {
    lines.push("", group);
    for (const c of COMMANDS.filter((x) => x.group === group)) {
      lines.push(`  ${c.name.padEnd(pad)}   ${c.summary}`);
    }
  }
  lines.push(
    "",
    "Run 'voicelogger <command> --help' for options  ·  'voicelogger version' for the version.",
    'A <session> is a full id, a unique id prefix, or "latest".',
  );
  return lines.join("\n");
}

function commandHelp(c: Command): string {
  const lines = [`voicelogger ${c.name} — ${c.summary}`, "", `usage: ${c.usage}`];
  if (c.options) lines.push("", "options:", c.options);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "version" || cmd === "-v" || cmd === "--version") {
    console.log(`voicelogger ${version()}`);
    return;
  }

  // `--help`, no command, or `help [command]`
  if (cmd === undefined || cmd === "help" || cmd === "-h" || cmd === "--help") {
    const target = COMMANDS.find((c) => c.name === rest[0]);
    console.log(target ? commandHelp(target) : topLevelHelp());
    return;
  }

  const entry = COMMANDS.find((c) => c.name === cmd);
  if (!entry) {
    console.error(`unknown command: ${cmd}\n`);
    console.log(topLevelHelp());
    process.exit(1);
  }

  // `voicelogger <command> --help`
  if (rest.includes("--help") || rest.includes("-h")) {
    console.log(commandHelp(entry));
    return;
  }

  return entry.run(rest);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
