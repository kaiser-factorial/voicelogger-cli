# voicelogger-cli

`voicelogger` — a local, offline voice-logger CLI. Record from your mic, transcribe
with **whisper.cpp**, optionally LLM-**clean** the transcript, and **link** the result
to a project tracker (e.g. [The Ledger](https://github.com/kaiser-factorial)).

Everything runs locally; nothing is uploaded except the optional `clean` pass (which
calls the Anthropic API). Transcripts are written as plain Markdown so agents/tools can
read them directly.

```
mic ──▶ energy VAD ──▶ whisper.cpp ──▶ raw/<id>.md  ──(clean)──▶ cleaned/<id>.md
                                       sessions/<id>.json (index)   │
                                                                    └─(link)─▶ ledger note/touch
```

## Install

**As a CLI** (the `voicelogger` command):

```bash
# from GitHub (builds on install — no npm publish needed)
npm install -g github:kaiser-factorial/voicelogger-cli

# or once published to npm
npm install -g voicelogger-cli
npx voicelogger-cli --help
```

**From source** (for development):

```bash
git clone git@github.com:kaiser-factorial/voicelogger-cli.git
cd voicelogger-cli
npm install
npm run voicelogger -- --help     # run via tsx, or `npm run build` then `node dist/cli.js`
```

## Prerequisites

- **Node 20+**
- **ffmpeg** — `brew install ffmpeg` (mic capture via avfoundation, macOS)
- **whisper.cpp** — `brew install whisper-cpp` (provides `whisper-cli`)
- **A model** — `voicelogger download-model` (≈141 MB → `~/.voicelogger/models/ggml-base.en.bin`)

> Mic capture currently targets macOS (`ffmpeg -f avfoundation`). The rest of the
> pipeline is platform-agnostic.

## Usage

```bash
voicelogger record                       # record, then auto-clean + show the edited markdown
voicelogger record --project rrg         # tag the session with a project id
voicelogger record --no-clean            # keep raw only; skip the cleanup pass
voicelogger record --clean prompt        # ask before cleaning this recording
voicelogger doctor                       # check ffmpeg / whisper / model / key / ledger
voicelogger list                         # all sessions, newest first
voicelogger list --json                  # machine-readable session list
voicelogger show latest                  # print the latest transcript (cleaned if present)
voicelogger show latest --raw            # force the raw transcript
voicelogger clean latest                 # LLM-clean the latest raw transcript
voicelogger link latest rrg              # attach to project "rrg" (+ ledger note)
voicelogger app add ledger ~/path/to/app # register an app + create its voicelogs/ dir
voicelogger app push latest ledger       # copy the session's logs into that app
voicelogger download-model               # fetch the Whisper model
voicelogger version
```

A `<session>` argument can be a full id, a unique id prefix, or `latest`.

macOS prompts once for microphone permission for the terminal running `record`. The
live transcript prints as each utterance is recognized; files land under `VOICELOG_DIR`
(default `~/Projects/voice_logs`).

## Cleanup — the edited markdown

Every session keeps two files: `raw/<id>.md` (the untouched transcript, never overwritten)
and `cleaned/<id>.md` (an LLM-edited pass that removes disfluencies, fixes domain terms via
the shared glossary, and organizes the content into the template). When a recording finishes,
`voicelogger` runs the cleanup and prints the edited markdown **styled inline** in the terminal.

The cleanup pass needs an Anthropic API key. Save it once with the wizard (it's entered
hidden and stored at `~/.voicelogger/config.json` with `600` perms):

```bash
voicelogger config        # prompts for your key without echoing it; saved per-machine
voicelogger config show   # show config (key masked) — handy to confirm it's set
```

Or set `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`) in your environment — an env var
always overrides the saved key. Without any key, `record` keeps the raw transcript and
points you to run `voicelogger clean` later.

Control when it runs:

| | |
|---|---|
| `VOICELOGGER_AUTOCLEAN=auto` | clean automatically on finish (**default**) |
| `VOICELOGGER_AUTOCLEAN=prompt` | ask `Clean this recording now? [Y/n]` each time |
| `VOICELOGGER_AUTOCLEAN=off` | keep raw only; clean manually with `voicelogger clean <id>` |

Per-recording overrides: `record --no-clean`, `record --clean`, `record --clean prompt`.
`voicelogger show <id>` renders the cleaned version styled (raw is shown verbatim); add
`--plain` for unstyled markdown.

## Use with The Ledger (or any project tracker)

`voicelogger link <session> <projectId>` records the link locally and — unless
`--no-ledger` — shells out to the `ledger` CLI to drop a `ledger note` (and a `touch`
with `--touch`), tying debug narration to project status.

By default it calls `ledger` on your `PATH`. If the binary lives elsewhere, point
`LEDGER_BIN` at it:

```bash
export LEDGER_BIN="$HOME/Projects/ledger_root/ledger-cli/ledger"
voicelogger link latest rrg --touch --reason "voice debug session"
```

If the binary is missing or auth fails, the **local link is still saved** and a warning
is printed — `voicelogger` never loses your data over a bridge failure.

## Push logs into other apps

Register a project directory as an "app", then copy a session's logs into it — so each
app owns a self-contained `voicelogs/` of the recordings relevant to it:

```bash
voicelogger app add rrg ~/Projects/rrg   # registers rrg + creates ~/Projects/rrg/voicelogs/
voicelogger app list
voicelogger app push latest rrg          # copies raw + cleaned + index into rrg/voicelogs/
voicelogger app rm rrg
```

Or push automatically as you record: `voicelogger record --app rrg` records, cleans, then
copies the finished session into `rrg/voicelogs/`.

`push` copies (doesn't symlink) the raw transcript, the cleaned markdown, and the session
index, rewriting the index paths to the app-local copies. The registry lives at
`~/.voicelogger/apps.json`. See [BRAINSTORM.md](BRAINSTORM.md) for where this is headed
(a per-app `voicelogger --app <name>` selector, per-app glossaries).

## Use as a library in another project

The package also ships a typed library entry, so you can embed the pipeline instead of
shelling out:

```ts
import { SessionRecorder, LaptopMicSource, cleanTranscript } from "voicelogger-cli";

const rec = new SessionRecorder(new LaptopMicSource(), {
  projectId: "rrg",
  onSegment: (s) => console.log(s.text),
});
await rec.start();
// … later …
const session = await rec.stop();
```

## Configuration (all optional, via env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `VOICELOG_DIR` | `~/Projects/voice_logs` | where `raw/`, `cleaned/`, `sessions/` live |
| `VOICELOGGER_HOME` | `~/.voicelogger` | per-user home for the model and other assets |
| `WHISPER_MODEL` | `~/.voicelogger/models/ggml-base.en.bin` | ggml model path (in-tree `models/` wins if present) |
| `WHISPER_MODEL_URL` | HF `ggml-base.en.bin` | source for `download-model` |
| `WHISPER_BIN` | `whisper-cli` | whisper.cpp binary |
| `WHISPER_THREADS` | `4` | whisper threads |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg binary |
| `MIC_DEVICE` | `:0` | avfoundation input (`ffmpeg -f avfoundation -list_devices true -i ""` to list) |
| `VOICELOGGER_AUTOCLEAN` | `auto` | cleanup on `record` finish: `auto` \| `prompt` \| `off` |
| `CLAUDE_MODEL` | `claude-opus-4-8` | Anthropic model for `clean` (e.g. `claude-haiku-4-5` for speed/cost) |
| `CLEAN_MAX_TOKENS` | `16000` | max output tokens for `clean` |
| `GLOSSARY_PATH` / `TEMPLATE_PATH` | bundled `cleaning/*` | cleaning glossary + template |
| `LEDGER_BIN` | `ledger` | the `ledger` binary used by `link` |
| `ANTHROPIC_API_KEY` | — | required by `clean` |

## Architecture

```
src/
  cli.ts                   command dispatch + version/help
  index.ts                 public library surface
  config.ts                paths + binaries (env-overridable)
  types.ts                 VoiceLogSession, TranscriptSegment
  sources/VoiceSource.ts   the capture-source abstraction
  sources/LaptopMicSource.ts   ffmpeg avfoundation → 16 kHz mono PCM
  sources/FileSource.ts        deterministic WAV source (tests)
  wav.ts                   PCM → WAV header
  vad.ts                   energy VAD / windowing
  transcriber.ts           whisper-cli on one window → text
  session.ts               orchestration → raw + index files
  cleaner.ts               LLM cleaning pass (Anthropic)
  cleanSession.ts          runClean: raw → cleaned/<id>.md + index update
  cleanMode.ts             auto/prompt/off resolution (env + flags)
  markdown.ts              styled-terminal markdown renderer
  store.ts                 list/resolve/read sessions on disk
  userConfig.ts            per-machine config (~/.voicelogger/config.json, API key)
  apps.ts                  app registry (~/.voicelogger/apps.json) for `app push`
  ledger.ts                bridge to the `ledger` CLI
  commands/                record · clean · list · show · link · config · app · doctor · download-model
```

Everything downstream of `VoiceSource` is source-agnostic, so a network/device source
(e.g. a wearable streaming PCM) can wire in later without touching VAD, transcription,
storage, or linking.

## Test (no mic, deterministic)

```bash
say -o /tmp/vl_test.aiff "the voicelogger pipeline is now working end to end"
ffmpeg -y -i /tmp/vl_test.aiff -ac 1 -ar 16000 -f wav /tmp/vl_test.wav
npm run smoke -- /tmp/vl_test.wav     # asserts a non-empty transcript + raw status
```

`FileSource` (a WAV-file `VoiceSource`) drives `SessionRecorder` exactly like the mic
would, into a throwaway temp dir.

## Roadmap

See [BRAINSTORM.md](BRAINSTORM.md) — notably a `--app <name>` flag to register multiple
project targets and auto-push saved logs into each app's own `voicelogs/` directory.

## License

MIT — see [LICENSE](LICENSE).
