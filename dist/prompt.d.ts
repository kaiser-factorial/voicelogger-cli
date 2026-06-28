/** Yes/no prompt. Non-interactive stdin returns the default without asking. */
export declare function confirm(question: string, defaultYes?: boolean): Promise<boolean>;
/** Read a single line from a TTY (visible). Non-interactive stdin → empty string. */
export declare function promptLine(prompt: string): Promise<string>;
/** Read a line from a TTY without echoing what is typed (password-style). */
export declare function promptHidden(prompt: string): Promise<string>;
