import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "./config.js";
import { pcmToWav } from "./wav.js";

/**
 * Transcribe one PCM window with whisper.cpp (`whisper-cli`).
 *
 * The window is written to a temp WAV and passed to whisper-cli with timestamps
 * and banner output suppressed, so stdout is just the transcript text.
 */
export async function transcribePcm(pcm: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "voicelog-"));
  const wavPath = path.join(dir, "window.wav");
  await writeFile(wavPath, pcmToWav(pcm, config.format.sampleRate, 1, 16));
  try {
    return await runWhisper(wavPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runWhisper(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      config.modelPath,
      "-f",
      wavPath,
      "-l",
      "en",
      "-t",
      String(config.whisperThreads),
      "-nt", // no timestamps
      "-np", // no prints (system info / progress) — leaves only the transcript
    ];

    const proc = spawn(config.whisperBin, args);
    let out = "";
    let err = "";

    proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`whisper-cli exited ${code}: ${err.trim() || "(no stderr)"}`));
    });
  });
}
