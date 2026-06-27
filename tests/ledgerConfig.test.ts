import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A ledgerBin saved in ~/.voicelogger/config.json should turn the tracker on.
const home = mkdtempSync(path.join(os.tmpdir(), "vl-ledger-"));
process.env.VOICELOGGER_HOME = home;
delete process.env.LEDGER_BIN;
writeFileSync(path.join(home, "config.json"), JSON.stringify({ ledgerBin: "/opt/ledger" }));

const { config } = await import("../src/config.js");

test("a saved tracker path enables the integration", () => {
  assert.equal(config.ledgerEnabled, true);
  assert.equal(config.ledgerBin, "/opt/ledger");
});
