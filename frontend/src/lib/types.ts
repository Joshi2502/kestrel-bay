export type Uom = "CS" | "LB";
export type Status = "order_now" | "watch" | "handled" | "ok";

export interface ItemRowData {
  code: string;
  description: string;
  category: string;
  vendor_name: string;
  country: string;
  lead_days: number;
  safety_days: number;
  uom: Uom;
  sellable: number;
  on_hold: number;
  committed_total: number;
  incoming_total: number;
  next_eta: string | null;
  demand_next_30d: number;
  status: Status;
  run_out_date: string | null;
  order_by_date: string | null;
  earliest_arrival: string | null;
  days_late: number;
  gap_days: number;
  suggested_qty: number;
  handled_note: string | null;
  headline: string;
}

export interface StuckRowData {
  code: string;
  description: string;
  location: string | null;
  lot_no: string | null;
  qty: number;
  uom: Uom;
  value_at_cost: number;
  reasons: ("expired" | "expiring" | "long" | "dead")[];
  expiry_date: string | null;
  at_hcs: boolean;
  detail: string;
}

export interface DataNote {
  kind: string;
  message: string;
  count: number;
}

export interface Dashboard {
  as_of: string;
  order_now: ItemRowData[];
  watch: ItemRowData[];
  handled: ItemRowData[];
  ok_count: number;
  stuck: StuckRowData[];
  stuck_total_value: number;
  data_notes: DataNote[];
}

export interface LotData {
  location: string;
  lot_no: string;
  qty: number;
  uom: Uom;
  expiry_date: string | null;
  unit_cost: number | null;
  status: "sellable" | "hold" | "damaged";
  is_adjustment: boolean;
}

export interface IncomingData {
  source: "po" | "dana";
  ref: string;
  qty: number;
  eta: string;
  vendor_said: string | null;
  overdue: boolean;
}

export interface MonthHistory {
  year: number;
  month: number;
  actual: number;
  corrected: number;
  stockout_days: number;
  partial: boolean;
}

export interface MonthForecast {
  year: number;
  month: number;
  qty: number;
}

export interface HandledInfo {
  note: string;
  qty: number | null;
  expected_date: string | null;
  expires_on: string;
}

export interface ItemDetail {
  code: string;
  description: string;
  category: string;
  uom: Uom;
  vendor_name: string;
  country: string;
  lead_days: number;
  safety_days: number;
  planned: boolean;
  verdict: ItemRowData | null;
  sellable: number;
  on_hold: number;
  damaged: number;
  lots: LotData[];
  committed_by_month: { month: string; qty: number }[];
  incoming: IncomingData[];
  history: MonthHistory[];
  forecast: MonthForecast[];
  level_factor: number;
  stockouts: { start: string; end: string }[];
  projection: { date: string; qty: number }[];
  math: string[];
  handled: HandledInfo | null;
  stuck: StuckRowData[];
}

export interface Vendor {
  code: string;
  name: string;
  country: string;
  lead_time_days_system: number | null;
  lead_time_days: number | null;
  safety_days: number;
}
