import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../src/cleaner.js";

const BASE = { glossary: "g", template: "t" };

test("buildSystemPrompt: plain mode has no test-log instructions", () => {
  const prompt = buildSystemPrompt(BASE);
  assert.match(prompt, /You clean raw voice-log transcripts\./);
  assert.doesNotMatch(prompt, /test-log recording/);
  assert.doesNotMatch(prompt, /silence/i);
});

test("buildSystemPrompt: test-log mode covers silence tolerance and speaker attribution", () => {
  const prompt = buildSystemPrompt({ ...BASE, testLog: true, speaker: "alex" });
  assert.match(prompt, /test-log recording/);
  assert.match(prompt, /Large gaps between segments are expected/);
  assert.match(prompt, /primary narrator is "alex"/);
  assert.match(prompt, /no real speaker diarization/);
});

test("buildSystemPrompt: test-log speaker defaults to 'dev' when omitted", () => {
  const prompt = buildSystemPrompt({ ...BASE, testLog: true });
  assert.match(prompt, /primary narrator is "dev"/);
});

test("buildSystemPrompt: test-log project-context header differs from plain mode", () => {
  const plain = buildSystemPrompt({ ...BASE, projectContext: "notes" });
  const testLog = buildSystemPrompt({ ...BASE, projectContext: "notes", testLog: true });
  assert.match(plain, /use for domain terms and continuity/);
  assert.match(testLog, /lean on this for what's under test/);
});

test("buildSystemPrompt: always includes glossary and template content", () => {
  const prompt = buildSystemPrompt({ glossary: "MCP row", template: "## Context" });
  assert.match(prompt, /MCP row/);
  assert.match(prompt, /## Context/);
});
