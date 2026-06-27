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

### 2. `voicelogger list --json` (machine-readable output)
_in progress_
