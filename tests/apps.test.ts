import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.VOICELOGGER_HOME = mkdtempSync(path.join(os.tmpdir(), "vl-apps-"));

const { upsertApp, loadApps, getApp, removeApp, appsFilePath } = await import("../src/apps.js");

test("upsertApp / loadApps / getApp round-trip", () => {
  upsertApp("ledger", { path: "/abs/ledger" });
  upsertApp("rrg", { path: "/abs/rrg" });
  assert.deepEqual(Object.keys(loadApps()).sort(), ["ledger", "rrg"]);
  assert.equal(getApp("ledger")?.path, "/abs/ledger");
  assert.equal(getApp("missing"), undefined);
});

test("upsertApp updates an existing app", () => {
  upsertApp("ledger", { path: "/abs/ledger2", bin: "/abs/ledger-cli/ledger" });
  assert.equal(getApp("ledger")?.path, "/abs/ledger2");
  assert.equal(getApp("ledger")?.bin, "/abs/ledger-cli/ledger");
});

test("removeApp drops an entry and reports success/failure", () => {
  assert.equal(removeApp("rrg"), true);
  assert.equal(getApp("rrg"), undefined);
  assert.equal(removeApp("rrg"), false); // already gone
});

test("appsFilePath lives under VOICELOGGER_HOME", () => {
  assert.equal(appsFilePath(), path.join(process.env.VOICELOGGER_HOME!, "apps.json"));
});
