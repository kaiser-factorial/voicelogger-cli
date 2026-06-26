# voicelog-service

Local Whisper transcription service for The Ledger's voice-logger
(step 1 of `docs/AGENT_AND_VOICELOG_PLAN.md`).

Captures audio from a `VoiceSource`, segments it with a simple energy VAD,
transcribes each window with **whisper.cpp**, and writes a two-part record:

- `raw/<session>.md` — the untouched transcript (never overwritten)
- `sessions/<session>.json` — the `VoiceLogSession` index (becomes the Firestore doc later)

The cleaned pass (`cleaned/<session>.md`) is intentionally **not** done here — it's
the first job for the Phase-1 agent (Cowork / the ledger-cli MCP server).

## Architecture

```
VoiceSource ──PCM──▶ EnergyVad ──window──▶ whisper-cli ──text──▶ raw/<id>.md
   │                                                              sessions/<id>.json
   ├─ LaptopMicSource  (MVP)   ffmpeg avfoundation → 16 kHz mono PCM
   └─ WearabLLMSource  (later) device streams PCM to the same pipeline
```

Everything downstream of `VoiceSource` is source-agnostic, so the WearabLLM
device wires in later without touching VAD, transcription, storage, or UI.

## Prerequisites

- **ffmpeg** — `brew install ffmpeg` (mic capture via avfoundation)
- **whisper.cpp** — `brew install whisper-cpp` (provides `whisper-cli`)
- **Node 20+**
- A model file (see below)

## Setup

```bash
cd ledger/voicelog-service
npm install
npm run download-model          # → models/ggml-base.en.bin (~141 MB)
```

## Record (standalone — no UI needed)

```bash
npm run record                  # Enter (or Ctrl-C) to stop
npm run record -- --project rrg # tag the session with a project id
```

macOS will prompt once for microphone permission for the terminal running it.
Live transcript prints to the terminal as each utterance is recognized; the
files land under `VOICELOG_DIR` (default `~/Projects/voice_logs`).

## Configuration (all optional, via env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `VOICELOG_DIR` | `~/Projects/voice_logs` | where `raw/`, `cleaned/`, `sessions/` live |
| `WHISPER_MODEL` | `models/ggml-base.en.bin` | ggml model path |
| `WHISPER_BIN` | `whisper-cli` | whisper.cpp binary |
| `WHISPER_THREADS` | `4` | whisper threads |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg binary |
| `MIC_DEVICE` | `:0` | avfoundation input (`ffmpeg -f avfoundation -list_devices true -i ""` to list) |

## Layout

```
src/
  types.ts                 VoiceLogSession, TranscriptSegment
  config.ts                paths + binaries (env-overridable)
  sources/VoiceSource.ts   the capture-source abstraction
  sources/LaptopMicSource.ts
  wav.ts                   PCM → WAV header
  vad.ts                   energy VAD / windowing
  transcriber.ts           whisper-cli on one window → text
  session.ts               orchestration → raw + index files
  cli.ts                   standalone record entrypoint
```

## Test (no mic, deterministic)

```bash
# generate a known clip and run the full pipeline against it
say -o /tmp/vl_test.aiff "the ledger voice logger pipeline is now working end to end"
ffmpeg -y -i /tmp/vl_test.aiff -ac 1 -ar 16000 -f wav /tmp/vl_test.wav
npm run smoke -- /tmp/vl_test.wav     # asserts a non-empty transcript + raw status
```

`FileSource` (a WAV-file `VoiceSource`) drives `SessionRecorder` exactly like
the mic would, into a throwaway temp dir.

## Not yet (next steps)

- Streaming partials over a WebSocket for the live transcription view (Voice Logs UI).
- `WearabLLMSource` (network PCM ingest to the same pipeline).
- Cleaned pass (`cleaned/<session>.md`) via the Phase-1 ledger-cli MCP agent.
# voicelogger-cli
