import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import { confirm, promptLine } from "../prompt.js";
import { setupApiKey } from "../setupKey.js";
import { configFilePath, loadUserConfig, saveUserConfig } from "../userConfig.js";
/**
 * Manage per-machine config (saved at ~/.voicelogger/config.json).
 *
 *   voicelogger config                 interactive wizard (API key + where to save logs)
 *   voicelogger config show            show current config (key masked)
 *   voicelogger config dir <path>      set where logs save
 *   voicelogger config ledger <path>   connect a project tracker CLI ("off" to disconnect)
 */
export async function configCommand(args) {
    if (args[0] === "show")
        return showConfig();
    if (args[0] === "dir")
        return configDir(args.slice(1));
    if (args[0] === "model")
        return configModel(args.slice(1));
    if (args[0] === "endpoint")
        return configEndpoint(args.slice(1));
    if (args[0] === "ledger")
        return configLedger(args.slice(1));
    return runWizard();
}
/** Resolve a user-typed path: expand a leading `~`, then make it absolute. */
function resolvePath(p) {
    const expanded = p.startsWith("~") ? p.replace(/^~/, os.homedir()) : p;
    return path.resolve(expanded);
}
/** Show last 4 chars only, never the full secret. */
function maskKey(key) {
    if (!key)
        return "(not set)";
    return key.length <= 8 ? "set" : `${key.slice(0, 7)}…${key.slice(-4)}`;
}
function showConfig() {
    const saved = loadUserConfig();
    // config.ts may have copied the saved key into the env, so treat the env as an
    // external override only when it differs from what's saved.
    const envKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
    let keyLine;
    if (envKey && envKey !== saved.anthropicApiKey)
        keyLine = `${maskKey(envKey)}  (from environment — overrides saved)`;
    else if (saved.anthropicApiKey)
        keyLine = `${maskKey(saved.anthropicApiKey)}  (from saved config)`;
    else
        keyLine = "(not set — run: voicelogger config)";
    const tracker = config.ledgerEnabled ? config.ledgerBin : "(not connected)";
    // Render <value>  (from <source>) — same shape as the API key line.
    const sourced = (value, env, savedVal) => {
        if (env)
            return `${value}  (from environment)`;
        if (savedVal !== undefined)
            return `${value}  (from saved config)`;
        return `${value}  (default)`;
    };
    const endpointUrl = config.llmBaseUrl;
    const endpointLine = endpointUrl
        ? sourced(endpointUrl, process.env.LLM_BASE_URL, saved.llmBaseUrl)
        : "Anthropic (default)";
    const endpointKeyLine = endpointUrl
        ? (config.llmApiKey ? `${maskKey(config.llmApiKey)}` : "(none — local endpoint)")
        : "(n/a)";
    console.log(`config file:        ${configFilePath()}`);
    console.log(`anthropic key:      ${keyLine}`);
    console.log(`LLM endpoint:       ${endpointLine}`);
    console.log(`endpoint key:       ${endpointKeyLine}`);
    console.log(`cleanup model:      ${sourced(config.anthropicModel, process.env.CLAUDE_MODEL, saved.anthropicModel)}`);
    console.log(`logs dir:           ${sourced(config.dataDir, process.env.VOICELOG_DIR, saved.dataDir)}`);
    console.log(`whisper model file: ${config.modelPath}`);
    console.log(`auto-clean:         ${config.autoCleanMode}`);
    console.log(`project tracker:    ${tracker}`);
}
/** Set (or reset) the model used for cleanup. Works for Anthropic and OpenAI-compat endpoints. */
function configModel(rest) {
    const value = rest[0];
    if (!value) {
        console.log(`cleanup model: ${config.anthropicModel}`);
        console.log("usage: voicelogger config model <name>  (or 'default' to reset)");
        console.log("Anthropic models:");
        console.log("  claude-sonnet-4-6                      (default — balanced)");
        console.log("  claude-haiku-4-5                       (cheaper / faster)");
        console.log("  claude-opus-4-8                        (highest quality)");
        console.log("OpenRouter free models (set endpoint first):");
        console.log("  google/gemma-2-27b-it:free");
        console.log("  meta-llama/llama-3.3-70b-instruct:free");
        console.log("  mistralai/mistral-7b-instruct:free");
        return;
    }
    if (value === "default") {
        saveUserConfig({ anthropicModel: undefined });
        console.log("✓ reset to the default cleanup model.");
        return;
    }
    saveUserConfig({ anthropicModel: value });
    console.log(`✓ cleanup will use ${value}`);
}
const ENDPOINT_SHORTHANDS = {
    openrouter: "https://openrouter.ai/api/v1",
    ollama: "http://localhost:11434/v1",
};
/** Set (or reset) the OpenAI-compatible LLM endpoint for the cleanup pass. */
async function configEndpoint(rest) {
    const value = rest[0];
    if (!value) {
        const cur = config.llmBaseUrl;
        console.log(cur ? `LLM endpoint: ${cur}` : "LLM endpoint: Anthropic (default)");
        console.log("usage: voicelogger config endpoint <url|openrouter|ollama|default>");
        console.log("examples:");
        console.log("  openrouter   → https://openrouter.ai/api/v1  (needs an API key)");
        console.log("  ollama       → http://localhost:11434/v1      (no key needed)");
        console.log("  default      → back to Anthropic");
        return;
    }
    if (value === "default") {
        saveUserConfig({ llmBaseUrl: undefined, llmApiKey: undefined });
        console.log("✓ reset to Anthropic (default).");
        return;
    }
    const url = ENDPOINT_SHORTHANDS[value] ?? value;
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    saveUserConfig({ llmBaseUrl: url });
    console.log(`✓ LLM endpoint set to ${url}`);
    if (isLocal) {
        saveUserConfig({ llmApiKey: undefined });
        console.log("  (no API key needed for local endpoints like Ollama)");
        console.log("  Make sure Ollama is running: ollama serve");
        console.log("  Set model:  voicelogger config model <ollama-model-name>");
        console.log("  e.g.        voicelogger config model llama3.2");
        return;
    }
    // Remote endpoint — prompt for API key if we have a TTY.
    if (!process.stdin.isTTY) {
        console.log("  Set the API key: voicelogger config endpoint-key <key>");
        console.log("  Or set LLM_API_KEY in your environment.");
        return;
    }
    if (value === "openrouter") {
        console.log("  Get a free key at: https://openrouter.ai/keys");
    }
    const key = await promptLine("  API key (Enter to skip): ");
    if (key.trim()) {
        saveUserConfig({ llmApiKey: key.trim() });
        console.log("  ✓ key saved.");
    }
    else {
        console.log("  ⚠ skipped — set it later: voicelogger config endpoint <url> again, or LLM_API_KEY.");
    }
    if (value === "openrouter") {
        console.log("\n  Suggested free models (set with: voicelogger config model <name>):");
        console.log("    google/gemma-2-27b-it:free");
        console.log("    meta-llama/llama-3.3-70b-instruct:free");
        console.log("    mistralai/mistral-7b-instruct:free");
    }
}
/** Set (or reset) where logs are saved. Use `default` to drop the saved override. */
function configDir(rest) {
    const value = rest[0];
    if (!value) {
        console.log(`logs save to: ${config.dataDir}`);
        console.log("usage: voicelogger config dir <path>  (or 'default' to reset)");
        return;
    }
    if (value === "default") {
        saveUserConfig({ dataDir: undefined });
        console.log("✓ reset to the default logs directory.");
        return;
    }
    const abs = resolvePath(value);
    saveUserConfig({ dataDir: abs });
    console.log(`✓ logs will save to ${abs}`);
    if (!existsSync(abs))
        console.log("  (it'll be created on your next recording.)");
    console.log("  existing logs in the old location aren't moved.");
}
/** Connect / disconnect a project-tracker CLI (e.g. The Ledger) that `link` notifies. */
function configLedger(rest) {
    const value = rest[0];
    if (!value) {
        const cur = loadUserConfig().ledgerBin;
        console.log(cur ? `project tracker: ${cur}` : "no project tracker connected.");
        console.log("usage: voicelogger config ledger <path-to-cli> | off");
        return;
    }
    if (value === "off") {
        saveUserConfig({ ledgerBin: undefined });
        console.log("✓ disconnected the project tracker.");
        return;
    }
    // A path gets resolved to absolute; a bare name (e.g. "ledger") is kept for PATH lookup.
    const looksLikePath = path.isAbsolute(value) || /[\\/]/.test(value);
    const stored = looksLikePath ? path.resolve(value) : value;
    if (looksLikePath && !existsSync(stored)) {
        console.warn(`note: ${stored} doesn't exist yet — saving anyway.`);
    }
    saveUserConfig({ ledgerBin: stored });
    console.log(`✓ connected project tracker → ${stored}`);
    console.log("  `voicelogger link <session> <project>` will now notify it.");
}
async function runWizard() {
    if (!process.stdin.isTTY) {
        console.error("voicelogger config needs an interactive terminal.");
        console.error("Non-interactively, set the env var instead: export ANTHROPIC_API_KEY=…");
        process.exit(1);
    }
    console.log(`voicelogger setup: settings saved locally to ${configFilePath()}\n`);
    await wizardKeyStep();
    await wizardDirStep();
    console.log("\nAll set. Try: voicelogger record");
}
/** Step 1 — Anthropic API key. Explains what it's for, where to get one, and skippable. */
async function wizardKeyStep() {
    console.log("Step 1 of 2 — Anthropic API key\n");
    console.log("  Used to clean your raw transcripts: no key = raw transcript only.");
    console.log("  Get one at: https://console.anthropic.com/settings/keys\n");
    const existing = loadUserConfig().anthropicApiKey;
    if (existing) {
        console.log(`  You already have a key saved: ${maskKey(existing)}`);
        if (!(await confirm("  Replace it? [y/N] ", false))) {
            console.log("  ✓ keeping your existing key.\n");
            return;
        }
    }
    console.log("  Paste your key below (input is hidden), or press Enter to skip.");
    const file = await setupApiKey();
    if (file) {
        console.log(`  ✓ API key saved (permissions 600).\n`);
    }
    else {
        console.log("  ⚠ skipped — re-run 'voicelogger config' any time, or set ANTHROPIC_API_KEY in your shell.\n");
    }
}
/** Step 2 — where logs save. Enter keeps the current effective dir (a no-op). */
async function wizardDirStep() {
    console.log("Step 2 of 2 — Where to save your voice logs");
    console.log(`  (press Enter to keep the default: ${config.dataDir})`);
    const answer = (await promptLine("  > ")).trim();
    if (answer) {
        const abs = resolvePath(answer);
        saveUserConfig({ dataDir: abs });
        console.log(`  ✓ logs will save to ${abs}`);
    }
    else {
        console.log(`  ✓ logs will save to ${config.dataDir}`);
    }
}
//# sourceMappingURL=config.js.map