// voicelogger test-log indicator — content script.
//
// Listens for state pushed by background.js and renders/clears the border via BrickOverlay
// (overlay.js, loaded just before this file — see manifest.json). Does nothing until a
// testlog:state message arrives; never blocks the page (BrickOverlay is pointer-events:none
// except for interactive elements this extension never uses).

const TESTLOG_COLOR = "#FFD60A"; // same yellow as Ledger's BRICK MODE border, for visual consistency

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "testlog:state") return;
  if (msg.active) {
    window.BrickOverlay.show({ color: TESTLOG_COLOR, fill: 0, border: 2 });
  } else {
    window.BrickOverlay.clear();
  }
});
