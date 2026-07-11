# voicelogger-cli — handoff

**What this is:** local mic → whisper.cpp → LLM-clean voice logger. Full command reference in
`README.md`; chronological build log in `SESSION_LOG.md`.

---

## ▶ Next up — Test-log mode, Phase 1c or Phase 2

**Where we are (2026-07-10):** Phase 1 is fully done — 1a-i (mode + prompt), 1a-ii (storage +
control surface + server), and 1b (the `voicelogger test <path>` launcher). `voicelogger test`
is a complete, tested, manually-verified feature:

- Deterministic project-type detection (`src/launch.ts`'s `detectProject()`), verified against
  the three real sibling repos: `ledger` → Tauri (`devUrl`/`beforeDevCommand` read exactly from
  `tauri.conf.json`), `ledger-cli` → Go CLI (binary name guessed from its `cmd/<name>/` layout),
  `bulwork` → Node with a *candidate list* (`dev`, `serve`, `start`), not a single guess — the
  survey that informed this found bulwork's own `"dev"` script is its CLI entry point, not its
  server (that's `"serve"`), which a naive "always run dev" rule would have gotten wrong in this
  very workspace.
- Launch-recipe cache at `~/.voicelogger/launch.json` (a *new* file, not an `apps.json`
  extension — keyed by absolute path, not an app name; see the plan doc's Phase 1b
  design-decisions block for why).
- Dev-server orchestration (`src/launchRun.ts`): probes a cached/known URL first (reuse instead
  of re-spawning), else trials Node candidates in priority order — a script that exits within a
  short grace window with no URL is a dud, tried past that grace window and it's a real failure.
  Spawned detached so it survives the recording process's own Ctrl-C (teardown decision: never
  torn down by voicelogger, regardless of who started it).
- `--prod [<link>]` (store-then-reuse), `--redetect` (bypass the cache).
- LLM-summarized launch/build failure handoff message (`src/launchError.ts`, Anthropic-only —
  a documented scope call, see the plan doc), with a no-key plain-output fallback.
- `commands/test.ts` calls `recordCommand(["--test-log", ...args])` **directly in-process**,
  not as a spawned subprocess — the same function 1a already built, not a re-implementation.
- Tests: `tests/launch.test.ts`, `tests/launchRun.test.ts` (13 tests, synthetic fixtures for the
  trial/reuse/redetect logic — a real bug surfaced during this pass and got fixed, see the plan
  doc). Manually verified end-to-end: `unknown` detection's error path (empty dir), and the full
  `go-cli` → `record --test-log` hand-off against the real `ledger-cli` repo (status/stop over
  the real `:7374` server, clean teardown, correct launch-cache persistence). Didn't spin up
  bulwork's real dev server for a full happy-path check — something unrelated already held its
  `:7373` port in this environment; the synthetic-fixture coverage already exercises the exact
  scenario that mattered (dud-then-winner candidate trial).

**The plan doc is the source of truth — read it before writing any code:**

- **`docs/TEST_LOG_PLAN.md`** — full design: locked decisions (don't re-litigate these without a
  reason — each one has a stated "why"), phase-by-phase checklist, backlog, open questions. It was
  written carefully to stand alone; if anything in it seems to assume context you don't have,
  that's a bug in the doc, not a gap you need to fill from memory of a prior session.

**Concrete next action — pick one, neither blocks the other:**

1. **Phase 1c** (browser extension): the real `:7374` server it needs has existed since 1a-ii
   and was re-verified against `test`'s hand-off in this pass. Still open: an actual manual QA
   pass with the extension loaded in a real browser against a live session — see Phase 1c's
   checklist in the plan doc, including the alarm-lag tradeoff worth confirming for real.
2. **Phase 2** (Ledger integration): **blocked** until decision #6's Firestore-writer mechanism
   is resolved (who writes the Firestore feature-note cache — still an open question, see the
   plan doc) — don't start Phase 2 UI work before that's real, per the plan's own gate.

**Not yet committed to git as of this note** — Phase 1b's files (`src/launch.ts`,
`src/launchRun.ts`, `src/launchError.ts`, `src/openUrl.ts`, `src/commands/test.ts`, their tests,
and the `cli.ts`/`index.ts` wiring) are on disk but uncommitted. If you're picking this up fresh
and `git status` looks dirty, check whether that's this — don't assume it's stray/unrelated work
without looking first.

## Things a fresh session needs to know that aren't obvious from this repo alone

- **Repo layout:** this repo lives at `~/Projects/ledger_root/voicelogger-cli`, a sibling of
  `ledger` (the GUI app), `ledger-cli` (Go CLI), `ledger-mcp` (MCP server), `bulwork` (focus
  enforcer, renamed from "brick" in July 2026 — the old name collided with an existing product),
  and `shield` (`~/Projects/ledger_root/shield` — a prompt-injection defense library several of
  these depend on via `file:../shield`). **None of these repos are in a monorepo** —
  each has its own independent GitHub remote, and `ledger_root` itself is not a git repo. A file
  placed at the `ledger_root` level (outside any of these) will never be picked up by `git push`
  from any of them — see `docs/TEST_LOG_PLAN.md` locked decision #5 for why that matters for the
  `extension/overlay.js` file specifically (it's a manual vendored copy of
  `../bulwork/extension/overlay.js`, not a shared import — if you change one, change the other by
  hand, per the note at the top of both files).
- **Port convention across this workspace:** bulwork's local service = `:7373`, voicelogger's
  (`src/testLogServer.ts`, live only during a `record --test-log` session) = `:7374`. Keep it
  that way.
- **A whole rename operation happened between this doc's first draft and now** (2026-07-10:
  `brick` → `bulwork`, unrelated to test-log — see the extension note above). `bulwork`, `ledger`,
  `shield`, and `ledger-cli` were clean, committed, and pushed as of that rename. `voicelogger-cli`
  is **not** in that state right now — see the "not yet committed" note above for exactly what's
  outstanding (Phase 1b, on disk but uncommitted) and the fact that Phase 1a's own commit hasn't
  been pushed to `origin` yet either. Don't assume a dirty `git status` here is a leftover from
  someone else's work without checking first.
- **`src/cleaner.ts` now integrates `@local/shield`** (prompt-injection scanning + wrapping on the
  cleanup LLM call) — a separate, already-completed piece of work, unrelated to test-log. Don't be
  surprised by shield imports there; nothing about it blocks or changes the test-log build.
- **A second, separate roadmap exists and is intentionally paused:** `ledger/docs/SHIELD_STATUS_PLAN.md`
  (a shield-status dashboard + scaffold feature for Ledger). Explicitly sequenced *after*
  test-log finishes, per the user's own call — don't start it just because it's designed and
  sitting there.
