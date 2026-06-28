import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
function userHome() {
    return process.env.VOICELOGGER_HOME ?? path.join(os.homedir(), ".voicelogger");
}
export function appsFilePath() {
    return path.join(userHome(), "apps.json");
}
export function loadApps() {
    try {
        return JSON.parse(readFileSync(appsFilePath(), "utf8"));
    }
    catch {
        return {};
    }
}
export function getApp(name) {
    return loadApps()[name];
}
export function upsertApp(name, entry) {
    mkdirSync(userHome(), { recursive: true });
    const apps = loadApps();
    apps[name] = entry;
    const file = appsFilePath();
    writeFileSync(file, JSON.stringify(apps, null, 2) + "\n");
    return file;
}
export function removeApp(name) {
    const apps = loadApps();
    if (!(name in apps))
        return false;
    delete apps[name];
    writeFileSync(appsFilePath(), JSON.stringify(apps, null, 2) + "\n");
    return true;
}
//# sourceMappingURL=apps.js.map