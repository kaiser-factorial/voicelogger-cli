import type { VoiceLogSession } from "./types.js";
/** All sessions on disk, newest first. */
export declare function listSessions(): Promise<VoiceLogSession[]>;
/**
 * Resolve a session by id, the literal "latest", or a unique id prefix.
 * Returns null if nothing matches (or a prefix is ambiguous).
 */
export declare function resolveSession(idOrLatest: string): Promise<VoiceLogSession | null>;
export declare function writeSession(session: VoiceLogSession): Promise<void>;
/** The transcript body of a raw log, with the metadata header stripped. */
export declare function readRawBody(session: VoiceLogSession): Promise<string>;
