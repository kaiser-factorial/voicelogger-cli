import { createServer } from "node:http";
const CLIENT_HEADER = "x-voicelogger-client";
/** Same allow-list as bulwork's server: the extension, or anything on localhost. */
function isAllowedOrigin(origin) {
    if (!origin)
        return true; // non-browser clients (curl, another local process) send no Origin
    if (origin.startsWith("chrome-extension://"))
        return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
function sendJson(res, status, obj) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(JSON.stringify(obj));
}
function applyCors(req, res) {
    const origin = req.headers.origin ?? "";
    if (origin && isAllowedOrigin(origin))
        res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${CLIENT_HEADER}`);
}
// SECURITY: same rationale as bulwork's server — a localhost port is reachable by any web
// page the user has open. A plain CORS allow-list only gates browser reads; a required
// custom header forces a preflight that fails for a random page, and blocks non-browser
// callers (curl, a compromised extension origin) from POSTing /stop without it.
function authorized(req) {
    return Boolean(req.headers[CLIENT_HEADER]);
}
async function handle(req, res, deps) {
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
export function startTestLogServer(deps, port = 7374) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            handle(req, res, deps).catch((err) => {
                sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
            });
        });
        server.once("error", (err) => {
            if (err.code === "EADDRINUSE") {
                reject(new Error(`port ${port} is already in use — a test-log session may already be running ` +
                    `(check GET http://127.0.0.1:${port}/status)`));
            }
            else {
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
//# sourceMappingURL=testLogServer.js.map