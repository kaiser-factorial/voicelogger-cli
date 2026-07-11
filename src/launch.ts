import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Launch-recipe cache for `voicelogger test <path>` (Phase 1b) — a *separate* file from
 * `apps.ts`'s registry, keyed by the project's resolved absolute path rather than a chosen
 * app name. See docs/TEST_LOG_PLAN.md's Phase 1b design-decisions block for why: apps.json
 * names are for push targets you deliberately registered, and a tested path has no reason
 * to already have (or need) one.
 */

export type ProjectKind = "tauri" | "node" | "go-cli" | "unknown";

export interface DevRecipe {
  /** Shell command to start the dev server, e.g. "npm run dev" or a tauri.conf.json beforeDevCommand. */
  cmd: string;
  cwd: string;
  /** Known in advance for tauri (from tauri.conf.json); absent for node until first observed. */
  url?: string;
  detectedAt: string; // ISO
  /** Last confirmed-reachable URL — probed on later runs before re-spawning anything. */
  lastUrl?: string;
}

export interface ProdRecipe {
  url: string;
  setAt: string; // ISO
}

export interface LaunchRecipe {
  kind: ProjectKind;
  dev?: DevRecipe;
  prod?: ProdRecipe;
  /** For "go-cli": the binary path to build (if stale/missing) and run. */
  cliBin?: string;
}

export type LaunchCache = Record<string, LaunchRecipe>;

function userHome(): string {
  return process.env.VOICELOGGER_HOME ?? path.join(os.homedir(), ".voicelogger");
}

export function launchFilePath(): string {
  return path.join(userHome(), "launch.json");
}

export async function loadLaunchCache(): Promise<LaunchCache> {
  try {
    return JSON.parse(await readFile(launchFilePath(), "utf8")) as LaunchCache;
  } catch {
    return {};
  }
}

export async function saveLaunchRecipe(absPath: string, recipe: LaunchRecipe): Promise<void> {
  await mkdir(userHome(), { recursive: true });
  const cache = await loadLaunchCache();
  cache[absPath] = recipe;
  await writeFile(launchFilePath(), JSON.stringify(cache, null, 2) + "\n");
}

/** Node script names to try, in priority order, when nothing is cached yet. */
export const NODE_DEV_CANDIDATES = ["dev", "serve", "start"] as const;

interface TauriConf {
  build?: { devUrl?: string; beforeDevCommand?: string };
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** `<absPath>/tauri.conf.json` or the more common `<absPath>/src-tauri/tauri.conf.json`. */
async function findTauriConf(absPath: string): Promise<string | undefined> {
  for (const candidate of ["tauri.conf.json", path.join("src-tauri", "tauri.conf.json")]) {
    const p = path.join(absPath, candidate);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Best-effort binary name for a Go project. `go.mod` states a module path, not a binary
 * name, and there's no single canonical file that does (unlike Tauri's tauri.conf.json) —
 * this is inherently a guess, documented as such. Prefers the idiomatic `cmd/<name>/` single-
 * binary layout (confirmed against ledger-cli's real `cmd/ledger/main.go`); falls back to the
 * repo directory's own name, which is what `go build` names a root-package binary anyway.
 */
async function guessGoBinaryName(absPath: string): Promise<string> {
  const cmdDir = path.join(absPath, "cmd");
  try {
    const entries = (await readdir(cmdDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    if (entries.length === 1) return entries[0];
  } catch {
    // no cmd/ dir — fall through
  }
  return path.basename(absPath);
}

/**
 * Deterministic project-type detection — pure filesystem/config inspection, no agent
 * dependency (locked decision #7 in docs/TEST_LOG_PLAN.md): `voicelogger test` must work
 * standalone, outside of any coding-agent session.
 *
 * Returns a recipe ready to use for "tauri" (devUrl/cmd both known exactly from
 * tauri.conf.json) and "go-cli" (no dev server — build-and-run). For "node", `dev` is
 * left undefined — there's a *candidate* script list to trial at runtime
 * (src/launchRun.ts), not a single answer; see the Phase 1b design-decisions note on why
 * a single "always run dev" guess would have been wrong for this very workspace (bulwork's
 * own `dev` script is its CLI entry point, not its server).
 */
export async function detectProject(
  absPath: string,
): Promise<{ recipe: LaunchRecipe; nodeCandidates?: string[] }> {
  const now = new Date().toISOString();

  const tauriConfPath = await findTauriConf(absPath);
  if (tauriConfPath) {
    const conf = await readJson<TauriConf>(tauriConfPath);
    const devUrl = conf?.build?.devUrl;
    const beforeDevCommand = conf?.build?.beforeDevCommand;
    if (devUrl && beforeDevCommand) {
      return {
        recipe: {
          kind: "tauri",
          dev: { cmd: beforeDevCommand, cwd: absPath, url: devUrl, detectedAt: now },
        },
      };
    }
    // tauri.conf.json exists but is missing the fields we need — don't guess, fall through.
  }

  if (existsSync(path.join(absPath, "go.mod"))) {
    return { recipe: { kind: "go-cli", cliBin: path.join(absPath, await guessGoBinaryName(absPath)) } };
  }

  const pkg = await readJson<{ scripts?: Record<string, string> }>(
    path.join(absPath, "package.json"),
  );
  if (pkg) {
    const scripts = pkg.scripts ?? {};
    const nodeCandidates = NODE_DEV_CANDIDATES.filter((s) => typeof scripts[s] === "string");
    if (nodeCandidates.length) {
      return { recipe: { kind: "node" }, nodeCandidates };
    }
  }

  return { recipe: { kind: "unknown" } };
}
