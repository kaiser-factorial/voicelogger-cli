/**
 * Registry of "apps" voicelogger can push logs into, saved at
 * ~/.voicelogger/apps.json (override the dir with VOICELOGGER_HOME). Each app is a
 * project directory; `app push` copies a session's logs into <path>/voicelogs/.
 */
export interface AppEntry {
    /** Absolute path to the app/project root. */
    path: string;
    /**
     * Optional companion CLI for this app (e.g. the `ledger` binary) — PLACEHOLDER:
     * recorded but not used yet. Wiring `link`/auto-note through this is a follow-up.
     */
    bin?: string;
}
export type AppRegistry = Record<string, AppEntry>;
export declare function appsFilePath(): string;
export declare function loadApps(): AppRegistry;
export declare function getApp(name: string): AppEntry | undefined;
export declare function upsertApp(name: string, entry: AppEntry): string;
export declare function removeApp(name: string): boolean;
