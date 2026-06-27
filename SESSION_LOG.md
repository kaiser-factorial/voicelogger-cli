# voicelogger-cli — session log

Running log of autonomous work under `/goal` (started 2026-06-27): *continue building
the project as far as possible without intervention; follow the phase plan; if blocked,
take a sensible new direction but **log divergences**; use placeholders for vars that
don't work yet.* Divergences are flagged **⚠ DIVERGENCE**.

## Starting point (2026-06-27)

Phases already complete (committed):
- Standalone, installable `voicelogger-cli` (bin, build, library exports, README, LICENSE).
- Edge-case bug fixes from an adversarial review + unit tests + GitHub Actions CI.
- Auto-clean on `record` (auto/prompt/off) + styled inline markdown rendering.
- `voicelogger config` wizard (hidden input, per-machine `~/.voicelogger/config.json`,
  0600) + inline nudge from `record` when no key is set.

Roadmap to pull from (`BRAINSTORM.md`): `--app` multi-app targets, `voicelogger doctor`,
streaming partials, network/device `VoiceSource`, cross-platform mic capture.

What needs the user (cannot be done autonomously here):
- Live mic / API-key / TTY testing (`record`, the hidden prompt) — needs their machine.
- `--app` semantics decision: copy vs symlink, and exactly what gets pushed.
- This environment has **no `ANTHROPIC_API_KEY`, no mic, no TTY** → those paths are
  verified by construction + unit tests, not live runs.

## Work

### 1. `voicelogger doctor` (roadmap item) — DONE
One-shot environment check: Node ≥ 20, ffmpeg, whisper.cpp, the model (required for
recording), plus the Anthropic key and ledger CLI (optional). Exits non-zero only if a
required check fails, so it's CI/script-friendly. New `src/commands/doctor.ts` (with a
pure, unit-tested `doctorExitCode`); wired into `cli.ts` + help. Verified live here —
ffmpeg/whisper/model ✓, key/ledger shown as optional `—`, exit 0.

### 2. `voicelogger list --json` (machine-readable output) — DONE
`list` now accepts `--json`, printing the raw `VoiceLogSession[]` (empty → `[]`) for
scripting and the eventual ledger/`--app` integration. Human format unchanged. Verified
live against a temp data dir. (`listCommand` now takes `args`; `cli.ts` passes `rest`.)

### 3. `--app` multi-app routing (roadmap item) — FIRST CUT DONE
`voicelogger app add|list|push|rm`: registry at `~/.voicelogger/apps.json` (`src/apps.ts`),
`app add <name> <path>` registers + creates `<path>/voicelogs/`, `app push <session> <name>`
copies the session's logs into it. Registry unit-tested; add→push→rm verified live.

**⚠ DIVERGENCES / decisions (BRAINSTORM left these open — chose defaults):**
- Built a dedicated `app <subcommand>` group **instead of the literal global
  `voicelogger --app ledger` flag**. Cleaner first cut, composable, and avoids a global
  flag whose meaning depends on the command. The `--app` selector at record time is a
  follow-up that can sit on top of this registry.
- `push` copies **raw + cleaned + index** (not cleaned-only) — most useful; the app gets
  the full record.
- **Copy, not symlink** — the app owns its data even if `~/Projects/voice_logs` moves.
- Rewrote the pushed index's `rawPath`/`cleanedPath` to the **app-local** copies so each
  app's `voicelogs/` is self-contained.
- `AppEntry.bin` (per-app companion CLI, e.g. ledger) is a **PLACEHOLDER** — recorded but
  not used yet.

### 4. `record --app <name>` (auto-push on record) — DONE
Extracted the push into a shared `src/appPush.ts` (`pushSessionToApp`), reused by both
`app push` and `record`. `record --app <name>` records → cleans → copies the finished
session into `<app>/voicelogs/`. Push failures warn but never crash the recording.
`pushSessionToApp` is unit-tested directly (raw+cleaned and raw-only cases), which also
covers the `record --app` core. Default: pushes all three artifacts after cleanup (same
decision as `app push`).

**Deferred (need a quick decision or are bigger):**
- Routing `link` notes through the per-app `bin` (placeholder field exists).
- Per-app glossary/template overrides.
- Streaming partials, network/device `VoiceSource`, cross-platform mic — these need
  infra/devices/other OSes I can't build+test here, so left for when that context exists.

### 5. Friendly names for cleaned files (user request, 2026-06-27) — DONE
User asked: name the cleaned recording like `test_with_music_27June2026` instead of the
timestamp id. Implemented:
- `cleaner.ts`: added a `title` field to the structured output (3–6 plain words). SDK call
  shape unchanged (still `messages.parse` + `output_config.format` + `parsed_output`).
- `slug.ts` (new, unit-tested): `slugify` (ASCII, underscores, diacritics folded) +
  `dateStamp` (`27June2026`, local date) + `cleanedBaseName`.
- `cleanSession.ts`: cleaned file is now `cleaned/<title>_<date>.md`; the H1 is the title and
  the session id moved into metadata. First clean assigns the name (collisions bump `-2`…);
  re-clean keeps the existing file. Raw + session id keep the sortable timestamp.
- `appPush.ts`: copies preserve each file's own name, so the friendly cleaned name carries
  into an app's `voicelogs/`. (Tests updated.)
Verified: slug/dateStamp unit tests, the new cleaned-header renders correctly via `show`,
full build + 56 tests + smoke green. (Live LLM title needs a key — verified the naming
mechanics deterministically; the title itself is produced at clean time on the user's machine.)

### 6. Cross-platform mic scaffold (user request, 2026-06-27) — DONE
User asked for *structure + notes* (not a full build-out) so a tech-savvy user on another OS
can get going, and a future agent can finish it.
- `src/platform.ts` (new, unit-tested): `micDefaults(platform)` → ffmpeg `-f`/`-i` defaults
  per OS (macOS avfoundation/:0 verified; Linux alsa/default and Windows dshow experimental)
  + a `supported` flag and a setup `note`. Has a `TODO(cross-platform)` pointing to the doc.
- `config.ts`: `micFormat` (new) + `micDevice` are now platform-derived, overridable via
  `MIC_FORMAT`/`MIC_DEVICE`. **macOS unchanged** (still avfoundation/:0 — verified no regression).
- `LaptopMicSource`: uses `config.micFormat` instead of hardcoded avfoundation; comment generalized.
- `doctor`: new info line shows the effective `-f <fmt> -i <dev>` and flags experimental platforms.
- `docs/CROSS_PLATFORM.md` (new): Linux/Windows setup (device listing, env vars, examples) +
  a build-out checklist (auto-detect device, `voicelogger devices`, verify on each OS, CI matrix).
Verified: 61 tests (5 new platform tests), build, doctor mic line, env override + macOS default.
Did NOT actually test Linux/Windows capture (no such machines here) — that's the documented
next step; defaults there are best-guess standard ffmpeg inputs, clearly marked experimental.

## Status / what's committed
6 autonomous commits this session: `doctor`, `list --json`, `app` (+ the 3 prior feature
commits). All local on `main`, ahead of `origin/main`. typecheck + build + 49 tests + the
whisper smoke all green.

## Needs the user
- **Push the branch** (`git push`) when ready — CI then runs on GitHub.
- **Live testing** with a real mic + API key + terminal (see the testing checklist I gave
  in chat): `record` end-to-end, the hidden `config` prompt, the no-key nudge.
- **Decisions** to unblock the deferred `--app` items: should `record --app <name>`
  auto-push after cleanup? push cleaned-only or all three? These are quick calls.
