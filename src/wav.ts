/**
 * Wrap raw PCM in a minimal 44-byte WAV header so whisper-cli can read a window
 * as a self-contained file. Defaults match the capture format (16 kHz mono s16le).
 */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = 16000,
  channels = 1,
  bitDepth = 16,
): Buffer {
  const bytesPerSample = bitDepth / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** Milliseconds of audio represented by a raw PCM buffer. */
export function pcmDurationMs(
  byteLength: number,
  sampleRate = 16000,
  channels = 1,
  bitDepth = 16,
): number {
  const bytesPerSample = bitDepth / 8;
  const samples = byteLength / (bytesPerSample * channels);
  return (samples / sampleRate) * 1000;
}
