import { test } from "node:test";
import assert from "node:assert/strict";
import { EnergyVad } from "../src/vad.js";

// Defaults: sampleRate 16000, frameMs 30 → 480 samples → 960 bytes/frame.
const SR = 16000;
const FRAME_BYTES = 960;
const SPEECH = 4000; // |4000/32768| ≈ 0.12 RMS, well above the 0.012 threshold
const QUIET = 100; //  |100/32768| ≈ 0.003 RMS, below threshold → counts as silence
const SILENCE = 0;

/** Build `n` analysis frames of a constant 16-bit sample value. */
function frames(n: number, value: number): Buffer {
  const buf = Buffer.alloc(n * FRAME_BYTES);
  for (let i = 0; i < buf.length; i += 2) buf.writeInt16LE(value, i);
  return buf;
}

test("constructing with a zero-length frame throws instead of hanging", () => {
  // frameMs:0 → frameBytes 0 → feed() would loop forever; guard must reject it
  assert.throws(() => new EnergyVad({ sampleRate: SR, frameMs: 0 }), RangeError);
  // sampleRate*frameMs < 1000 also floors to a 0-sample frame
  assert.throws(() => new EnergyVad({ sampleRate: 100, frameMs: 5 }), RangeError);
});

test("pure silence never opens an utterance", () => {
  const vad = new EnergyVad({ sampleRate: SR });
  assert.deepEqual(vad.feed(frames(50, SILENCE)), []);
  assert.equal(vad.flush(), null);
});

test("sub-threshold energy is treated as silence", () => {
  const vad = new EnergyVad({ sampleRate: SR });
  assert.deepEqual(vad.feed(frames(30, QUIET)), []);
  assert.equal(vad.flush(), null);
});

test("speech followed by a silence gap closes exactly one window", () => {
  const vad = new EnergyVad({ sampleRate: SR });
  // 20 speech frames (600 ms) then 24 silence frames (720 ms ≥ 700 ms silenceMs)
  const windows = vad.feed(Buffer.concat([frames(20, SPEECH), frames(24, SILENCE)]));
  assert.equal(windows.length, 1);
  // utterance buffers the speech frames plus the trailing-silence frames up to the cut
  assert.equal(windows[0].pcm.length, (20 + 24) * FRAME_BYTES);
  assert.equal(windows[0].startMs, 0);
  assert.equal(windows[0].endMs, (20 + 24) * 30);
  assert.equal(vad.flush(), null); // nothing left in progress
});

test("flush emits an in-progress utterance over the minimum length", () => {
  const vad = new EnergyVad({ sampleRate: SR });
  assert.deepEqual(vad.feed(frames(20, SPEECH)), []); // no trailing silence yet
  const tail = vad.flush();
  assert.ok(tail);
  assert.equal(tail!.pcm.length, 20 * FRAME_BYTES);
});

test("flush drops an utterance below minUtteranceMs", () => {
  const vad = new EnergyVad({ sampleRate: SR });
  // 5 frames = 150 ms < 350 ms minUtteranceMs
  assert.deepEqual(vad.feed(frames(5, SPEECH)), []);
  assert.equal(vad.flush(), null);
});

test("a too-long utterance is force-cut at maxUtteranceMs", () => {
  const vad = new EnergyVad({ sampleRate: SR, maxUtteranceMs: 600 });
  // 20 frames hits the 600 ms cap exactly → one window; the next 5 stay in progress
  const windows = vad.feed(frames(25, SPEECH));
  assert.equal(windows.length, 1);
  assert.equal(windows[0].pcm.length, 20 * FRAME_BYTES);
});

test("leftover bytes carry across feed() calls (chunk boundaries are arbitrary)", () => {
  const seq = Buffer.concat([frames(20, SPEECH), frames(24, SILENCE)]);

  const whole = new EnergyVad({ sampleRate: SR }).feed(seq);
  assert.equal(whole.length, 1);

  // Split at a non-frame-aligned byte offset; the VAD must buffer the partial frame.
  const split = new EnergyVad({ sampleRate: SR });
  const cut = 1234; // not a multiple of 960
  const out = [...split.feed(seq.subarray(0, cut)), ...split.feed(seq.subarray(cut))];
  assert.equal(out.length, 1);
  assert.equal(out[0].pcm.length, whole[0].pcm.length);
});
