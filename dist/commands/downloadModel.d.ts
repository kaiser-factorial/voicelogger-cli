/**
 * Download the default Whisper ggml model to the resolved model path
 * (see config.resolveModelPath — typically ~/.voicelogger/models/). This is the
 * installed-binary equivalent of the old `download-model` npm script, so a
 * global / npx install can fetch the model without the repo's scripts.
 *
 *   voicelogger download-model [--force]
 */
export declare function downloadModelCommand(args: string[]): Promise<void>;
