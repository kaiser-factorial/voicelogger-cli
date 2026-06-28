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
const GROUPS = ["Record", "Browse", "Integrate", "Setup"];
const COMMANDS = [
    {
        name: "record",
        group: "Record",
        short: "capture a new voice log",
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
        short: "LLM-clean a raw transcript",
        summary: "LLM-clean a raw transcript → cleaned/<name>.md",
        usage: "voicelogger clean <session|latest> [--plain]",
        options: "  --plain          print the cleaned markdown unstyled",
        run: cleanCommand,
    },
    {
        name: "list",
        group: "Browse",
        short: "see all your logs",
        summary: "list sessions, newest first",
        usage: "voicelogger list [--json]",
        options: "  --json           output the raw session list as JSON",
        run: listCommand,
    },
    {
        name: "show",
        group: "Browse",
        short: "read a log",
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
        short: "tag a log with a project",
        summary: "attach a session to a project",
        usage: "voicelogger link <session|latest> <projectId> [--touch] [--reason <r>] [--note <n>] [--no-ledger]",
        options: `  --no-ledger      don't notify a connected tracker (save the local link only)
  --touch          tracker: also record a 'touch' on the project
  --reason <r>     tracker: reason for the touch
  --note <n>       tracker: note text (default: the session summary)

  A project tracker is optional — connect one with: voicelogger config ledger <path>`,
        run: linkCommand,
    },
    {
        name: "app",
        group: "Integrate",
        short: "send logs to another project",
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
        short: "set your API key + preferences",
        summary: "set API key / LLM endpoint / preferences (wizard)",
        usage: "voicelogger config [show | dir <path|default> | model <name|default> | endpoint <url|default> | ledger <path|off>]",
        options: `  (no arg)            run the wizard (API key + where to save logs)
  show                print the resolved config (key masked)
  dir <path>          set where logs save  ('default' to reset)
  model <name>        set the cleanup model  ('default' to reset)
                      Anthropic: claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-8
                      OpenRouter: run the config wizard to browse live free models
  endpoint <url>      set an OpenAI-compatible LLM endpoint  ('default' to reset to Anthropic)
                      shorthands: openrouter, ollama
  ledger <path>       connect a project tracker CLI  ('off' to disconnect)`,
        run: configCommand,
    },
    {
        name: "doctor",
        group: "Setup",
        short: "check your setup",
        summary: "check ffmpeg / whisper / model / API key",
        usage: "voicelogger doctor",
        run: () => doctorCommand(),
    },
    {
        name: "download-model",
        group: "Setup",
        short: "fetch the Whisper model (~141 MB)",
        summary: "download the Whisper model (~141 MB)",
        usage: "voicelogger download-model [--force]",
        options: "  --force          re-download even if the model is already present",
        run: downloadModelCommand,
    },
];
function version() {
    try {
        const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        return pkg.version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
/** Light ANSI bold/dim, but only when stdout is a real TTY (clean text on pipes/CI). */
const isTTY = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const bold = (s) => (isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const dim = (s) => (isTTY ? `\x1b[2m${s}\x1b[22m` : s);
function topLevelHelp() {
    const pad = Math.max(...COMMANDS.map((c) => c.name.length));
    const lines = [
        bold("voicelogger") + dim(" — record your voice, get a clean note back."),
        "",
        "What do you want to do?",
    ];
    for (const group of GROUPS) {
        lines.push("", dim(group));
        for (const c of COMMANDS.filter((x) => x.group === group)) {
            lines.push(`  • ${bold(c.name.padEnd(pad))}   ${c.short}`);
        }
    }
    lines.push("", dim("New here? Run ") + "voicelogger doctor" + dim(" to check your setup."), dim("More on a command: ") + "voicelogger <command> --help");
    return lines.join("\n");
}
function commandHelp(c) {
    const lines = [`voicelogger ${c.name} — ${c.summary}`, "", `usage: ${c.usage}`];
    if (c.options)
        lines.push("", "options:", c.options);
    return lines.join("\n");
}
async function main() {
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
//# sourceMappingURL=cli.js.map