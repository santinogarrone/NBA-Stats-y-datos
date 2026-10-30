const nf = new Map<number, Intl.NumberFormat>();
function formatter(d: number) {
  let f = nf.get(d);
  if (!f) {
    f = new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });
    nf.set(d, f);
  }
  return f;
}

/** Texto para un dato que la fuente no informó. Nunca se muestra como 0. */
export const NA = "—";

export function fmt(n: number | null | undefined, decimals = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? NA : formatter(decimals).format(n);
}

/** Proporción 0–1 → "48,5 %". */
export function fmtPct(p: number | null | undefined, decimals = 1): string {
  return p === null || p === undefined || !Number.isFinite(p) ? NA : `${formatter(decimals).format(p * 100)} %`;
}

/** Récord de victorias y derrotas con porcentaje de tres decimales estilo NBA (".625"). */
export function fmtWinPct(p: number | null | undefined): string {
  if (p === null || p === undefined) return NA;
  return p >= 1 ? "1,000" : formatter(3).format(p).replace(/^0/, "");
}

export function fmtSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NA;
  return `${n > 0 ? "+" : ""}${formatter(decimals).format(n)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function playerSlug(id: string): string {
  return id.replace(":", "-");
}
export function playerIdFromSlug(slug: string): string {
  return slug.replace("-", ":");
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
