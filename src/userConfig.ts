import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Per-machine config saved at ~/.voicelogger/config.json (override the dir with
 * VOICELOGGER_HOME). Written with 0600 perms so only you can read it.
 * Environment variables always take precedence over saved values.
 */
export interface UserConfig {
  anthropicApiKey?: string;
  /** Path to a project-tracker CLI (e.g. The Ledger) that `link` notifies. Optional. */
  ledgerBin?: string;
  /** Path to the Unified Memory Hub `mem` CLI. When set, cleaned logs are ingested and
   *  project context is queried before cleaning. Optional — off by default. */
  memBin?: string;
  /** Where to save logs. Falls back to the code default. */
  dataDir?: string;
  /** Model name for the `clean` pass. Falls back to the code default. */
  anthropicModel?: string;
  /** Base URL for an OpenAI-compatible LLM endpoint (OpenRouter, Ollama, etc.).
   *  When set, the clean pass uses fetch + this endpoint instead of the Anthropic SDK. */
  llmBaseUrl?: string;
  /** API key for the above endpoint. Not needed for local endpoints like Ollama. */
  llmApiKey?: string;
}

function userHome(): string {
  return process.env.VOICELOGGER_HOME ?? path.join(os.homedir(), ".voicelogger");
}

export function configFilePath(): string {
  return path.join(userHome(), "config.json");
}

export function loadUserConfig(): UserConfig {
  try {
    return JSON.parse(readFileSync(configFilePath(), "utf8")) as UserConfig;
  } catch {
    return {}; // missing or unreadable → empty config
  }
}

/** Merge `patch` into the saved config and write it back with 0600 perms. */
export function saveUserConfig(patch: Partial<UserConfig>): string {
  mkdirSync(userHome(), { recursive: true });
  const file = configFilePath();
  const merged = { ...loadUserConfig(), ...patch };
  writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
  // mode on writeFile only applies when creating — enforce it for an existing file too.
  try {
    chmodSync(file, 0o600);
  } catch {
    /* best effort (e.g. non-POSIX) */
  }
  return file;
}

/**
 * If a key is saved and no Anthropic credential is already in the environment,
 * populate process.env.ANTHROPIC_API_KEY so the SDK and hasAnthropicAuth() see it.
 * Called once at startup (from config.ts). An explicit env var always wins.
 */
export function applyStoredEnv(): void {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return;
  const key = loadUserConfig().anthropicApiKey;
  if (key) process.env.ANTHROPIC_API_KEY = key;
}
