import * as readline from "node:readline";

/** Yes/no prompt. Non-interactive stdin returns the default without asking. */
export function confirm(question: string, defaultYes = true): Promise<boolean> {
  if (!process.stdin.isTTY) return Promise.resolve(defaultYes);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === "" ? defaultYes : a === "y" || a === "yes");
    });
  });
}

/** Read a line from a TTY without echoing what is typed (password-style). */
export function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    // Suppress echo of typed characters once muted; the prompt is written before
    // muting, so it still shows.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (!muted) process.stdout.write(s);
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
