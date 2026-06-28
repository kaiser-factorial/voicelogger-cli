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
}
export declare function cleanTranscript(rawBody: string, inputs: CleanInputs): Promise<CleanResult>;
export {};
