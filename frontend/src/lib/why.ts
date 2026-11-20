import { arrivalDate, days, daysBetween, groupedInt, money, perDay, qty, relativeDate, shortDate } from "./format";
import type { ItemDetail, ItemRowData, StuckRowData } from "./types";

// Builds the content of the "why" panel from fields the API already returns.
// Nothing here recomputes a verdict; it only restates it in plain words.
export interface WhyInput {
  label: string;
  value: string;
  source: string;
}
export interface WhyContent {
  sentence: string;
  inputs: WhyInput[];
  formula: string;
  asOf: string;
  href: string;
  hrefLabel?: string;
}

const SOURCE = {
  stock: "Latest inventory snapshot, sellable locations only",
  hold: "Latest inventory snapshot, QA hold",
  orders: "Open customer orders",
  pos: "Open purchase orders",
  demand: "Forecast and booked orders, whichever is higher",
  lead: "Lead time set for this supplier",
};

function itemHref(code: string, from: string): string {
  return `/items/${encodeURIComponent(code)}?from=${encodeURIComponent(from)}`;
}

function baseInputs(row: ItemRowData): WhyInput[] {
  return [
    { label: "On hand", value: qty(row.sellable, row.uom), source: SOURCE.stock },
    { label: "On hold, not counted", value: qty(row.on_hold, row.uom), source: SOURCE.hold },
    { label: "Promised to customers", value: qty(row.committed_total, row.uom), source: SOURCE.orders },
    {
      label: "On the way",
      value: qty(row.incoming_total, row.uom),
      source: row.next_eta ? `${SOURCE.pos}; next due ${shortDate(row.next_eta)}` : SOURCE.pos,
    },
    { label: "Expected use, next 30 days", value: qty(row.demand_next_30d, row.uom), source: SOURCE.demand },
  ];
}

export function whyRunOut(row: ItemRowData, asOf: string, from: string): WhyContent {
  const sentence = row.run_out_date
    ? `Runs out around ${shortDate(row.run_out_date)}, ${relativeDate(row.run_out_date, asOf)}. A reorder placed today could arrive ${shortDate(arrivalDate(row, asOf))}.`
    : "No run-out inside the planning window.";
  return {
    sentence,
    inputs: baseInputs(row),
    formula: "Run-out = first day that stock on hand, plus what is on the way, minus expected use goes below zero.",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyArrival(row: ItemRowData, asOf: string, from: string): WhyContent {
  return {
    sentence: `An order placed today takes ${days(row.lead_days)} to arrive from ${row.vendor_name}, so it would land ${shortDate(arrivalDate(row, asOf))}.`,
    inputs: [
      { label: "Lead time", value: days(row.lead_days), source: SOURCE.lead },
      { label: "Safety buffer", value: days(row.safety_days), source: "Extra days of cover we plan for" },
      { label: "Last day to order", value: row.order_by_date ? shortDate(row.order_by_date) : "—", source: "Run-out minus lead time" },
    ],
    formula: "Earliest arrival = today + lead time.  Last day to order = run-out date − lead time.",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyGap(row: ItemRowData, asOf: string, from: string): WhyContent {
  return {
    sentence:
      row.days_late > 0
        ? `Stock runs out ${days(row.days_late)} before a reorder placed today could arrive.`
        : "A reorder placed today would arrive before stock runs out. The last day to order is close, though.",
    inputs: [
      { label: "Runs out", value: row.run_out_date ? shortDate(row.run_out_date) : "—", source: SOURCE.demand },
      { label: "Reorder could land", value: shortDate(arrivalDate(row, asOf)), source: SOURCE.lead },
    ],
    formula: "Days short = earliest arrival − run-out date (never below zero).",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyOrderQty(row: ItemRowData, asOf: string, from: string): WhyContent {
  return {
    sentence:
      row.suggested_qty > 0
        ? `Order about ${qty(row.suggested_qty, row.uom)} so you are covered for the safety buffer plus four weeks after it lands.`
        : "No new order is suggested: projected stock on the day a new order would land already covers the weeks after it.",
    inputs: [
      { label: "Lead time", value: days(row.lead_days), source: SOURCE.lead },
      { label: "Safety buffer", value: days(row.safety_days), source: "Extra days of cover we plan for" },
      { label: "On the way", value: qty(row.incoming_total, row.uom), source: SOURCE.pos },
    ],
    formula: "Suggested order = expected use from arrival through safety buffer + 28 days − projected stock on arrival day.",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyAction(row: ItemRowData, asOf: string, from: string): WhyContent {
  const by = row.order_by_date;
  return {
    sentence: !by
      ? "No order needed yet."
      : by <= asOf
        ? `The last day to order was ${shortDate(by)}. Order today to get stock back as soon as possible.`
        : `Order by ${shortDate(by)}, ${relativeDate(by, asOf)}, to keep stock from running out.`,
    inputs: [
      { label: "Runs out", value: row.run_out_date ? shortDate(row.run_out_date) : "—", source: SOURCE.demand },
      { label: "Lead time", value: days(row.lead_days), source: SOURCE.lead },
    ],
    formula: "Order now = last day to order is within 7 days of today (or already past). Watch = within 28 days.",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyCount(
  sentence: string,
  rows: ItemRowData[],
  rule: string,
  asOf: string,
  from: string,
): WhyContent {
  return {
    sentence,
    inputs: rows.slice(0, 8).map((r) => ({
      label: r.description,
      value: r.days_late > 0 ? `${days(r.days_late)} short` : r.order_by_date ? `order by ${shortDate(r.order_by_date)}` : "—",
      source: r.code,
    })),
    formula: rule,
    asOf: shortDate(asOf),
    href: from,
    hrefLabel: "See them below",
  };
}

export function whyStuckValue(row: StuckRowData, asOf: string, from: string): WhyContent {
  return {
    sentence: row.detail,
    inputs: [
      { label: "Quantity", value: qty(row.qty, row.uom), source: row.at_hcs ? "Harbor Cold Storage" : `Location ${row.location ?? "—"}` },
      { label: "Value at cost", value: money(row.value_at_cost), source: "What it cost, not what it would sell for" },
      ...(row.expiry_date ? [{ label: "Expires", value: shortDate(row.expiry_date), source: `Lot ${row.lot_no ?? "—"}` }] : []),
    ],
    formula: "Stuck = expired or under 6 months of shelf life, more than 6 months of stock, or no recent sales.",
    asOf: shortDate(asOf),
    href: itemHref(row.code, from),
  };
}

export function whyStuckTotal(rows: StuckRowData[], total: number, asOf: string, from: string): WhyContent {
  const top = [...rows].sort((a, b) => b.value_at_cost - a.value_at_cost).slice(0, 5);
  return {
    sentence: `${money(total)} of stock at cost is stuck across ${groupedInt(rows.length)} lots.`,
    inputs: top.map((r) => ({
      label: `${r.description}${r.lot_no ? `, lot ${r.lot_no}` : ""}`,
      value: money(r.value_at_cost),
      source: r.code,
    })),
    formula: "Total = sum of value at cost for every stuck lot. The five largest are listed.",
    asOf: shortDate(asOf),
    href: from,
    hrefLabel: "See the full list below",
  };
}

export function itemWhy(d: ItemDetail, asOf: string) {
  const href = "#math";
  const hrefLabel = "See the full working";
  const stamp = shortDate(asOf);
  const v = d.verdict;
  const sellableLots = d.lots.filter((l) => l.status === "sellable");
  const onWay = d.incoming.reduce((sum, i) => sum + i.qty, 0);
  const daily = v ? v.demand_next_30d / 30 : 0;
  const runsIn = v?.run_out_date ? daysBetween(asOf, v.run_out_date) : null;
  return {
    onHand: {
      sentence: `${qty(d.sellable, d.uom)} is on hand and sellable today.`,
      inputs: sellableLots.slice(0, 8).map((l) => ({
        label: `${l.location}, lot ${l.lot_no}`,
        value: qty(l.qty, l.uom),
        source: l.expiry_date ? `Expires ${shortDate(l.expiry_date)}` : SOURCE.stock,
      })),
      formula: "On hand = sum of sellable lots at NB, PVD and HCS. QA hold and damaged stock are not counted.",
      asOf: stamp,
      href,
      hrefLabel,
    } satisfies WhyContent,
    onWay: {
      sentence: d.incoming.length
        ? `${qty(onWay, d.uom)} is due in on ${d.incoming.length} open ${d.incoming.length === 1 ? "order" : "orders"}.`
        : "Nothing is on order.",
      inputs: d.incoming.map((i) => ({
        label: i.source === "dana" ? "You phoned in" : i.ref,
        value: qty(i.qty, d.uom),
        source: `Arriving ${shortDate(i.eta)}`,
      })),
      formula: "On the way = open purchase orders, plus anything you told us. Overdue orders are assumed to land in 7 days (domestic) or 14 (imports).",
      asOf: stamp,
      href,
      hrefLabel,
    } satisfies WhyContent,
    dailyUse: {
      sentence: `About ${perDay(daily, d.uom)} is expected to ship over the next 30 days.`,
      inputs: [
        { label: "Expected use, next 30 days", value: qty(v?.demand_next_30d ?? 0, d.uom), source: SOURCE.demand },
        { label: "Days in the window", value: "30", source: "Fixed" },
      ],
      formula: "Daily use = expected use over 30 days ÷ 30. Shown for reference; the plan itself works day by day.",
      asOf: stamp,
      href,
      hrefLabel,
    } satisfies WhyContent,
    lead: {
      sentence: `A new order from ${d.vendor_name} takes ${days(d.lead_days)} to arrive.`,
      inputs: [
        { label: "Lead time", value: days(d.lead_days), source: SOURCE.lead },
        { label: "Safety buffer", value: days(d.safety_days), source: "Extra days of cover we plan for" },
      ],
      formula: "Change either number on the Lead times page and the plan updates.",
      asOf: stamp,
      href: "/vendors",
      hrefLabel: "Open Lead times",
    } satisfies WhyContent,
    cover: {
      sentence:
        v?.run_out_date && runsIn !== null
          ? `Stock lasts about ${days(runsIn)}, running out around ${shortDate(v.run_out_date)}.`
          : "Stock lasts past the planning window.",
      inputs: [
        { label: "Runs out", value: v?.run_out_date ? shortDate(v.run_out_date) : "—", source: SOURCE.demand },
        { label: "Today", value: stamp, source: "Reference date for this plan" },
      ],
      formula: "Days of cover = run-out date − today.",
      asOf: stamp,
      href,
      hrefLabel,
    } satisfies WhyContent,
  };
}
