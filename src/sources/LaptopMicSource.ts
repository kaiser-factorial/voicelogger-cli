import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { config } from "../config.js";
import type { AudioFormat } from "../types.js";
import type { VoiceSource } from "./VoiceSource.js";

/**
 * Captures the laptop microphone via ffmpeg's avfoundation input and emits
 * 16 kHz mono signed-16-bit PCM frames on stdout.
 *
 * This is the MVP VoiceSource. The WearabLLM variant will implement the same
 * interface by feeding PCM from the device instead of from ffmpeg.
 */
export class LaptopMicSource implements VoiceSource {
  readonly kind = "laptop" as const;
  readonly format: AudioFormat = {
    sampleRate: config.format.sampleRate,
    channels: 1,
    bitDepth: 16,
  };

  private proc?: ChildProcessWithoutNullStreams;
  private frameHandlers: Array<(pcm: Buffer) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];
  private endHandlers: Array<() => void> = [];
  private stopping = false;

  onFrame(handler: (pcm: Buffer) => void): void {
    this.frameHandlers.push(handler);
  }
  onError(handler: (err: Error) => void): void {
    this.errorHandlers.push(handler);
  }
  onEnd(handler: () => void): void {
    this.endHandlers.push(handler);
  }

  async start(): Promise<void> {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "avfoundation",
      "-i",
      config.micDevice,
      "-ac",
      String(this.format.channels),
      "-ar",
      String(this.format.sampleRate),
      "-f",
      "s16le", // raw PCM
      "-",
    ];

    const proc = spawn(config.ffmpegBin, args);
    this.proc = proc;

    proc.stdout.on("data", (chunk: Buffer) => {
      for (const h of this.frameHandlers) h(chunk);
    });

    proc.stderr.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) for (const h of this.errorHandlers) h(new Error(msg));
    });

    proc.on("error", (err) => {
      for (const h of this.errorHandlers) h(err);
    });

    proc.on("close", () => {
      for (const h of this.endHandlers) h();
    });
  }

  async stop(): Promise<void> {
    const proc = this.proc;
    if (!proc || this.stopping) return;
    this.stopping = true;
    // Already exited (e.g. ffmpeg crashed) — nothing to wait for.
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    // SIGINT lets ffmpeg flush its remaining PCM to stdout (delivered to onFrame
    // before 'close'); resolve only once it has fully closed so no frames are lost.
    await new Promise<void>((resolve) => {
      proc.once("close", () => resolve());
      proc.kill("SIGINT");
    });
  }
}
