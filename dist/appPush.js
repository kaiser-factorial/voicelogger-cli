import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
/**
 * Copy a session's logs into an app's `voicelogs/` directory. Pushes the raw
 * transcript, the cleaned markdown (if present), and the session index — rewriting
 * the index's paths to the app-local copies so the app's voicelogs/ is
 * self-contained. Copies (not symlinks). Shared by `app push` and `record --app`.
 */
export async function pushSessionToApp(session, app) {
    const base = path.join(app.path, "voicelogs");
    await Promise.all([
        mkdir(path.join(base, "raw"), { recursive: true }),
        mkdir(path.join(base, "cleaned"), { recursive: true }),
        mkdir(path.join(base, "sessions"), { recursive: true }),
    ]);
    // Preserve each file's own name — so the cleaned copy keeps its friendly
    // title (e.g. test_with_music_27June2026.md), not the timestamp id.
    const copied = [];
    const destRaw = path.join(base, "raw", path.basename(session.rawPath));
    if (existsSync(session.rawPath)) {
        await copyFile(session.rawPath, destRaw);
        copied.push("raw");
    }
    let destCleaned;
    if (session.cleanedPath && existsSync(session.cleanedPath)) {
        destCleaned = path.join(base, "cleaned", path.basename(session.cleanedPath));
        await copyFile(session.cleanedPath, destCleaned);
        copied.push("cleaned");
    }
    const localIndex = { ...session, rawPath: destRaw, cleanedPath: destCleaned };
    await writeFile(path.join(base, "sessions", `${session.id}.json`), JSON.stringify(localIndex, null, 2) + "\n");
    return { base, copied };
}
/**
 * If the app has a companion CLI (`bin`), notify it about the pushed session by
 * calling `<bin> note <projectId> <text>`. Matches the Ledger CLI's `note` command
 * interface. Skipped silently when the app has no bin or the session has no projectId.
 */
export async function notifyAppBin(session, app) {
    if (!app.bin || !session.projectId)
        return { ok: true, skipped: true, message: "" };
    const noteText = session.summary
        ? `voice log ${session.id}: ${session.summary}`
        : `voice log ${session.id}`;
    return new Promise((resolve) => {
        const parts = app.bin.split(" ");
        const proc = spawn(parts[0], [...parts.slice(1), "note", session.projectId, noteText], {
            env: process.env,
        });
        let stderr = "";
        proc.stderr?.on("data", (d) => (stderr += d.toString()));
        proc.on("error", (e) => resolve({ ok: false, skipped: false, message: e.message }));
        proc.on("close", (code) => resolve({ ok: code === 0, skipped: false, message: code !== 0 ? (stderr.trim() || `exit ${code}`) : "" }));
    });
}
//# sourceMappingURL=appPush.js.map