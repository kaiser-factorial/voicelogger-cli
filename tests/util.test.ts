import { test } from "node:test";
import assert from "node:assert/strict";
import { optValue, firstPositional, positionals } from "../src/commands/util.js";

test("optValue returns the token after a flag", () => {
  assert.equal(optValue(["--project", "rrg"], "--project"), "rrg");
  assert.equal(optValue(["a", "--project", "rrg", "b"], "--project"), "rrg");
});

test("optValue tries each alias in order and falls back to undefined", () => {
  assert.equal(optValue(["-p", "x"], "--project", "-p"), "x");
  assert.equal(optValue(["a", "b"], "--project"), undefined);
});

test("optValue returns undefined when the flag is last (no value follows)", () => {
  assert.equal(optValue(["--project"], "--project"), undefined);
});

test("optValue does not swallow a following flag as the value", () => {
  // a forgotten value must not capture the next flag (regression)
  assert.equal(optValue(["--project", "--touch"], "--project"), undefined);
  assert.equal(optValue(["--note", "--reason", "r"], "--note"), undefined);
});

test("firstPositional skips flags", () => {
  assert.equal(firstPositional(["--raw", "latest"]), "latest");
  assert.equal(firstPositional(["latest", "--raw"]), "latest");
  assert.equal(firstPositional(["--raw"]), undefined);
  assert.equal(firstPositional([]), undefined);
});

test("positionals keeps only non-flag tokens, in order", () => {
  assert.deepEqual(positionals(["latest", "rrg", "--touch"]), ["latest", "rrg"]);
  assert.deepEqual(positionals(["--touch", "latest", "rrg"]), ["latest", "rrg"]);
  assert.deepEqual(positionals([]), []);
});

test("positionals skips the value of a declared value-taking flag", () => {
  // regression: the note text must not be read as a positional (e.g. projectId)
  assert.deepEqual(
    positionals(["latest", "--note", "sprint recap", "rrg"], ["--note"]),
    ["latest", "rrg"],
  );
  // a following flag is NOT consumed as the value, so booleans still register
  assert.deepEqual(
    positionals(["latest", "rrg", "--note", "--touch"], ["--note"]),
    ["latest", "rrg"],
  );
});
