import type { CleanMode } from "./types.js";
/** Normalize a mode string (env or flag value); returns undefined if unrecognized. */
export declare function parseCleanMode(value: string | undefined): CleanMode | undefined;
/**
 * Resolve the effective clean mode for a `record` invocation.
 * Precedence: explicit flag → caller's fallback (env default) → "auto".
 *
 *   --no-clean            → off
 *   --clean               → auto
 *   --clean <auto|prompt|off>
 */
export declare function resolveAutoCleanMode(args: string[], fallback?: CleanMode): CleanMode;
