/** Yes/no prompt. Non-interactive stdin returns the default without asking. */
export declare function confirm(question: string, defaultYes?: boolean): Promise<boolean>;
/** Read a single line from a TTY (visible). Non-interactive stdin → empty string. */
export declare function promptLine(prompt: string): Promise<string>;
/**
 * Show a numbered list of choices and return the 0-based index of the selection.
 * Pressing Enter returns `defaultIndex`. Repeats until a valid number is entered.
 */
export declare function promptChoice(options: Array<{
    label: string;
    hint?: string;
}>, defaultIndex?: number): Promise<number>;
/**
 * Show a numbered list of Ledger projects and return the chosen project ID,
 * or undefined if the user presses Enter to skip.
 * Returns undefined immediately in non-interactive environments.
 */
export declare function promptProject(projects: Array<{
    id: string;
    name: string;
}>): Promise<string | undefined>;
/** Read a line from a TTY without echoing what is typed (password-style). */
export declare function promptHidden(prompt: string): Promise<string>;
