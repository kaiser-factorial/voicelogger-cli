import { test } from "node:test";
import assert from "node:assert/strict";
import { stripNonSpeechMarkers } from "../src/transcriber.js";

test("stripNonSpeechMarkers drops whole-line whisper non-speech tokens", () => {
  assert.equal(stripNonSpeechMarkers("[BLANK_AUDIO]"), "");
  assert.equal(stripNonSpeechMarkers("[ Silence ]"), "");
  assert.equal(stripNonSpeechMarkers("(buzzing)"), "");
  assert.equal(stripNonSpeechMarkers("  [BLANK_AUDIO]  \n"), "");
});

test("stripNonSpeechMarkers keeps real speech (and trims)", () => {
  assert.equal(stripNonSpeechMarkers("  the ledger works  "), "the ledger works");
  // marker line removed, surrounding speech kept
  assert.equal(stripNonSpeechMarkers("hello\n[BLANK_AUDIO]\nworld"), "hello\nworld");
  // a bracket inside a line of speech is not a marker
  assert.equal(stripNonSpeechMarkers("see [fig 1] for details"), "see [fig 1] for details");
});
