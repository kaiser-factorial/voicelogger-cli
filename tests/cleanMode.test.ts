import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCleanMode, resolveAutoCleanMode } from "../src/cleanMode.js";

test("parseCleanMode normalizes recognized values", () => {
  assert.equal(parseCleanMode("auto"), "auto");
  assert.equal(parseCleanMode("ON"), "auto");
  assert.equal(parseCleanMode("prompt"), "prompt");
  assert.equal(parseCleanMode("ask"), "prompt");
  assert.equal(parseCleanMode("off"), "off");
  assert.equal(parseCleanMode("  Off  "), "off");
  assert.equal(parseCleanMode("nonsense"), undefined);
  assert.equal(parseCleanMode(undefined), undefined);
});

test("resolveAutoCleanMode: explicit flags override the fallback", () => {
  assert.equal(resolveAutoCleanMode(["--no-clean"], "auto"), "off");
  assert.equal(resolveAutoCleanMode(["--clean"], "off"), "auto"); // bare --clean = auto
  assert.equal(resolveAutoCleanMode(["--clean", "prompt"], "off"), "prompt");
  assert.equal(resolveAutoCleanMode(["--clean", "off"], "auto"), "off");
});

test("resolveAutoCleanMode: --no-clean wins, and --clean before a flag means auto", () => {
  assert.equal(resolveAutoCleanMode(["--clean", "--no-clean"], "auto"), "off");
  // --clean followed by another flag has no value → auto (optValue won't swallow it)
  assert.equal(resolveAutoCleanMode(["--clean", "--project", "rrg"], "off"), "auto");
});

test("resolveAutoCleanMode: falls back when no clean flag is present", () => {
  assert.equal(resolveAutoCleanMode([], "auto"), "auto");
  assert.equal(resolveAutoCleanMode([], "prompt"), "prompt");
  assert.equal(resolveAutoCleanMode(["--project", "rrg"], "off"), "off");
});
