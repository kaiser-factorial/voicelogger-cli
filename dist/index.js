/**
 * Public library surface for `voicelogger-cli`.
 *
 * Import the pipeline pieces directly when embedding the voice-logger in another
 * project instead of shelling out to the CLI, e.g.
 *
 *   import { SessionRecorder, LaptopMicSource } from "voicelogger-cli";
 *   const rec = new SessionRecorder(new LaptopMicSource());
 *   await rec.start();
 */
export { config } from "./config.js";
export * from "./types.js";
export { LaptopMicSource } from "./sources/LaptopMicSource.js";
export { FileSource } from "./sources/FileSource.js";
export { SessionRecorder } from "./session.js";
export { EnergyVad } from "./vad.js";
export { transcribePcm } from "./transcriber.js";
export { pcmToWav, pcmDurationMs } from "./wav.js";
export { cleanTranscript } from "./cleaner.js";
export { runClean, hasAnthropicAuth } from "./cleanSession.js";
export { startTestLogServer, } from "./testLogServer.js";
export { loadUserConfig, saveUserConfig, configFilePath, applyStoredEnv, } from "./userConfig.js";
export { setupApiKey } from "./setupKey.js";
export { loadApps, getApp, upsertApp, removeApp, appsFilePath, } from "./apps.js";
export { pushSessionToApp } from "./appPush.js";
export { slugify, dateStamp, cleanedBaseName } from "./slug.js";
export { micDefaults } from "./platform.js";
export { resolveAutoCleanMode, parseCleanMode } from "./cleanMode.js";
export { renderMarkdown } from "./markdown.js";
export { listSessions, resolveSession, writeSession, readRawBody, } from "./store.js";
export { ledgerNote, ledgerTouch, exitLabel, } from "./ledger.js";
//# sourceMappingURL=index.js.map