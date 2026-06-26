import { exitLabel, ledgerNote, ledgerTouch } from "../ledger.js";
import { resolveSession, writeSession } from "../store.js";
import { optValue, positionals } from "./util.js";

/**
 * Attach a session to a project. Always records the link locally; unless
 * --no-ledger, also drops a `ledger note` (and a `touch` with --touch) via the
 * ledger-cli — the CLI-to-CLI bridge from the plan.
 *
 *   voicelog link <session|latest> <projectId> [--touch] [--reason <r>] [--note <n>] [--no-ledger]
 */
export async function linkCommand(args: string[]): Promise<void> {
  const [id, projectId] = positionals(args);
  if (!id || !projectId) {
    console.error(
      "usage: voicelog link <session|latest> <projectId> [--touch] [--reason <r>] [--note <n>] [--no-ledger]",
    );
    process.exit(1);
  }

  const session = await resolveSession(id);
  if (!session) {
    console.error(`no session matching '${id}'`);
    process.exit(20);
  }

  // The local link is the source of truth and is always saved first.
  session.projectId = projectId;
  await writeSession(session);
  console.log(`✓ linked session ${session.id} → project ${projectId}`);

  if (args.includes("--no-ledger")) return;

  const noteText =
    optValue(args, "--note") ??
    `voice log ${session.id}${session.summary ? `: ${session.summary}` : ""}`;
  const noteRes = await ledgerNote(projectId, noteText);
  if (noteRes.ok) {
    console.log(`✓ ledger note added to ${projectId}`);
  } else {
    console.warn(
      `! ledger note failed (${exitLabel(noteRes.code)}): ${noteRes.stderr.trim() || "check ledger-cli auth"} — local link still saved`,
    );
  }

  if (args.includes("--touch")) {
    const reason = optValue(args, "--reason") ?? `voice log ${session.id}`;
    const touchRes = await ledgerTouch(projectId, reason);
    if (touchRes.ok) {
      console.log(`✓ ledger touch recorded on ${projectId}`);
    } else {
      console.warn(
        `! ledger touch failed (${exitLabel(touchRes.code)}): ${touchRes.stderr.trim() || "check ledger-cli auth"}`,
      );
    }
  }
}
