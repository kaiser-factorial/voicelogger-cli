export type VoiceSourceKind = "laptop" | "wearabllm";
export type SessionStatus = "recording" | "raw" | "cleaned";
/** How `record` handles the LLM cleaning pass when a recording finishes. */
export type CleanMode = "auto" | "prompt" | "off";
/** Full Scan vs. a named Feature — see docs/TEST_LOG_PLAN.md Phase 2's scope toggle. */
export type TestLogScope = "full" | "feature";
export interface AudioFormat {
    sampleRate: number;
    channels: number;
    bitDepth: 16;
}
/** One transcribed utterance window. */
export interface TranscriptSegment {
    index: number;
    /** ms from session start when this window began. */
    startMs: number;
    /** ms from session start when this window ended. */
    endMs: number;
    text: string;
    /**
     * Best-effort speaker attribution — a seam for real diarization, not real diarization
     * (locked decision #2 in docs/TEST_LOG_PLAN.md). Never populated by the recording
     * pipeline today (no diarization exists); left optional/nullable so old session files
     * without it keep parsing, and so a future diarization pass has somewhere to write.
     */
    speaker?: string | null;
}
/**
 * The per-session index record. Persisted as JSON on disk now; the same shape
 * becomes the Firestore `VoiceLogSession` doc when the app wires in.
 */
export interface VoiceLogSession {
    id: string;
    projectId?: string;
    startedAt: string;
    endedAt?: string;
    source: VoiceSourceKind;
    rawPath: string;
    cleanedPath?: string;
    status: SessionStatus;
    summary?: string;
    /** Set by `record --test-log` — see docs/TEST_LOG_PLAN.md. Absent on plain voice logs. */
    testLog?: boolean;
    /** Test-log narrator name (metadata only, default "dev"); see locked decision #2. */
    speaker?: string;
    /** Test-log user-supplied label (Ledger's future title/subtitle field). */
    title?: string;
    /** Test-log Full Scan vs. Feature toggle. */
    scope?: TestLogScope;
    /** Feature name/topic under test — seeds Ledger's future Feature dropdown (decision #6). */
    featureNote?: string;
}
