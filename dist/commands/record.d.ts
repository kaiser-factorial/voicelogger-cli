/**
 * Record from the laptop mic until Enter/Ctrl-C. Writes raw/<id>.md and the
 * session index; live transcript prints to the terminal. On finish, unless
 * disabled, runs the LLM cleaning pass and prints the edited markdown.
 *
 *   voicelogger record [--project <id>] [--no-clean | --clean [auto|prompt|off]] [--app <name>]
 *                      [--test-log] [--user <name>] [--title <t>] [--scope <full|feature>]
 *                      [--feature <note>]
 *
 * `--test-log` also starts the local control server on :7374 for the session's duration
 * (status + stop, for the browser extension indicator and Ledger — see testLogServer.ts
 * and docs/TEST_LOG_PLAN.md Phase 1a-ii). It runs whether this invocation is interactive
 * (a human at a terminal) or spawned headlessly by the future launcher/Ledger — starting a
 * session is always this CLI invocation itself, the server only covers status/stop for a
 * caller outside this process.
 */
export declare function recordCommand(args: string[]): Promise<void>;
