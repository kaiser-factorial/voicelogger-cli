import { config } from "../config.js";
import { LaptopMicSource } from "../sources/LaptopMicSource.js";
import { SessionRecorder } from "../session.js";
import { optValue } from "./util.js";

/**
 * Record from the laptop mic until Enter/Ctrl-C. Writes raw/<id>.md and the
 * session index; live transcript prints to the terminal.
 *
 *   voicelog record [--project <id>]
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
    const session = await recorder.stop();
    console.log("\n✓ done");
    console.log(`  raw:   ${session.rawPath}`);
    console.log(`  index: ${config.sessionsDir}/${session.id}.json`);
    console.log(`\nNext: voicelog clean ${session.id}`);
    process.exit(0);
  };

  process.stdin.resume();
  process.stdin.once("data", finish);
  process.on("SIGINT", finish);
}
