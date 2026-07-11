import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { detectProject, loadLaunchCache, saveLaunchRecipe } from "../launch.js";
import type { LaunchRecipe } from "../launch.js";
import { resolveDevServer } from "../launchRun.js";
import { buildHandoffMessage } from "../launchError.js";
import { openUrl } from "../openUrl.js";
import { recordCommand } from "./record.js";
import { firstPositional, optValue } from "./util.js";

/**
 * `voicelogger test <path>` — detect the project at <path>, get its dev server (or an
 * already-built CLI binary) ready, open it in the browser if applicable, then hand off to
 * `record --test-log` in-process. See docs/TEST_LOG_PLAN.md Phase 1b for the full design.
 *
 *   voicelogger test <path> [--prod [<link>]] [--redetect] [record --test-log flags...]
 *
 * Any flag `record` understands (--project, --user, --title, --scope, --feature, --app,
 * --clean/--no-clean) is simply forwarded — `record`'s own arg parsing only looks for the
 * flag names it knows, so passing through `--prod`/`--redetect`/the path positional alongside
 * them is harmless.
 */
export async function testCommand(args: string[]): Promise<void> {
  const targetPath = firstPositional(args);
  if (!targetPath) {
    console.error("usage: voicelogger test <path> [--prod [<link>]] [--redetect] [record flags...]");
    process.exit(1);
  }
  const absPath = path.resolve(targetPath);
  if (!existsSync(absPath)) {
    console.error(`✗ no such path: ${absPath}`);
    process.exit(1);
  }

  const cache = await loadLaunchCache();
  let recipe: LaunchRecipe | undefined = cache[absPath];

  if (args.includes("--prod")) {
    await runProd(absPath, recipe, args);
    return recordCommand(["--test-log", ...args]);
  }

  const redetect = args.includes("--redetect");
  let nodeCandidates: string[] | undefined;
  if (!recipe || redetect) {
    const detected = await detectProject(absPath);
    recipe = detected.recipe;
    nodeCandidates = detected.nodeCandidates;
    // "node" isn't fully resolved by detection alone (still needs the candidate trial below) —
    // persist it once resolveDevServer knows the winning command instead of persisting twice.
    if (recipe.kind !== "node") await saveLaunchRecipe(absPath, recipe);
  }

  if (recipe.kind === "unknown") {
    console.error(
      `✗ couldn't detect a project type at ${absPath} (looked for tauri.conf.json, go.mod, and ` +
        `package.json dev/serve/start scripts). Use --prod <link> to point at an already-running ` +
        `deployment instead.`,
    );
    process.exit(1);
  }

  if (recipe.kind === "go-cli") {
    await runGoCli(absPath, recipe);
    return recordCommand(["--test-log", ...args]);
  }

  // tauri | node
  console.log(`▶ ${recipe.kind}: checking for a running dev server…`);
  const result = await resolveDevServer(recipe, { nodeCandidates, forceRedetect: redetect });

  if (result.status === "failed") {
    const message = await buildHandoffMessage(result.failure);
    console.error(`\n✗ dev server didn't come up\n\n${message}`);
    process.exit(1);
  }

  await saveLaunchRecipe(absPath, { ...recipe, dev: result.recipe });

  if (result.status === "running-no-url") {
    console.log(
      "  server is running but no URL was detected in its output — open it manually.\n" +
        "  (starting the test-log recording anyway)",
    );
  } else {
    console.log(result.reused ? `  already running → ${result.url}` : `  ready → ${result.url}`);
    openUrl(result.url);
  }

  return recordCommand(["--test-log", ...args]);
}

/** `--prod [<link>]`: store a link directly on first use; bare `--prod` reuses the cached one. */
async function runProd(
  absPath: string,
  recipe: LaunchRecipe | undefined,
  args: string[],
): Promise<void> {
  const link = optValue(args, "--prod");
  if (link) {
    recipe = { ...(recipe ?? { kind: "unknown" }), prod: { url: link, setAt: new Date().toISOString() } };
    await saveLaunchRecipe(absPath, recipe);
  } else if (!recipe?.prod) {
    console.error("✗ no cached --prod link for this path yet — pass one: --prod <link>");
    process.exit(1);
  }
  console.log(`▶ opening ${recipe!.prod!.url}`);
  openUrl(recipe!.prod!.url);
}

/** Go projects don't fit the "dev server on a URL" model (locked heuristic, see launch.ts) —
 *  just make sure a binary exists, building it if not, and let the user invoke it manually. */
async function runGoCli(absPath: string, recipe: LaunchRecipe): Promise<void> {
  const bin = recipe.cliBin!;
  console.log(`▶ go-cli: ${bin}`);
  if (existsSync(bin)) {
    console.log("  binary already built — invoke it manually while narrating.");
    return;
  }
  console.log("  binary not found — building (go build ./...)…");
  const build = await runGoBuild(absPath);
  if (!build.ok) {
    const message = await buildHandoffMessage({
      cmd: "go build ./...",
      cwd: absPath,
      exitCode: build.exitCode,
      timedOut: false,
      output: build.output,
    });
    console.error(`\n✗ build failed\n\n${message}`);
    process.exit(1);
  }
  console.log(`  built. Invoke ${bin} manually while narrating.`);
}

function runGoBuild(cwd: string): Promise<{ ok: boolean; exitCode: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("go", ["build", "./..."], { cwd, shell: true });
    let output = "";
    child.stdout?.on("data", (b: Buffer) => (output += b.toString()));
    child.stderr?.on("data", (b: Buffer) => (output += b.toString()));
    child.on("error", (err) => resolve({ ok: false, exitCode: null, output: output + `\n${err.message}` }));
    child.on("close", (code) => resolve({ ok: code === 0, exitCode: code, output }));
  });
}
