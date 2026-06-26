import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Package root, stable whether running from src/ (tsx) or dist/ (built).
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");

const home = os.homedir();

// Per-user home for voicelogger's own assets (the Whisper model, etc.). This is
// independent of where the package is installed, so a global/`npx` install has a
// writable, predictable place for the ~141 MB model. Override with VOICELOGGER_HOME.
const userHome = process.env.VOICELOGGER_HOME ?? path.join(home, ".voicelogger");

// Transcripts live on the filesystem (see AGENT_AND_VOICELOG_PLAN.md "Storage").
// Default to ~/Projects/voice_logs; override with VOICELOG_DIR.
const dataDir = process.env.VOICELOG_DIR ?? path.join(home, "Projects", "voice_logs");

const MODEL_FILE = "ggml-base.en.bin";

/**
 * Resolve the Whisper model path. Precedence:
 *   1. WHISPER_MODEL (explicit override)
 *   2. <packageRoot>/models/<file> when present (source checkout that already
 *      ran `download-model` in-tree)
 *   3. <userHome>/models/<file> (the install-location-independent default)
 */
function resolveModelPath(): string {
  if (process.env.WHISPER_MODEL) return process.env.WHISPER_MODEL;
  const inTree = path.join(packageRoot, "models", MODEL_FILE);
  if (existsSync(inTree)) return inTree;
  return path.join(userHome, "models", MODEL_FILE);
}

export interface Config {
  dataDir: string;
  rawDir: string;
  cleanedDir: string;
  sessionsDir: string;
  modelPath: string;
  /** Where `download-model` fetches the default ggml model from. */
  modelUrl: string;
  whisperBin: string;
  ffmpegBin: string;
  /** avfoundation input spec for ffmpeg, e.g. ":0" = default audio device. */
  micDevice: string;
  whisperThreads: number;
  format: { sampleRate: number; channels: number };

  // --- cleaning (Part B agent, LLM-powered) ---
  /** Anthropic model for `clean`. Default Opus 4.8; set CLAUDE_MODEL=claude-haiku-4-5 for speed/cost. */
  anthropicModel: string;
  cleanMaxTokens: number;
  glossaryPath: string;
  templatePath: string;

  // --- ledger-cli bridge (the CLI-to-CLI link) ---
  /** The `ledger` binary used by `link`. Defaults to `ledger` on PATH; set LEDGER_BIN to point at a build. */
  ledgerBin: string;
}

export const config: Config = {
  dataDir,
  rawDir: path.join(dataDir, "raw"),
  cleanedDir: path.join(dataDir, "cleaned"),
  sessionsDir: path.join(dataDir, "sessions"),
  modelPath: resolveModelPath(),
  modelUrl:
    process.env.WHISPER_MODEL_URL ??
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
  whisperBin: process.env.WHISPER_BIN ?? "whisper-cli",
  ffmpegBin: process.env.FFMPEG_BIN ?? "ffmpeg",
  micDevice: process.env.MIC_DEVICE ?? ":0",
  whisperThreads: Number(process.env.WHISPER_THREADS ?? "4"),
  format: { sampleRate: 16000, channels: 1 },

  anthropicModel: process.env.CLAUDE_MODEL ?? "claude-opus-4-8",
  cleanMaxTokens: Number(process.env.CLEAN_MAX_TOKENS ?? "16000"),
  glossaryPath: process.env.GLOSSARY_PATH ?? path.join(packageRoot, "cleaning", "glossary.md"),
  templatePath: process.env.TEMPLATE_PATH ?? path.join(packageRoot, "cleaning", "template.md"),

  // Defaults to `ledger` on PATH so the bridge is portable. Point LEDGER_BIN at a
  // local build (e.g. ../ledger-cli/ledger) when the binary isn't installed globally.
  ledgerBin: process.env.LEDGER_BIN ?? "ledger",
};
