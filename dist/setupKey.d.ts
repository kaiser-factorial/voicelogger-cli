/**
 * Interactive wizard: read the Anthropic API key with input hidden, save it to
 * ~/.voicelogger/config.json (0600), and load it into the environment for the
 * current process so it's usable immediately. Returns the saved file path, or
 * null if there's no TTY or nothing was entered.
 */
export declare function setupApiKey(): Promise<string | null>;
