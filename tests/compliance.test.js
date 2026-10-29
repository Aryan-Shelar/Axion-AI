import test from "node:test";
import assert from "node:assert/strict";
import { analyze, scoreOf, fixed, initRules } from "../src/data.js";

test("detects prohibited claims", () => {
  const findings = analyze("This is guaranteed to give the best results", initRules);
  assert.ok(findings.length >= 1);
  assert.ok(findings.some((item) => item.sev === "High"));
});

test("score decreases with severity and never drops below 40", () => {
  assert.equal(scoreOf([]), 100);
  assert.equal(scoreOf([{ sev: "High" }, { sev: "Medium" }]), 77);
  assert.equal(scoreOf(Array.from({ length: 10 }, () => ({ sev: "High" }))), 40);
});

test("applies known textual fixes", () => {
  assert.equal(fixed("This is guaranteed", [{ from: "guaranteed", to: "designed to help" }]), "This is designed to help");
});
