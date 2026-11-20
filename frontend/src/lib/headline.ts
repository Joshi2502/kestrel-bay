import { moneyShort } from "./format.ts";
import type { Dashboard } from "./types";

/** Items that really run out before a reorder placed today could land. */
export function runOutFirst(data: Pick<Dashboard, "order_now">): number {
  return data.order_now.filter((r) => r.days_late > 0).length;
}

/** Items that dip below zero briefly, until an order already on the way lands. No new order needed. */
export function briefDips(data: Pick<Dashboard, "order_now">): number {
  return data.order_now.filter((r) => r.gap_days > 0).length;
}

/** The one sentence Walt reads. Counts come straight from the dashboard payload. */
export function headlineSentence(data: Pick<Dashboard, "order_now" | "stuck_total_value">): string {
  const total = data.order_now.length;
  const first = runOutFirst(data);
  const dips = briefDips(data);
  const rest = total - first - dips;
  const parts: string[] = [];
  if (total === 0) {
    parts.push("Nothing needs ordering this week.");
  } else if (first === 0 && dips === 0) {
    parts.push(
      `${total} ${total === 1 ? "item needs" : "items need"} an order this week. None will run out before it arrives.`,
    );
  } else {
    if (first > 0) parts.push(`${first} ${first === 1 ? "item runs" : "items run"} out before a reorder can arrive.`);
    if (rest > 0) parts.push(`${rest} ${first > 0 ? "more " : ""}${rest === 1 ? "needs" : "need"} an order this week.`);
    if (dips > 0)
      parts.push(
        `${dips} ${first + rest > 0 ? "more " : ""}${dips === 1 ? "dips" : "dip"} below zero briefly until an order on the way lands.`,
      );
  }
  if (data.stuck_total_value > 0) parts.push(`${moneyShort(data.stuck_total_value)} is tied up in stuck stock.`);
  return parts.join(" ");
}
