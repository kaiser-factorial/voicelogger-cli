import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getApp, loadApps, removeApp, upsertApp } from "../apps.js";
import { pushSessionToApp } from "../appPush.js";
import { resolveSession } from "../store.js";
import { positionals } from "./util.js";

const USAGE = `usage:
  voicelogger app add <name> <path>              register an app + create <path>/voicelogs/
  voicelogger app list                           list registered apps
  voicelogger app push <session|latest> <name>   copy a session's logs into the app
  voicelogger app rm <name>                       unregister an app`;

/**
 * Manage "apps" voicelogger pushes logs into (a first cut of the BRAINSTORM
 * `--app` idea). Registry lives at ~/.voicelogger/apps.json.
 */
export async function appCommand(args: string[]): Promise<void> {
  const [sub, ...rest] = args;
  switch (sub) {
    case "add":
      return addApp(rest);
    case undefined:
    case "list":
      return listApps();
    case "push":
      return pushApp(rest);
    case "rm":
    case "remove":
      return rmApp(rest);
    default:
      console.error(`unknown app subcommand: ${sub}\n`);
      console.error(USAGE);
      process.exit(1);
  }
}

async function addApp(rest: string[]): Promise<void> {
  const [name, appPath] = positionals(rest);
  if (!name || !appPath) {
    console.error(USAGE);
    process.exit(1);
  }
  const abs = path.resolve(appPath);
  if (!existsSync(abs)) {
    console.error(`path does not exist: ${abs}`);
    process.exit(20);
  }
  const voicelogs = path.join(abs, "voicelogs");
  await mkdir(voicelogs, { recursive: true });
  const file = upsertApp(name, { path: abs });
  console.log(`✓ registered app '${name}' → ${abs}`);
  console.log(`  created ${voicelogs}/`);
  console.log(`  saved to ${file}`);
}

function listApps(): void {
  const apps = loadApps();
  const names = Object.keys(apps);
  if (!names.length) {
    console.log("no apps registered — add one with: voicelogger app add <name> <path>");
    return;
  }
  for (const name of names) console.log(`${name}  →  ${apps[name].path}`);
}

async function pushApp(rest: string[]): Promise<void> {
  const [sessionRef, name] = positionals(rest);
  if (!sessionRef || !name) {
    console.error(USAGE);
    process.exit(1);
  }
  const app = getApp(name);
  if (!app) {
    console.error(`unknown app '${name}' — add it with: voicelogger app add ${name} <path>`);
    process.exit(20);
  }
  const session = await resolveSession(sessionRef);
  if (!session) {
    console.error(`no session matching '${sessionRef}'`);
    process.exit(20);
  }

  const { base, copied } = await pushSessionToApp(session, app);
  console.log(`✓ pushed session ${session.id} → ${base}`);
  console.log(`  copied: ${copied.length ? copied.join(", ") : "(index only)"} + index`);
}

async function rmApp(rest: string[]): Promise<void> {
  const [name] = positionals(rest);
  if (!name) {
    console.error(USAGE);
    process.exit(1);
  }
  if (removeApp(name)) console.log(`✓ unregistered app '${name}'`);
  else {
    console.error(`no app named '${name}'`);
    process.exit(20);
  }
}
