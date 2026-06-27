import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pushSessionToApp } from "../src/appPush.js";
import type { VoiceLogSession } from "../src/types.js";

test("pushSessionToApp copies raw + cleaned (keeping its friendly name) + index", async () => {
  const src = mkdtempSync(path.join(os.tmpdir(), "vl-src-"));
  const app = mkdtempSync(path.join(os.tmpdir(), "vl-app-"));
  const rawPath = path.join(src, "sid.md"); // raw is named by id
  const cleanedPath = path.join(src, "test_with_music_27June2026.md"); // friendly name
  writeFileSync(rawPath, "raw body");
  writeFileSync(cleanedPath, "cleaned body");
  const session: VoiceLogSession = {
    id: "sid",
    startedAt: "2026-06-27T00:00:00.000Z",
    source: "laptop",
    rawPath,
    cleanedPath,
    status: "cleaned",
  };

  const { base, copied } = await pushSessionToApp(session, { path: app });

  assert.deepEqual([...copied].sort(), ["cleaned", "raw"]);
  assert.ok(existsSync(path.join(base, "raw", "sid.md")));
  assert.ok(existsSync(path.join(base, "cleaned", "test_with_music_27June2026.md")));
  const idx = JSON.parse(readFileSync(path.join(base, "sessions", "sid.json"), "utf8"));
  assert.equal(idx.rawPath, path.join(base, "raw", "sid.md")); // rewritten to app-local
  assert.equal(idx.cleanedPath, path.join(base, "cleaned", "test_with_music_27June2026.md"));
});

test("pushSessionToApp handles a raw-only (uncleaned) session", async () => {
  const src = mkdtempSync(path.join(os.tmpdir(), "vl-src2-"));
  const app = mkdtempSync(path.join(os.tmpdir(), "vl-app2-"));
  const rawPath = path.join(src, "s2.md");
  writeFileSync(rawPath, "raw body");
  const session: VoiceLogSession = {
    id: "s2",
    startedAt: "2026-06-27T00:00:00.000Z",
    source: "laptop",
    rawPath,
    status: "raw",
  };

  const { base, copied } = await pushSessionToApp(session, { path: app });

  assert.deepEqual(copied, ["raw"]);
  assert.ok(!existsSync(path.join(base, "cleaned", "s2.md")));
  const idx = JSON.parse(readFileSync(path.join(base, "sessions", "s2.json"), "utf8"));
  assert.equal(idx.cleanedPath, undefined); // omitted when absent
});
