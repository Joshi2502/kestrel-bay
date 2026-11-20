import assert from "node:assert/strict";
import { test } from "node:test";
import { pick, sortStuck, withParams } from "./sort.ts";
import type { StuckRowData } from "./types.ts";

const row = (code: string, value: number, expiry: string | null): StuckRowData => ({
  code,
  description: code,
  location: "HCS",
  lot_no: null,
  qty: value / 10,
  uom: "CS",
  value_at_cost: value,
  reasons: ["expiring"],
  expiry_date: expiry,
  at_hcs: true,
  detail: "",
});

test("stuck rows sort by value, biggest first when desc", () => {
  const sorted = sortStuck([row("a", 10, null), row("b", 30, null), row("c", 20, null)], "value", "desc");
  assert.deepEqual(sorted.map((r) => r.code), ["b", "c", "a"]);
});

test("rows with no expiry sort last when ascending by expiry", () => {
  const sorted = sortStuck([row("a", 1, null), row("b", 1, "2026-12-01")], "expiry", "asc");
  assert.deepEqual(sorted.map((r) => r.code), ["b", "a"]);
});

test("withParams keeps other state and replaces the patched keys", () => {
  assert.equal(withParams({ sort: "item", dir: "asc" }, { sort: "order", dir: "desc" }), "/?sort=order&dir=desc");
  assert.equal(withParams({ sort: "item" }, { sort: null }), "/");
});

test("pick falls back for unknown values", () => {
  assert.equal(pick("nope", ["a", "b"] as const, "a"), "a");
  assert.equal(pick("b", ["a", "b"] as const, "a"), "b");
});
