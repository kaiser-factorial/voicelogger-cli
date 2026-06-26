import { test } from "node:test";
import assert from "node:assert/strict";
import { pcmToWav, pcmDurationMs } from "../src/wav.js";

test("pcmToWav writes a canonical 44-byte header + payload", () => {
  const pcm = Buffer.alloc(8, 1); // 8 bytes of payload
  const wav = pcmToWav(pcm);

  assert.equal(wav.length, 44 + pcm.length);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(4), 36 + pcm.length); // RIFF chunk size
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.toString("ascii", 12, 16), "fmt ");
  assert.equal(wav.readUInt32LE(16), 16); // fmt chunk size
  assert.equal(wav.readUInt16LE(20), 1); // PCM
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), pcm.length);
  // payload is appended verbatim
  assert.deepEqual(wav.subarray(44), pcm);
});

test("pcmToWav default 16 kHz mono s16le derived fields", () => {
  const wav = pcmToWav(Buffer.alloc(0));
  assert.equal(wav.readUInt16LE(22), 1); // channels
  assert.equal(wav.readUInt32LE(24), 16000); // sampleRate
  assert.equal(wav.readUInt32LE(28), 16000 * 1 * 2); // byteRate
  assert.equal(wav.readUInt16LE(32), 1 * 2); // blockAlign
  assert.equal(wav.readUInt16LE(34), 16); // bitDepth
  // empty payload → data size 0, RIFF size 36
  assert.equal(wav.readUInt32LE(40), 0);
  assert.equal(wav.readUInt32LE(4), 36);
  assert.equal(wav.length, 44);
});

test("pcmToWav honors non-default format (stereo / 8 kHz)", () => {
  const wav = pcmToWav(Buffer.alloc(4), 8000, 2, 16);
  assert.equal(wav.readUInt16LE(22), 2); // channels
  assert.equal(wav.readUInt32LE(24), 8000); // sampleRate
  assert.equal(wav.readUInt32LE(28), 8000 * 2 * 2); // byteRate
  assert.equal(wav.readUInt16LE(32), 2 * 2); // blockAlign
});

test("pcmDurationMs computes wall-clock from byte length", () => {
  // 16-bit mono @16kHz: 32000 bytes = 16000 samples = 1000 ms
  assert.equal(pcmDurationMs(32000), 1000);
  assert.equal(pcmDurationMs(0), 0);
  assert.equal(pcmDurationMs(16000), 500);
  // stereo halves the duration for the same byte count
  assert.equal(pcmDurationMs(32000, 16000, 2), 500);
});
