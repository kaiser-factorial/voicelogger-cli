import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.VOICELOGGER_HOME = mkdtempSync(path.join(os.tmpdir(), "vl-launch-"));

const { detectProject, loadLaunchCache, saveLaunchRecipe, launchFilePath, NODE_DEV_CANDIDATES } =
  await import("../src/launch.js");

// Real sibling repos in this workspace — the plan doc explicitly calls for testing detection
// against them. Skip gracefully (not fail) when a sibling isn't present, e.g. a checkout that
// only has voicelogger-cli — see docs/TEST_LOG_PLAN.md Phase 1b.
const SIBLINGS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEDGER = path.join(SIBLINGS_ROOT, "ledger");
const LEDGER_CLI = path.join(SIBLINGS_ROOT, "ledger-cli");
const BULWORK = path.join(SIBLINGS_ROOT, "bulwork");

test("detectProject: ledger (Tauri) — devUrl/beforeDevCommand read exactly from tauri.conf.json", async (t) => {
  if (!existsSync(LEDGER)) return t.skip("sibling repo 'ledger' not present in this workspace");
  const { recipe } = await detectProject(LEDGER);
  assert.equal(recipe.kind, "tauri");
  assert.equal(recipe.dev?.url, "http://localhost:1420");
  assert.equal(recipe.dev?.cmd, "npm run dev");
  assert.equal(recipe.dev?.cwd, LEDGER);
});

test("detectProject: ledger-cli (Go) — go-cli kind, binary name from cmd/<name>/", async (t) => {
  if (!existsSync(LEDGER_CLI)) return t.skip("sibling repo 'ledger-cli' not present in this workspace");
  const { recipe } = await detectProject(LEDGER_CLI);
  assert.equal(recipe.kind, "go-cli");
  assert.equal(recipe.cliBin, path.join(LEDGER_CLI, "ledger"));
});

test("detectProject: bulwork (Node) — candidate list in priority order, includes 'serve'", async (t) => {
  if (!existsSync(BULWORK)) return t.skip("sibling repo 'bulwork' not present in this workspace");
  const { recipe, nodeCandidates } = await detectProject(BULWORK);
  assert.equal(recipe.kind, "node");
  assert.deepEqual(nodeCandidates, ["dev", "serve", "start"]);
});

test("detectProject: a directory with none of the markers is 'unknown'", async () => {
  const empty = mkdtempSync(path.join(os.tmpdir(), "vl-launch-empty-"));
  const { recipe } = await detectProject(empty);
  assert.equal(recipe.kind, "unknown");
});

test("NODE_DEV_CANDIDATES is dev/serve/start in priority order", () => {
  assert.deepEqual(NODE_DEV_CANDIDATES, ["dev", "serve", "start"]);
});

test("launch cache round-trips and is keyed by absolute path", async () => {
  await saveLaunchRecipe("/abs/project-a", { kind: "node", dev: { cmd: "npm run dev", cwd: "/abs/project-a", detectedAt: "x" } });
  await saveLaunchRecipe("/abs/project-b", { kind: "go-cli", cliBin: "/abs/project-b/project-b" });
  const cache = await loadLaunchCache();
  assert.deepEqual(Object.keys(cache).sort(), ["/abs/project-a", "/abs/project-b"]);
  assert.equal(cache["/abs/project-a"].dev?.cmd, "npm run dev");
  assert.equal(cache["/abs/project-b"].cliBin, "/abs/project-b/project-b");
});

test("saveLaunchRecipe updates an existing entry without disturbing others", async () => {
  await saveLaunchRecipe("/abs/project-a", { kind: "node", prod: { url: "https://a.example", setAt: "y" } });
  const cache = await loadLaunchCache();
  assert.equal(cache["/abs/project-a"].prod?.url, "https://a.example");
  assert.ok(cache["/abs/project-b"]); // untouched
});

test("launchFilePath lives under VOICELOGGER_HOME", () => {
  assert.equal(launchFilePath(), path.join(process.env.VOICELOGGER_HOME!, "launch.json"));
});
