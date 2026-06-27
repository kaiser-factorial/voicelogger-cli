import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// config.ts parses env at import time. Set values BEFORE importing it (each test file
// runs in its own process, so this is isolated). Point VOICELOGGER_HOME at an empty dir
// and clear LEDGER_BIN so the tracker resolves to its real default: off.
process.env.WHISPER_THREADS = "auto";
process.env.CLEAN_MAX_TOKENS = "";
process.env.VOICELOGGER_HOME = mkdtempSync(path.join(os.tmpdir(), "vl-cfg-default-"));
delete process.env.LEDGER_BIN;

const { config } = await import("../src/config.js");

test("non-numeric WHISPER_THREADS falls back to the default", () => {
  assert.equal(config.whisperThreads, 4);
  assert.ok(Number.isFinite(config.whisperThreads));
});

test("empty CLEAN_MAX_TOKENS falls back to the default", () => {
  assert.equal(config.cleanMaxTokens, 16000);
  assert.ok(Number.isInteger(config.cleanMaxTokens) && config.cleanMaxTokens > 0);
});

test("project tracker is off by default (no LEDGER_BIN, none saved)", () => {
  assert.equal(config.ledgerEnabled, false);
  assert.equal(config.ledgerBin, "");
});
