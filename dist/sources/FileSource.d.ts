import type { AudioFormat } from "../types.js";
import type { VoiceSource } from "./VoiceSource.js";
/**
 * A deterministic, mic-free VoiceSource for testing: reads a 16 kHz mono s16le
 * WAV file and emits its PCM payload in chunks, then ends. Lets the whole
 * pipeline be exercised without microphone permission or live speech.
 *
 * Expects audio already in the capture format. Convert with:
 *   ffmpeg -i in.aiff -ac 1 -ar 16000 -f wav out.wav
 */
export declare class FileSource implements VoiceSource {
    private readonly filePath;
    private readonly chunkBytes;
    readonly kind: "laptop";
    readonly format: AudioFormat;
    private frameHandlers;
    private errorHandlers;
    private endHandlers;
    private stopped;
    constructor(filePath: string, chunkBytes?: number);
    onFrame(handler: (pcm: Buffer) => void): void;
    onError(handler: (err: Error) => void): void;
    onEnd(handler: () => void): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}
