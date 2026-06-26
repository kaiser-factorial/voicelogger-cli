/** Value following a flag, e.g. optValue(args, "--project") → "rrg". */
export function optValue(args: string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const i = args.indexOf(flag);
    if (i >= 0 && args[i + 1] !== undefined) return args[i + 1];
  }
  return undefined;
}

/** First non-flag positional argument. */
export function firstPositional(args: string[]): string | undefined {
  return args.find((a) => !a.startsWith("-"));
}

/** All non-flag positional arguments, in order. */
export function positionals(args: string[]): string[] {
  return args.filter((a) => !a.startsWith("-"));
}
