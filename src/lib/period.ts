import { monthNameEs, monthRange, seasonBounds, todayInTz, weekRange, formatYmdShort, type Ymd } from "@/lib/dates";

export type PeriodMode = "temporada" | "semana" | "mes";

export interface ResolvedPeriod {
  mode: PeriodMode;
  from: Ymd;
  to: Ymd;
  label: string;
}

export function parseMode(v: string | undefined): PeriodMode {
  return v === "semana" || v === "mes" ? v : "temporada";
}

/** "2026-10" → { year, month }. Cualquier otro valor se ignora. */
export function parseMonthParam(v: string | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

export function resolvePeriod(
  mode: PeriodMode,
  opts: { season: number; tz: string; fecha: Ymd; mes?: string },
): ResolvedPeriod {
  const today = todayInTz(opts.tz);
  if (mode === "semana") {
    const w = weekRange(opts.fecha);
    return {
      mode,
      from: w.from,
      to: w.to,
      label: `Semana del ${formatYmdShort(w.from)} al ${formatYmdShort(w.to)} (lunes a domingo)`,
    };
  }
  if (mode === "mes") {
    const m = parseMonthParam(opts.mes) ?? { year: Number(opts.fecha.slice(0, 4)), month: Number(opts.fecha.slice(5, 7)) };
    const r = monthRange(m.year, m.month);
    return { mode, from: r.from, to: r.to, label: `${monthNameEs(m.month)} de ${m.year} (mes calendario)` };
  }
  const b = seasonBounds(opts.season);
  return {
    mode,
    from: b.start,
    to: today < b.end ? today : b.end,
    label: `Temporada completa hasta hoy`,
  };
}
