import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDevServer } from "../src/launchRun.js";
import type { LaunchRecipe } from "../src/launch.js";

/**
 * A synthetic Node fixture with fake npm scripts (plain `node -e ...`, no real npm needed —
 * `npm run <script>` still works since these are read straight from package.json).
 *
 * Fixture "servers" self-exit after a few seconds (`setTimeout`, not `setInterval` forever) —
 * resolveDevServer spawns these detached by design (so a real dev server survives the
 * recording process's Ctrl-C, per the Phase 1b teardown decision), which means nothing in
 * this test file can reach in and kill them afterward. Self-terminating keeps `npm test` from
 * leaving real orphan node processes behind on every run.
 */
function nodeFixture(scripts: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vl-launchrun-"));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts }));
  return dir;
}

const recipeFor = (cwd: string): LaunchRecipe => ({
  kind: "node",
  dev: { cmd: "", cwd, detectedAt: new Date(0).toISOString() },
});

test("resolveDevServer: skips a dud script (exits fast, no URL) and picks the next candidate", async () => {
  const cwd = nodeFixture({
    dev: "node -e \"process.exit(0)\"",
    serve: "node -e \"console.log('ready at http://127.0.0.1:18881'); setTimeout(()=>process.exit(0),4000)\"",
  });
  const result = await resolveDevServer(recipeFor(cwd), { nodeCandidates: ["dev", "serve", "start"] });
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.url, "http://127.0.0.1:18881");
    assert.equal(result.recipe.cmd, "npm run serve");
    assert.equal(result.reused, false);
  }
});

test("resolveDevServer: every candidate a dud -> failed, reports the last one tried", async () => {
  const cwd = nodeFixture({
    dev: "node -e \"process.exit(1)\"",
  });
  const result = await resolveDevServer(recipeFor(cwd), { nodeCandidates: ["dev"] });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.cmd, "npm run dev");
    assert.equal(result.failure.exitCode, 1);
  }
});

test("resolveDevServer: reuses an already-running server instead of spawning a new one", async () => {
  // A tiny real HTTP server standing in for "already running from a previous session."
  const { createServer } = await import("node:http");
  const server = createServer((_req, res) => res.end("ok"));
  await new Promise<void>((resolve) => server.listen(18882, "127.0.0.1", () => resolve()));
  try {
    const cwd = nodeFixture({ dev: "node -e \"process.exit(1)\"" }); // would fail if actually spawned
    const recipe: LaunchRecipe = {
      kind: "node",
      dev: { cmd: "", cwd, detectedAt: new Date(0).toISOString(), lastUrl: "http://127.0.0.1:18882" },
    };
    const result = await resolveDevServer(recipe, { nodeCandidates: ["dev"] });
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.reused, true);
      assert.equal(result.url, "http://127.0.0.1:18882");
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("resolveDevServer: a cached winning command is tried directly, skipping the candidate trial", async () => {
  const cwd = nodeFixture({
    dev: "node -e \"process.exit(1)\"", // would be picked wrong if the trial ran again
    serve: "node -e \"console.log('http://127.0.0.1:18883'); setTimeout(()=>process.exit(0),4000)\"",
  });
  const recipe: LaunchRecipe = {
    kind: "node",
    dev: { cmd: "npm run serve", cwd, detectedAt: new Date(0).toISOString() },
  };
  const result = await resolveDevServer(recipe);
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.equal(result.url, "http://127.0.0.1:18883");
});

test("resolveDevServer: --redetect re-trials instead of trusting the cache", async () => {
  const cwd = nodeFixture({
    dev: "node -e \"console.log('http://127.0.0.1:18884'); setTimeout(()=>process.exit(0),4000)\"",
  });
  const recipe: LaunchRecipe = {
    kind: "node",
    // Cached cmd points at a script that no longer exists in this fixture's package.json.
    dev: { cmd: "npm run nonexistent", cwd, detectedAt: new Date(0).toISOString() },
  };
  const result = await resolveDevServer(recipe, { nodeCandidates: ["dev"], forceRedetect: true });
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.equal(result.url, "http://127.0.0.1:18884");
});
