import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionRecorder } from "../src/session.js";
import { FileSource } from "../src/sources/FileSource.js";

// The SessionRecorder constructor is side-effect-free (it only computes the id and
// paths — no disk I/O until start()), so these run without a model, mic, or files.

test("session ids are unique even when created in the same instant", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    ids.add(new SessionRecorder(new FileSource("/unused.wav")).session.id);
  }
  assert.equal(ids.size, 100); // no collisions (regression for second-resolution ids)
});

test("session id keeps a sortable timestamp prefix", () => {
  const id = new SessionRecorder(new FileSource("/unused.wav")).session.id;
  // 2026-06-26T15-34-47-120Z-<rand>-<counter>
  assert.match(id, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/);
});

test("test-log metadata is captured on the session at construction (captured at the source)", () => {
  const { session } = new SessionRecorder(new FileSource("/unused.wav"), {
    testLog: true,
    speaker: "alex",
    title: "Checkout regression pass",
    scope: "feature",
    featureNote: "checkout flow",
  });
  assert.equal(session.testLog, true);
  assert.equal(session.speaker, "alex");
  assert.equal(session.title, "Checkout regression pass");
  assert.equal(session.scope, "feature");
  assert.equal(session.featureNote, "checkout flow");
});

test("a plain (non-test-log) session leaves the new fields undefined", () => {
  const { session } = new SessionRecorder(new FileSource("/unused.wav"));
  assert.equal(session.testLog, undefined);
  assert.equal(session.speaker, undefined);
  assert.equal(session.scope, undefined);
});
