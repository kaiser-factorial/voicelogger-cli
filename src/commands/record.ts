import { getApp } from "../apps.js";
import { notifyAppBin, pushSessionToApp } from "../appPush.js";
import { resolveAutoCleanMode } from "../cleanMode.js";
import { hasAnthropicAuth, runClean } from "../cleanSession.js";
import { config } from "../config.js";
import { exitLabel, ledgerListProjects, ledgerNote } from "../ledger.js";
import { renderMarkdown } from "../markdown.js";
import { micLabel } from "../platform.js";
import { confirm, promptProject } from "../prompt.js";
import { SessionRecorder } from "../session.js";
import { setupApiKey } from "../setupKey.js";
import { LaptopMicSource } from "../sources/LaptopMicSource.js";
import { readRawBody, writeSession } from "../store.js";
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
  console.log(`▶ starting — session ${recorder.session.id}`);
  console.log(`  raw:     ${recorder.session.rawPath}`);
  console.log(`  mic:     ${micLabel(process.platform, config.micFormat, config.micDevice)}`);
  console.log(`  project: ${projectId ?? "(unlinked)"}`);

  console.log("\n□  wait — mic initializing…");
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
      await maybePromptProject(session);
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

/**
 * After cleaning, if the session isn't linked to a project yet and ledger is
 * connected, show a numbered list of active projects and let the user pick one
 * (or press Enter to leave it unlinked). Saves the projectId and drops a ledger note.
 */
async function maybePromptProject(session: VoiceLogSession): Promise<void> {
  if (session.projectId) return;          // already set via --project
  if (!config.ledgerEnabled) return;      // no tracker connected
  if (!process.stdin.isTTY) return;       // non-interactive

  const projects = await ledgerListProjects();
  if (!projects.length) return;

  const chosen = await promptProject(projects);
  if (!chosen) return;

  session.projectId = chosen;
  await writeSession(session);
  console.log(`✓ linked → ${chosen}`);

  const note = session.summary
    ? `voice log ${session.id}: ${session.summary}`
    : `voice log ${session.id}`;
  const res = await ledgerNote(chosen, note);
  if (res.ok) console.log(`✓ ledger note added to ${chosen}`);
  else console.warn(`! ledger note failed (${exitLabel(res.code)}): ${res.stderr.trim() || "check ledger-cli auth"}`);
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
    const notify = await notifyAppBin(session, app);
    if (!notify.skipped) {
      if (notify.ok) console.log(`  ✓ notified ${app.bin} (ledger note added)`);
      else console.warn(`  ! bin notification failed: ${notify.message} — push still succeeded`);
    }
  } catch (err) {
    console.warn(`\n⚠ push to '${appName}' failed: ${err instanceof Error ? err.message : err}`);
  }
}
