import { spawn } from "node:child_process";
import { config } from "./config.js";

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

// Documented ledger-cli exit codes.
const EXIT_LABEL: Record<number, string> = {
  10: "auth",
  20: "not found",
  30: "network",
  40: "validation",
  50: "error",
};

export function exitLabel(code: number): string {
  return EXIT_LABEL[code] ?? `exit ${code}`;
}

function runLedger(args: string[]): Promise<LedgerResult> {
  return new Promise((resolve) => {
    const proc = spawn(config.ledgerBin, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (e) => resolve({ ok: false, code: -1, stdout, stderr: e.message }));
    proc.on("close", (code) =>
      resolve({ ok: code === 0, code: code ?? -1, stdout, stderr }),
    );
  });
}

// Note: the binary takes the note inline (`ledger note <id> <text>`), not via an
// editor — verified against the actual binary, contra older CLI docs.
export function ledgerNote(projectId: string, note: string): Promise<LedgerResult> {
  return runLedger(["note", projectId, note, "--json"]);
}

export function ledgerTouch(projectId: string, reason: string): Promise<LedgerResult> {
  return runLedger(["touch", projectId, "--reason", reason, "--json"]);
}

export interface LedgerProject {
  id: string;
  name: string;
}

/** Fetch active projects from `ledger status --json`. Returns [] on any failure. */
export async function ledgerListProjects(): Promise<LedgerProject[]> {
  const result = await runLedger(["status", "--json"]);
  if (!result.ok) return [];
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? (parsed as LedgerProject[]) : [];
  } catch {
    return [];
  }
}
