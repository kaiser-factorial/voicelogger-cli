import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { NODE_DEV_CANDIDATES } from "./launch.js";
import type { DevRecipe, LaunchRecipe } from "./launch.js";

/**
 * Runtime process orchestration for `voicelogger test <path>` (Phase 1b) — trialing
 * candidate dev-server scripts, waiting for readiness, and reusing an already-running
 * server instead of spawning a duplicate. See docs/TEST_LOG_PLAN.md's Phase 1b
 * design-decisions block for the reasoning behind each choice below.
 */

const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?[^\s'"<>]*/;
/** A candidate that exits within this window without printing a URL is a dud (try the next one). */
const STARTUP_GRACE_MS = 3000;
/** Overall budget to wait for a URL once a candidate has survived the grace window. */
const READY_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 1500;
const OUTPUT_CAP = 20_000;

export interface LaunchFailure {
  cmd: string;
  cwd: string;
  exitCode?: number | null;
  timedOut: boolean;
  output: string;
}

export type DevServerResult =
  | { status: "ready"; url: string; recipe: DevRecipe; reused: boolean }
  // Node only: the process is alive and never exited, but nothing URL-shaped ever appeared in
  // its output — genuinely ambiguous (not a crash), so this degrades gracefully rather than
  // aborting: no browser tab to open, but recording still proceeds (see commands/test.ts).
  | { status: "running-no-url"; recipe: DevRecipe }
  | { status: "failed"; failure: LaunchFailure };

function cap(s: string): string {
  return s.length > OUTPUT_CAP ? s.slice(-OUTPUT_CAP) : s;
}

/** Any response (even a non-2xx one) means something is listening — that's all "reused" needs. */
async function probe(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnDetached(cmd: string, cwd: string): ChildProcess {
  // detached + unref: this process must survive the recording process's own Ctrl-C/exit —
  // see the Phase 1b teardown decision (never torn down by voicelogger, regardless of who
  // started it). stdio stays piped (not "ignore") so we can still capture output for the
  // readiness scrape / error report while the child is alive. Unref-ing the child handle
  // alone isn't enough — its stdio pipes are separate handles that keep our own event loop
  // (and node:test's process, in tests) alive too, so those need unref-ing as well.
  const child = spawn(cmd, { cwd, shell: true, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.unref();
  // child.stdout/stderr are typed as plain Readable, but for piped stdio they're actually
  // net.Socket-like handles that do support unref() at runtime — @types/node just doesn't
  // expose it on the narrower Readable type.
  unrefStream(child.stdout);
  unrefStream(child.stderr);
  return child;
}

function unrefStream(stream: NodeJS.ReadableStream | null | undefined): void {
  const maybeUnref = (stream as unknown as { unref?: () => void } | null)?.unref;
  if (typeof maybeUnref === "function") maybeUnref.call(stream);
}

interface TrialOutcome {
  ok: boolean;
  url?: string;
  exitCode?: number | null;
  /** True only if it exited within the grace window — signals "try the next candidate," not
   *  "report this as a failure." */
  dud?: boolean;
  output: string;
}

/** Spawn one candidate command and race: a URL appears in its output, it exits, or it just
 *  keeps running past the ready timeout with nothing printed (accepted as "probably fine"). */
function trialCandidate(cmd: string, cwd: string): Promise<TrialOutcome> {
  return new Promise((resolve) => {
    let pastGrace = false;
    let settled = false;
    let output = "";
    const child = spawnDetached(cmd, cwd);

    const finish = (outcome: TrialOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      clearTimeout(readyTimer);
      resolve(outcome);
    };

    const onData = (buf: Buffer) => {
      output = cap(output + buf.toString());
      const match = output.match(URL_RE);
      if (match) finish({ ok: true, url: match[0], output });
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => finish({ ok: false, exitCode: code, dud: !pastGrace, output }));
    child.on("error", (err) =>
      finish({ ok: false, exitCode: null, dud: !pastGrace, output: cap(output + `\n[spawn error] ${err.message}`) }),
    );

    const graceTimer = setTimeout(() => {
      pastGrace = true;
    }, STARTUP_GRACE_MS);
    const readyTimer = setTimeout(() => {
      finish({ ok: true, url: undefined, output }); // still alive, no URL seen — accept as-is
    }, READY_TIMEOUT_MS);
  });
}

/** Try each Node script candidate in priority order until one sticks (or none do). */
async function trialNodeCandidates(
  candidates: string[],
  cwd: string,
): Promise<{ cmd: string; outcome: TrialOutcome } | { failed: TrialOutcome; cmd: string }> {
  let last: { cmd: string; outcome: TrialOutcome } | undefined;
  for (const script of candidates) {
    const cmd = `npm run ${script}`;
    const outcome = await trialCandidate(cmd, cwd);
    last = { cmd, outcome };
    if (outcome.ok) return { cmd, outcome }; // success (with or without a scraped URL)
    if (!outcome.dud) return { failed: outcome, cmd }; // exited past grace, no URL — a real
    // failure, not "try the next script" territory — stop here rather than silently masking
    // it as the earlier {cmd, outcome} shape, which the caller would misread as a success.
  }
  // Every candidate was a dud (exited within its grace window) — report the last one tried.
  return { failed: last!.outcome, cmd: last!.cmd };
}

/** Spawn a command whose URL is already known (Tauri) and poll that URL until it answers. */
async function spawnAndPollKnownUrl(cmd: string, cwd: string, url: string): Promise<TrialOutcome> {
  let exitCode: number | null | undefined;
  let output = "";
  const child = spawnDetached(cmd, cwd);
  const onData = (buf: Buffer) => {
    output = cap(output + buf.toString());
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.on("exit", (code) => {
    exitCode = code;
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exitCode !== undefined) return { ok: false, exitCode, output };
    if (await probe(url)) return { ok: true, url, output };
    await sleep(500);
  }
  return { ok: false, output, exitCode: undefined };
}

/**
 * Resolve a live dev-server URL for a "tauri" or "node" recipe: reuse an already-running
 * server if one answers, else spawn and wait for readiness. `nodeCandidates` is the ordered
 * script-name list from `detectProject` — only consulted when there's no cached `dev.cmd` yet
 * (or `forceRedetect`), since a cached recipe already knows the winning command.
 */
export async function resolveDevServer(
  recipe: LaunchRecipe,
  opts: { nodeCandidates?: string[]; forceRedetect?: boolean } = {},
): Promise<DevServerResult> {
  const dev = recipe.dev;
  if (!dev) throw new Error(`resolveDevServer: recipe has no dev entry (kind=${recipe.kind})`);

  // Already running? Prefer the last-confirmed URL, then the known/cached one.
  const known = dev.lastUrl ?? dev.url;
  if (known && !opts.forceRedetect && (await probe(known))) {
    return { status: "ready", url: known, recipe: { ...dev, lastUrl: known }, reused: true };
  }

  if (recipe.kind === "tauri") {
    const outcome = await spawnAndPollKnownUrl(dev.cmd, dev.cwd, dev.url!);
    if (!outcome.ok) {
      return {
        status: "failed",
        failure: {
          cmd: dev.cmd,
          cwd: dev.cwd,
          exitCode: outcome.exitCode,
          timedOut: outcome.exitCode === undefined,
          output: outcome.output,
        },
      };
    }
    return { status: "ready", url: dev.url!, recipe: { ...dev, lastUrl: dev.url }, reused: false };
  }

  // "node": use the cached winning command if we have one and aren't forcing a fresh trial;
  // otherwise trial the candidate list.
  if (dev.cmd && !opts.forceRedetect) {
    const outcome = await trialCandidate(dev.cmd, dev.cwd);
    if (outcome.ok && outcome.url) {
      return { status: "ready", url: outcome.url, recipe: { ...dev, lastUrl: outcome.url }, reused: false };
    }
    if (outcome.ok) {
      // stayed alive past the timeout with no URL printed — ambiguous, not a crash.
      return { status: "running-no-url", recipe: { ...dev } };
    }
    // the previously-cached command failed this time — fall through to a fresh trial rather
    // than giving up, in case the project's scripts changed since it was cached.
  }

  const candidates = opts.nodeCandidates?.length ? opts.nodeCandidates : [...NODE_DEV_CANDIDATES];
  const trial = await trialNodeCandidates(candidates, dev.cwd);
  if ("failed" in trial) {
    return {
      status: "failed",
      failure: { cmd: trial.cmd, cwd: dev.cwd, exitCode: trial.failed.exitCode, timedOut: false, output: trial.failed.output },
    };
  }
  if (!trial.outcome.url) {
    return {
      status: "running-no-url",
      recipe: { cmd: trial.cmd, cwd: dev.cwd, detectedAt: new Date().toISOString() },
    };
  }
  return {
    status: "ready",
    url: trial.outcome.url,
    recipe: { cmd: trial.cmd, cwd: dev.cwd, lastUrl: trial.outcome.url, detectedAt: new Date().toISOString() },
    reused: false,
  };
}
