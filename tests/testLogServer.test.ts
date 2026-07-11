import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestLogServer } from "../src/testLogServer.js";
import type { VoiceLogSession } from "../src/types.js";

const TEST_PORT = 17374; // distinct from the real :7374 so these never collide with a live session

function fakeSession(overrides: Partial<VoiceLogSession> = {}): VoiceLogSession {
  return {
    id: "s1",
    startedAt: "2026-07-10T00:00:00.000Z",
    source: "laptop",
    rawPath: "/tmp/raw.md",
    status: "recording",
    ...overrides,
  };
}

test("GET /status without the client header is rejected", async () => {
  const handle = await startTestLogServer(
    { getSession: () => fakeSession(), requestStop: () => {} },
    TEST_PORT,
  );
  try {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/status`);
    assert.equal(res.status, 403);
  } finally {
    await handle.close();
  }
});

test("GET /status reports active + session metadata", async () => {
  const session = fakeSession({
    title: "Checkout pass",
    scope: "feature",
    speaker: "alex",
    featureNote: "checkout flow",
    projectId: "rrg",
  });
  const handle = await startTestLogServer(
    { getSession: () => session, requestStop: () => {} },
    TEST_PORT,
  );
  try {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/status`, {
      headers: { "X-Voicelogger-Client": "test" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.active, true);
    assert.equal(body.sessionId, "s1");
    assert.equal(body.title, "Checkout pass");
    assert.equal(body.scope, "feature");
    assert.equal(body.speaker, "alex");
    assert.equal(body.featureNote, "checkout flow");
    assert.equal(body.projectId, "rrg");
  } finally {
    await handle.close();
  }
});

test("GET /status reports active:false once the session has stopped recording", async () => {
  const handle = await startTestLogServer(
    { getSession: () => fakeSession({ status: "raw" }), requestStop: () => {} },
    TEST_PORT,
  );
  try {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/status`, {
      headers: { "X-Voicelogger-Client": "test" },
    });
    const body = (await res.json()) as { active: boolean };
    assert.equal(body.active, false);
  } finally {
    await handle.close();
  }
});

test("POST /stop triggers requestStop and responds immediately", async () => {
  let stopped = false;
  const handle = await startTestLogServer(
    { getSession: () => fakeSession(), requestStop: () => { stopped = true; } },
    TEST_PORT,
  );
  try {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/stop`, {
      method: "POST",
      headers: { "X-Voicelogger-Client": "test" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; sessionId: string };
    assert.equal(body.ok, true);
    assert.equal(body.sessionId, "s1");
    assert.equal(stopped, true);
  } finally {
    await handle.close();
  }
});

test("unknown routes 404", async () => {
  const handle = await startTestLogServer(
    { getSession: () => fakeSession(), requestStop: () => {} },
    TEST_PORT,
  );
  try {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/nope`, {
      headers: { "X-Voicelogger-Client": "test" },
    });
    assert.equal(res.status, 404);
  } finally {
    await handle.close();
  }
});

test("a second server on the same port rejects with a clear 'already running' message", async () => {
  const first = await startTestLogServer(
    { getSession: () => fakeSession(), requestStop: () => {} },
    TEST_PORT,
  );
  try {
    await assert.rejects(
      startTestLogServer({ getSession: () => fakeSession(), requestStop: () => {} }, TEST_PORT),
      /already running|already in use/,
    );
  } finally {
    await first.close();
  }
});
