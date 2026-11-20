import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateIn,
  days,
  daysBetween,
  groupedInt,
  money,
  moneyShort,
  percent,
  qty,
  relativeDate,
} from "./format.ts";

const NBSP = " ";

test("quantities group thousands and keep the unit", () => {
  assert.equal(qty(1200, "LB"), `1,200${NBSP}lbs`);
  assert.equal(qty(480, "CS"), `480${NBSP}cs`);
  assert.equal(groupedInt(12.6), "13");
});

test("money is whole dollars in tables and compact in headlines", () => {
  assert.equal(money(117598.51), "$117,599");
  assert.equal(moneyShort(117598.51), "$118k");
  assert.equal(moneyShort(1_240_000), "$1.2M");
  assert.equal(moneyShort(950), "$950");
});

test("days are singular for one and always in days", () => {
  assert.equal(days(1), `1${NBSP}day`);
  assert.equal(days(50), `50${NBSP}days`);
});

test("percent rounds to a whole number", () => {
  assert.equal(percent(0.456), "46%");
});

test("dates drop the year only in the reference year", () => {
  assert.equal(dateIn("2026-12-28", "2026-11-16"), "Dec 28");
  assert.equal(dateIn("2027-02-08", "2026-11-16"), "Feb 8, 2027");
});

test("relative dates count calendar days from the as-of date", () => {
  assert.equal(daysBetween("2026-11-16", "2026-12-20"), 34);
  assert.equal(relativeDate("2026-11-16", "2026-11-16"), "today");
  assert.equal(relativeDate("2026-12-20", "2026-11-16"), `in 34${NBSP}days`);
  assert.equal(relativeDate("2026-11-13", "2026-11-16"), `3${NBSP}days ago`);
});

test("arrival falls back to today + lead time", async () => {
  const { addDays, arrivalDate } = await import("./format.ts");
  assert.equal(addDays("2026-11-16", 84), "2027-02-08");
  assert.equal(arrivalDate({ earliest_arrival: null, lead_days: 84 }, "2026-11-16"), "2027-02-08");
  assert.equal(arrivalDate({ earliest_arrival: "2026-12-07", lead_days: 21 }, "2026-11-16"), "2026-12-07");
});
