import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "./config.js";

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
const CleanResult = z.object({
  title: z
    .string()
    .describe(
      "A short, file-name-friendly title for this voice log: 3–6 words capturing the topic " +
        "(e.g. 'Test with music', 'API design notes'). Plain words only — no date, quotes, or punctuation.",
    ),
  summary: z
    .string()
    .describe("One sentence (≤ 20 words) capturing what this voice log is about."),
  cleaned: z
    .string()
    .describe(
      "The cleaned transcript as Markdown following the template. No top-level title heading.",
    ),
});

export type CleanResult = z.infer<typeof CleanResult>;

export interface CleanInputs {
  glossary: string;
  template: string;
}

export async function cleanTranscript(
  rawBody: string,
  inputs: CleanInputs,
): Promise<CleanResult> {
  return config.llmBaseUrl
    ? cleanWithOpenAICompat(rawBody, inputs)
    : cleanWithAnthropic(rawBody, inputs);
}

async function cleanWithAnthropic(rawBody: string, inputs: CleanInputs): Promise<CleanResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — export it (or ANTHROPIC_AUTH_TOKEN) before running `clean`.",
    );
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
    throw new Error(
      `cleaning returned no structured output (stop_reason=${response.stop_reason ?? "unknown"})`,
    );
  }
  return out;
}

async function cleanWithOpenAICompat(rawBody: string, inputs: CleanInputs): Promise<CleanResult> {
  const systemPrompt =
    buildSystemPrompt(inputs) +
    '\n\nReturn a JSON object with exactly three keys: "title" (3–6 plain words), ' +
    '"summary" (one sentence ≤ 20 words), and "cleaned" (the full cleaned transcript in Markdown).';

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.llmApiKey) headers["Authorization"] = `Bearer ${config.llmApiKey}`;

  const body = JSON.stringify({
    model: config.anthropicModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawBody },
    ],
    response_format: { type: "json_object" },
  });

  const MAX_RETRIES = 5;
  let res!: Response;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    res = await fetch(`${config.llmBaseUrl}/chat/completions`, { method: "POST", headers, body });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get("Retry-After") ?? "3");
    // Exponential backoff, capped at 15s, but never less than what the server asks for.
    const delaySec = Math.min(Math.max(retryAfter, Math.pow(2, attempt)), 15);
    process.stderr.write(
      `  rate-limited — retrying in ${delaySec}s (${attempt + 1}/${MAX_RETRIES})…\n`,
    );
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    if (res.status === 429) {
      throw new Error(
        `${config.anthropicModel} is rate-limited — try a different model:\n` +
          "  voicelogger config model <name>   (run 'voicelogger config model' to see options)",
      );
    }
    throw new Error(`LLM request failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response");

  const parsed = JSON.parse(content) as Partial<CleanResult>;
  if (!parsed.title || !parsed.cleaned) {
    throw new Error('LLM response missing required fields ("title" and/or "cleaned")');
  }
  return {
    title: parsed.title,
    summary: parsed.summary ?? "",
    cleaned: parsed.cleaned,
  };
}

function buildSystemPrompt({ glossary, template }: CleanInputs): string {
  return [
    "You clean raw voice-log transcripts.",
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
