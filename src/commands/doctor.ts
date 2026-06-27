import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { hasAnthropicAuth } from "../cleanSession.js";
import { config } from "../config.js";
import { micDefaults } from "../platform.js";

/**
 * Check that the environment is ready: ffmpeg + whisper.cpp + a model for
 * recording, plus an Anthropic key (clean) and the ledger CLI (link).
 *
 *   voicelogger doctor
 *
 * Exits non-zero if any check required for recording fails.
 */
export interface DoctorCheck {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

/** Non-zero exit if any *required* check failed (optional checks never fail the run). */
export function doctorExitCode(checks: DoctorCheck[]): number {
  return checks.some((c) => c.required && !c.ok) ? 1 : 0;
}

/** Run a binary just to see whether it exists/executes; ENOENT → not found. */
function runBinary(bin: string, args: string[]): Promise<{ ran: boolean; out: string }> {
  return new Promise((resolve) => {
    let out = "";
    const proc = spawn(bin, args);
    proc.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    proc.stderr?.on("data", (d: Buffer) => (out += d.toString()));
    proc.on("error", () => resolve({ ran: false, out: "" }));
    proc.on("close", () => resolve({ ran: true, out }));
  });
}

const firstLine = (s: string): string => s.split("\n")[0]?.trim() ?? "";
const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(0)} MB`;

export async function doctorCommand(): Promise<void> {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node ≥ 20",
    ok: nodeMajor >= 20,
    required: true,
    detail: `v${process.versions.node}`,
  });

  const ff = await runBinary(config.ffmpegBin, ["-version"]);
  checks.push({
    name: "ffmpeg (mic capture)",
    ok: ff.ran,
    required: true,
    detail: ff.ran ? firstLine(ff.out) : `not found: ${config.ffmpegBin} — brew install ffmpeg`,
  });

  // Platform mic input — verified on macOS, experimental elsewhere (optional info).
  const mic = micDefaults(process.platform);
  const overridden = Boolean(process.env.MIC_FORMAT || process.env.MIC_DEVICE);
  checks.push({
    name: `mic input (${process.platform})`,
    ok: mic.supported || overridden,
    required: false,
    detail:
      `-f ${config.micFormat} -i ${config.micDevice || "(set MIC_DEVICE)"}` +
      (mic.supported || overridden ? "" : " — experimental; see docs/CROSS_PLATFORM.md"),
  });

  const wh = await runBinary(config.whisperBin, ["--help"]);
  checks.push({
    name: "whisper.cpp (transcription)",
    ok: wh.ran,
    required: true,
    detail: wh.ran
      ? config.whisperBin
      : `not found: ${config.whisperBin} — brew install whisper-cpp`,
  });

  const modelOk = existsSync(config.modelPath) && statSync(config.modelPath).size > 0;
  checks.push({
    name: "Whisper model",
    ok: modelOk,
    required: true,
    detail: modelOk
      ? `${config.modelPath} (${mb(statSync(config.modelPath).size)})`
      : `missing: ${config.modelPath} — run: voicelogger download-model`,
  });

  checks.push({
    name: "Anthropic API key (clean)",
    ok: hasAnthropicAuth(),
    required: false,
    detail: hasAnthropicAuth() ? "set" : "not set — run: voicelogger config",
  });

  const ld = await runBinary(config.ledgerBin, ["--help"]);
  checks.push({
    name: "ledger CLI (link)",
    ok: ld.ran,
    required: false,
    detail: ld.ran ? config.ledgerBin : `not found: ${config.ledgerBin} — set LEDGER_BIN (optional)`,
  });

  console.log("voicelogger doctor\n");
  for (const c of checks) {
    const mark = c.ok ? "✓" : c.required ? "✗" : "—";
    console.log(`  ${mark} ${c.name}: ${c.detail}`);
  }

  const code = doctorExitCode(checks);
  const failed = checks.filter((c) => c.required && !c.ok).length;
  console.log("");
  console.log(
    code === 0
      ? `Ready to record.${hasAnthropicAuth() ? "" : " (set a key to enable cleanup)"}`
      : `Not ready — fix ${failed} required item(s) above.`,
  );
  process.exit(code);
}
