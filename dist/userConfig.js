import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
function userHome() {
    return process.env.VOICELOGGER_HOME ?? path.join(os.homedir(), ".voicelogger");
}
export function configFilePath() {
    return path.join(userHome(), "config.json");
}
export function loadUserConfig() {
    try {
        return JSON.parse(readFileSync(configFilePath(), "utf8"));
    }
    catch {
        return {}; // missing or unreadable → empty config
    }
}
/** Merge `patch` into the saved config and write it back with 0600 perms. */
export function saveUserConfig(patch) {
    mkdirSync(userHome(), { recursive: true });
    const file = configFilePath();
    const merged = { ...loadUserConfig(), ...patch };
    writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
    // mode on writeFile only applies when creating — enforce it for an existing file too.
    try {
        chmodSync(file, 0o600);
    }
    catch {
        /* best effort (e.g. non-POSIX) */
    }
    return file;
}
/**
 * If a key is saved and no Anthropic credential is already in the environment,
 * populate process.env.ANTHROPIC_API_KEY so the SDK and hasAnthropicAuth() see it.
 * Called once at startup (from config.ts). An explicit env var always wins.
 */
export function applyStoredEnv() {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
        return;
    const key = loadUserConfig().anthropicApiKey;
    if (key)
        process.env.ANTHROPIC_API_KEY = key;
}
//# sourceMappingURL=userConfig.js.map