import type { VoiceLogSession } from "./types.js";
/**
 * Local control surface for a `record --test-log` session — see docs/TEST_LOG_PLAN.md
 * Phase 1a-ii. Lives inside the `record --test-log` process itself, for the duration of
 * that one session (not a persistent background daemon): starting a session is a CLI
 * invocation (whoever wants one — a human, the Phase 1b launcher, or Ledger — runs
 * `voicelogger record --test-log [flags]`); this server only covers *status* and *stop*,
 * the two things a caller outside that process needs (Ledger's future modal, the browser
 * extension indicator). Conventions (CORS + required client header, sendJson helper)
 * mirror bulwork's `src/server.ts` for consistency across this workspace.
 */
export interface TestLogServerDeps {
    /** The live session object — SessionRecorder mutates it in place, so read fresh each call. */
    getSession(): VoiceLogSession;
    /** Trigger the same graceful stop path as Enter/Ctrl-C. Fire-and-forget; must be idempotent. */
    requestStop(): void;
}
export interface TestLogServerHandle {
    port: number;
    close(): Promise<void>;
}
/**
 * Start the control server. Rejects on bind failure — most commonly EADDRINUSE, which
 * doubles as this workspace's answer to two Phase 1a-ii edge cases at once: a port already
 * in use IS "a second test-log session tried to start while one's already running," since
 * starting a session is a process launch that claims this port for its lifetime. No PID
 * file or separate liveness check is needed — the OS reclaims the port the instant the
 * owning process exits or crashes, so a crash can never leave a stale server answering
 * `active: true` forever.
 */
export declare function startTestLogServer(deps: TestLogServerDeps, port?: number): Promise<TestLogServerHandle>;
