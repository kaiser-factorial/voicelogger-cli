/**
 * Transcribe one PCM window with whisper.cpp (`whisper-cli`).
 *
 * The window is written to a temp WAV and passed to whisper-cli with timestamps
 * and banner output suppressed, so stdout is just the transcript text.
 */
export declare function transcribePcm(pcm: Buffer): Promise<string>;
/**
 * Drop whisper.cpp non-speech markers — lines that are entirely a bracketed or
 * parenthesized token such as `[BLANK_AUDIO]`, `[ Silence ]`, or `(buzzing)`.
 * The energy VAD windows always include trailing silence and can fire on
 * transient noise, so these markers would otherwise be written verbatim into the
 * transcript and fed to the LLM cleaning pass. Lines with real speech (even
 * alongside a marker) are preserved.
 */
export declare function stripNonSpeechMarkers(text: string): string;
