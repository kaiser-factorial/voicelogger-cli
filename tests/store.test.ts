import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// store.ts reads paths from config.ts, which resolves VOICELOG_DIR at import time.
// Point it at a throwaway dir BEFORE importing the module under test. node's test
// runner executes each test file in its own process, so this env write is isolated.
const dir = mkdtempSync(path.join(os.tmpdir(), "vl-store-"));
process.env.VOICELOG_DIR = dir;
const sessionsDir = path.join(dir, "sessions");
mkdirSync(sessionsDir, { recursive: true });

function writeSess(s: Record<string, unknown>): void {
  writeFileSync(path.join(sessionsDir, `${s.id}.json`), JSON.stringify(s));
}

writeSess({ id: "2026-01-01T00-00-00Z", startedAt: "2026-01-01T00:00:00Z", source: "laptop", rawPath: "x", status: "raw" });
writeSess({ id: "2026-02-02T00-00-00Z", startedAt: "2026-02-02T00:00:00Z", source: "laptop", rawPath: "x", status: "raw" });
writeSess({ id: "2026-02-15T00-00-00Z", startedAt: "2026-02-15T00:00:00Z", source: "laptop", rawPath: "x", status: "raw" });
// Noise the loader must ignore:
writeFileSync(path.join(sessionsDir, "broken.json"), "{ not valid json");
writeFileSync(path.join(sessionsDir, "notes.txt"), "not a session");

const { listSessions, resolveSession, readRawBody, writeSession } = await import("../src/store.js");

test("listSessions returns valid sessions newest-first, skipping junk", async () => {
  const sessions = await listSessions();
  assert.deepEqual(
    sessions.map((s) => s.id),
    ["2026-02-15T00-00-00Z", "2026-02-02T00-00-00Z", "2026-01-01T00-00-00Z"],
  );
});

test("resolveSession handles latest / exact / unique-prefix / ambiguous / missing", async () => {
  assert.equal((await resolveSession("latest"))?.id, "2026-02-15T00-00-00Z");
  assert.equal((await resolveSession("2026-01-01T00-00-00Z"))?.id, "2026-01-01T00-00-00Z");
  assert.equal((await resolveSession("2026-01"))?.id, "2026-01-01T00-00-00Z"); // unique prefix
  assert.equal(await resolveSession("2026-02"), null); // ambiguous → null
  assert.equal(await resolveSession("nope"), null); // no match → null
});

test("readRawBody strips the metadata header above the --- divider", async () => {
  const rawPath = path.join(dir, "raw-sample.md");
  const body = "first utterance\n\nsecond utterance";
  writeFileSync(
    rawPath,
    ["# Voice log — id", "", "- started: now", "", "---", "", "", body, ""].join("\n"),
  );
  const out = await readRawBody({
    id: "id",
    startedAt: "now",
    source: "laptop",
    rawPath,
    status: "raw",
  });
  assert.equal(out, body);
});

test("readRawBody returns the whole trimmed file when there is no divider", async () => {
  const rawPath = path.join(dir, "headerless.md");
  writeFileSync(rawPath, "  just a body, no header  \n");
  const out = await readRawBody({
    id: "h",
    startedAt: "now",
    source: "laptop",
    rawPath,
    status: "raw",
  });
  assert.equal(out, "just a body, no header");
});

test("listSessions parses a legacy session file that predates testLog/speaker/scope/featureNote", async () => {
  // Regression for docs/TEST_LOG_PLAN.md Phase 1a-ii: adding optional fields to
  // VoiceLogSession/TranscriptSegment must not break list/show/clean on old
  // sessions/*.json files that were written before those fields existed.
  writeSess({
    id: "2025-legacy-00-00-00Z",
    startedAt: "2025-12-31T00:00:00Z",
    source: "laptop",
    rawPath: "x",
    status: "cleaned",
    summary: "a plain voice log from before test-log mode existed",
  });
  const session = await resolveSession("2025-legacy-00-00-00Z");
  assert.ok(session);
  assert.equal(session?.testLog, undefined);
  assert.equal(session?.speaker, undefined);
  assert.equal(session?.scope, undefined);
  assert.equal(session?.featureNote, undefined);
});

test("writeSession round-trips a session into the index", async () => {
  await writeSession({
    id: "2026-03-03T00-00-00Z",
    startedAt: "2026-03-03T00:00:00Z",
    source: "laptop",
    rawPath: "x",
    status: "raw",
  });
  const ids = (await listSessions()).map((s) => s.id);
  assert.ok(ids.includes("2026-03-03T00-00-00Z"));
  assert.equal(ids[0], "2026-03-03T00-00-00Z"); // newest → first
});
