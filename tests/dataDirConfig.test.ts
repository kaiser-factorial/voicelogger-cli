import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A dataDir saved in ~/.voicelogger/config.json should override the code default
// when VOICELOG_DIR isn't set in the environment.
const home = mkdtempSync(path.join(os.tmpdir(), "vl-datadir-"));
process.env.VOICELOGGER_HOME = home;
delete process.env.VOICELOG_DIR;
writeFileSync(
  path.join(home, "config.json"),
  JSON.stringify({ dataDir: "/var/voicelogs" }),
);

const { config } = await import("../src/config.js");

test("saved dataDir flows through to config (and derived raw/cleaned/sessions paths)", () => {
  assert.equal(config.dataDir, "/var/voicelogs");
  assert.equal(config.rawDir, "/var/voicelogs/raw");
  assert.equal(config.cleanedDir, "/var/voicelogs/cleaned");
  assert.equal(config.sessionsDir, "/var/voicelogs/sessions");
});
