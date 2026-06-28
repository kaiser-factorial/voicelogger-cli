import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../config.js";
/**
 * Download the default Whisper ggml model to the resolved model path
 * (see config.resolveModelPath — typically ~/.voicelogger/models/). This is the
 * installed-binary equivalent of the old `download-model` npm script, so a
 * global / npx install can fetch the model without the repo's scripts.
 *
 *   voicelogger download-model [--force]
 */
export async function downloadModelCommand(args) {
    const dest = config.modelPath;
    const force = args.includes("--force");
    if (!force) {
        const existing = await stat(dest).catch(() => null);
        if (existing?.isFile() && existing.size > 0) {
            console.log(`✓ model already present: ${dest} (${mb(existing.size)})`);
            console.log("  use --force to re-download.");
            return;
        }
    }
    await mkdir(path.dirname(dest), { recursive: true });
    console.log(`downloading model…`);
    console.log(`  from: ${config.modelUrl}`);
    console.log(`  to:   ${dest}\n`);
    const res = await fetch(config.modelUrl);
    if (!res.ok || !res.body) {
        throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`);
    }
    const total = Number(res.headers.get("content-length") ?? "0");
    let received = 0;
    const body = Readable.fromWeb(res.body);
    if (total > 0 && process.stderr.isTTY) {
        body.on("data", (chunk) => {
            received += chunk.length;
            const pct = ((received / total) * 100).toFixed(0);
            process.stderr.write(`\r  ${pct}%  ${mb(received)} / ${mb(total)}   `);
        });
    }
    await pipeline(body, createWriteStream(dest));
    if (total > 0 && process.stderr.isTTY)
        process.stderr.write("\n");
    const final = await stat(dest);
    console.log(`\n✓ model ready: ${dest} (${mb(final.size)})`);
}
function mb(bytes) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
//# sourceMappingURL=downloadModel.js.map