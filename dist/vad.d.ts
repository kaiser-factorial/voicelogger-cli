/**
 * Energy-based voice activity detection / windowing.
 *
 * Feed it raw PCM (16-bit mono, little-endian) as it arrives. It buffers speech
 * and emits a complete utterance window when it sees either:
 *   - a sustained silence gap after speech (`silenceMs`), or
 *   - a window that has grown past `maxUtteranceMs` (force a cut).
 *
 * This is deliberately simple — a robust streaming VAD (Silero / webrtcvad) can
 * drop in behind the same `feed()`/`flush()` surface later. whisper.cpp also
 * ships `whisper-vad-speech-segments` if we want to offload this.
 */
export interface VadOptions {
    sampleRate: number;
    /** Analysis frame size in ms. */
    frameMs?: number;
    /** Trailing silence that closes an utterance. */
    silenceMs?: number;
    /** Hard cap on a single utterance before forcing a cut. */
    maxUtteranceMs?: number;
    /** Drop utterances shorter than this (clicks, blips). */
    minUtteranceMs?: number;
    /** RMS threshold in normalized [0,1] amplitude. */
    energyThreshold?: number;
    /**
     * Pre-roll: how much audio just *before* the energy threshold trips to include in the
     * utterance. Without this, the soft leading edge of a word (e.g. the "w" in "one")
     * drops below threshold and gets truncated. Default 300 ms. Set to 0 to disable.
     */
    preRollMs?: number;
}
export interface VadWindow {
    pcm: Buffer;
    /** ms of audio seen (across the whole stream) when this window started. */
    startMs: number;
    /** ms of audio seen when this window ended. */
    endMs: number;
}
export declare class EnergyVad {
    private readonly sampleRate;
    private readonly frameBytes;
    private readonly frameMs;
    private readonly silenceMs;
    private readonly maxUtteranceMs;
    private readonly minUtteranceMs;
    private readonly energyThreshold;
    private readonly preRollMaxFrames;
    private leftover;
    private utterance;
    /** Recent silent/quiet frames kept so a triggering utterance gets a leading-edge buffer. */
    private preRollFrames;
    private inSpeech;
    private trailingSilenceMs;
    private utteranceMs;
    /** Total audio time consumed so far, in ms. */
    private streamMs;
    private utteranceStartMs;
    constructor(opts: VadOptions);
    /** Push PCM; returns any windows completed by this chunk. */
    feed(chunk: Buffer): VadWindow[];
    /** Emit any in-progress utterance (call on stop). */
    flush(): VadWindow | null;
    private closeUtterance;
    private rms;
}
