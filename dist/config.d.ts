import type { CleanMode } from "./types.js";
export interface Config {
    dataDir: string;
    rawDir: string;
    cleanedDir: string;
    sessionsDir: string;
    modelPath: string;
    /** Where `download-model` fetches the default ggml model from. */
    modelUrl: string;
    whisperBin: string;
    ffmpegBin: string;
    /** ffmpeg input format for mic capture (`-f`), platform-derived; override with MIC_FORMAT. */
    micFormat: string;
    /** ffmpeg input device for mic capture (`-i`), platform-derived; override with MIC_DEVICE. */
    micDevice: string;
    whisperThreads: number;
    format: {
        sampleRate: number;
        channels: number;
    };
    /** Model name for the `clean` pass. Default sonnet-4-6; override with LLM_MODEL (or legacy CLAUDE_MODEL). */
    anthropicModel: string;
    cleanMaxTokens: number;
    glossaryPath: string;
    templatePath: string;
    /** How `record` handles cleaning on finish (VOICELOGGER_AUTOCLEAN). Default "auto". */
    autoCleanMode: CleanMode;
    /** Base URL for an OpenAI-compatible endpoint. Empty = use Anthropic SDK. */
    llmBaseUrl: string;
    /** API key for the above. Empty = no key (fine for local endpoints like Ollama). */
    llmApiKey: string;
    /** Tracker CLI used by `link`. Empty unless connected via LEDGER_BIN or `config ledger`. */
    ledgerBin: string;
    /** Whether a tracker CLI is connected (link will notify it). */
    ledgerEnabled: boolean;
}
export declare const config: Config;
