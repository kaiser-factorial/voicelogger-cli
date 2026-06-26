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
}

export interface VadWindow {
  pcm: Buffer;
  /** ms of audio seen (across the whole stream) when this window started. */
  startMs: number;
  /** ms of audio seen when this window ended. */
  endMs: number;
}

export class EnergyVad {
  private readonly sampleRate: number;
  private readonly frameBytes: number;
  private readonly frameMs: number;
  private readonly silenceMs: number;
  private readonly maxUtteranceMs: number;
  private readonly minUtteranceMs: number;
  private readonly energyThreshold: number;

  private leftover: Buffer = Buffer.alloc(0);
  private utterance: Buffer[] = [];
  private inSpeech = false;
  private trailingSilenceMs = 0;
  private utteranceMs = 0;
  /** Total audio time consumed so far, in ms. */
  private streamMs = 0;
  private utteranceStartMs = 0;

  constructor(opts: VadOptions) {
    this.sampleRate = opts.sampleRate;
    this.frameMs = opts.frameMs ?? 30;
    this.silenceMs = opts.silenceMs ?? 700;
    this.maxUtteranceMs = opts.maxUtteranceMs ?? 15000;
    this.minUtteranceMs = opts.minUtteranceMs ?? 350;
    this.energyThreshold = opts.energyThreshold ?? 0.012;
    // 16-bit mono → 2 bytes/sample.
    this.frameBytes = Math.floor((this.sampleRate * this.frameMs) / 1000) * 2;
    if (this.frameBytes < 2) {
      // A zero-length frame would make feed() loop forever (offset never advances).
      throw new RangeError(
        `EnergyVad: frame too small (sampleRate=${this.sampleRate}, frameMs=${this.frameMs}); need ≥ 1 sample per frame`,
      );
    }
  }

  /** Push PCM; returns any windows completed by this chunk. */
  feed(chunk: Buffer): VadWindow[] {
    const windows: VadWindow[] = [];
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
          this.utteranceStartMs = this.streamMs - this.frameMs;
        }
        this.utterance.push(Buffer.from(frame));
        this.utteranceMs += this.frameMs;
        this.trailingSilenceMs = 0;
      } else if (this.inSpeech) {
        // Keep a little trailing silence so words aren't clipped.
        this.utterance.push(Buffer.from(frame));
        this.utteranceMs += this.frameMs;
        this.trailingSilenceMs += this.frameMs;
        if (this.trailingSilenceMs >= this.silenceMs) {
          const w = this.closeUtterance();
          if (w) windows.push(w);
        }
      }

      if (this.inSpeech && this.utteranceMs >= this.maxUtteranceMs) {
        const w = this.closeUtterance();
        if (w) windows.push(w);
      }
    }

    this.leftover = buf.subarray(offset);
    return windows;
  }

  /** Emit any in-progress utterance (call on stop). */
  flush(): VadWindow | null {
    return this.closeUtterance();
  }

  private closeUtterance(): VadWindow | null {
    const pcm = this.utterance.length ? Buffer.concat(this.utterance) : Buffer.alloc(0);
    const durationMs = this.utteranceMs;
    const startMs = this.utteranceStartMs;
    const endMs = this.streamMs;

    this.utterance = [];
    this.inSpeech = false;
    this.trailingSilenceMs = 0;
    this.utteranceMs = 0;

    if (pcm.length === 0 || durationMs < this.minUtteranceMs) return null;
    return { pcm, startMs, endMs };
  }

  private rms(frame: Buffer): number {
    let sumSquares = 0;
    const samples = frame.length / 2;
    for (let i = 0; i < frame.length; i += 2) {
      const s = frame.readInt16LE(i) / 32768; // normalize to [-1,1]
      sumSquares += s * s;
    }
    return Math.sqrt(sumSquares / samples);
  }
}
