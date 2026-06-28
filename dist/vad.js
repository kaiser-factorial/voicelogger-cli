export class EnergyVad {
    sampleRate;
    frameBytes;
    frameMs;
    silenceMs;
    maxUtteranceMs;
    minUtteranceMs;
    energyThreshold;
    preRollMaxFrames;
    leftover = Buffer.alloc(0);
    utterance = [];
    /** Recent silent/quiet frames kept so a triggering utterance gets a leading-edge buffer. */
    preRollFrames = [];
    inSpeech = false;
    trailingSilenceMs = 0;
    utteranceMs = 0;
    /** Total audio time consumed so far, in ms. */
    streamMs = 0;
    utteranceStartMs = 0;
    constructor(opts) {
        this.sampleRate = opts.sampleRate;
        this.frameMs = opts.frameMs ?? 30;
        this.silenceMs = opts.silenceMs ?? 700;
        this.maxUtteranceMs = opts.maxUtteranceMs ?? 15000;
        this.minUtteranceMs = opts.minUtteranceMs ?? 350;
        this.energyThreshold = opts.energyThreshold ?? 0.012;
        this.preRollMaxFrames = Math.max(0, Math.ceil((opts.preRollMs ?? 300) / this.frameMs));
        // 16-bit mono → 2 bytes/sample.
        this.frameBytes = Math.floor((this.sampleRate * this.frameMs) / 1000) * 2;
        if (this.frameBytes < 2) {
            // A zero-length frame would make feed() loop forever (offset never advances).
            throw new RangeError(`EnergyVad: frame too small (sampleRate=${this.sampleRate}, frameMs=${this.frameMs}); need ≥ 1 sample per frame`);
        }
    }
    /** Push PCM; returns any windows completed by this chunk. */
    feed(chunk) {
        const windows = [];
        let buf = this.leftover.length ? Buffer.concat([this.leftover, chunk]) : chunk;
        let offset = 0;
        while (offset + this.frameBytes <= buf.length) {
            const frame = buf.subarray(offset, offset + this.frameBytes);
            offset += this.frameBytes;
            this.streamMs += this.frameMs;
            const speech = this.rms(frame) >= this.energyThreshold;
            if (speech) {
                if (!this.inSpeech) {
                    this.inSpeech = true;
                    // Include the pre-roll frames so the leading edge isn't truncated.
                    const preRollMs = this.preRollFrames.length * this.frameMs;
                    this.utteranceStartMs = this.streamMs - this.frameMs - preRollMs;
                    for (const pr of this.preRollFrames) {
                        this.utterance.push(pr);
                        this.utteranceMs += this.frameMs;
                    }
                    this.preRollFrames = [];
                }
                this.utterance.push(Buffer.from(frame));
                this.utteranceMs += this.frameMs;
                this.trailingSilenceMs = 0;
            }
            else if (this.inSpeech) {
                // Keep a little trailing silence so words aren't clipped.
                this.utterance.push(Buffer.from(frame));
                this.utteranceMs += this.frameMs;
                this.trailingSilenceMs += this.frameMs;
                if (this.trailingSilenceMs >= this.silenceMs) {
                    const w = this.closeUtterance();
                    if (w)
                        windows.push(w);
                }
            }
            else if (this.preRollMaxFrames > 0) {
                // Outside speech: keep the most recent N frames so the next utterance can use them.
                this.preRollFrames.push(Buffer.from(frame));
                if (this.preRollFrames.length > this.preRollMaxFrames)
                    this.preRollFrames.shift();
            }
            if (this.inSpeech && this.utteranceMs >= this.maxUtteranceMs) {
                const w = this.closeUtterance();
                if (w)
                    windows.push(w);
            }
        }
        this.leftover = buf.subarray(offset);
        return windows;
    }
    /** Emit any in-progress utterance (call on stop). */
    flush() {
        return this.closeUtterance();
    }
    closeUtterance() {
        const pcm = this.utterance.length ? Buffer.concat(this.utterance) : Buffer.alloc(0);
        const durationMs = this.utteranceMs;
        const startMs = this.utteranceStartMs;
        const endMs = this.streamMs;
        this.utterance = [];
        this.inSpeech = false;
        this.trailingSilenceMs = 0;
        this.utteranceMs = 0;
        if (pcm.length === 0 || durationMs < this.minUtteranceMs)
            return null;
        return { pcm, startMs, endMs };
    }
    rms(frame) {
        let sumSquares = 0;
        const samples = frame.length / 2;
        for (let i = 0; i < frame.length; i += 2) {
            const s = frame.readInt16LE(i) / 32768; // normalize to [-1,1]
            sumSquares += s * s;
        }
        return Math.sqrt(sumSquares / samples);
    }
}
//# sourceMappingURL=vad.js.map