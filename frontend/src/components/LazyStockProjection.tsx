"use client";

import dynamic from "next/dynamic";
import { Bar } from "./Skeleton";
import type { StockProjectionProps } from "./StockProjection";

// Recharts only loads where a chart is actually drawn.
const Chart = dynamic(() => import("./StockProjection").then((m) => m.StockProjection), {
  ssr: false,
  loading: () => <Bar className="h-64 w-full sm:h-72" />,
});

export function LazyStockProjection(props: StockProjectionProps) {
  return <Chart {...props} />;
}
