import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { VoiceSource } from "./sources/VoiceSource.js";
import { transcribePcm } from "./transcriber.js";
import type { TranscriptSegment, VoiceLogSession } from "./types.js";
import { EnergyVad } from "./vad.js";

export interface SessionOptions {
  projectId?: string;
  /** Called as each transcribed segment is appended (for live display). */
  onSegment?: (seg: TranscriptSegment) => void;
}

/**
 * Orchestrates one recording session:
 *   VoiceSource → EnergyVad → whisper-cli → raw/<id>.md  (+ sessions/<id>.json index)
 *
 * Transcription runs on a sequential queue so segments are appended in order
 * even though whisper calls overlap with capture.
 */
export class SessionRecorder {
  readonly session: VoiceLogSession;
  private readonly source: VoiceSource;
  private readonly vad: EnergyVad;
  private readonly onSegment?: (seg: TranscriptSegment) => void;

  private segments: TranscriptSegment[] = [];
  private queue: Promise<void> = Promise.resolve();
  private segmentIndex = 0;
  private started = false;

  constructor(source: VoiceSource, opts: SessionOptions = {}) {
    this.source = source;
    this.onSegment = opts.onSegment;
    this.vad = new EnergyVad({ sampleRate: source.format.sampleRate });

    const id = SessionRecorder.makeId();
    this.session = {
      id,
      projectId: opts.projectId,
      startedAt: new Date().toISOString(),
      source: source.kind,
      rawPath: path.join(config.rawDir, `${id}.md`),
      status: "recording",
    };
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await mkdir(config.rawDir, { recursive: true });
    await mkdir(config.sessionsDir, { recursive: true });

    await writeFile(this.session.rawPath, this.rawHeader());
    await this.writeIndex();

    this.source.onFrame((pcm) => {
      const windows = this.vad.feed(pcm);
      for (const w of windows) this.enqueueWindow(w.pcm, w.startMs, w.endMs);
    });
    this.source.onError((err) => {
      // ffmpeg writes benign notices to stderr too; surface but don't crash.
      process.stderr.write(`[source] ${err.message}\n`);
    });

    await this.source.start();
  }

  async stop(): Promise<VoiceLogSession> {
    await this.source.stop();

    const tail = this.vad.flush();
    if (tail) this.enqueueWindow(tail.pcm, tail.startMs, tail.endMs);

    // Drain the transcription queue before finalizing.
    await this.queue;

    this.session.endedAt = new Date().toISOString();
    this.session.status = "raw";
    await this.writeIndex();
    return this.session;
  }

  private enqueueWindow(pcm: Buffer, startMs: number, endMs: number): void {
    this.queue = this.queue.then(async () => {
      let text = "";
      try {
        text = await transcribePcm(pcm);
      } catch (err) {
        process.stderr.write(`[transcribe] ${(err as Error).message}\n`);
        return;
      }
      if (!text) return;

      const seg: TranscriptSegment = {
        index: this.segmentIndex++,
        startMs,
        endMs,
        text,
      };
      this.segments.push(seg);
      await appendFile(this.session.rawPath, `${text}\n\n`);
      this.onSegment?.(seg);
    });
  }

  private rawHeader(): string {
    const s = this.session;
    return [
      `# Voice log — ${s.id}`,
      "",
      `- started: ${s.startedAt}`,
      `- source: ${s.source}`,
      `- project: ${s.projectId ?? "(unlinked)"}`,
      "",
      "---",
      "",
      "",
    ].join("\n");
  }

  private async writeIndex(): Promise<void> {
    const indexPath = path.join(config.sessionsDir, `${this.session.id}.json`);
    await writeFile(indexPath, JSON.stringify(this.session, null, 2) + "\n");
  }

  private static makeId(): string {
    // e.g. 2026-06-24T16-30-05 — filesystem-safe, sortable.
    return new Date().toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
  }
}
