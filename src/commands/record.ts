import { getApp } from "../apps.js";
import { pushSessionToApp } from "../appPush.js";
import { resolveAutoCleanMode } from "../cleanMode.js";
import { hasAnthropicAuth, runClean } from "../cleanSession.js";
import { config } from "../config.js";
import { renderMarkdown } from "../markdown.js";
import { confirm } from "../prompt.js";
import { SessionRecorder } from "../session.js";
import { setupApiKey } from "../setupKey.js";
import { LaptopMicSource } from "../sources/LaptopMicSource.js";
import { readRawBody } from "../store.js";
import type { VoiceLogSession } from "../types.js";
import { optValue } from "./util.js";

/**
 * Record from the laptop mic until Enter/Ctrl-C. Writes raw/<id>.md and the
 * session index; live transcript prints to the terminal. On finish, unless
 * disabled, runs the LLM cleaning pass and prints the edited markdown.
 *
 *   voicelogger record [--project <id>] [--no-clean | --clean [auto|prompt|off]] [--app <name>]
 */
export async function recordCommand(args: string[]): Promise<void> {
  const projectId = optValue(args, "--project", "-p");

  const source = new LaptopMicSource();
  const recorder = new SessionRecorder(source, {
    projectId,
    onSegment: (seg) => process.stdout.write(`  ▸ ${seg.text}\n`),
  });

  // Show session info immediately; "Speak now" prints only after the mic is live
  // (recorder.start() now waits for ffmpeg's first PCM chunk).
  console.log(`● starting — session ${recorder.session.id}`);
  console.log(`  raw:    ${recorder.session.rawPath}`);
  console.log(`  model:  ${config.modelPath}`);
  console.log(`  device: ${config.micFormat} ${config.micDevice}`);
  console.log(projectId ? `  project: ${projectId}` : "  project: (unlinked)");

  await recorder.start();

  console.log("\n● Speak now. Press Enter (or Ctrl-C) to stop.\n");

  let stopped = false;
  const finish = async () => {
    if (stopped) return;
    stopped = true;
    console.log("\n■ stopping — finishing transcription…");
    // finish() is a detached event listener, so its rejection can't be caught by
    // cli.ts — handle it here or it becomes a process-killing unhandled rejection.
    try {
      const session = await recorder.stop();
      console.log("\n✓ done");
      console.log(`  raw:   ${session.rawPath}`);
      console.log(`  index: ${config.sessionsDir}/${session.id}.json`);
      await maybeAutoClean(session, args);
      await maybePushToApp(session, args);
      process.exit(0);
    } catch (err) {
      console.error(
        `\n✗ failed to finalize recording: ${err instanceof Error ? err.message : err}`,
      );
      process.exit(1);
    }
  };

  process.stdin.resume();
  process.stdin.once("data", finish);
  process.on("SIGINT", finish);
}

/**
 * Auto-clean the finished recording per the resolved mode (raw is always kept).
 * Skips gracefully — never crashes the recording — if cleaning is off, there's
 * no speech, credentials are missing, the user declines, or the API call fails.
 */
async function maybeAutoClean(session: VoiceLogSession, args: string[]): Promise<void> {
  const mode = resolveAutoCleanMode(args, config.autoCleanMode);
  const nextHint = `\nNext: voicelogger clean ${session.id}`;

  if (mode === "off") {
    console.log(nextHint);
    return;
  }
  if (!(await readRawBody(session))) {
    console.log("\n(no speech transcribed — skipping cleanup)");
    return;
  }
  if (!hasAnthropicAuth()) {
    console.log("\n⚠ No Anthropic API key set — it's needed to clean the transcript.");
    if (await confirm("  Set one now? [Y/n] ")) {
      const file = await setupApiKey();
      if (file) console.log(`✓ key saved to ${file}`);
    }
    if (!hasAnthropicAuth()) {
      console.log(
        `\nKept the raw transcript. Add a key (voicelogger config), then: voicelogger clean ${session.id}`,
      );
      return;
    }
  }
  if (mode === "prompt" && !(await confirm("\nClean this recording now? [Y/n] "))) {
    console.log(nextHint);
    return;
  }

  console.log(`\ncleaning with ${config.anthropicModel}…`);
  try {
    const cleaned = await runClean(session);
    console.log(`\n✓ cleaned → ${cleaned.cleanedPath}\n`);
    console.log(renderMarkdown(cleaned.markdown));
  } catch (err) {
    console.warn(`\n⚠ cleanup failed: ${err instanceof Error ? err.message : err}`);
    console.warn(`  the raw transcript is safe — retry with: voicelogger clean ${session.id}`);
  }
}

/** If `--app <name>` was given, copy the finished session into that app's voicelogs/. */
async function maybePushToApp(session: VoiceLogSession, args: string[]): Promise<void> {
  const appName = optValue(args, "--app");
  if (!appName) return;
  const app = getApp(appName);
  if (!app) {
    console.warn(`\n⚠ unknown app '${appName}' — register it: voicelogger app add ${appName} <path>`);
    return;
  }
  try {
    const { base, copied } = await pushSessionToApp(session, app);
    console.log(`\n✓ pushed to ${appName} → ${base} (${copied.join(", ") || "index only"} + index)`);
  } catch (err) {
    console.warn(`\n⚠ push to '${appName}' failed: ${err instanceof Error ? err.message : err}`);
  }
}
