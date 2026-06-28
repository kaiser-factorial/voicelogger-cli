/**
 * Print a session's transcript. Defaults to the cleaned version if it exists,
 * otherwise raw. The cleaned view is rendered with styled markdown; raw is
 * printed verbatim. `--plain` prints the cleaned markdown unstyled.
 *
 *   voicelogger show <session|latest> [--raw | --cleaned] [--plain]
 */
export declare function showCommand(args: string[]): Promise<void>;
