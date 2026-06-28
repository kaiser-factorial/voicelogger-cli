import { z } from "zod";
/**
 * LLM-powered cleaning pass (Part B of the plan). Reads a raw transcript and a
 * shared glossary + template, and returns a cleaned Markdown body plus a one-line
 * summary. Uses structured output so the summary can be reused by `link`.
 *
 * Model defaults to Claude Opus 4.8; set CLAUDE_MODEL=claude-haiku-4-5 for a
 * cheaper/faster pass.
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
}
export declare function cleanTranscript(rawBody: string, inputs: CleanInputs): Promise<CleanResult>;
export {};
