import Anthropic from "@anthropic-ai/sdk";
import { wrapUntrusted } from "@local/shield";
import { config } from "./config.js";
/**
 * Copy-pasteable handoff message for a `voicelogger test <path>` launch/build failure — see
 * docs/TEST_LOG_PLAN.md's Phase 1b design-decisions block for the resolved format and scope.
 *
 * Anthropic-only (checks ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN directly, not `cleaner.ts`'s
 * OpenAI-compatible-endpoint fallback) — a documented scope call: this is a secondary,
 * nice-to-have summarization step, not the core cleaning feature, so it doesn't need full
 * multi-provider parity. Falls back to the plain captured output with no summary when no key
 * is set, matching how plain `record`'s cleanup already degrades without one.
 *
 * Explicitly NOT doing codebase-aware fix suggestions (see the plan doc) — this only
 * summarizes what happened, for a human to hand to a separate coding-agent session.
 */
export function hasLaunchSummarizerAuth() {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
async function summarize(output) {
    if (!hasLaunchSummarizerAuth())
        return undefined;
    try {
        const client = new Anthropic();
        const response = await client.messages.create({
            model: config.anthropicModel,
            max_tokens: 300,
            system: "You summarize a failed dev-server/build launch for a developer. Given raw captured " +
                "stdout/stderr, write 2-4 concise sentences: what failed, and the most likely cause if " +
                "evident from the output. Do not suggest specific code fixes — you don't have the " +
                "codebase, only this output. If the output doesn't clearly show a cause, say so plainly " +
                "rather than guessing.",
            messages: [{ role: "user", content: wrapUntrusted(output, "launch_output") }],
        });
        const text = response.content.find((b) => b.type === "text");
        return text?.type === "text" ? text.text.trim() : undefined;
    }
    catch {
        return undefined; // never let the summarizer itself crash the launcher's error path
    }
}
/**
 * Build the copy-pasteable handoff message: command/cwd, exit status, captured output tail,
 * and an LLM summary when available.
 */
export async function buildHandoffMessage(failure) {
    const status = failure.timedOut
        ? "timed out waiting for readiness"
        : `exited (code ${failure.exitCode ?? "unknown"})`;
    const summary = await summarize(failure.output);
    const lines = [
        `## Launch failed: ${failure.cwd}`,
        "",
        `**Command:** \`${failure.cmd}\``,
        `**Status:** ${status}`,
        "",
        "### Summary",
        summary ?? "(no Anthropic API key configured — showing raw output only)",
        "",
        "### Captured output (tail)",
        "```",
        failure.output.trim() || "(no output captured)",
        "```",
    ];
    return lines.join("\n");
}
//# sourceMappingURL=launchError.js.map