import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { setupApiKey } from "../setupKey.js";
import { configFilePath, loadUserConfig, saveUserConfig } from "../userConfig.js";

/**
 * Manage per-machine config (saved at ~/.voicelogger/config.json).
 *
 *   voicelogger config                 interactive wizard — set the Anthropic API key
 *   voicelogger config show            show current config (key masked)
 *   voicelogger config ledger <path>   connect a project tracker CLI ("off" to disconnect)
 */
export async function configCommand(args: string[]): Promise<void> {
  if (args[0] === "show") return showConfig();
  if (args[0] === "ledger") return configLedger(args.slice(1));
  return runWizard();
}

/** Show last 4 chars only, never the full secret. */
function maskKey(key: string | undefined): string {
  if (!key) return "(not set)";
  return key.length <= 8 ? "set" : `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function showConfig(): void {
  const saved = loadUserConfig().anthropicApiKey;
  // config.ts may have copied the saved key into the env, so treat the env as an
  // external override only when it differs from what's saved.
  const env = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  let keyLine: string;
  if (env && env !== saved) keyLine = `${maskKey(env)}  (from environment — overrides saved)`;
  else if (saved) keyLine = `${maskKey(saved)}  (from saved config)`;
  else keyLine = "(not set — run: voicelogger config)";

  const tracker = config.ledgerEnabled ? config.ledgerBin : "(not connected)";

  console.log(`config file:      ${configFilePath()}`);
  console.log(`anthropic key:    ${keyLine}`);
  console.log(`data dir:         ${config.dataDir}`);
  console.log(`model:            ${config.modelPath}`);
  console.log(`auto-clean:       ${config.autoCleanMode}`);
  console.log(`project tracker:  ${tracker}`);
}

/** Connect / disconnect a project-tracker CLI (e.g. The Ledger) that `link` notifies. */
function configLedger(rest: string[]): void {
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

async function runWizard(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error("voicelogger config needs an interactive terminal.");
    console.error("Non-interactively, set the env var instead: export ANTHROPIC_API_KEY=…");
    process.exit(1);
  }

  console.log("voicelogger setup — your key is stored locally and never shown as you type.\n");
  const file = await setupApiKey();
  if (!file) {
    console.error("no key entered — nothing saved.");
    process.exit(1);
  }
  console.log(`\n✓ saved to ${file} (permissions 600)`);
  console.log("  voicelogger will use it automatically. A shell ANTHROPIC_API_KEY still wins.");
}
