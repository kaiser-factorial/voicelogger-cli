import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { transcribePcm } from "./transcriber.js";
import { EnergyVad } from "./vad.js";
// Per-process counter folded into session ids to guarantee uniqueness even for
// multiple recorders constructed within the same millisecond.
let idSeq = 0;
/**
 * Orchestrates one recording session:
 *   VoiceSource → EnergyVad → whisper-cli → raw/<id>.md  (+ sessions/<id>.json index)
 *
 * Transcription runs on a sequential queue so segments are appended in order
 * even though whisper calls overlap with capture.
 */
export class SessionRecorder {
    session;
    source;
    vad;
    onSegment;
    segments = [];
    queue = Promise.resolve();
    segmentIndex = 0;
    started = false;
    constructor(source, opts = {}) {
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
    async start() {
        if (this.started)
            return;
        this.started = true;
        await mkdir(config.rawDir, { recursive: true });
        await mkdir(config.sessionsDir, { recursive: true });
        await writeFile(this.session.rawPath, this.rawHeader());
        await this.writeIndex();
        this.source.onFrame((pcm) => {
            const windows = this.vad.feed(pcm);
            for (const w of windows)
                this.enqueueWindow(w.pcm, w.startMs, w.endMs);
        });
        this.source.onError((err) => {
            // ffmpeg writes benign notices to stderr too; surface but don't crash.
            process.stderr.write(`[source] ${err.message}\n`);
        });
        await this.source.start();
    }
    async stop() {
        // source.stop() resolves once the source is fully closed (for the mic, after
        // ffmpeg flushes its remaining PCM), so every frame has already been enqueued.
        await this.source.stop();
        const tail = this.vad.flush();
        if (tail)
            this.enqueueWindow(tail.pcm, tail.startMs, tail.endMs);
        // Drain the transcription queue before finalizing. enqueueWindow reassigns
        // this.queue, so loop until it stops growing rather than awaiting a snapshot —
        // otherwise a late-arriving window could land after the index is written.
        let q;
        do {
            q = this.queue;
            await q;
        } while (q !== this.queue);
        this.session.endedAt = new Date().toISOString();
        this.session.status = "raw";
        await this.writeIndex();
        return this.session;
    }
    enqueueWindow(pcm, startMs, endMs) {
        this.queue = this.queue
            .then(async () => {
            const text = await transcribePcm(pcm);
            if (!text)
                return;
            const seg = {
                index: this.segmentIndex++,
                startMs,
                endMs,
                text,
            };
            this.segments.push(seg);
            await appendFile(this.session.rawPath, `${text}\n\n`);
            this.onSegment?.(seg);
        })
            // A failure in one window (transcription, the disk append, or the live
            // onSegment callback) must not crash recording or poison the queue for the
            // rest of the session — log it and keep the chain resolved.
            .catch((err) => {
            process.stderr.write(`[segment] ${err.message}\n`);
        });
    }
    rawHeader() {
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
    async writeIndex() {
        const indexPath = path.join(config.sessionsDir, `${this.session.id}.json`);
        await writeFile(indexPath, JSON.stringify(this.session, null, 2) + "\n");
    }
    static makeId() {
        // e.g. 2026-06-24T16-30-05-123Z-k3f9-0 — filesystem-safe and time-sortable.
        // Keep milliseconds, add a random suffix, and a per-process counter so two
        // sessions started in the same instant (e.g. a library caller batching files)
        // never collide and overwrite each other's raw/<id>.md and sessions/<id>.json.
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rand = Math.random().toString(36).slice(2, 6);
        return `${stamp}-${rand}-${(idSeq++).toString(36)}`;
    }
}
//# sourceMappingURL=session.js.map