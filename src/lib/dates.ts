/** Utilidades de fecha con zona horaria. Las fechas "calendario" se manejan como "YYYY-MM-DD". */
export type Ymd = string;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string | undefined | null): s is Ymd {
  if (!s || !YMD_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function ymdFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Fecha calendario de un instante en una zona horaria concreta. */
export function ymdInTz(date: Date | string, tz: string): Ymd {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = ymdFormatter(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayInTz(tz: string, now: Date = new Date()): Ymd {
  return ymdInTz(now, tz);
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Todos los días entre `from` y `to`, ambos incluidos. */
export function eachDay(from: Ymd, to: Ymd): Ymd[] {
  const out: Ymd[] = [];
  if (from > to) return out;
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Semana de lunes a domingo que contiene la fecha. */
export function weekRange(ymd: Ymd): { from: Ymd; to: Ymd } {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  const from = addDays(ymd, -dow);
  return { from, to: addDays(from, 6) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Mes calendario completo (month = 1..12). */
export function monthRange(year: number, month: number): { from: Ymd; to: Ymd } {
  const mm = String(month).padStart(2, "0");
  const last = String(daysInMonth(year, month)).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
}

export function monthOf(ymd: Ymd): { year: number; month: number } {
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}

/** Temporada (año de inicio) a la que pertenece una fecha. De octubre en adelante es la nueva. */
export function seasonForDate(ymd: Ymd): number {
  const { year, month } = monthOf(ymd);
  return month >= 10 ? year : year - 1;
}

export function seasonBounds(season: number): { start: Ymd; end: Ymd } {
  return { start: `${season}-10-01`, end: `${season + 1}-07-01` };
}

export function seasonLabel(season: number): string {
  return `${season}-${String((season + 1) % 100).padStart(2, "0")}`;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function monthNameEs(month: number): string {
  return MONTHS_ES[month - 1] ?? String(month);
}

export function formatYmd(ymd: Ymd): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} de ${monthNameEs(m)} de ${y}`;
}

export function formatYmdShort(ymd: Ymd): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${monthNameEs(m).slice(0, 3)}`;
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
