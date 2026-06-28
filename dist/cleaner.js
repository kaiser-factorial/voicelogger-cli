import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "./config.js";
/**
 * LLM-powered cleaning pass (Part B of the plan). Reads a raw transcript and a
 * shared glossary + template, and returns a cleaned Markdown body plus a one-line
 * summary. Uses structured output so the summary can be reused by `link`.
 *
 * Model defaults to Claude Opus 4.8; set CLAUDE_MODEL=claude-haiku-4-5 for a
 * cheaper/faster pass.
 */
const CleanResult = z.object({
    title: z
        .string()
        .describe("A short, file-name-friendly title for this voice log: 3–6 words capturing the topic " +
        "(e.g. 'Test with music', 'RRG eval brief'). Plain words only — no date, quotes, or punctuation."),
    summary: z
        .string()
        .describe("One sentence (≤ 20 words) capturing what this voice log is about."),
    cleaned: z
        .string()
        .describe("The cleaned transcript as Markdown following the template. No top-level title heading."),
});
export async function cleanTranscript(rawBody, inputs) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        throw new Error("ANTHROPIC_API_KEY is not set — export it (or ANTHROPIC_AUTH_TOKEN) before running `clean`.");
    }
    const client = new Anthropic();
    const response = await client.messages.parse({
        model: config.anthropicModel,
        max_tokens: config.cleanMaxTokens,
        system: buildSystemPrompt(inputs),
        messages: [{ role: "user", content: rawBody }],
        output_config: { format: zodOutputFormat(CleanResult) },
    });
    const out = response.parsed_output;
    if (!out) {
        throw new Error(`cleaning returned no structured output (stop_reason=${response.stop_reason ?? "unknown"})`);
    }
    return out;
}
function buildSystemPrompt({ glossary, template }) {
    return [
        "You clean raw voice-log transcripts for a developer's project tracker (The Ledger).",
        "The input is a rough speech-to-text transcript: it has disfluencies, false starts,",
        "and mis-transcribed technical terms.",
        "",
        "Your job:",
        "1. Remove filler and disfluencies (um, uh, like, you know, repeated words, false starts).",
        "2. Fix mis-transcribed domain terms using the glossary below. Leave terms not in the glossary alone.",
        "3. Organize the content into the template below. Preserve the speaker's meaning exactly —",
        "   never invent facts, decisions, or next steps that weren't said.",
        "4. Omit any template section that has no content rather than padding it.",
        "5. Write clear, concise prose in the speaker's first-person voice.",
        "",
        "Return `title` (3–6 plain words for the filename), `summary` (one sentence), and `cleaned`",
        "(the Markdown body, with no title heading).",
        "",
        "=== GLOSSARY (mis-hearing → correct term) ===",
        glossary.trim() || "(none provided)",
        "",
        "=== TEMPLATE (structure for the cleaned body) ===",
        template.trim() || "(no template provided — use sensible sections)",
    ].join("\n");
}
//# sourceMappingURL=cleaner.js.map