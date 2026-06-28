/**
 * Record from the laptop mic until Enter/Ctrl-C. Writes raw/<id>.md and the
 * session index; live transcript prints to the terminal. On finish, unless
 * disabled, runs the LLM cleaning pass and prints the edited markdown.
 *
 *   voicelogger record [--project <id>] [--no-clean | --clean [auto|prompt|off]] [--app <name>]
 */
export declare function recordCommand(args: string[]): Promise<void>;
