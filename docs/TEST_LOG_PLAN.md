# Test-log mode — plan

**Status (2026-07-10):** design phase complete, then stress-tested with an independent
completeness pass before any real implementation started. The browser indicator extension
skeleton (`extension/`) exists and already had two real bugs found and fixed during that pass —
see [Phase 1c](#phase-1c--browser-visual-indicator). This doc is the source of truth for phasing
so we don't re-litigate decisions already made while building. See `BRAINSTORM.md` for the
original loose idea this grew out of, and **`../HANDOFF.md` for exactly where implementation
currently stands and the concrete next action** — check that first if you're picking this up
fresh.

## What this is

A dedicated recording mode for narrating observations while manually QA-testing a project —
distinct from plain `voicelogger record` — plus a companion launcher that opens the thing you're
testing, plus a thin Ledger UI surface on top. Full detail lives in this conversation's history;
this doc captures the decisions and the build order.

## Locked decisions

Don't re-litigate these without a reason — they were chosen deliberately, usually to avoid scope
creep or a premature abstraction. Two are marked **direction locked, mechanism open** — don't
treat those as fully settled.

1. **voicelogger-cli owns everything, including Ledger-specific behavior.** Ledger-tuned
   prompts/templates ship baked into VL by default (not an opt-in plugin), and Ledger's UI is a
   thin layer that calls into capabilities VL already exposes. This is *why* VL ships before the
   Ledger integration — Ledger has nothing of its own to build until VL exists. **Implication
   surfaced by the completeness pass:** "thin layer calling into VL" requires VL to actually
   expose start/stop-with-metadata, not just status — see Phase 1a's control-surface item below,
   which was missing from the original draft of this doc.
2. **No real speaker diarization in v1.** whisper.cpp's local `base.en` model doesn't support it.
   `--user <name>` is prompt metadata only — the cleanup LLM does best-effort speaker attribution
   from context. **Seam to leave now:** the existing `TranscriptSegment` type
   (`src/types.ts`) gets an optional, nullable `speaker` field. That part is genuinely small since
   the segment type already exists — but wiring it through meaningfully (cleaner prompt, `show`
   rendering) still touches more than one file; don't treat it as a one-line change.
3. **Browser visual indicator: VL ships its own minimal extension**, vendoring a copy of bulwork's
   `overlay.js` primitive rather than sharing a package — see that file's header comment in both
   repos for why (ledger_root isn't a monorepo; bulwork and voicelogger-cli are independently
   pushed GitHub repos). Local status port convention: **bulwork = `:7373`, voicelogger = `:7374`**,
   and the port is **not user-configurable in v1** — the extension hardcodes it, and making it
   configurable later would break that without a matching extension update.
4. **Desktop-app visual indicator is deferred.** Menu-bar icon only, lower priority, not designed
   yet — revisit once browser-based testing (the common case) is working end to end.
5. **Shared code across bulwork/voicelogger-cli is vendored, not packaged.** No git submodule, no
   subtree, no npm package yet. **Caveat found during the completeness pass:** voicelogger-cli's
   `package.json` already has `"@local/shield": "file:../../shield"` — a dependency on a sibling
   repo (`~/Projects/shield`) outside `ledger_root` entirely. So the "protects VL's clean-clone
   onboarding" argument against a submodule was somewhat overstated — that onboarding story
   already has a pre-existing gap, unrelated to this feature. The vendoring decision still stands
   on its own (lowest ceremony for one rarely-changing file), just noting the supporting argument
   was weaker than presented. Not fixing the `shield` dependency now — out of scope.
6. **Feature-note history: direction locked, mechanism open.** VL-local index is canonical,
   Ledger's Firestore copy is a derived cache. **What's still unresolved:** which command actually
   writes to Firestore. Today's `app push` only copies markdown files into `<path>/voicelogs/` —
   it never touches Firestore. Something (Ledger itself reading VL's local index? a new `ledger-cli`
   command? an extension to `link`?) has to own that write path, and nothing owns it yet. Resolve
   this before Phase 2, not during it.
7. **The `test <path>` launcher owns its own deterministic project-type detection** (read
   `package.json` scripts, look for `tauri.conf.json`, etc.) — it must not hard-depend on any
   coding agent being present (e.g. this environment's `run` skill), since `voicelogger test`
   should work standalone, outside of an agent session. Agent-assisted discovery can be an
   optional enhancement layered on top, never the load-bearing path.

## Phasing

### Phase 1a — test-log recording pipeline (voicelogger-cli core)

No OS-level UI, no launcher dependency — ships first, useful standalone. **Two genuinely
different-sized deliverables — don't treat this as one lump:**

**1a-i (small): mode + prompt**
- [x] decide the mode's naming *before* starting (`test-log` subcommand vs. `record --test-log`
      flag) — this is a precursor decision, not a TBD to leave dangling mid-implementation.
      **Decided: `record --test-log` flag**, not a subcommand. The mode reuses the entire
      existing recording pipeline (mic capture, SIGINT handling, auto-clean, `--app` push) —
      a subcommand would duplicate most of `record.ts` just to vary the cleaner prompt and add
      metadata. `record` already has flag-driven variants (`--clean <mode>`, `--project`,
      `--app`); `--test-log` + `--user <name>` fit that pattern.
- [x] cleaner prompt variant: heavier project context, tolerance for large silence gaps,
      multi-speaker awareness
- [x] `--user <name>` flag (default speaker "dev") — metadata only, see decision #2. **Scope
      note:** since session-index storage changes are 1a-ii's job, `--test-log`/`--user` are
      read straight from `record`'s own `args` and passed directly into the same-process
      auto-clean call — they don't yet survive to a later `voicelogger clean <session>` run.
      That's fine for now (recording auto-cleans by default) but 1a-ii's schema/storage work
      should persist them onto the session so a deferred `clean` still gets the right variant.

**1a-ii (cross-cutting, bigger than it looks): storage + control surface + server — done
2026-07-10/11**
- [x] add optional `speaker` field to `TranscriptSegment`; version the session-index schema so
      existing `sessions/*.json` files without the field don't break `list`/`show`/`clean`.
      **No `schemaVersion` counter added** — the new fields (`speaker` on `TranscriptSegment`;
      `testLog`/`speaker`/`title`/`scope`/`featureNote` on `VoiceLogSession`) are all optional
      and nothing reads them unconditionally, so old files parse as-is (`JSON.parse` + optional
      fields = free backward compat). Verified with a regression test (`tests/store.test.ts`)
      using a hand-written legacy-shaped session file. A version counter would be overkill for a
      purely-additive change — add one later if a field ever needs a *breaking* reshape.
- [x] **VL→Ledger / VL→launcher control surface — resolved as a hybrid, not pure REST or pure
      CLI-invocation:** starting a session is a **CLI invocation** — `voicelogger record
      --test-log [--project] [--user] [--title] [--scope] [--feature]` — run directly by a
      human, or spawned by the future launcher/Ledger; there's no `POST /start`, because before
      a session exists there's no process to receive one. Stopping and status are **HTTP**, on
      the local server below, because a caller outside this process (Ledger, the extension) may
      not hold this process's stdin/PID. See `src/testLogServer.ts`.
- [x] a feature-note field on session metadata, captured at the source (`--feature <note>`,
      stored as `VoiceLogSession.featureNote`), so Ledger's future "Feature" dropdown (Phase 2)
      has real data to read from day one. `--scope` (`full`/`feature`) came along with it since
      Ledger's modal pairs the two; an explicit `--feature` with no `--scope` infers `"feature"`
      rather than defaulting to `"full"`.
- [x] local status server on `:7374` — `GET /status` → `{ active, sessionId, startedAt,
      projectId?, title?, scope?, speaker?, featureNote? }` (`active` is derived from
      `session.status === "recording"`, not a separately-tracked flag) plus `POST /stop`
      (fire-and-forget graceful stop, same code path as Enter/Ctrl-C — responds immediately,
      auto-clean proceeds in the background exactly like the interactive flow). **Owned by the
      `record --test-log` process itself, not the launcher** — starts before the mic does (see
      next item), lives only for that one session, whether invoked directly or via the future
      launcher. Auth: requires an `X-Voicelogger-Client` header on every request, mirroring
      bulwork's `X-Bulwork-Client` (a localhost port is reachable by any web page). Updated
      `extension/background.js` to send it.
- [x] server lifecycle edge cases:
      - **Port already in use** → bound *before* `recorder.start()`, so a busy `:7374` fails fast
        with a clear message and never touches the mic. Verified manually (occupied :7374, ran
        `record --test-log`, confirmed it errored before "mic initializing…").
      - **Second session while one's running** → same mechanism as above: starting a session
        *is* claiming the port, so a second `record --test-log` simply can't bind it. No
        separate "is one already running" check needed.
      - **Stale server after a crash** → not possible by construction: the server lives inside
        the recording process, so the OS reclaims the port the instant that process exits or is
        killed, for any reason. No PID file, no separate liveness/heartbeat logic.
- [x] tests: `tests/testLogServer.test.ts` (auth header, `/status` shape, `active` semantics,
      `/stop`, EADDRINUSE), `tests/session.test.ts` (metadata captured at construction),
      `tests/store.test.ts` (legacy-file regression). Verified end-to-end manually too: a real
      `record --test-log` session, `curl`'d `/status` and `/stop` against the real port, watched
      it tear down cleanly (raw file + session index written correctly, port freed, process
      exited).

### Phase 1b — `voicelogger test <path>` launcher

Builds on 1a (calls into its recording start/stop + status server — does not duplicate them).
Doesn't need Ledger.

- [ ] deterministic project-type detection (package.json scripts, `tauri.conf.json` presence, etc.)
- [ ] launch-recipe cache — extend `apps.json` (or a new file) with something like
      `launch: { dev: { cmd, cwd, detectedAt }, prod: { url, setAt } }`
- [ ] `--prod <link>` stores directly on first use; subsequent `--prod` alone reuses the cached link
- [ ] check whether a dev server is already running for the project before starting a new one;
      wait for readiness before opening the URL, not just "process spawned"
- [ ] teardown: what happens to the launched dev server when the test-log session ends — left
      running, or torn down too? (not decided yet — add to open questions if not resolved during
      1b)
- [ ] on launch/build error: capture stderr/stdout, LLM-summarize, produce a copy-pasteable
      handoff message for another agent session. **Explicitly not doing codebase-aware fix
      suggestions in v1** — that's a heavier capability that duplicates whatever coding-agent
      session is already active on the project. Needs a no-API-key fallback (plain error, no
      summarization) matching how plain `record`'s cleanup already degrades without a key.
- [ ] opens the resulting URL and starts Phase 1a's recording simultaneously
- [ ] tests: detection heuristics against a few real project shapes in this workspace (ledger,
      ledger-cli, bulwork), cache read/write, error-capture path

### Phase 1c — browser visual indicator

- [x] extension skeleton: `manifest.json`, `background.js` (polls `:7374/status`),
      `content-guard.js`, vendored `overlay.js` — see `extension/README.md`
- [x] **found and fixed during the completeness pass, before any server existed to test against:**
      (a) tab-switch bug — `background.js` gated every message on "did the global active flag
      change," so activating a *new* tab during an already-active session never told that tab to
      show the border; (b) a stale comment claiming the launcher (1b) serves `:7374/status` when
      the plan actually assigns that to 1a
- [x] **re-vendored after an unrelated rename** (2026-07-10): the sibling `brick` repo this
      overlay primitive is vendored from was renamed to `bulwork` (name collision with an existing
      product, nothing to do with test-log). `overlay.js` was re-copied from bulwork's renamed
      source (now `window.BulworkOverlay`, with the vendoring-rationale header updated to match),
      and `background.js`/`content-guard.js` were updated to call it directly. No behavior change
      for test-log — same skeleton, same dependency on the not-yet-built `:7374/status` endpoint,
      just current names. If you're diffing against an older version of this repo and see
      `BulworkOverlay` where you expected `BrickOverlay`, that's why.
- [ ] **unblocked as of 1a-ii** (2026-07-11): the real `:7374` server now exists and was manually
      verified against `curl`. `background.js` was updated to send the now-required
      `X-Voicelogger-Client` header (a small, in-scope fix caused directly by 1a-ii's auth
      design — not itself "wiring up for real"). Still not done: an actual manual QA pass with
      the extension loaded in a real browser against a real `record --test-log` session. Not
      literally "zero changes" as originally claimed here — expect to actually exercise (and
      likely adjust) the polling logic against a real server, especially the ~60s alarm-driven
      lag on session start. Keeping poll-based (not switching to a pushed
      `chrome.runtime.connect` port) for v1 is a judgment
      call worth revisiting once this is used for real: annoying lag at session *start* is
      probably tolerable for QA narration (you're not reacting in real time to the border itself),
      but say so explicitly rather than assuming it's fine.
- [ ] real icon set (currently omitted from manifest)
- [ ] manual QA checklist once wired up (start session → border appears within alarm lag → switch
      tabs → border follows → end session → border clears → kill server mid-session → border
      doesn't get stuck)

### Phase 2 — Ledger integration

Starts only after Phase 1 ships and is actually being used — see decision #1 for why Ledger has
nothing to build before VL exists. **Blocked on resolving decision #6's Firestore-writer mechanism
and Phase 1a's control-surface shape** — don't start Phase 2 UI work until those are real.

- [ ] "Test" action on the project card → modal
- [ ] modal fields: speaker (dev/user, default dev), auto-filled date/time, title/subtitle, scope
      toggle (Full Scan / Feature)
- [ ] Feature scope: dropdown of past feature-notes for the project, most-recent-first, typeahead
      search, free text for a new one
- [ ] lives on the full ProjectPage, not just the compact card
- [ ] Firestore-backed feature-note cache, synced from VL's local index — **mechanism TBD, see
      decision #6**

### Backlog — explicitly deferred, not scheduled

- Desktop-app visual indicator (menu-bar icon)
- Codebase-aware fix suggestions in the launcher's error path
- Real speaker diarization
- Promoting vendored `overlay.js` to a real shared package
- Fixing voicelogger-cli's pre-existing `@local/shield` sibling-repo dependency (unrelated to this
  feature, surfaced as a side note during the completeness pass)

## Open questions for when we get to Phase 1b/2

- Exact launch-recipe schema and where it lives (`apps.json` extension vs. a new file)
- Exact shape of the "handoff message for another agent" the launcher produces on error
- Whether the launcher tears down the dev server it started when the test-log session ends
- **Who writes the Firestore feature-note cache** (decision #6) — Ledger reading VL's local index
  directly, a new `ledger-cli` command, or an extension to `link`
- ~~Exact shape of the VL→Ledger/launcher control surface~~ — **resolved in Phase 1a-ii:** start
  is CLI-invocation, stop/status is HTTP on `:7374`. See `src/testLogServer.ts`.
