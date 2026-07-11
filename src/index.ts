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
export { config, type Config } from "./config.js";
export * from "./types.js";

export type { VoiceSource } from "./sources/VoiceSource.js";
export { LaptopMicSource } from "./sources/LaptopMicSource.js";
export { FileSource } from "./sources/FileSource.js";

export { SessionRecorder, type SessionOptions } from "./session.js";
export { EnergyVad, type VadOptions, type VadWindow } from "./vad.js";
export { transcribePcm } from "./transcriber.js";
export { pcmToWav, pcmDurationMs } from "./wav.js";

export { cleanTranscript, type CleanResult, type CleanInputs } from "./cleaner.js";
export { runClean, hasAnthropicAuth, type CleanOutcome } from "./cleanSession.js";
export {
  startTestLogServer,
  type TestLogServerDeps,
  type TestLogServerHandle,
} from "./testLogServer.js";
export {
  loadUserConfig,
  saveUserConfig,
  configFilePath,
  applyStoredEnv,
  type UserConfig,
} from "./userConfig.js";
export { setupApiKey } from "./setupKey.js";
export {
  loadApps,
  getApp,
  upsertApp,
  removeApp,
  appsFilePath,
  type AppEntry,
  type AppRegistry,
} from "./apps.js";
export { pushSessionToApp } from "./appPush.js";
export { slugify, dateStamp, cleanedBaseName } from "./slug.js";
export { micDefaults, type MicDefaults } from "./platform.js";
export { resolveAutoCleanMode, parseCleanMode } from "./cleanMode.js";
export { renderMarkdown, type RenderOptions } from "./markdown.js";

export {
  listSessions,
  resolveSession,
  writeSession,
  readRawBody,
} from "./store.js";

export {
  ledgerNote,
  ledgerTouch,
  exitLabel,
  type LedgerResult,
} from "./ledger.js";
