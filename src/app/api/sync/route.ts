import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { APP_CONFIG } from "@/config/app";
import { FetchBudget } from "@/lib/cache";
import { addDays, isValidYmd, seasonBounds, seasonForDate, todayInTz } from "@/lib/dates";
import { getPlayerLines } from "@/services/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Precarga la caché en disco sin esperar visitas.
 *   GET /api/sync?desde=2026-10-01&hasta=2026-10-31&n=300
 *   Cabecera: Authorization: Bearer <SYNC_TOKEN>
 * Sin SYNC_TOKEN configurado la ruta no existe (404): consume cuota de las APIs.
 * Repítela (p. ej. con un cron) hasta que "complete" sea true.
 */
export async function GET(req: NextRequest) {
  const token = process.env.SYNC_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!sameToken(given, token)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tz = APP_CONFIG.defaultTimeZone;
  const today = todayInTz(tz);
  const season = seasonForDate(today);
  const q = req.nextUrl.searchParams;
  const from = q.get("desde");
  const to = q.get("hasta");
  const start = isValidYmd(from) ? from : seasonBounds(season).start;
  const end = isValidYmd(to) ? to : today;
  if (start > end) return NextResponse.json({ error: "«desde» es posterior a «hasta»" }, { status: 400 });
  if (end > addDays(today, 1)) return NextResponse.json({ error: "«hasta» no puede ser futura" }, { status: 400 });

  const requested = Number(q.get("n"));
  const max = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 1000) : 300;

  const res = await getPlayerLines(start, end, tz, { type: "all", budget: new FetchBudget(max) });
  return NextResponse.json({
    desde: start,
    hasta: end,
    fuente: res.meta.source,
    complete: res.coverage.complete,
    boxscores: res.coverage.boxscores,
    dias: res.coverage.days,
    avisos: res.meta.warnings.slice(0, 20),
  });
}
