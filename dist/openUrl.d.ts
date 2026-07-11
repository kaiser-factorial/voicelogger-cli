/**
 * Open a URL in the default browser. macOS is verified; Linux/Windows are best-guess (same
 * split as platform.ts's mic defaults — untested here, fix forward if reported broken).
 */
export declare function openUrl(url: string): void;
