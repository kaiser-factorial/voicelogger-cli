import type { AppEntry } from "./apps.js";
import type { VoiceLogSession } from "./types.js";
/**
 * Copy a session's logs into an app's `voicelogs/` directory. Pushes the raw
 * transcript, the cleaned markdown (if present), and the session index — rewriting
 * the index's paths to the app-local copies so the app's voicelogs/ is
 * self-contained. Copies (not symlinks). Shared by `app push` and `record --app`.
 */
export declare function pushSessionToApp(session: VoiceLogSession, app: AppEntry): Promise<{
    base: string;
    copied: string[];
}>;
/**
 * If the app has a companion CLI (`bin`), notify it about the pushed session by
 * calling `<bin> note <projectId> <text>`. Matches the Ledger CLI's `note` command
 * interface. Skipped silently when the app has no bin or the session has no projectId.
 */
export declare function notifyAppBin(session: VoiceLogSession, app: AppEntry): Promise<{
    ok: boolean;
    skipped: boolean;
    message: string;
}>;
