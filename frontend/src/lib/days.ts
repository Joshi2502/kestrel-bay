export type ParsedDays = { ok: true; value: number } | { ok: false };

/** A whole number of days from a text box. Blank is not zero; the limits match the API (max 365). */
export function parseDays(text: string, min: number): ParsedDays {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= min && value <= 365 ? { ok: true, value } : { ok: false };
}
