import { z } from "zod";
/**
 * LLM-powered cleaning pass. Reads a raw transcript and a shared glossary + template,
 * and returns a cleaned Markdown body, a short title, and a one-line summary.
 *
 * Two backends:
 *   - Anthropic SDK (default): structured output via zodOutputFormat.
 *   - OpenAI-compatible (when config.llmBaseUrl is set): fetch + json_object.
 *     Works with OpenRouter, Ollama, Groq, etc. Set LLM_BASE_URL (and LLM_API_KEY
 *     for remote endpoints) or use `voicelogger config endpoint`.
 */
declare const CleanResult: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    cleaned: z.ZodString;
}, z.core.$strip>;
export type CleanResult = z.infer<typeof CleanResult>;
export interface CleanInputs {
    glossary: string;
    template: string;
    /** Recent notes from the Memory Hub for this project — injected as extra context. */
    projectContext?: string;
    /**
     * True when this is a test-log recording (narrated QA observations) rather than
     * a plain voice log — see `docs/TEST_LOG_PLAN.md`. Adjusts the system prompt:
     * heavier reliance on project context, tolerance for large silence gaps (the
     * speaker is clicking through a UI, not talking continuously), and best-effort
     * multi-speaker attribution. Never triggers real diarization (locked decision #2).
     */
    testLog?: boolean;
    /**
     * The narrator's name (default "dev"), metadata only — used for best-effort
     * speaker attribution in test-log mode. Ignored when `testLog` is falsy.
     */
    speaker?: string;
}
export declare function cleanTranscript(rawBody: string, inputs: CleanInputs): Promise<CleanResult>;
/** Exported for tests — pure string construction, no network calls. */
export declare function buildSystemPrompt({ glossary, template, projectContext, testLog, speaker, }: CleanInputs): string;
export {};
