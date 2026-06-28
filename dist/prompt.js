import * as readline from "node:readline";
/** Yes/no prompt. Non-interactive stdin returns the default without asking. */
export function confirm(question, defaultYes = true) {
    if (!process.stdin.isTTY)
        return Promise.resolve(defaultYes);
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            const a = answer.trim().toLowerCase();
            resolve(a === "" ? defaultYes : a === "y" || a === "yes");
        });
    });
}
/** Read a single line from a TTY (visible). Non-interactive stdin → empty string. */
export function promptLine(prompt) {
    if (!process.stdin.isTTY)
        return Promise.resolve("");
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
/**
 * Show a numbered list of choices and return the 0-based index of the selection.
 * Pressing Enter returns `defaultIndex`. Repeats until a valid number is entered.
 */
export async function promptChoice(options, defaultIndex = 0) {
    const width = String(options.length).length;
    options.forEach(({ label, hint }, i) => {
        const num = String(i + 1).padStart(width);
        const isDefault = i === defaultIndex ? "  ← default" : "";
        console.log(`  ${num}) ${label}${hint ? `  — ${hint}` : ""}${isDefault}`);
    });
    while (true) {
        const raw = (await promptLine("  > ")).trim();
        if (!raw)
            return defaultIndex;
        const n = Number.parseInt(raw, 10);
        if (n >= 1 && n <= options.length)
            return n - 1;
        console.log(`  Please enter a number between 1 and ${options.length}.`);
    }
}
/** Read a line from a TTY without echoing what is typed (password-style). */
export function promptHidden(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });
        let muted = false;
        // Suppress echo of typed characters once muted; the prompt is written before
        // muting, so it still shows.
        rl._writeToOutput = (s) => {
            if (!muted)
                process.stdout.write(s);
        };
        process.stdout.write(prompt);
        muted = true;
        rl.question("", (answer) => {
            muted = false;
            rl.close();
            process.stdout.write("\n");
            resolve(answer);
        });
    });
}
//# sourceMappingURL=prompt.js.map