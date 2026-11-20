import assert from "node:assert/strict";
import { test } from "node:test";
import { headlineSentence } from "./headline.ts";
import type { ItemRowData } from "./types.ts";

const row = (days_late: number) => ({ days_late }) as ItemRowData;

test("says how many run out first and how many more need ordering", () => {
  const s = headlineSentence({ order_now: [row(71), row(50), row(6), row(0)], stuck_total_value: 117598.51 });
  assert.equal(s, "3 items run out before a reorder can arrive. 1 more needs an order this week. $118k is tied up in stuck stock.");
});

test("singular wording for one item", () => {
  assert.match(headlineSentence({ order_now: [row(5)], stuck_total_value: 0 }), /^1 item runs out before/);
});

test("calm confirmation when nothing is urgent", () => {
  assert.equal(
    headlineSentence({ order_now: [], stuck_total_value: 0 }),
    "Nothing needs ordering this week.",
  );
});

test("items due this week but not running out are not called run-outs", () => {
  assert.match(headlineSentence({ order_now: [row(0), row(0)], stuck_total_value: 0 }), /None will run out before it arrives/);
});
