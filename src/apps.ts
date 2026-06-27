import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Registry of "apps" voicelogger can push logs into, saved at
 * ~/.voicelogger/apps.json (override the dir with VOICELOGGER_HOME). Each app is a
 * project directory; `app push` copies a session's logs into <path>/voicelogs/.
 */
export interface AppEntry {
  /** Absolute path to the app/project root. */
  path: string;
  /**
   * Optional companion CLI for this app (e.g. the `ledger` binary) — PLACEHOLDER:
   * recorded but not used yet. Wiring `link`/auto-note through this is a follow-up.
   */
  bin?: string;
}

export type AppRegistry = Record<string, AppEntry>;

function userHome(): string {
  return process.env.VOICELOGGER_HOME ?? path.join(os.homedir(), ".voicelogger");
}

export function appsFilePath(): string {
  return path.join(userHome(), "apps.json");
}

export function loadApps(): AppRegistry {
  try {
    return JSON.parse(readFileSync(appsFilePath(), "utf8")) as AppRegistry;
  } catch {
    return {};
  }
}

export function getApp(name: string): AppEntry | undefined {
  return loadApps()[name];
}

export function upsertApp(name: string, entry: AppEntry): string {
  mkdirSync(userHome(), { recursive: true });
  const apps = loadApps();
  apps[name] = entry;
  const file = appsFilePath();
  writeFileSync(file, JSON.stringify(apps, null, 2) + "\n");
  return file;
}

export function removeApp(name: string): boolean {
  const apps = loadApps();
  if (!(name in apps)) return false;
  delete apps[name];
  writeFileSync(appsFilePath(), JSON.stringify(apps, null, 2) + "\n");
  return true;
}
