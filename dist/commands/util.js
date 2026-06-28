/**
 * Value following a flag, e.g. optValue(args, "--project") → "rrg".
 * A following token that is itself a flag (starts with "-") is treated as a
 * missing value, so `--note --touch` yields undefined rather than "--touch".
 */
export function optValue(args, ...flags) {
    for (const flag of flags) {
        const i = args.indexOf(flag);
        const next = args[i + 1];
        if (i >= 0 && next !== undefined && !next.startsWith("-"))
            return next;
    }
    return undefined;
}
/** First non-flag positional argument. */
export function firstPositional(args) {
    return args.find((a) => !a.startsWith("-"));
}
/**
 * All non-flag positional arguments, in order. Pass the value-taking flags
 * (e.g. `--note`, `--reason`) so their values aren't mistaken for positionals —
 * otherwise `link latest --note "recap" rrg` would read the note text as the
 * projectId.
 */
export function positionals(args, valueFlags = []) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith("-")) {
            // Skip the value that belongs to a value-taking flag (unless it's itself a flag).
            const next = args[i + 1];
            if (valueFlags.includes(a) && next !== undefined && !next.startsWith("-"))
                i++;
            continue;
        }
        out.push(a);
    }
    return out;
}
//# sourceMappingURL=util.js.map