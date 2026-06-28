import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the config home at a throwaway dir and clear any inherited Anthropic env
// before importing (each test file is its own process).
process.env.VOICELOGGER_HOME = mkdtempSync(path.join(os.tmpdir(), "vl-cfg-"));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const { saveUserConfig, loadUserConfig, configFilePath, applyStoredEnv } = await import(
  "../src/userConfig.js"
);

test("saveUserConfig / loadUserConfig round-trip", () => {
  saveUserConfig({ anthropicApiKey: "sk-ant-test123" });
  assert.equal(loadUserConfig().anthropicApiKey, "sk-ant-test123");
});

test("saved config file is not group/other readable (0600)", () => {
  const mode = statSync(configFilePath()).mode & 0o777;
  assert.equal(mode & 0o077, 0); // owner-only
});

test("applyStoredEnv populates ANTHROPIC_API_KEY when none is set", () => {
  delete process.env.ANTHROPIC_API_KEY;
  applyStoredEnv();
  assert.equal(process.env.ANTHROPIC_API_KEY, "sk-ant-test123");
});

test("applyStoredEnv does not override an existing env key", () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-fromenv";
  applyStoredEnv();
  assert.equal(process.env.ANTHROPIC_API_KEY, "sk-ant-fromenv");
});

test("ledgerBin round-trips and can be cleared with undefined", () => {
  saveUserConfig({ ledgerBin: "/opt/ledger" });
  assert.equal(loadUserConfig().ledgerBin, "/opt/ledger");
  // the API key set earlier must survive the merge
  assert.equal(loadUserConfig().anthropicApiKey, "sk-ant-test123");
  saveUserConfig({ ledgerBin: undefined });
  assert.equal(loadUserConfig().ledgerBin, undefined);
});

test("anthropicModel round-trips and clears with undefined", () => {
  saveUserConfig({ anthropicModel: "claude-haiku-4-5" });
  assert.equal(loadUserConfig().anthropicModel, "claude-haiku-4-5");
  // other fields survive the merge
  assert.equal(loadUserConfig().anthropicApiKey, "sk-ant-test123");
  saveUserConfig({ anthropicModel: undefined });
  assert.equal(loadUserConfig().anthropicModel, undefined);
});

test("dataDir round-trips and clears with undefined", () => {
  saveUserConfig({ dataDir: "/var/voicelogs" });
  assert.equal(loadUserConfig().dataDir, "/var/voicelogs");
  // earlier fields survive the merge
  assert.equal(loadUserConfig().anthropicApiKey, "sk-ant-test123");
  saveUserConfig({ dataDir: undefined });
  assert.equal(loadUserConfig().dataDir, undefined);
});
