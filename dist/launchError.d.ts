import type { LaunchFailure } from "./launchRun.js";
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
export declare function hasLaunchSummarizerAuth(): boolean;
/**
 * Build the copy-pasteable handoff message: command/cwd, exit status, captured output tail,
 * and an LLM summary when available.
 */
export declare function buildHandoffMessage(failure: LaunchFailure): Promise<string>;
