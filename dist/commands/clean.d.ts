/**
 * Clean a raw transcript with the LLM and write cleaned/<id>.md, then print the
 * edited markdown styled for the terminal.
 *
 *   voicelogger clean <session|latest> [--plain]
 */
export declare function cleanCommand(args: string[]): Promise<void>;
