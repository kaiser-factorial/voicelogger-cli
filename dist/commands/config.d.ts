/**
 * Manage per-machine config (saved at ~/.voicelogger/config.json).
 *
 *   voicelogger config                 interactive wizard (API key + where to save logs)
 *   voicelogger config show            show current config (key masked)
 *   voicelogger config dir <path>      set where logs save
 *   voicelogger config ledger <path>   connect a project tracker CLI ("off" to disconnect)
 */
export declare function configCommand(args: string[]): Promise<void>;
