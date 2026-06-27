import { test } from "node:test";
import assert from "node:assert/strict";
import { doctorExitCode, type DoctorCheck } from "../src/commands/doctor.js";

const c = (ok: boolean, required: boolean): DoctorCheck => ({ name: "x", ok, required, detail: "" });

test("doctorExitCode fails only on a missing required check", () => {
  assert.equal(doctorExitCode([]), 0);
  assert.equal(doctorExitCode([c(true, true), c(true, false)]), 0);
  assert.equal(doctorExitCode([c(true, true), c(false, false)]), 0); // optional failure is fine
  assert.equal(doctorExitCode([c(false, true)]), 1); // required failure → exit 1
  assert.equal(doctorExitCode([c(true, true), c(false, true)]), 1);
});
