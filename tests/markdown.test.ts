import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/markdown.js";

const SAMPLE = [
  "# Cleaned voice log — abc",
  "",
  "> a one-line summary",
  "",
  "- source: laptop",
  "",
  "---",
  "",
  "## Context",
  "Worked on the **ledger** CLI.",
  "- did a thing",
].join("\n");

test("renderMarkdown with color:false strips markers to readable text", () => {
  const out = renderMarkdown(SAMPLE, { color: false });
  assert.ok(!out.includes("\x1b["), "no ANSI escapes when color is off");
  assert.ok(out.includes("Cleaned voice log — abc")); // heading text kept
  assert.ok(!/^#/m.test(out), "heading '#' markers stripped");
  assert.ok(out.includes("• source: laptop"), "bullets become •");
  assert.ok(out.includes("│ a one-line summary"), "blockquote prefixed");
  assert.ok(out.includes("ledger") && !out.includes("**ledger**"), "bold markers stripped");
  assert.ok(out.includes("─"), "horizontal rule rendered");
});

test("renderMarkdown with color:true emits ANSI escapes", () => {
  const out = renderMarkdown(SAMPLE, { color: true });
  assert.ok(out.includes("\x1b["), "contains ANSI styling");
  assert.ok(out.includes("Cleaned voice log — abc"));
});

test("color auto-disables for non-TTY output (default opts)", () => {
  // the test runner's stdout is not a TTY, so the default resolves to plain
  const out = renderMarkdown("# Title\n- item");
  assert.ok(!out.includes("\x1b["));
});
