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

export function micDefaults(platform: NodeJS.Platform): MicDefaults {
  switch (platform) {
    case "darwin":
      return {
        format: "avfoundation",
        device: ":0",
        supported: true,
        note: 'macOS: default mic via avfoundation. List devices: ffmpeg -f avfoundation -list_devices true -i ""',
      };
    case "linux":
      return {
        format: "alsa",
        device: "default",
        supported: false,
        note: "Linux (experimental): ALSA default mic. For PulseAudio use MIC_FORMAT=pulse MIC_DEVICE=default. List ALSA devices: arecord -l",
      };
    case "win32":
      return {
        format: "dshow",
        device: "",
        supported: false,
        note: 'Windows (experimental): set MIC_DEVICE="audio=<Your Mic Name>". List devices: ffmpeg -f dshow -list_devices true -i dummy',
      };
    default:
      return {
        format: "avfoundation",
        device: ":0",
        supported: false,
        note: `Unrecognized platform '${platform}': set MIC_FORMAT and MIC_DEVICE manually (see docs/CROSS_PLATFORM.md).`,
      };
  }
}
