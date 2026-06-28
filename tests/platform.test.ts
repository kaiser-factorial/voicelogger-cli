import { test } from "node:test";
import assert from "node:assert/strict";
import { micDefaults, micLabel } from "../src/platform.js";

test("macOS mic defaults are avfoundation/:0 and verified (no regression)", () => {
  const m = micDefaults("darwin");
  assert.equal(m.format, "avfoundation");
  assert.equal(m.device, ":0");
  assert.equal(m.supported, true);
});

test("Linux defaults to alsa/default, marked experimental", () => {
  const m = micDefaults("linux");
  assert.equal(m.format, "alsa");
  assert.equal(m.device, "default");
  assert.equal(m.supported, false);
});

test("Windows defaults to dshow with no device (must be set), experimental", () => {
  const m = micDefaults("win32");
  assert.equal(m.format, "dshow");
  assert.equal(m.device, ""); // no safe default
  assert.equal(m.supported, false);
});

test("unknown platform falls back and is flagged unsupported", () => {
  const m = micDefaults("sunos" as NodeJS.Platform);
  assert.equal(m.supported, false);
  assert.ok(m.format && m.note.includes("sunos"));
});

test("micLabel: defaults render as a friendly platform name", () => {
  assert.equal(micLabel("darwin", "avfoundation", ":0"), "macOS default");
  assert.equal(micLabel("linux", "alsa", "default"), "Linux default");
});

test("micLabel: shows the configured device when overridden", () => {
  // a custom MIC_DEVICE on macOS surfaces verbatim (e.g. selecting a non-default mic)
  assert.equal(micLabel("darwin", "avfoundation", ":1"), ":1");
  // Windows with no device set should prompt the user
  assert.equal(micLabel("win32", "dshow", ""), "(set MIC_DEVICE)");
});

test("config wires the platform default when MIC_FORMAT is unset", async () => {
  if (process.env.MIC_FORMAT) return; // skip if the runner overrides it
  const { config } = await import("../src/config.js");
  assert.equal(config.micFormat, micDefaults(process.platform).format);
});
