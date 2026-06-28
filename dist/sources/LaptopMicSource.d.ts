import type { AudioFormat } from "../types.js";
import type { VoiceSource } from "./VoiceSource.js";
/**
 * Captures the microphone via ffmpeg and emits 16 kHz mono signed-16-bit PCM
 * frames on stdout. The input format/device are platform-derived (avfoundation on
 * macOS, alsa on Linux, dshow on Windows) and overridable via MIC_FORMAT /
 * MIC_DEVICE — see src/platform.ts and docs/CROSS_PLATFORM.md. macOS is verified;
 * other platforms are experimental.
 *
 * This is the MVP VoiceSource. The WearabLLM variant will implement the same
 * interface by feeding PCM from the device instead of from ffmpeg.
 */
export declare class LaptopMicSource implements VoiceSource {
    readonly kind: "laptop";
    readonly format: AudioFormat;
    private proc?;
    private frameHandlers;
    private errorHandlers;
    private endHandlers;
    private stopping;
    onFrame(handler: (pcm: Buffer) => void): void;
    onError(handler: (err: Error) => void): void;
    onEnd(handler: () => void): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}
