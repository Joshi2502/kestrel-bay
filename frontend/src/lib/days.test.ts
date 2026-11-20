import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDays } from "./days.ts";

test("accepts whole numbers in range", () => {
  assert.deepEqual(parseDays("84", 1), { ok: true, value: 84 });
  assert.deepEqual(parseDays(" 14 ", 0), { ok: true, value: 14 });
  assert.deepEqual(parseDays("0", 0), { ok: true, value: 0 });
});

test("blank is not zero", () => {
  assert.equal(parseDays("", 1).ok, false);
  assert.equal(parseDays("   ", 0).ok, false);
});

test("rejects below the minimum, above 365, decimals and text", () => {
  assert.equal(parseDays("0", 1).ok, false);
  assert.equal(parseDays("-3", 0).ok, false);
  assert.equal(parseDays("366", 0).ok, false);
  assert.equal(parseDays("2.5", 0).ok, false);
  assert.equal(parseDays("abc", 0).ok, false);
});
