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
    detectedAt: string;
    /** Last confirmed-reachable URL — probed on later runs before re-spawning anything. */
    lastUrl?: string;
}
export interface ProdRecipe {
    url: string;
    setAt: string;
}
export interface LaunchRecipe {
    kind: ProjectKind;
    dev?: DevRecipe;
    prod?: ProdRecipe;
    /** For "go-cli": the binary path to build (if stale/missing) and run. */
    cliBin?: string;
}
export type LaunchCache = Record<string, LaunchRecipe>;
export declare function launchFilePath(): string;
export declare function loadLaunchCache(): Promise<LaunchCache>;
export declare function saveLaunchRecipe(absPath: string, recipe: LaunchRecipe): Promise<void>;
/** Node script names to try, in priority order, when nothing is cached yet. */
export declare const NODE_DEV_CANDIDATES: readonly ["dev", "serve", "start"];
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
export declare function detectProject(absPath: string): Promise<{
    recipe: LaunchRecipe;
    nodeCandidates?: string[];
}>;
