# Cross-platform mic capture

`voicelogger` records via **ffmpeg**, so the pipeline (VAD → whisper → clean) is
platform-agnostic. Only the **microphone input** is OS-specific. macOS is verified and
works out of the box; **Linux and Windows are experimental** — the structure is in place
and a tech-savvy user can get going with two env vars, but they haven't been tested yet.

## How the mic input is chosen

`record` builds the ffmpeg input from two values, each defaulted per OS in
[`src/platform.ts`](../src/platform.ts) and overridable by env var:

| | `-f` (format) | `-i` (device) | env overrides |
|---|---|---|---|
| **macOS** (verified) | `avfoundation` | `:0` | `MIC_FORMAT`, `MIC_DEVICE` |
| **Linux** (experimental) | `alsa` | `default` | `MIC_FORMAT`, `MIC_DEVICE` |
| **Windows** (experimental) | `dshow` | *(none — must set)* | `MIC_FORMAT`, `MIC_DEVICE` |

Run `voicelogger doctor` to see the exact ffmpeg input it will use on your machine, plus
whether your platform is verified or experimental.

## Linux

Install prerequisites, then list and pick a device:

```bash
# Debian/Ubuntu example
sudo apt-get install ffmpeg
# whisper.cpp: build from source (https://github.com/ggml-org/whisper.cpp) so `whisper-cli`
# is on PATH, or set WHISPER_BIN to its path.

arecord -l                      # list ALSA capture devices
voicelogger download-model
voicelogger record              # uses -f alsa -i default
```

If the default device is wrong, or you use PulseAudio/PipeWire:

```bash
MIC_FORMAT=alsa  MIC_DEVICE=hw:1,0   voicelogger record   # specific ALSA device
MIC_FORMAT=pulse MIC_DEVICE=default  voicelogger record   # PulseAudio / PipeWire
```

## Windows

ffmpeg's `dshow` needs the **exact device name** — there is no safe default, so you must
set `MIC_DEVICE`:

```powershell
# list capture devices (note the exact "audio=" name in the output)
ffmpeg -f dshow -list_devices true -i dummy

$env:MIC_DEVICE = 'audio=Microphone (Realtek High Definition Audio)'
voicelogger record               # uses -f dshow -i $env:MIC_DEVICE
```

Install ffmpeg (e.g. `winget install ffmpeg` or [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))
and whisper.cpp so `whisper-cli` is on PATH (or set `WHISPER_BIN`).

> Mic permission, and the `record --app`/clean steps, are unchanged across platforms.

## Status / TODO — making it out-of-the-box

What's done: platform-derived `MIC_FORMAT`/`MIC_DEVICE` defaults, env overrides, and a
`doctor` line showing the effective input + experimental warning. macOS verified.

To make Linux/Windows turnkey (good first tasks for a future pass / agent):

- [ ] **Auto-detect the default capture device** per OS (so `MIC_DEVICE` isn't required on
      Windows). Parse `ffmpeg -list_devices`, `arecord -l`, etc.
- [ ] Add a **`voicelogger devices`** command that lists inputs for the current OS (wraps the
      ffmpeg/arecord listing) so users don't hand-copy device names.
- [ ] **Verify capture end-to-end** on Ubuntu (ALSA + PulseAudio/PipeWire) and Windows
      (dshow); flip `supported: true` in `platform.ts` per OS as each is confirmed.
- [ ] Extend the **CI matrix** to a smoke recording on Linux (e.g. a virtual/loopback ALSA
      device) so regressions are caught.
- [ ] Document **whisper.cpp install** per OS (Homebrew is macOS-only; Linux/Windows build
      from source) — or detect a missing `whisper-cli` and link the build instructions.
- [ ] Consider a **WSL note** for Windows users (audio passthrough caveats).

Until those land, treat Linux/Windows as "bring your own device name" — functional for a
careful user, not yet zero-config.
