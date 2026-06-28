/**
 * Attach a session to a project. Always records the link locally. If a project
 * tracker is connected (`voicelogger config ledger <path>`, or LEDGER_BIN), it also
 * notifies the tracker — a note, and a touch with --touch — unless --no-ledger.
 *
 *   voicelogger link <session|latest> <projectId> [--touch] [--reason <r>] [--note <n>] [--no-ledger]
 */
export declare function linkCommand(args: string[]): Promise<void>;
