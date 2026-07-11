import type { DevRecipe, LaunchRecipe } from "./launch.js";
export interface LaunchFailure {
    cmd: string;
    cwd: string;
    exitCode?: number | null;
    timedOut: boolean;
    output: string;
}
export type DevServerResult = {
    status: "ready";
    url: string;
    recipe: DevRecipe;
    reused: boolean;
} | {
    status: "running-no-url";
    recipe: DevRecipe;
} | {
    status: "failed";
    failure: LaunchFailure;
};
/**
 * Resolve a live dev-server URL for a "tauri" or "node" recipe: reuse an already-running
 * server if one answers, else spawn and wait for readiness. `nodeCandidates` is the ordered
 * script-name list from `detectProject` — only consulted when there's no cached `dev.cmd` yet
 * (or `forceRedetect`), since a cached recipe already knows the winning command.
 */
export declare function resolveDevServer(recipe: LaunchRecipe, opts?: {
    nodeCandidates?: string[];
    forceRedetect?: boolean;
}): Promise<DevServerResult>;
