import * as readline from "node:readline/promises";
import { resolveAutoCleanMode } from "../cleanMode.js";
import { hasAnthropicAuth, runClean } from "../cleanSession.js";
import { config } from "../config.js";
import { renderMarkdown } from "../markdown.js";
import { SessionRecorder } from "../session.js";
import { LaptopMicSource } from "../sources/LaptopMicSource.js";
import { readRawBody } from "../store.js";
import type { VoiceLogSession } from "../types.js";
import { optValue } from "./util.js";

/**
 * Record from the laptop mic until Enter/Ctrl-C. Writes raw/<id>.md and the
 * session index; live transcript prints to the terminal. On finish, unless
 * disabled, runs the LLM cleaning pass and prints the edited markdown.
 *
 *   voicelogger record [--project <id>] [--no-clean | --clean [auto|prompt|off]]
 */
export async function recordCommand(args: string[]): Promise<void> {
  const projectId = optValue(args, "--project", "-p");

  const source = new LaptopMicSource();
  const recorder = new SessionRecorder(source, {
    projectId,
    onSegment: (seg) => process.stdout.write(`  ▸ ${seg.text}\n`),
  });

  await recorder.start();

  console.log(`● recording — session ${recorder.session.id}`);
  console.log(`  raw:    ${recorder.session.rawPath}`);
  console.log(`  model:  ${config.modelPath}`);
  console.log(`  device: avfoundation ${config.micDevice}`);
  console.log(projectId ? `  project: ${projectId}` : "  project: (unlinked)");
  console.log("\nSpeak now. Press Enter (or Ctrl-C) to stop.\n");

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
    console.log("\n⚠ ANTHROPIC_API_KEY not set — skipping cleanup.");
    console.log(`  Set it, then run: voicelogger clean ${session.id}`);
    return;
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

/** Yes/no prompt defaulting to yes; non-interactive stdin proceeds with the default. */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
