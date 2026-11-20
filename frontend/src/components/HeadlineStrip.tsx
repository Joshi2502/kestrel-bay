import { moneyShort, weekdayDate } from "@/lib/format";
import { headlineSentence } from "@/lib/headline";
import type { Dashboard } from "@/lib/types";
import { whyCount, whyStuckTotal } from "@/lib/why";
import { Why } from "./Why";

// The five-second read: one sentence, then three figures set as a typographic strip.
export function HeadlineStrip({ data }: { data: Dashboard }) {
  const asOf = data.as_of;
  const figure = "min-w-0 border-l border-border pl-4 first:border-l-0 first:pl-0 sm:pl-6 sm:first:pl-0";
  return (
    <section aria-label="Summary">
      <p className="text-xs text-muted">As of {weekdayDate(asOf)}</p>
      <h1 className="mt-1 max-w-3xl font-serif text-xl font-normal sm:text-2xl">{headlineSentence(data)}</h1>
      <dl className="mt-5 flex gap-4 sm:gap-8">
        <div className={figure}>
          <dd className="text-xl font-semibold">
            <Why
              content={whyCount(
                `${data.order_now.length} items need an order this week, or will run out before a reorder could arrive.`,
                data.order_now,
                "Order now = the last day to order is within 7 days of today, or already past.",
                asOf,
                "#order-now",
              )}
            >
              {data.order_now.length}
            </Why>
          </dd>
          <dt className="text-sm text-muted">to order now</dt>
        </div>
        <div className={figure}>
          <dd className="text-xl font-semibold">
            <Why
              content={whyCount(
                `${data.watch.length} items have a last day to order within the next four weeks.`,
                data.watch,
                "Watch = the last day to order is 8 to 28 days from today.",
                asOf,
                "#watch",
              )}
            >
              {data.watch.length}
            </Why>
          </dd>
          <dt className="text-sm text-muted">to watch</dt>
        </div>
        <div className={figure}>
          <dd className="text-xl font-semibold">
            <Why content={whyStuckTotal(data.stuck, data.stuck_total_value, asOf, "#stuck")}>
              {moneyShort(data.stuck_total_value)}
            </Why>
          </dd>
          <dt className="text-sm text-muted">stuck, at cost</dt>
        </div>
      </dl>
    </section>
  );
}
