/**
 * Check that the environment is ready: ffmpeg + whisper.cpp + a model for
 * recording, plus an Anthropic key (clean) and the ledger CLI (link).
 *
 *   voicelogger doctor
 *
 * Exits non-zero if any check required for recording fails.
 */
export interface DoctorCheck {
    name: string;
    ok: boolean;
    required: boolean;
    detail: string;
}
/** Non-zero exit if any *required* check failed (optional checks never fail the run). */
export declare function doctorExitCode(checks: DoctorCheck[]): number;
export declare function doctorCommand(): Promise<void>;
