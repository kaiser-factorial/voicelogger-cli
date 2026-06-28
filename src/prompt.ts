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

/** Read a single line from a TTY (visible). Non-interactive stdin → empty string. */
export function promptLine(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve("");
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
export async function promptChoice(
  options: Array<{ label: string; hint?: string }>,
  defaultIndex = 0,
): Promise<number> {
  const width = String(options.length).length;
  options.forEach(({ label, hint }, i) => {
    const num = String(i + 1).padStart(width);
    const isDefault = i === defaultIndex ? "  ← default" : "";
    console.log(`  ${num}) ${label}${hint ? `  — ${hint}` : ""}${isDefault}`);
  });
  while (true) {
    const raw = (await promptLine("  > ")).trim();
    if (!raw) return defaultIndex;
    const n = Number.parseInt(raw, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    console.log(`  Please enter a number between 1 and ${options.length}.`);
  }
}

/**
 * Show a numbered list of Ledger projects and return the chosen project ID,
 * or undefined if the user presses Enter to skip.
 * Returns undefined immediately in non-interactive environments.
 */
export async function promptProject(
  projects: Array<{ id: string; name: string }>,
): Promise<string | undefined> {
  if (!process.stdin.isTTY || projects.length === 0) return undefined;
  console.log("\nLink this session to a project? (Enter to skip)\n");
  const width = String(projects.length).length;
  projects.forEach(({ id, name }, i) => {
    console.log(`  ${String(i + 1).padStart(width)}) ${name}  — ${id}`);
  });
  console.log();
  while (true) {
    const raw = (await promptLine("  > ")).trim();
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    if (n >= 1 && n <= projects.length) return projects[n - 1].id;
    console.log(`  Enter a number 1–${projects.length}, or press Enter to skip.`);
  }
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
