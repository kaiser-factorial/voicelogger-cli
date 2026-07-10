# voicelogger-cli — handoff

**What this is:** local mic → whisper.cpp → LLM-clean voice logger. Full command reference in
`README.md`; chronological build log in `SESSION_LOG.md`.

---

## ▶ Next up — Test-log mode, Phase 1a-i

**Where we are (2026-07-10):** design phase for "test-log mode" (a dedicated recording mode for
narrating QA-testing observations, plus a project launcher, plus a thin Ledger UI on top) is
locked and phased. **The plan doc is the source of truth — read it before writing any code:**

- **`docs/TEST_LOG_PLAN.md`** — full design: locked decisions (don't re-litigate these without a
  reason — each one has a stated "why"), phase-by-phase checklist, backlog, open questions. It was
  written carefully to stand alone; if anything in it seems to assume context you don't have,
  that's a bug in the doc, not a gap you need to fill from memory of a prior session.

**Concrete next action:** start Phase 1a-i (small, see the plan doc's phasing section) —
1. Decide the mode's naming (`test-log` subcommand vs. `record --test-log` flag) — a precursor
   decision, make it before writing code, not mid-implementation.
2. Build the cleaner prompt variant: heavier project context, tolerance for large silence gaps,
   multi-speaker awareness, `--user <name>` flag (metadata only — **no diarization**, see locked
   decision #2 in the plan doc for why, and the seam to leave for later).

Do **not** start Phase 1a-ii (storage schema + control surface + status server) as part of the
same pass as 1a-i — the plan doc explicitly splits these because they're differently sized; see
"Phase 1a" in `docs/TEST_LOG_PLAN.md`.

**Already built, don't redo:** `extension/` — a working (but not yet wired-up) browser-extension
skeleton for the visual "recording active" indicator (Phase 1c). It polls
`http://127.0.0.1:7374/status`, which doesn't exist yet — that's Phase 1a-ii's job. See
`extension/README.md`.

## Things a fresh session needs to know that aren't obvious from this repo alone

- **Repo layout:** this repo lives at `~/Projects/ledger_root/voicelogger-cli`, a sibling of
  `ledger` (the GUI app), `ledger-cli` (Go CLI), `ledger-mcp` (MCP server), `brick` (focus
  enforcer), and `shield` (`~/Projects/ledger_root/shield` — a prompt-injection defense library
  several of these depend on via `file:../shield`). **None of these repos are in a monorepo** —
  each has its own independent GitHub remote, and `ledger_root` itself is not a git repo. A file
  placed at the `ledger_root` level (outside any of these) will never be picked up by `git push`
  from any of them — see `docs/TEST_LOG_PLAN.md` locked decision #5 for why that matters for the
  `extension/overlay.js` file specifically (it's a manual vendored copy of
  `../brick/extension/overlay.js`, not a shared import — if you change one, change the other by
  hand, per the note at the top of both files).
- **Port convention across this workspace:** brick's local service = `:7373`, voicelogger's
  (planned, Phase 1a-ii) = `:7374`. Keep it that way.
- **⚠ Uncommitted work exists in sibling repos that this conversation did not create.** As of
  2026-07-10, `git status` shows modified files in `ledger/src/` (`App.tsx`, `ProjectCard.tsx`,
  `firestore.ts`, `projects.ts`, `useProjects.ts`, `Project.ts`, `CyberButton.tsx`,
  `DailyPrompt.tsx`) and in `voicelogger-cli/src/cleaner.ts`, plus new untracked files in
  `ledger/src/` (`NextActionPrompt.tsx`, `useResponsiveColumns.ts`). **This is someone else's
  in-progress work, not test-log's.** Don't assume a clean tree, don't attribute unfamiliar diffs
  in those files to the test-log build, and don't stash/revert/overwrite them without checking
  with the user first.
- **A second, separate roadmap exists and is intentionally paused:** `ledger/docs/SHIELD_STATUS_PLAN.md`
  (a shield-status dashboard + scaffold feature for Ledger). Explicitly sequenced *after*
  test-log finishes, per the user's own call — don't start it just because it's designed and
  sitting there.
