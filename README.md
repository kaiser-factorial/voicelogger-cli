# voicelogger-cli

Record from your mic, get a clean note back.

`voicelogger` transcribes locally with **whisper.cpp** and (optionally) cleans the result
with an LLM — removing disfluencies, fixing domain terms, organizing the content. The raw
transcript is always saved; nothing is uploaded except the optional cleanup pass.

```
mic ──▶ whisper.cpp ──▶ raw/<id>.md ──(clean)──▶ cleaned/<friendly-name>.md
```

---

## Getting started

Follow these steps once, then you're set.

### 1. Install voicelogger

You'll need **Node 20+** — check with `node --version`, or grab it at [nodejs.org](https://nodejs.org).

```bash
git clone https://github.com/kaiser-factorial/voicelogger-cli.git ~/voicelogger-cli
cd ~/voicelogger-cli
npm install --omit=dev
npm link
```

This puts the `voicelogger` command on your PATH.

### 2. Install ffmpeg and whisper.cpp

**macOS (Homebrew):**

```bash
brew install ffmpeg whisper-cpp
```

`ffmpeg` captures the mic; `whisper-cpp` runs transcription locally on your machine.

> Linux / Windows: mic capture is experimental — see [docs/CROSS_PLATFORM.md](docs/CROSS_PLATFORM.md).

### 3. Download the Whisper model

```bash
voicelogger download-model
```

Fetches the `base.en` model (~141 MB) to `~/.voicelogger/models/`. One-time, takes about
30 seconds.

### 4. Choose your LLM provider *(optional — for cleanup)*

```bash
voicelogger config
```

The wizard walks you through four steps:

1. **Where to save logs** — defaults to `~/voicelogger/`, press Enter to keep it
2. **LLM provider** — choose one:
   - **Anthropic** — best quality; needs an [API key](https://console.anthropic.com/settings/keys)
   - **OpenRouter** — free models available; needs a [free key](https://openrouter.ai/keys)
   - **Ollama** — runs entirely on your machine, no key, no internet
3. **API key** — entered hidden, stored at `~/.voicelogger/config.json` with owner-only permissions (skipped for Ollama)
4. **Model** — pick from a live list for your chosen provider

Skip the whole step if you only want raw transcripts — voicelogger works without a key, it just won't auto-clean.

### 5. Check everything is ready

```bash
voicelogger doctor
```

All green? You're good to go. If anything is missing it tells you exactly what to install.

### 6. Record something

```bash
voicelogger record
```

You'll see:

```
▶ starting — session 20260627-143201
  raw:     ~/voicelogger/raw/20260627-143201.md
  mic:     macOS default
  project: (unlinked)

□  wait — mic initializing…

● Speak now. Press Enter (or Ctrl-C) to stop.
```

Speak until you're done, then press **Enter**. The transcript is cleaned and printed right
in the terminal. Your logs live in `~/voicelogger/` by default.

> **macOS:** you'll see a mic-permission prompt the first time. Allow it.

---

## Usage

```bash
voicelogger                              # show this menu
voicelogger doctor                       # check all dependencies + config

# Recording
voicelogger record                       # record → auto-clean → print
voicelogger record --no-clean            # keep raw only
voicelogger record --clean prompt        # ask before cleaning
voicelogger record --project myproject   # tag the session with a project id
voicelogger record --app myapp           # record + copy into a registered app dir

# Browsing
voicelogger list                         # all sessions, newest first
voicelogger list --json                  # machine-readable
voicelogger show latest                  # print the latest (cleaned if present)
voicelogger show latest --raw            # force raw transcript
voicelogger show latest --plain          # no ANSI styling

# Cleaning
voicelogger clean latest                 # LLM-clean the latest raw transcript

# Organizing
voicelogger link latest myproject        # tag latest with a project id
voicelogger app add myapp ~/Projects/myapp   # register a project dir
voicelogger app push latest myapp            # copy session into that dir's voicelogs/
voicelogger app list / app rm myapp

# Setup
voicelogger config                           # run the setup wizard
voicelogger config show                      # print current config (keys masked)
voicelogger config endpoint openrouter       # switch to OpenRouter (prompts for key)
voicelogger config endpoint ollama           # switch to Ollama (no key needed)
voicelogger config endpoint default          # switch back to Anthropic
voicelogger config model <name>              # set the cleanup model
voicelogger config dir <path>                # set where logs save ('default' to reset)
voicelogger download-model                   # fetch the Whisper model
voicelogger version
```

A `<session>` argument can be a full id, a unique id prefix, or `latest`.

---

## Cleanup — the edited note

After each recording, voicelogger runs the transcript through an LLM to produce a
**cleaned note** — disfluencies removed, domain terms corrected via the shared glossary,
content organized per template. Both files are always kept:

- `raw/<id>.md` — the untouched transcript, never overwritten
- `cleaned/<friendly-name>_<date>.md` — the edited version (e.g. `planning_call_27June2026.md`)

The cleaned file is printed styled in the terminal right when the recording finishes.

**Control when cleanup runs:**

| | |
|---|---|
| Default (`auto`) | cleans automatically on finish |
| `voicelogger record --clean prompt` | asks `Clean this recording now? [Y/n]` each time |
| `voicelogger record --no-clean` | skips cleanup; raw only |
| `VOICELOGGER_AUTOCLEAN=off` | skip by default (override per-recording with `--clean`) |

No LLM configured? voicelogger keeps the raw transcript and tells you how to clean it later.

**LLM provider options:**

| Provider | Quality | Cost | Setup |
|---|---|---|---|
| Anthropic (default) | Best | Pay-per-token | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| OpenRouter | Good | Free tier available | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Ollama | Good | Free, local | `brew install ollama && ollama pull llama3.2` |

Switch provider any time:

```bash
voicelogger config endpoint openrouter   # prompts for key + model
voicelogger config endpoint ollama
voicelogger config endpoint default      # back to Anthropic
```

**Change the cleanup model:**

```bash
voicelogger config model claude-haiku-4-5    # faster and cheaper (Anthropic)
voicelogger config model llama3.2            # if using Ollama
voicelogger config model default             # reset to claude-sonnet-4-6
```

---

## Customize your logs directory

By default logs go to `~/voicelogger/`. Change it:

```bash
voicelogger config dir ~/Documents/voice-notes
voicelogger config dir default    # reset
```

Or set `VOICELOG_DIR` in your environment.

---

## Push logs into project folders

Register a project directory once; then `record --app` automatically copies the
finished session into it:

```bash
voicelogger app add myapp ~/Projects/myapp   # creates ~/Projects/myapp/voicelogs/
voicelogger record --app myapp               # record → clean → copy into myapp/voicelogs/
voicelogger app push latest myapp            # or push an existing session manually
```

Each app gets a self-contained `voicelogs/` with the raw transcript, cleaned note, and
session index — fully portable, no symlinks.

---

## Configuration reference

All settings are optional; the defaults work out of the box on macOS.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic key for the cleanup pass |
| `LLM_BASE_URL` | — | OpenAI-compatible endpoint (e.g. `https://openrouter.ai/api/v1`) |
| `LLM_API_KEY` | — | API key for the above endpoint |
| `LLM_MODEL` | `claude-sonnet-4-6` | model name for cleanup (works for any provider) |
| `VOICELOG_DIR` | `~/voicelogger` | where `raw/`, `cleaned/`, `sessions/` live |
| `VOICELOGGER_HOME` | `~/.voicelogger` | per-user home for the model + config |
| `VOICELOGGER_AUTOCLEAN` | `auto` | `auto` \| `prompt` \| `off` |
| `WHISPER_MODEL` | `~/.voicelogger/models/ggml-base.en.bin` | model path |
| `WHISPER_BIN` | `whisper-cli` | whisper.cpp binary |
| `WHISPER_THREADS` | `4` | threads for transcription |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg binary |
| `MIC_FORMAT` | `avfoundation` (macOS) | ffmpeg input format — see [cross-platform notes](docs/CROSS_PLATFORM.md) |
| `MIC_DEVICE` | `:0` (macOS) | ffmpeg input device |
| `LEDGER_BIN` | — (off) | optional project-tracker CLI for `link` |

---

## For developers

**From source:**

```bash
git clone https://github.com/kaiser-factorial/voicelogger-cli.git
cd voicelogger-cli
npm install
npm run dev -- record          # run via tsx (no build step)
npm run build                  # compile to dist/
npm test                       # run unit tests
```

**Run the smoke test** (no mic required):

```bash
say -o /tmp/vl_test.aiff "the voicelogger pipeline is now working end to end"
ffmpeg -y -i /tmp/vl_test.aiff -ac 1 -ar 16000 -f wav /tmp/vl_test.wav
npm run smoke -- /tmp/vl_test.wav
```

**Architecture:**

```
src/
  cli.ts              command dispatch + help
  config.ts           paths, binaries, env-overridable settings
  session.ts          orchestration → raw/<id>.md + sessions/<id>.json
  vad.ts              energy VAD with pre-roll (captures soft leading edges)
  transcriber.ts      whisper-cli wrapper
  cleaner.ts          LLM cleanup pass (Anthropic SDK or OpenAI-compatible endpoint)
  cleanSession.ts     runClean: raw → cleaned/<name>.md + index update
  markdown.ts         styled-terminal markdown renderer
  store.ts            list / resolve / read sessions on disk
  userConfig.ts       ~/.voicelogger/config.json (API key, dirs, model)
  apps.ts             ~/.voicelogger/apps.json (registered project dirs)
  sources/            VoiceSource abstraction, LaptopMicSource, FileSource
  commands/           record · clean · list · show · link · config · app · doctor · download-model
```

Everything downstream of `VoiceSource` is source-agnostic — a network or wearable PCM
source can be added without touching VAD, transcription, storage, or linking.

---

## License

MIT — see [LICENSE](LICENSE).
