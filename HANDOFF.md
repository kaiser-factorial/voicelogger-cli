# voicelogger-cli — handoff

**What this is:** local mic → whisper.cpp → LLM-clean voice logger. Full command reference in
`README.md`; chronological build log in `SESSION_LOG.md`.

---

## ▶ Next up — Test-log mode, Phase 1b

**Where we are (2026-07-10):** Phase 1a is fully done — both 1a-i (mode + prompt) and 1a-ii
(storage + control surface + server). `record --test-log` (a flag, not a subcommand — see the
naming rationale in `docs/TEST_LOG_PLAN.md`'s Phase 1a-i checklist) is a complete, tested,
manually-verified feature:

- QA-narration cleaner variant (`cleaning/test-log-template.md`), heavier project context
  (`mem.ts`'s `queryProjectContext` takes a `limit`; test-log passes 8 vs. the default 3),
  silence-gap tolerance, `--user <name>` (default `dev`) for best-effort speaker attribution —
  metadata only, no diarization, per locked decision #2.
- `--title`/`--scope`/`--feature` flags; all test-log metadata (`testLog`, `speaker`, `title`,
  `scope`, `featureNote`) is captured at the source onto `VoiceLogSession` (`session.ts`) — the
  **1a-i scope gap is closed**: `voicelogger clean <session>` run later now picks the right
  variant too, since `cleanSession.ts`'s `runClean` reads it straight from the session, no
  separate opts param.
- The `:7374` control server (`src/testLogServer.ts`): `GET /status`, `POST /stop`, required
  `X-Voicelogger-Client` auth header (mirrors bulwork's `X-Bulwork-Client`). Bound *before* the
  mic starts, so a port conflict fails fast without ever touching audio — this doubles as the
  "second session already running" check, since starting a session IS claiming the port. A
  crash can't leave a stale server: it lives inside the recording process, so the OS reclaims
  the port the instant that process is gone, no PID file needed.
- `extension/background.js` updated to send the new required header (small, necessary fix — not
  Phase 1c's actual "wire up for real" pass, which is still open).
- Tests: `tests/testLogServer.test.ts`, `tests/session.test.ts`, `tests/cleaner.test.ts`,
  `tests/store.test.ts` (legacy-file regression). Plus a manual end-to-end pass: real mic
  recording, `curl`'d `/status` and `/stop` against the live port, confirmed clean teardown.

**The plan doc is the source of truth — read it before writing any code:**

- **`docs/TEST_LOG_PLAN.md`** — full design: locked decisions (don't re-litigate these without a
  reason — each one has a stated "why"), phase-by-phase checklist, backlog, open questions. It was
  written carefully to stand alone; if anything in it seems to assume context you don't have,
  that's a bug in the doc, not a gap you need to fill from memory of a prior session.

**Concrete next action:** start Phase 1b, the `voicelogger test <path>` launcher (see the plan
doc's phasing section) — deterministic project-type detection (no hard dependency on a coding
agent being present, per locked decision #7), a launch-recipe cache extending `apps.json` (exact
schema is an open question, resolve before/during 1b), dev-server readiness checking before
opening the URL, and an LLM-summarized error/handoff path on launch failure (explicitly *not*
codebase-aware fix suggestions — see the backlog). The launcher spawns `record --test-log`
itself rather than reimplementing recording — Phase 1a already owns start/stop/status.

**Phase 1c (browser extension) is unblocked but not done:** the real server it needs now exists
and was manually verified; still open is an actual manual QA pass with the extension loaded in a
real browser against a live session (see Phase 1c's checklist in the plan doc for what that
covers, including the alarm-lag tradeoff). Pick this up whenever it's convenient — it doesn't
block Phase 1b, and Phase 1b doesn't block it either.

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
  `brick` → `bulwork`, unrelated to test-log — see the extension note above). All five repos in
  this workspace (`bulwork`, `ledger`, `voicelogger-cli`, `shield`, `ledger-cli`) are clean,
  committed, and pushed as of this writing — builds and test suites pass in all of them. If you
  run `git status` and see something dirty, that's new since this note, not a leftover.
- **`src/cleaner.ts` now integrates `@local/shield`** (prompt-injection scanning + wrapping on the
  cleanup LLM call) — a separate, already-completed piece of work, unrelated to test-log. Don't be
  surprised by shield imports there; nothing about it blocks or changes the test-log build.
- **A second, separate roadmap exists and is intentionally paused:** `ledger/docs/SHIELD_STATUS_PLAN.md`
  (a shield-status dashboard + scaffold feature for Ledger). Explicitly sequenced *after*
  test-log finishes, per the user's own call — don't start it just because it's designed and
  sitting there.
