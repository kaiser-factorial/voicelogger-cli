import { promptHidden } from "./prompt.js";
import { saveUserConfig } from "./userConfig.js";

/**
 * Interactive wizard: read the Anthropic API key with input hidden, save it to
 * ~/.voicelogger/config.json (0600), and load it into the environment for the
 * current process so it's usable immediately. Returns the saved file path, or
 * null if there's no TTY or nothing was entered.
 */
export async function setupApiKey(): Promise<string | null> {
  if (!process.stdin.isTTY) return null;

  const key = (await promptHidden("Anthropic API key: ")).trim();
  if (!key) return null;
  if (!key.startsWith("sk-ant-")) {
    console.log("note: that doesn't look like an sk-ant-… key — saving anyway.");
  }

  const file = saveUserConfig({ anthropicApiKey: key });
  process.env.ANTHROPIC_API_KEY = key; // usable now, no restart needed
  return file;
}
