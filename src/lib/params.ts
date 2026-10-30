import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { isValidTimeZone, isValidYmd, seasonForDate, todayInTz, type Ymd } from "@/lib/dates";

export type SearchParams = Record<string, string | string[] | undefined>;
export type PageProps<P = object> = { params: Promise<P>; searchParams: Promise<SearchParams> };

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function getTz(): Promise<string> {
  const c = await cookies();
  const tz = c.get("tz")?.value;
  return isValidTimeZone(tz) ? tz : APP_CONFIG.defaultTimeZone;
}

export function currentSeason(tz: string): number {
  return seasonForDate(todayInTz(tz));
}

export function seasonOptions(tz: string): number[] {
  const cur = currentSeason(tz);
  return Array.from({ length: APP_CONFIG.seasonsToOffer }, (_, i) => cur - i);
}

export function parseSeason(v: string | undefined, tz: string): number {
  const n = Number(v);
  const opts = seasonOptions(tz);
  return Number.isInteger(n) && opts.includes(n) ? n : currentSeason(tz);
}

export function parseDate(v: string | undefined, tz: string): Ymd {
  return isValidYmd(v) ? v : todayInTz(tz);
}

export function parseIntIn(v: string | undefined, allowed: readonly number[], fallback: number): number {
  const n = Number(v);
  return allowed.includes(n) ? n : fallback;
}

/** Construye un href conservando los parámetros actuales y cambiando los indicados. */
export function withParams(base: string, current: SearchParams, changes: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = one(v);
    if (val !== undefined && val !== "") q.set(k, val);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === "") q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
