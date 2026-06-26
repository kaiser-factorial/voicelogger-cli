import * as readline from "node:readline";
import { config } from "../config.js";
import { configFilePath, loadUserConfig, saveUserConfig } from "../userConfig.js";

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
  const key = (await promptHidden("Anthropic API key: ")).trim();
  if (!key) {
    console.error("no key entered — nothing saved.");
    process.exit(1);
  }
  if (!key.startsWith("sk-ant-")) {
    console.log("note: that doesn't look like an sk-ant-… key — saving anyway.");
  }

  const file = saveUserConfig({ anthropicApiKey: key });
  console.log(`\n✓ saved to ${file} (permissions 600)`);
  console.log("  voicelogger will use it automatically. A shell ANTHROPIC_API_KEY still wins.");
}

/** Read a line from a TTY without echoing what is typed (like a password prompt). */
function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    // Suppress echo of typed characters once muted; the prompt itself is written
    // before muting, so it still shows.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (!muted) process.stdout.write(s);
    };
    process.stdout.write(prompt);
    muted = true;
    rl.question("", (answer) => {
      muted = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}
