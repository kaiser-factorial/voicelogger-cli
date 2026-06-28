import { spawn } from "node:child_process";
import { config } from "./config.js";
// Documented ledger-cli exit codes.
const EXIT_LABEL = {
    10: "auth",
    20: "not found",
    30: "network",
    40: "validation",
    50: "error",
};
export function exitLabel(code) {
    return EXIT_LABEL[code] ?? `exit ${code}`;
}
function runLedger(args) {
    return new Promise((resolve) => {
        const proc = spawn(config.ledgerBin, args, { env: process.env });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => (stdout += d.toString()));
        proc.stderr.on("data", (d) => (stderr += d.toString()));
        proc.on("error", (e) => resolve({ ok: false, code: -1, stdout, stderr: e.message }));
        proc.on("close", (code) => resolve({ ok: code === 0, code: code ?? -1, stdout, stderr }));
    });
}
// Note: the binary takes the note inline (`ledger note <id> <text>`), not via an
// editor — verified against the actual binary, contra older CLI docs.
export function ledgerNote(projectId, note) {
    return runLedger(["note", projectId, note, "--json"]);
}
export function ledgerTouch(projectId, reason) {
    return runLedger(["touch", projectId, "--reason", reason, "--json"]);
}
//# sourceMappingURL=ledger.js.map