import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import { confirm, promptChoice, promptHidden, promptLine } from "../prompt.js";
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
    console.log(`cleanup model:      ${sourced(config.anthropicModel, process.env.LLM_MODEL ?? process.env.CLAUDE_MODEL, saved.anthropicModel)}`);
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
        console.log("OpenRouter free models (run `voicelogger config` wizard to browse live list):");
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
const B = process.stdout.isTTY && !process.env.NO_COLOR
    ? (s) => `\x1b[1m${s}\x1b[0m`
    : (s) => s;
async function runWizard() {
    if (!process.stdin.isTTY) {
        console.error("voicelogger config needs an interactive terminal.");
        console.error("Non-interactively, set env vars: ANTHROPIC_API_KEY, LLM_BASE_URL, etc.");
        process.exit(1);
    }
    console.log(`voicelogger setup — settings saved to ${configFilePath()}\n`);
    await wizardDirStep();
    const provider = await wizardProviderStep();
    await wizardKeyStep(provider);
    await wizardModelStep(provider);
    console.log("All set. Try: voicelogger record");
}
/** Step 1 — where logs save. Enter keeps the current effective dir. */
async function wizardDirStep() {
    console.log(`${B("Step 1")} — Where to save your voice logs`);
    console.log(`  (press Enter to keep: ${config.dataDir})\n`);
    const answer = (await promptLine("  > ")).trim();
    if (answer) {
        const abs = resolvePath(answer);
        saveUserConfig({ dataDir: abs });
        console.log(`  ✓ logs will save to ${abs}\n`);
    }
    else {
        console.log(`  ✓ ${config.dataDir}\n`);
    }
}
/** Step 2 — choose LLM provider. Saves the endpoint (or clears it for Anthropic). */
async function wizardProviderStep() {
    console.log(`${B("Step 2")} — LLM provider for transcript cleanup`);
    console.log("  Your transcript text is sent to this provider for cleaning.\n");
    const idx = await promptChoice([
        { label: "Anthropic", hint: "best quality — API key required" },
        { label: "OpenRouter", hint: "free models available — API key required" },
        { label: "Ollama", hint: "runs 100% locally, completely private, no API key" },
    ], 0);
    console.log();
    const providers = ["anthropic", "openrouter", "ollama"];
    const chosen = providers[idx];
    if (chosen === "anthropic") {
        saveUserConfig({ llmBaseUrl: undefined, llmApiKey: undefined });
    }
    else if (chosen === "openrouter") {
        saveUserConfig({ llmBaseUrl: "https://openrouter.ai/api/v1" });
    }
    else {
        saveUserConfig({ llmBaseUrl: "http://localhost:11434/v1", llmApiKey: undefined });
    }
    return chosen;
}
/** Step 3 — API key (skipped for Ollama). */
async function wizardKeyStep(provider) {
    if (provider === "ollama") {
        console.log(`${B("Step 3")} — API key`);
        console.log("  Ollama runs locally — no API key needed.\n");
        console.log("  Make sure it's running: ollama serve");
        console.log("  Pull a model if you haven't: ollama pull llama3.2\n");
        return;
    }
    if (provider === "anthropic") {
        console.log(`${B("Step 3")} — Anthropic API key`);
        console.log("  Get one at: https://console.anthropic.com/settings/keys\n");
        const existing = loadUserConfig().anthropicApiKey;
        if (existing) {
            console.log(`  Saved key: ${maskKey(existing)}`);
            if (!(await confirm("  Replace it? [y/N] ", false))) {
                console.log("  ✓ keeping existing key.\n");
                return;
            }
        }
        console.log("  Paste your key below (input is hidden), or press Enter to skip.");
        const key = (await promptHidden("  Key: ")).trim();
        if (key) {
            saveUserConfig({ anthropicApiKey: key });
            process.env.ANTHROPIC_API_KEY = key;
            console.log("  ✓ key saved (permissions 600).\n");
        }
        else {
            console.log("  ⚠ skipped — set ANTHROPIC_API_KEY or re-run 'voicelogger config'.\n");
        }
        return;
    }
    // OpenRouter
    console.log(`${B("Step 3")} — OpenRouter API key`);
    console.log("  Free tier available — get a key at: https://openrouter.ai/keys\n");
    const existing = loadUserConfig().llmApiKey;
    if (existing) {
        console.log(`  Saved key: ${maskKey(existing)}`);
        if (!(await confirm("  Replace it? [y/N] ", false))) {
            console.log("  ✓ keeping existing key.\n");
            return;
        }
    }
    console.log("  Paste your key below (input is hidden), or press Enter to skip.");
    const key = (await promptHidden("  Key: ")).trim();
    if (key) {
        saveUserConfig({ llmApiKey: key });
        console.log("  ✓ key saved (permissions 600).\n");
    }
    else {
        console.log("  ⚠ skipped — set LLM_API_KEY or re-run 'voicelogger config'.\n");
    }
}
/**
 * Fetch the current list of free model IDs from OpenRouter's public models API.
 * Returns an empty array on any network/parse failure so callers can fall back gracefully.
 */
const OPENROUTER_EXCLUDE = ["coder", "code", "content-safety", "embed", "vision", "omni", "vl"];
/** Parse the first Nb number from a model ID (e.g. "550b" → 550, "31b" → 31). */
function parseParamsBillions(id) {
    const m = id.match(/(\d+(?:\.\d+)?)b/i);
    return m ? parseFloat(m[1]) : 0;
}
async function fetchOpenRouterFreeModels(maxParams = 72) {
    try {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (!res.ok)
            return [];
        const data = (await res.json());
        return (data.data ?? [])
            .filter((m) => m.id.endsWith(":free"))
            .filter((m) => !OPENROUTER_EXCLUDE.some((kw) => m.id.toLowerCase().includes(kw)))
            .filter((m) => {
            const p = parseParamsBillions(m.id);
            return p === 0 || p <= maxParams; // keep models with no parseable size
        })
            .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
            .map((m) => m.id)
            .slice(0, 6);
    }
    catch {
        return [];
    }
}
/** Step 4 — choose cleanup model. Shows a list scoped to the chosen provider. */
async function wizardModelStep(provider) {
    let heading;
    let options;
    if (provider === "anthropic") {
        heading = `${B("Step 4")} — Cleanup model`;
        options = [
            { label: "claude-sonnet-4-6", hint: "balanced — great quality, reasonable cost", value: "claude-sonnet-4-6" },
            { label: "claude-haiku-4-5", hint: "faster and cheaper, good for quick notes", value: "claude-haiku-4-5" },
            { label: "claude-opus-4-8", hint: "highest quality, higher cost", value: "claude-opus-4-8" },
            { label: "type a custom model name", value: "__custom__" },
        ];
    }
    else if (provider === "openrouter") {
        heading = `${B("Step 4")} — Cleanup model (OpenRouter)`;
        process.stdout.write("  Fetching available free models from OpenRouter…");
        const live = await fetchOpenRouterFreeModels();
        process.stdout.write(live.length ? ` ${live.length} found.\n\n` : " (offline, showing defaults)\n\n");
        const modelIds = live.length
            ? live
            : ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-r1:free", "qwen/qwq-32b:free"];
        options = [
            ...modelIds.map((id) => ({ label: id, value: id })),
            { label: "type a custom model name", value: "__custom__" },
        ];
    }
    else {
        heading = `${B("Step 4")} — Cleanup model (Ollama)`;
        options = [
            { label: "llama3.2", hint: "recommended — fast and capable", value: "llama3.2" },
            { label: "mistral", hint: "solid general-purpose model", value: "mistral" },
            { label: "gemma2", hint: "Google's open model", value: "gemma2" },
            { label: "type a custom model name", value: "__custom__" },
        ];
    }
    console.log(heading);
    console.log();
    const idx = await promptChoice(options.map(({ label, hint }) => ({ label, hint })), 0);
    const chosen = options[idx];
    let modelName;
    if (chosen.value === "__custom__") {
        modelName = (await promptLine("  Model name: ")).trim();
        if (!modelName) {
            console.log("  ⚠ skipped — keeping current model setting.\n");
            return;
        }
    }
    else {
        modelName = chosen.value;
    }
    saveUserConfig({ anthropicModel: modelName });
    console.log(`  ✓ cleanup will use ${modelName}\n`);
}
//# sourceMappingURL=config.js.map