import { readFile } from "node:fs/promises";
import { config } from "../config.js";
/**
 * A deterministic, mic-free VoiceSource for testing: reads a 16 kHz mono s16le
 * WAV file and emits its PCM payload in chunks, then ends. Lets the whole
 * pipeline be exercised without microphone permission or live speech.
 *
 * Expects audio already in the capture format. Convert with:
 *   ffmpeg -i in.aiff -ac 1 -ar 16000 -f wav out.wav
 */
export class FileSource {
    filePath;
    chunkBytes;
    kind = "laptop"; // a recorded laptop capture
    format = {
        sampleRate: config.format.sampleRate,
        channels: 1,
        bitDepth: 16,
    };
    frameHandlers = [];
    errorHandlers = [];
    endHandlers = [];
    stopped = false;
    constructor(filePath, chunkBytes = 8192) {
        this.filePath = filePath;
        this.chunkBytes = chunkBytes;
    }
    onFrame(handler) {
        this.frameHandlers.push(handler);
    }
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    onEnd(handler) {
        this.endHandlers.push(handler);
    }
    async start() {
        let file;
        try {
            file = await readFile(this.filePath);
        }
        catch (err) {
            for (const h of this.errorHandlers)
                h(err);
            for (const h of this.endHandlers)
                h();
            return;
        }
        const pcm = stripWavHeader(file);
        // Emit asynchronously so onFrame handlers (registered before start
        // resolves) receive every chunk, mirroring the streaming sources.
        let offset = 0;
        const pump = () => {
            if (this.stopped)
                return;
            if (offset >= pcm.length) {
                for (const h of this.endHandlers)
                    h();
                return;
            }
            const end = Math.min(offset + this.chunkBytes, pcm.length);
            const chunk = pcm.subarray(offset, end);
            offset = end;
            for (const h of this.frameHandlers)
                h(chunk);
            setImmediate(pump);
        };
        setImmediate(pump);
    }
    async stop() {
        this.stopped = true;
    }
}
/** Strip a 44-byte canonical WAV header if present; else return as-is. */
function stripWavHeader(buf) {
    if (buf.length >= 44 && buf.toString("ascii", 0, 4) === "RIFF") {
        // Find the 'data' chunk rather than assuming a fixed offset.
        let i = 12;
        while (i + 8 <= buf.length) {
            const id = buf.toString("ascii", i, i + 4);
            const size = buf.readUInt32LE(i + 4);
            if (id === "data")
                return buf.subarray(i + 8, i + 8 + size);
            // RIFF chunks are word-aligned: an odd `size` is followed by a pad byte
            // that isn't counted in `size`. Skipping it would mis-read the next chunk.
            i += 8 + size + (size & 1);
        }
        return buf.subarray(44);
    }
    return buf;
}
//# sourceMappingURL=FileSource.js.map