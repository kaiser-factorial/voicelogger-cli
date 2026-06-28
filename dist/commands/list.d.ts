/**
 * List all voice-log sessions, newest first.
 *
 *   voicelogger list [--json]
 *
 * --json prints the raw VoiceLogSession array (for scripting / other tools).
 */
export declare function listCommand(args?: string[]): Promise<void>;
