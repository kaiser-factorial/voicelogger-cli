import type { VoiceLogSession } from "./types.js";
/**
 * Query the Memory Hub for context relevant to this session's project.
 * Called before cleaning — injects project-specific memory into the LLM prompt
 * so the cleaner understands domain terms and recent work on this project.
 * Returns undefined when the Hub is not configured, the project is unlinked,
 * or no relevant memories are found.
 */
export declare function queryProjectContext(session: VoiceLogSession): Promise<string | undefined>;
/**
 * Ingest a freshly-cleaned voice log into the Memory Hub.
 * Called after cleaning — seeds the flywheel so future sessions and BULWORK
 * adjudication have project-specific context to draw from.
 * Fire-and-forget: errors are swallowed so the caller doesn't need to await this.
 */
export declare function ingestCleanedLog(session: VoiceLogSession, cleanedPath: string): Promise<void>;
