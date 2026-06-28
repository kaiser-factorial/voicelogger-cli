import { optValue } from "./commands/util.js";
/** Normalize a mode string (env or flag value); returns undefined if unrecognized. */
export function parseCleanMode(value) {
    switch (value?.trim().toLowerCase()) {
        case "auto":
        case "on":
        case "yes":
        case "true":
            return "auto";
        case "prompt":
        case "ask":
            return "prompt";
        case "off":
        case "no":
        case "false":
        case "skip":
            return "off";
        default:
            return undefined;
    }
}
/**
 * Resolve the effective clean mode for a `record` invocation.
 * Precedence: explicit flag → caller's fallback (env default) → "auto".
 *
 *   --no-clean            → off
 *   --clean               → auto
 *   --clean <auto|prompt|off>
 */
export function resolveAutoCleanMode(args, fallback = "auto") {
    if (args.includes("--no-clean"))
        return "off";
    if (args.includes("--clean")) {
        // bare `--clean` means auto; `--clean <mode>` picks the mode
        return parseCleanMode(optValue(args, "--clean")) ?? "auto";
    }
    return fallback;
}
//# sourceMappingURL=cleanMode.js.map