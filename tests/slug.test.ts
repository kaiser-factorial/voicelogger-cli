import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, dateStamp, cleanedBaseName } from "../src/slug.js";

test("slugify lowercases, replaces non-alphanumerics with underscores, trims", () => {
  assert.equal(slugify("Test with music"), "test_with_music");
  assert.equal(slugify("  RRG eval brief!  "), "rrg_eval_brief");
  assert.equal(slugify("Café déjà vu"), "cafe_deja_vu"); // diacritics folded
  assert.equal(slugify("a---b__c"), "a_b_c"); // collapse runs
});

test("slugify falls back to voice_log for empty/symbol-only input", () => {
  assert.equal(slugify(""), "voice_log");
  assert.equal(slugify("!!!"), "voice_log");
});

test("slugify caps length", () => {
  assert.ok(slugify("word ".repeat(40)).length <= 60);
});

test("dateStamp formats as DDMonthYYYY (local) and handles bad input", () => {
  // mid-month noon UTC is the same calendar day in all practical zones
  const stamp = dateStamp("2026-06-15T12:00:00.000Z");
  assert.match(stamp, /^\d{1,2}[A-Z][a-z]+\d{4}$/);
  assert.ok(stamp.includes("June") && stamp.includes("2026"));
  assert.equal(dateStamp("not-a-date"), "undated");
});

test("cleanedBaseName joins slug + date", () => {
  const name = cleanedBaseName("Test with music", "2026-06-15T12:00:00.000Z");
  assert.match(name, /^test_with_music_\d{1,2}June2026$/);
});
