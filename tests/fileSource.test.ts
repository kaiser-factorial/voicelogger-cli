import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileSource } from "../src/sources/FileSource.js";
import type { VoiceSource } from "../src/sources/VoiceSource.js";
import { pcmToWav } from "../src/wav.js";

/** Drive a VoiceSource to completion, collecting emitted PCM and errors. */
function drain(source: VoiceSource): Promise<{ pcm: Buffer; errors: Error[] }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errors: Error[] = [];
    source.onFrame((c) => chunks.push(Buffer.from(c)));
    source.onError((e) => errors.push(e));
    source.onEnd(() => resolve({ pcm: Buffer.concat(chunks), errors }));
    source.start().catch(reject);
  });
}

test("FileSource strips the WAV header and re-emits the exact PCM payload", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vl-fsrc-"));
  try {
    const pcm = Buffer.from(Array.from({ length: 250 }, (_, i) => i % 256));
    const wavPath = path.join(dir, "clip.wav");
    await writeFile(wavPath, pcmToWav(pcm));

    // chunkBytes < payload so the pump runs several iterations
    const { pcm: out, errors } = await drain(new FileSource(wavPath, 100));
    assert.equal(errors.length, 0);
    assert.deepEqual(out, pcm);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileSource on a missing file surfaces an error and still ends cleanly", async () => {
  const { pcm, errors } = await drain(new FileSource("/no/such/voicelog.wav"));
  assert.equal(pcm.length, 0);
  assert.equal(errors.length, 1);
});

test("FileSource locates data past an odd-sized chunk (RIFF word-alignment pad)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vl-fsrc-odd-"));
  try {
    const u32 = (n: number): Buffer => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(n);
      return b;
    };
    const payload = Buffer.from(Array.from({ length: 64 }, (_, i) => (i * 7) % 256));
    const info = Buffer.from("hi!!!"); // 5 bytes → odd, requires a trailing pad byte
    const listChunk = Buffer.concat([Buffer.from("LIST"), u32(info.length), info, Buffer.alloc(1)]);
    const dataChunk = Buffer.concat([Buffer.from("data"), u32(payload.length), payload]);
    const body = Buffer.concat([Buffer.from("WAVE"), listChunk, dataChunk]);
    const wav = Buffer.concat([Buffer.from("RIFF"), u32(body.length), body]);

    const wavPath = path.join(dir, "odd.wav");
    await writeFile(wavPath, wav);

    const { pcm, errors } = await drain(new FileSource(wavPath, 32));
    assert.equal(errors.length, 0);
    assert.deepEqual(pcm, payload); // exact payload, no metadata bytes leaked in
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
