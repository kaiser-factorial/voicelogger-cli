# voicelogger test-log indicator (skeleton)

A minimal browser extension: shows a thin yellow border in the active tab while `voicelogger
test-log` recording is running, so you have a visible signal you're being recorded during manual
QA testing. Renders through the same overlay primitive brick's border uses — see
[overlay.js](overlay.js) for why it's a vendored copy rather than a shared import.

This is scaffolding, built ahead of the server side. **Not wired up to real recording state yet.**

```
content script (border)  ◄──  background worker (polls)  ◄──  voicelogger local status endpoint
     overlay.js + content-guard.js      background.js           http://127.0.0.1:7374/status (TODO)
```

## Status endpoint contract (to be built)

```
GET http://127.0.0.1:7374/status
200 { "active": boolean }
```

Planned to be served by `voicelogger test <path>` for the lifetime of that recording session —
not a persistent background daemon (see the launcher design notes). Until that endpoint exists,
the extension just polls, gets a connection error, and stays inactive — safe by default.

## Load it (Chrome / Edge / Brave)

- Open `chrome://extensions`
- Toggle **Developer mode** on
- **Load unpacked** → select `voicelogger-cli/extension/`

Nothing will happen yet — there's no server on `:7374` to poll. Once the `test` launcher exists
and serves `/status`, this should start working with no changes to the extension itself.

## Notes

- No icon set yet (manifest omits `icons`/`action.default_icon` — Chrome falls back to a generic
  icon). Add real icons when this graduates past skeleton.
- Port convention across this workspace: **brick = `:7373`, voicelogger = `:7374`.** Keep it that
  way so the two never collide if both happen to be running.
- `background.js` polls via `chrome.alarms`, which has a 1-minute floor once packed — see the
  comment at the top of that file for the tradeoff and the upgrade path if snappier toggling is
  wanted later.
