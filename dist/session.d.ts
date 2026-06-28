import type { VoiceSource } from "./sources/VoiceSource.js";
import type { TranscriptSegment, VoiceLogSession } from "./types.js";
export interface SessionOptions {
    projectId?: string;
    /** Called as each transcribed segment is appended (for live display). */
    onSegment?: (seg: TranscriptSegment) => void;
}
/**
 * Orchestrates one recording session:
 *   VoiceSource → EnergyVad → whisper-cli → raw/<id>.md  (+ sessions/<id>.json index)
 *
 * Transcription runs on a sequential queue so segments are appended in order
 * even though whisper calls overlap with capture.
 */
export declare class SessionRecorder {
    readonly session: VoiceLogSession;
    private readonly source;
    private readonly vad;
    private readonly onSegment?;
    private segments;
    private queue;
    private segmentIndex;
    private started;
    constructor(source: VoiceSource, opts?: SessionOptions);
    start(): Promise<void>;
    stop(): Promise<VoiceLogSession>;
    private enqueueWindow;
    private rawHeader;
    private writeIndex;
    private static makeId;
}
