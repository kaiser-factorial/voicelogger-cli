import type { VoiceLogSession } from "./types.js";
export interface CleanOutcome {
    cleanedPath: string;
    summary: string;
    /** Full cleaned-file markdown (header + body), ready to render. */
    markdown: string;
}
/** Whether credentials are available for the cleaning pass (Anthropic or a configured LLM endpoint). */
export declare function hasAnthropicAuth(): boolean;
/**
 * LLM cleaning pass for a session: read its raw body, apply the shared
 * glossary+template, write cleaned/<id>.md, update the session index, and return
 * the cleaned markdown. Throws if the raw transcript is empty.
 *
 * Shared by the `clean` command and `record`'s auto-clean step so both produce
 * identical output. The test-log variant (template, project-context depth, speaker)
 * is read straight from `session.testLog`/`session.speaker` — captured at the source
 * by `record --test-log` (see session.ts) — so a deferred `voicelogger clean <session>`
 * run picks the right variant too, not just the same-invocation auto-clean.
 */
export declare function runClean(session: VoiceLogSession): Promise<CleanOutcome>;
