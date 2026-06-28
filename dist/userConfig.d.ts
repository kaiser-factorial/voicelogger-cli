/**
 * Per-machine config saved at ~/.voicelogger/config.json (override the dir with
 * VOICELOGGER_HOME). Currently just the Anthropic key — written with 0600 perms so
 * only you can read it. An ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN in the
 * environment always takes precedence over the saved value.
 */
export interface UserConfig {
    anthropicApiKey?: string;
    /** Path to a project-tracker CLI (e.g. The Ledger) that `link` notifies. Optional. */
    ledgerBin?: string;
    /** Where to save logs. Falls back to the code default. */
    dataDir?: string;
    /** Anthropic model the `clean` pass uses. Falls back to the code default. */
    anthropicModel?: string;
}
export declare function configFilePath(): string;
export declare function loadUserConfig(): UserConfig;
/** Merge `patch` into the saved config and write it back with 0600 perms. */
export declare function saveUserConfig(patch: Partial<UserConfig>): string;
/**
 * If a key is saved and no Anthropic credential is already in the environment,
 * populate process.env.ANTHROPIC_API_KEY so the SDK and hasAnthropicAuth() see it.
 * Called once at startup (from config.ts). An explicit env var always wins.
 */
export declare function applyStoredEnv(): void;
