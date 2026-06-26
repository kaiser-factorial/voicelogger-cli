import { test } from "node:test";
import assert from "node:assert/strict";

// config.ts parses numeric env vars at import time. Set non-numeric values BEFORE
// importing it (each test file runs in its own process, so this is isolated) and
// confirm they fall back rather than producing NaN that would reach whisper-cli /
// the Anthropic API.
process.env.WHISPER_THREADS = "auto";
process.env.CLEAN_MAX_TOKENS = "";

const { config } = await import("../src/config.js");

test("non-numeric WHISPER_THREADS falls back to the default", () => {
  assert.equal(config.whisperThreads, 4);
  assert.ok(Number.isFinite(config.whisperThreads));
});

test("empty CLEAN_MAX_TOKENS falls back to the default", () => {
  assert.equal(config.cleanMaxTokens, 16000);
  assert.ok(Number.isInteger(config.cleanMaxTokens) && config.cleanMaxTokens > 0);
});
