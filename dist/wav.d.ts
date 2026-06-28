/**
 * Wrap raw PCM in a minimal 44-byte WAV header so whisper-cli can read a window
 * as a self-contained file. Defaults match the capture format (16 kHz mono s16le).
 */
export declare function pcmToWav(pcm: Buffer, sampleRate?: number, channels?: number, bitDepth?: number): Buffer;
/** Milliseconds of audio represented by a raw PCM buffer. */
export declare function pcmDurationMs(byteLength: number, sampleRate?: number, channels?: number, bitDepth?: number): number;
