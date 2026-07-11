// voicelogger test-log indicator — background service worker.
//
// Polls voicelogger's local test-log status endpoint and forwards state changes to the active
// tab's content script, which renders the border via overlay.js (BulworkOverlay, vendored — see
// that file's header for why this is a copy and not a shared import). This worker holds no
// secrets and runs no AI: it only asks "is test-log recording right now?" and relays the answer.
//
// STATUS ENDPOINT (not built yet — this extension is a skeleton ahead of the server side):
//   GET http://127.0.0.1:7374/status  ->  { "active": boolean }
// Owned by the test-log recording session itself (Phase 1a), live for the duration of that
// session whether started directly or via the `test <path>` launcher (Phase 1b) — not a
// persistent background daemon. Until that endpoint exists, fetch() below fails closed to
// inactive, same as it will once voicelogger isn't running. See ../docs/TEST_LOG_PLAN.md.
//
// POLLING CADENCE: MV3 `chrome.alarms` has a 1-minute floor once this extension is packed
// (unpacked/dev-mode Chrome allows shorter periods, but don't rely on that difference). That
// means up to ~60s of lag between starting `voicelogger test` and the border appearing. That's
// an acceptable v1 tradeoff; if snappier toggling matters later, switch the local server to
// pushing over a long-lived `chrome.runtime.connect` port instead of being polled.

const STATUS_URL = "http://127.0.0.1:7374/status";
const POLL_ALARM = "vl-testlog-poll";

let lastActive = false;

async function fetchActive() {
  try {
    const res = await fetch(STATUS_URL);
    if (res.ok) {
      const data = await res.json();
      return !!data.active;
    }
  } catch {
    // Connection refused / voicelogger not running -> fail closed to "inactive". Same philosophy
    // as bulwork's fail-open-to-allow: the extension should never get stuck showing a border
    // because the local service isn't there.
  }
  return false;
}

async function notifyActiveTab(active) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "testlog:state", active }).catch(() => {});
  }
}

// Alarm-driven poll: only message the (already-current) active tab when the state actually
// changes, to avoid spamming it every tick.
async function pollAndBroadcastOnChange() {
  const active = await fetchActive();
  if (active === lastActive) return;
  lastActive = active;
  await notifyActiveTab(active);
}

// Tab-switch sync: always tell the newly-focused tab the CURRENT state, regardless of whether
// that state changed globally — a freshly-activated tab has never been told anything, so gating
// on `active === lastActive` here (as an earlier version of this file did) meant switching to a
// new tab during an already-active session silently never showed the border on it.
async function syncCurrentTab() {
  const active = await fetchActive();
  lastActive = active;
  await notifyActiveTab(active);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  syncCurrentTab();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  syncCurrentTab();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollAndBroadcastOnChange();
});
chrome.tabs.onActivated.addListener(() => syncCurrentTab());
