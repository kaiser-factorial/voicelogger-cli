import type { AudioFormat, VoiceSourceKind } from "../types.js";
/**
 * The capture-source abstraction (the foresight in AGENT_AND_VOICELOG_PLAN.md).
 *
 * A VoiceSource yields a stream of raw PCM frames plus start/stop. Everything
 * downstream — VAD, transcription, storage, UI — is identical regardless of
 * which source produced the audio.
 *
 *   LaptopMicSource (MVP)     — ffmpeg → 16 kHz mono PCM from the system mic
 *   NetworkSource (later)     — device streams PCM to the same pipeline over WiFi
 *
 * Frames are little-endian signed 16-bit mono samples at `format.sampleRate`.
 */
export interface VoiceSource {
    readonly kind: VoiceSourceKind;
    readonly format: AudioFormat;
    start(): Promise<void>;
    stop(): Promise<void>;
    /** Raw PCM chunks as they arrive. Chunk boundaries are arbitrary. */
    onFrame(handler: (pcm: Buffer) => void): void;
    onError(handler: (err: Error) => void): void;
    /** Source closed (process exited / stream ended). */
    onEnd(handler: () => void): void;
}
