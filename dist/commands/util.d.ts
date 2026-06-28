/**
 * Value following a flag, e.g. optValue(args, "--project") → "rrg".
 * A following token that is itself a flag (starts with "-") is treated as a
 * missing value, so `--note --touch` yields undefined rather than "--touch".
 */
export declare function optValue(args: string[], ...flags: string[]): string | undefined;
/** First non-flag positional argument. */
export declare function firstPositional(args: string[]): string | undefined;
/**
 * All non-flag positional arguments, in order. Pass the value-taking flags
 * (e.g. `--note`, `--reason`) so their values aren't mistaken for positionals —
 * otherwise `link latest --note "recap" rrg` would read the note text as the
 * projectId.
 */
export declare function positionals(args: string[], valueFlags?: string[]): string[];
