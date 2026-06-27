# voicelogger — brainstorm / roadmap

Loose ideas for where `voicelogger-cli` goes next. Nothing here is committed; it's the
parking lot.

## Multi-app targets — `voicelogger --app <name>`

> **Status (2026-06-27): first cut shipped.** `voicelogger app add|list|push|rm` is
> implemented (registry at `~/.voicelogger/apps.json`, push copies raw+cleaned+index
> into `<app>/voicelogs/`). Decisions made in the first cut: a dedicated `app`
> subcommand instead of a global `--app` flag; push copies all three artifacts (not
> cleaned-only); copy not symlink; index paths rewritten to app-local. Still open:
> auto-push on `record`, the `--app <name>` selector at record time, per-app glossary,
> and using the per-app `bin` to route `link` notes. See SESSION_LOG.md.

The reason `voicelogger` is its own tool is that it should serve **more than one**
project (The Ledger today, RRG and others later). Generalize today's single `link`
bridge into named app targets.

**Sketch**

- `voicelogger --app ledger` vs `voicelogger --app rrg` selects a destination app.
- **First use of an app** prompts to configure the path to that app on disk, and saves
  it to a small config (e.g. `~/.voicelogger/apps.json`):

  ```jsonc
  {
    "ledger": { "path": "~/Projects/ledger_root/ledger", "bin": "~/Projects/ledger_root/ledger-cli/ledger" },
    "rrg":    { "path": "~/Projects/rrg" }
  }
  ```

- **Installing voicelogger into an app** creates a `voicelogs/` directory inside that
  app (so each app owns its logs alongside its code).
- When a session is **saved to an app**, voicelogger auto-pushes the files (`raw/` +
  `cleaned/` + the session index, or just the cleaned `.md`) into that app's
  `voicelogs/` dir — no manual copying.

**How it builds on what exists**

- The current `link` command + the `ledger.ts` bridge are the seed: `link` already
  attaches a session to a project and (for Ledger) drops a `ledger note`/`touch`. The
  `--app` idea generalizes the *destination* — file push for every app, plus the
  CLI/note bridge for apps that have one (like Ledger).
- `config.ts` already centralizes paths and is fully env-overridable; an `apps.json`
  registry slots in next to it. `LEDGER_BIN` becomes the per-app `bin` for ledger.

**Open questions**

- What exactly gets pushed — cleaned-only, or raw+cleaned+index?
- Copy vs. symlink vs. "the app's `voicelogs/` *is* this app's `VOICELOG_DIR`"?
- Per-app glossary/template overrides (RRG vs Ledger terminology)?
- Should `--app` also imply the project id for `link`, or stay orthogonal?

## Other ideas

- **Streaming partials** over a WebSocket for a live transcription view.
- **Network/device source** (`VoiceSource` for a wearable streaming PCM) — the
  abstraction is already in place; only a new source class is needed.
- **`voicelogger doctor`** — check ffmpeg / whisper-cli / model / `ledger` reachability
  in one shot (mirrors `ledger doctor`).
- **Auto-clean on stop** — optionally run the `clean` pass immediately after `record`.
- **Cross-platform mic capture** — _scaffolded (2026-06-27)._ Platform-derived
  `MIC_FORMAT`/`MIC_DEVICE` (avfoundation/alsa/dshow) with env overrides; macOS verified,
  Linux/Windows experimental. See [docs/CROSS_PLATFORM.md](docs/CROSS_PLATFORM.md) for the
  setup notes + the build-out checklist (auto-detect device, `devices` command, CI on Linux).
