/**
 * Per-OS ffmpeg microphone-input defaults. macOS is verified; Linux/Windows are
 * best-guess starting points so a tech-savvy user can get going via MIC_FORMAT /
 * MIC_DEVICE, and a future pass can make them out-of-the-box.
 *
 * TODO(cross-platform): see docs/CROSS_PLATFORM.md — auto-detect the default input
 * device per OS (so MIC_DEVICE isn't required on Windows), add a `devices` command,
 * and verify capture on Linux + Windows in CI. Until then these are experimental.
 */
export interface MicDefaults {
    /** ffmpeg input format (the `-f` value). */
    format: string;
    /** ffmpeg input device (the `-i` value). "" means "no safe default — set MIC_DEVICE". */
    device: string;
    /** Whether mic capture is verified working on this platform. */
    supported: boolean;
    /** One-line setup hint for this platform. */
    note: string;
}
/**
 * A human-friendly mic label for the `record` header: the platform's name + "default"
 * when nothing's been overridden, or the configured device value when it has.
 */
export declare function micLabel(platform: NodeJS.Platform, format: string, device: string): string;
export declare function micDefaults(platform: NodeJS.Platform): MicDefaults;
