import { spawn } from "node:child_process";

/**
 * Open a URL in the default browser. macOS is verified; Linux/Windows are best-guess (same
 * split as platform.ts's mic defaults — untested here, fix forward if reported broken).
 */
export function openUrl(url: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    // `start` is a cmd.exe builtin, not a real executable — must go through cmd /c. Its first
    // quoted argument is treated as the window title, not the URL, so an empty title is
    // required or `start` swallows the URL as the title instead of opening it.
    cmd = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}
