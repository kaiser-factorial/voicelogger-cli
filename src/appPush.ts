import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppEntry } from "./apps.js";
import type { VoiceLogSession } from "./types.js";

/**
 * Copy a session's logs into an app's `voicelogs/` directory. Pushes the raw
 * transcript, the cleaned markdown (if present), and the session index — rewriting
 * the index's paths to the app-local copies so the app's voicelogs/ is
 * self-contained. Copies (not symlinks). Shared by `app push` and `record --app`.
 */
export async function pushSessionToApp(
  session: VoiceLogSession,
  app: AppEntry,
): Promise<{ base: string; copied: string[] }> {
  const base = path.join(app.path, "voicelogs");
  await Promise.all([
    mkdir(path.join(base, "raw"), { recursive: true }),
    mkdir(path.join(base, "cleaned"), { recursive: true }),
    mkdir(path.join(base, "sessions"), { recursive: true }),
  ]);

  // Preserve each file's own name — so the cleaned copy keeps its friendly
  // title (e.g. test_with_music_27June2026.md), not the timestamp id.
  const copied: string[] = [];
  const destRaw = path.join(base, "raw", path.basename(session.rawPath));
  if (existsSync(session.rawPath)) {
    await copyFile(session.rawPath, destRaw);
    copied.push("raw");
  }
  let destCleaned: string | undefined;
  if (session.cleanedPath && existsSync(session.cleanedPath)) {
    destCleaned = path.join(base, "cleaned", path.basename(session.cleanedPath));
    await copyFile(session.cleanedPath, destCleaned);
    copied.push("cleaned");
  }

  const localIndex = { ...session, rawPath: destRaw, cleanedPath: destCleaned };
  await writeFile(
    path.join(base, "sessions", `${session.id}.json`),
    JSON.stringify(localIndex, null, 2) + "\n",
  );

  return { base, copied };
}
