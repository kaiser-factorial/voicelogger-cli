const PLATFORM_NAMES = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows",
};
/**
 * A human-friendly mic label for the `record` header: the platform's name + "default"
 * when nothing's been overridden, or the configured device value when it has.
 */
export function micLabel(platform, format, device) {
    const d = micDefaults(platform);
    const platformName = PLATFORM_NAMES[platform] ?? platform;
    if (format === d.format && device === d.device) {
        return device ? `${platformName} default` : "(set MIC_DEVICE)";
    }
    return device || "(set MIC_DEVICE)";
}
export function micDefaults(platform) {
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
//# sourceMappingURL=platform.js.map