import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCleanMode } from "./cleanMode.js";
import { micDefaults } from "./platform.js";
import { applyStoredEnv, loadUserConfig } from "./userConfig.js";
// Load a key saved via `voicelogger config` into the environment (if none is set)
// before anything reads Anthropic credentials.
applyStoredEnv();
// Package root, stable whether running from src/ (tsx) or dist/ (built).
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const home = os.homedir();
// Per-user home for voicelogger's own assets (the Whisper model, etc.). This is
// independent of where the package is installed, so a global/`npx` install has a
// writable, predictable place for the ~141 MB model. Override with VOICELOGGER_HOME.
const userHome = process.env.VOICELOGGER_HOME ?? path.join(home, ".voicelogger");
// Transcripts live on the filesystem (see AGENT_AND_VOICELOG_PLAN.md "Storage").
// Precedence: VOICELOG_DIR env → saved config (set via `voicelogger config dir <path>`) →
// auto default. The auto default keeps existing users at the legacy ~/Projects/voice_logs
// (so their recordings don't go missing), but a fresh install lands the friendlier
// ~/voicelogger.
function defaultDataDir() {
    const legacy = path.join(home, "Projects", "voice_logs");
    return existsSync(legacy) ? legacy : path.join(home, "voicelogger");
}
// Cache the saved config — referenced by several settings below, and the underlying
// loadUserConfig() does a readFileSync each call.
const userCfg = loadUserConfig();
const dataDir = process.env.VOICELOG_DIR ?? userCfg.dataDir ?? defaultDataDir();
const MODEL_FILE = "ggml-base.en.bin";
/**
 * Parse a positive integer from an env var, falling back when it's unset, empty,
 * non-numeric, or <= 0. (`Number(process.env.X ?? "4")` would pass NaN through for
 * e.g. `WHISPER_THREADS=auto`, which then reaches whisper-cli / the API call.)
 */
function posInt(value, fallback) {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
/**
 * Resolve the Whisper model path. Precedence:
 *   1. WHISPER_MODEL (explicit override)
 *   2. <packageRoot>/models/<file> when present (source checkout that already
 *      ran `download-model` in-tree)
 *   3. <userHome>/models/<file> (the install-location-independent default)
 */
function resolveModelPath() {
    if (process.env.WHISPER_MODEL)
        return process.env.WHISPER_MODEL;
    const inTree = path.join(packageRoot, "models", MODEL_FILE);
    if (existsSync(inTree))
        return inTree;
    return path.join(userHome, "models", MODEL_FILE);
}
// Platform-derived ffmpeg mic input (overridable via MIC_FORMAT / MIC_DEVICE).
const mic = micDefaults(process.platform);
// Project-tracker integration is opt-in: off unless LEDGER_BIN is set or a path was
// saved via `voicelogger config ledger <path>`.
const ledgerBin = process.env.LEDGER_BIN ?? userCfg.ledgerBin ?? "";
export const config = {
    dataDir,
    rawDir: path.join(dataDir, "raw"),
    cleanedDir: path.join(dataDir, "cleaned"),
    sessionsDir: path.join(dataDir, "sessions"),
    modelPath: resolveModelPath(),
    modelUrl: process.env.WHISPER_MODEL_URL ??
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    whisperBin: process.env.WHISPER_BIN ?? "whisper-cli",
    ffmpegBin: process.env.FFMPEG_BIN ?? "ffmpeg",
    micFormat: process.env.MIC_FORMAT ?? mic.format,
    micDevice: process.env.MIC_DEVICE ?? mic.device,
    whisperThreads: posInt(process.env.WHISPER_THREADS, 4),
    format: { sampleRate: 16000, channels: 1 },
    // Default Sonnet 4.6 — best balance of cleanup quality vs cost. Override per-machine
    // with `voicelogger config model <name>`, or per-call with the CLAUDE_MODEL env var.
    anthropicModel: process.env.CLAUDE_MODEL ?? userCfg.anthropicModel ?? "claude-sonnet-4-6",
    cleanMaxTokens: posInt(process.env.CLEAN_MAX_TOKENS, 16000),
    glossaryPath: process.env.GLOSSARY_PATH ?? path.join(packageRoot, "cleaning", "glossary.md"),
    templatePath: process.env.TEMPLATE_PATH ?? path.join(packageRoot, "cleaning", "template.md"),
    autoCleanMode: parseCleanMode(process.env.VOICELOGGER_AUTOCLEAN) ?? "auto",
    ledgerBin,
    ledgerEnabled: ledgerBin !== "",
};
//# sourceMappingURL=config.js.map