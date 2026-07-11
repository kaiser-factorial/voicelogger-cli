# voicelogger-cli — handoff

**What this is:** local mic → whisper.cpp → LLM-clean voice logger. Full command reference in
`README.md`; chronological build log in `SESSION_LOG.md`.

---

## ▶ Next up — Test-log mode, finish Phase 1c (needs YOU) or start Phase 2

**Where we are (2026-07-11):** Phase 1a and 1b are fully done and committed. Phase 1c (the
browser extension) is as far as it can go **without a human** — read the next section before
doing anything else here.

### Phase 1c is blocked on a step only you can do

Loading an unpacked extension requires clicking "Load unpacked" in `chrome://extensions` and
then picking the `extension/` directory in a native OS file dialog. That page is blocked from
browser automation entirely — confirmed against both the sandboxed preview browser and a real
connected Chrome in this session. This is almost certainly deliberate: an agent silently
installing a content-script extension that runs on every `http`/`https` page you visit, into
your real browser, without you doing it yourself, is exactly the kind of thing that shouldn't
happen without a human's hands on it.

**What's already done, so this should be quick once you're at the keyboard:**
- The real `:7374` server, the extension skeleton, and the required auth header are all built
  and verified — including a check that plain `curl` testing never exercised: a real CORS
  preflight (`OPTIONS` + `Origin: chrome-extension://…`) followed by the actual `GET`, both
  against a live `record --test-log` session, came back correct. `background.js`'s `fetchActive()`
  sends exactly that shape, so it should work against a real installed extension.
- A real icon set now exists (`extension/icons/`) — a small dark square with a yellow border
  ring, matching the on-page indicator's own color.

**To finish Phase 1c yourself:**
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   `voicelogger-cli/extension/`.
2. Run through the manual QA checklist in `docs/TEST_LOG_PLAN.md`'s Phase 1c section: start a
   `record --test-log` session → border appears within ~60s (the `chrome.alarms` floor) →
   switch tabs → border follows the newly-active tab → end the session → border clears → kill
   the server mid-session (Ctrl-C the `record` process, or `kill -9` it) → border doesn't get
   stuck showing "active."
3. Come back and tell me what you saw — if something's off (the ~60s alarm lag is a known,
   explicitly-flagged-as-revisitable tradeoff; anything else is worth a closer look), I can dig
   into `background.js`/`content-guard.js`/`overlay.js` from there. I can't watch it happen, but
   I can fix whatever you report.

### What's done in Phase 1 (1a-i, 1a-ii, 1b)

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

**If Phase 1c's manual QA is genuinely not happening right now** (no one's at a browser),
**Phase 2** (Ledger integration) is the other option — but it's **blocked** until decision #6's
Firestore-writer mechanism is resolved (who writes the Firestore feature-note cache — still an
open question, see the plan doc) — don't start Phase 2 UI work before that's real, per the
plan's own gate. In practice that leaves Phase 1c's manual step as the only unblocked, ready-to-
run next action.

**Committed as of this note:** Phase 1a and 1b are both committed to git (not yet pushed to
`origin` — check before assuming they are). The icon set and this doc's own updates for Phase 1c
are the only things possibly still uncommitted — check `git status` if picking this up fresh.

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
