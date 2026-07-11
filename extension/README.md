# voicelogger test-log indicator (skeleton)

A minimal browser extension: shows a thin yellow border in the active tab while `voicelogger
record --test-log` recording is running, so you have a visible signal you're being recorded
during manual QA testing. Renders through the same overlay primitive bulwork's border uses — see
[overlay.js](overlay.js) for why it's a vendored copy rather than a shared import.

The server side (`src/testLogServer.ts`) now exists (Phase 1a-ii). **Not wired up for real yet**
(Phase 1c) — that's a separate pass to actually exercise the polling logic against a live server,
not just point at the right URL.

```
content script (border)  ◄──  background worker (polls)  ◄──  voicelogger local status endpoint
     overlay.js + content-guard.js      background.js           http://127.0.0.1:7374/status
```

## Status endpoint contract

```
GET http://127.0.0.1:7374/status
Header: X-Voicelogger-Client: <any non-empty value>
200 { "active": boolean, "sessionId": string, "startedAt": string,
      "title"?: string, "scope"?: "full"|"feature", "speaker"?: string, "featureNote"?: string }
```

The header is required on every request (403 without it) — same defense-in-depth as bulwork's
`X-Bulwork-Client`: a localhost port is reachable by any web page the user has open, and a
required custom header forces a CORS preflight that only this extension's origin passes.

Served by `voicelogger record --test-log` itself, for the lifetime of that one recording
session — not a persistent background daemon, and not owned by the `test <path>` launcher
(Phase 1b): the launcher will just spawn `record --test-log` under the hood, so the border works
identically whether a human ran the command directly or the launcher did. If voicelogger isn't
running (or any other fetch failure), the extension fails closed to inactive.

## Load it (Chrome / Edge / Brave)

- Open `chrome://extensions`
- Toggle **Developer mode** on
- **Load unpacked** → select `voicelogger-cli/extension/`

Should now light up during a real `voicelogger record --test-log` session (Phase 1a-ii's server
is built) — Phase 1c is still pending a manual QA pass to confirm the alarm-lag polling behaves
as expected against it.

## Notes

- No icon set yet (manifest omits `icons`/`action.default_icon` — Chrome falls back to a generic
  icon). Add real icons when this graduates past skeleton.
- Port convention across this workspace: **bulwork = `:7373`, voicelogger = `:7374`.** Keep it that
  way so the two never collide if both happen to be running.
- `background.js` polls via `chrome.alarms`, which has a 1-minute floor once packed — see the
  comment at the top of that file for the tradeoff and the upgrade path if snappier toggling is
  wanted later.
