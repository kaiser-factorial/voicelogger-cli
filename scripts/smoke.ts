/**
 * End-to-end smoke test (no mic): FileSource → VAD → whisper → raw/<id>.md.
 *
 *   npm run smoke -- /tmp/vl_test.wav
 *
 * Verifies the pipeline produces a non-empty transcript and a session index.
 * Uses a temp VOICELOG_DIR so it doesn't touch real logs.
 */
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const wav = process.argv[2] ?? "/tmp/vl_test.wav";

// Point the service at a throwaway data dir before importing config consumers.
process.env.VOICELOG_DIR = await mkdtemp(path.join(os.tmpdir(), "voicelog-smoke-"));

const { FileSource } = await import("../src/sources/FileSource.js");
const { SessionRecorder } = await import("../src/session.js");

const source = new FileSource(wav);
const recorder = new SessionRecorder(source, {
  onSegment: (s) => console.log(`  ▸ ${s.text}`),
});

const ended = new Promise<void>((resolve) => source.onEnd(resolve));

await recorder.start();
console.log(`session ${recorder.session.id} → ${recorder.session.rawPath}`);
await ended;
const session = await recorder.stop();

const raw = await readFile(session.rawPath, "utf8");
const body = raw.split("---\n")[1]?.trim() ?? "";
const indexRaw = await readFile(
  path.join(process.env.VOICELOG_DIR!, "sessions", `${session.id}.json`),
  "utf8",
);
const index = JSON.parse(indexRaw);

console.log("\n--- raw transcript body ---");
console.log(body || "(empty)");
console.log("\n--- index ---");
console.log(JSON.stringify(index, null, 2));

const ok = body.length > 0 && index.status === "raw" && !!index.endedAt;
console.log(`\n${ok ? "PASS" : "FAIL"}: transcript=${body.length}b status=${index.status}`);
process.exit(ok ? 0 : 1);
