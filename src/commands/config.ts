import { config } from "../config.js";
import { setupApiKey } from "../setupKey.js";
import { configFilePath, loadUserConfig } from "../userConfig.js";

/**
 * Manage per-machine config (saved at ~/.voicelogger/config.json).
 *
 *   voicelogger config            interactive wizard — set the Anthropic API key
 *   voicelogger config show       show current config (key masked)
 */
export async function configCommand(args: string[]): Promise<void> {
  if (args[0] === "show") return showConfig();
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

  console.log(`config file:      ${configFilePath()}`);
  console.log(`anthropic key:    ${keyLine}`);
  console.log(`data dir:         ${config.dataDir}`);
  console.log(`model:            ${config.modelPath}`);
  console.log(`auto-clean:       ${config.autoCleanMode}`);
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
