/**
 * Thin bridge to the `ledger` Go binary — the CLI-to-CLI link.
 * `link` uses this to drop a `ledger note` / `touch` when a voice log is
 * attached to a project, so debug narration ties into project status.
 *
 * Auth (GOOGLE_APPLICATION_CREDENTIALS, LEDGER_EMAIL/PASSWORD, …) is inherited
 * from the parent environment.
 */
export interface LedgerResult {
    ok: boolean;
    code: number;
    stdout: string;
    stderr: string;
}
export declare function exitLabel(code: number): string;
export declare function ledgerNote(projectId: string, note: string): Promise<LedgerResult>;
export declare function ledgerTouch(projectId: string, reason: string): Promise<LedgerResult>;
export interface LedgerProject {
    id: string;
    name: string;
}
/** Fetch active projects from `ledger status --json`. Returns [] on any failure. */
export declare function ledgerListProjects(): Promise<LedgerProject[]>;
