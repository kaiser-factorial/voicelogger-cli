import { spawn } from "node:child_process";
import { config } from "../config.js";
/**
 * Captures the microphone via ffmpeg and emits 16 kHz mono signed-16-bit PCM
 * frames on stdout. The input format/device are platform-derived (avfoundation on
 * macOS, alsa on Linux, dshow on Windows) and overridable via MIC_FORMAT /
 * MIC_DEVICE — see src/platform.ts and docs/CROSS_PLATFORM.md. macOS is verified;
 * other platforms are experimental.
 *
 * This is the MVP VoiceSource. A network variant could implement the same
 * interface by feeding PCM from a remote device instead of from ffmpeg.
 */
export class LaptopMicSource {
    kind = "laptop";
    format = {
        sampleRate: config.format.sampleRate,
        channels: 1,
        bitDepth: 16,
    };
    proc;
    frameHandlers = [];
    errorHandlers = [];
    endHandlers = [];
    stopping = false;
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
        const args = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            config.micFormat,
            "-i",
            config.micDevice,
            "-ac",
            String(this.format.channels),
            "-ar",
            String(this.format.sampleRate),
            "-f",
            "s16le", // raw PCM
            "-",
        ];
        const proc = spawn(config.ffmpegBin, args);
        this.proc = proc;
        proc.stdout.on("data", (chunk) => {
            for (const h of this.frameHandlers)
                h(chunk);
        });
        proc.stderr.on("data", (d) => {
            const msg = d.toString().trim();
            if (msg)
                for (const h of this.errorHandlers)
                    h(new Error(msg));
        });
        proc.on("error", (err) => {
            for (const h of this.errorHandlers)
                h(err);
        });
        proc.on("close", () => {
            for (const h of this.endHandlers)
                h();
        });
        // Don't resolve until ffmpeg is actually producing audio. avfoundation startup
        // is hundreds of ms — without this wait, "Speak now" prints before the mic is
        // capturing and the first word gets eaten.
        await new Promise((resolve, reject) => {
            const onData = () => {
                proc.removeListener("exit", onExit);
                resolve();
            };
            const onExit = (code) => {
                proc.stdout.removeListener("data", onData);
                reject(new Error(`ffmpeg exited with code ${code} before producing audio`));
            };
            proc.stdout.once("data", onData);
            proc.once("exit", onExit);
        });
    }
    async stop() {
        const proc = this.proc;
        if (!proc || this.stopping)
            return;
        this.stopping = true;
        // Already exited (e.g. ffmpeg crashed) — nothing to wait for.
        if (proc.exitCode !== null || proc.signalCode !== null)
            return;
        // SIGINT lets ffmpeg flush its remaining PCM to stdout (delivered to onFrame
        // before 'close'); resolve only once it has fully closed so no frames are lost.
        await new Promise((resolve) => {
            proc.once("close", () => resolve());
            proc.kill("SIGINT");
        });
    }
}
//# sourceMappingURL=LaptopMicSource.js.map