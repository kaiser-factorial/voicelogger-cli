import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { VoiceLogSession } from "./types.js";

/**
 * Local control surface for a `record --test-log` session — see docs/TEST_LOG_PLAN.md
 * Phase 1a-ii. Lives inside the `record --test-log` process itself, for the duration of
 * that one session (not a persistent background daemon): starting a session is a CLI
 * invocation (whoever wants one — a human, the Phase 1b launcher, or Ledger — runs
 * `voicelogger record --test-log [flags]`); this server only covers *status* and *stop*,
 * the two things a caller outside that process needs (Ledger's future modal, the browser
 * extension indicator). Conventions (CORS + required client header, sendJson helper)
 * mirror bulwork's `src/server.ts` for consistency across this workspace.
 */

export interface TestLogServerDeps {
  /** The live session object — SessionRecorder mutates it in place, so read fresh each call. */
  getSession(): VoiceLogSession;
  /** Trigger the same graceful stop path as Enter/Ctrl-C. Fire-and-forget; must be idempotent. */
  requestStop(): void;
}

export interface TestLogServerHandle {
  port: number;
  close(): Promise<void>;
}

const CLIENT_HEADER = "x-voicelogger-client";

/** Same allow-list as bulwork's server: the extension, or anything on localhost. */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true; // non-browser clients (curl, another local process) send no Origin
  if (origin.startsWith("chrome-extension://")) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin ?? "";
  if (origin && isAllowedOrigin(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${CLIENT_HEADER}`);
}

// SECURITY: same rationale as bulwork's server — a localhost port is reachable by any web
// page the user has open. A plain CORS allow-list only gates browser reads; a required
// custom header forces a preflight that fails for a random page, and blocks non-browser
// callers (curl, a compromised extension origin) from POSTing /stop without it.
function authorized(req: IncomingMessage): boolean {
  return Boolean(req.headers[CLIENT_HEADER]);
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TestLogServerDeps,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (!authorized(req)) {
    sendJson(res, 403, { error: `missing ${CLIENT_HEADER} header` });
    return;
  }

  const route = `${req.method} ${url.pathname}`;
  const session = deps.getSession();

  if (route === "GET /status") {
    sendJson(res, 200, {
      active: session.status === "recording",
      sessionId: session.id,
      startedAt: session.startedAt,
      projectId: session.projectId,
      title: session.title,
      scope: session.scope,
      speaker: session.speaker,
      featureNote: session.featureNote,
    });
    return;
  }
  if (route === "POST /stop") {
    // Fire-and-forget: requestStop()'s caller (record.ts's `finish`) eventually calls
    // process.exit(), which must not race the synchronous res.end() below — JS's single
    // thread guarantees requestStop() only runs up to its first await before control
    // returns here, well before any exit.
    deps.requestStop();
    sendJson(res, 200, { ok: true, sessionId: session.id });
    return;
  }
  sendJson(res, 404, { error: `no route: ${route}` });
}

/**
 * Start the control server. Rejects on bind failure — most commonly EADDRINUSE, which
 * doubles as this workspace's answer to two Phase 1a-ii edge cases at once: a port already
 * in use IS "a second test-log session tried to start while one's already running," since
 * starting a session is a process launch that claims this port for its lifetime. No PID
 * file or separate liveness check is needed — the OS reclaims the port the instant the
 * owning process exits or crashes, so a crash can never leave a stale server answering
 * `active: true` forever.
 */
export function startTestLogServer(
  deps: TestLogServerDeps,
  port = 7374,
): Promise<TestLogServerHandle> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      handle(req, res, deps).catch((err: unknown) => {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      });
    });
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `port ${port} is already in use — a test-log session may already be running ` +
              `(check GET http://127.0.0.1:${port}/status)`,
          ),
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
