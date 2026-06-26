// Shared types for the voice-logger service.
// These mirror the `VoiceLogSession` index doc described in
// docs/AGENT_AND_VOICELOG_PLAN.md (Storage section). The bulky transcript text
// lives on the filesystem; this metadata is what Firestore will index later.

export type VoiceSourceKind = "laptop" | "wearabllm";

export type SessionStatus = "recording" | "raw" | "cleaned";

/** How `record` handles the LLM cleaning pass when a recording finishes. */
export type CleanMode = "auto" | "prompt" | "off";

export interface AudioFormat {
  sampleRate: number; // 16000
  channels: number; // 1 (mono)
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
}

/**
 * The per-session index record. Persisted as JSON on disk now; the same shape
 * becomes the Firestore `VoiceLogSession` doc when the app wires in.
 */
export interface VoiceLogSession {
  id: string;
  projectId?: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  source: VoiceSourceKind;
  rawPath: string;
  cleanedPath?: string;
  status: SessionStatus;
  summary?: string;
}
