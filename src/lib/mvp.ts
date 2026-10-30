import { dedupeLines } from "@/lib/averages";
import { ymdInTz, type Ymd } from "@/lib/dates";
import { rateLine, type Rating } from "@/lib/rating";
import type { PlayerGameLine } from "@/lib/types";

export interface RatedLine {
  line: PlayerGameLine;
  rating: Rating;
  /** Fecha del partido en la zona horaria elegida. */
  localDate: Ymd;
}

export interface DayMvp {
  winner: RatedLine | null;
  ranking: RatedLine[];
  /** Jugadores con la misma valoración que el ganador. */
  tiedAtTop: RatedLine[];
  /** Criterio que decidió el desempate, si lo hubo. */
  tieBreak?: string;
  considered: number;
  /** Líneas descartadas por estadísticas incompletas. */
  excluded: number;
}

export function rateAll(lines: PlayerGameLine[], tz: string): { rated: RatedLine[]; excluded: number } {
  const rated: RatedLine[] = [];
  let excluded = 0;
  for (const line of dedupeLines(lines)) {
    if (!line.played) continue;
    const rating = rateLine(line);
    if (!rating.complete) {
      excluded++;
      continue;
    }
    rated.push({ line, rating, localDate: ymdInTz(line.startUtc, tz) });
  }
  return { rated, excluded };
}

/** Desempate del MVP diario: valoración → puntos → rebotes+asistencias → menos minutos → nombre. */
const DAY_TIEBREAKS: Array<{ name: string; cmp: (a: RatedLine, b: RatedLine) => number }> = [
  { name: "valoración", cmp: (a, b) => (b.rating.total ?? 0) - (a.rating.total ?? 0) },
  { name: "más puntos", cmp: (a, b) => (b.line.stats.pts ?? 0) - (a.line.stats.pts ?? 0) },
  {
    name: "más rebotes + asistencias",
    cmp: (a, b) =>
      (b.line.stats.reb ?? 0) + (b.line.stats.ast ?? 0) - ((a.line.stats.reb ?? 0) + (a.line.stats.ast ?? 0)),
  },
  { name: "menos minutos jugados", cmp: (a, b) => (a.line.stats.min ?? Infinity) - (b.line.stats.min ?? Infinity) },
  { name: "orden alfabético", cmp: (a, b) => a.line.playerName.localeCompare(b.line.playerName, "es") },
];

/** Reglas: solo partidos de la fecha local indicada; el llamador debe pasar únicamente partidos finalizados. */
export function mvpOfDay(lines: PlayerGameLine[], day: Ymd, tz: string): DayMvp {
  const { rated, excluded } = rateAll(lines, tz);
  const pool = rated.filter((r) => r.localDate === day);
  if (pool.length === 0) {
    return { winner: null, ranking: [], tiedAtTop: [], considered: 0, excluded };
  }

  const ranking = [...pool].sort((a, b) => {
    for (const t of DAY_TIEBREAKS) {
      const c = t.cmp(a, b);
      if (c !== 0) return c;
    }
    return 0;
  });
  const winner = ranking[0];
  const tiedAtTop = ranking.filter((r) => r.rating.total === winner.rating.total);

  let tieBreak: string | undefined;
  if (tiedAtTop.length > 1) {
    const [a, b] = tiedAtTop;
    tieBreak = DAY_TIEBREAKS.slice(1).find((t) => t.cmp(a, b) !== 0)?.name ?? "orden alfabético";
  }

  return { winner, ranking, tiedAtTop, tieBreak, considered: pool.length, excluded };
}

export interface PeriodPlayer {
  playerId: string;
  playerName: string;
  teamAbbr: string;
  headshot?: string;
  /** Suma de valoraciones partido a partido (no un promedio). */
  total: number;
  games: number;
  avgRating: number;
  best: number;
  totals: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number };
  /** Partidos del jugador excluidos por estadísticas incompletas. */
  excludedGames: number;
  contributions: Array<{
    gameKey: string;
    date: Ymd;
    opponent: string;
    isHome: boolean;
    rating: number;
    pts: number;
    reb: number;
    ast: number;
  }>;
  /** Valoración acumulada tras cada partido (evolución). */
  cumulative: Array<{ date: Ymd; value: number }>;
}

export interface PeriodMvp {
  from: Ymd;
  to: Ymd;
  winner: PeriodPlayer | null;
  ranking: PeriodPlayer[];
  tiedAtTop: PeriodPlayer[];
  tieBreak?: string;
  considered: number;
  excluded: number;
}

/** Desempate del periodo: total → más partidos → valoración media → puntos totales → nombre. */
const PERIOD_TIEBREAKS: Array<{ name: string; cmp: (a: PeriodPlayer, b: PeriodPlayer) => number }> = [
  { name: "valoración total", cmp: (a, b) => b.total - a.total },
  { name: "más partidos disputados", cmp: (a, b) => b.games - a.games },
  { name: "mayor valoración media", cmp: (a, b) => b.avgRating - a.avgRating },
  { name: "más puntos totales", cmp: (a, b) => b.totals.pts - a.totals.pts },
  { name: "orden alfabético", cmp: (a, b) => a.playerName.localeCompare(b.playerName, "es") },
];

export function mvpOfPeriod(lines: PlayerGameLine[], from: Ymd, to: Ymd, tz: string): PeriodMvp {
  const { rated, excluded } = rateAll(lines, tz);
  const pool = rated.filter((r) => r.localDate >= from && r.localDate <= to);

  // Jugadores con partidos excluidos, para avisar que su total puede estar subestimado.
  const excludedBy = new Map<string, number>();
  for (const line of dedupeLines(lines)) {
    if (!line.played) continue;
    const d = ymdInTz(line.startUtc, tz);
    if (d < from || d > to) continue;
    if (!rateLine(line).complete) excludedBy.set(line.playerId, (excludedBy.get(line.playerId) ?? 0) + 1);
  }

  const byPlayer = new Map<string, PeriodPlayer>();
  for (const r of pool.sort((a, b) => a.line.startUtc.localeCompare(b.line.startUtc))) {
    const l = r.line;
    let p = byPlayer.get(l.playerId);
    if (!p) {
      p = {
        playerId: l.playerId,
        playerName: l.playerName,
        teamAbbr: l.teamAbbr,
        headshot: l.headshot,
        total: 0,
        games: 0,
        avgRating: 0,
        best: -Infinity,
        totals: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 },
        excludedGames: excludedBy.get(l.playerId) ?? 0,
        contributions: [],
        cumulative: [],
      };
      byPlayer.set(l.playerId, p);
    }
    const value = r.rating.total ?? 0;
    p.total = Math.round((p.total + value) * 100) / 100;
    p.games++;
    p.teamAbbr = l.teamAbbr;
    p.headshot = l.headshot ?? p.headshot;
    p.best = Math.max(p.best, value);
    p.totals.pts += l.stats.pts ?? 0;
    p.totals.reb += l.stats.reb ?? 0;
    p.totals.ast += l.stats.ast ?? 0;
    p.totals.stl += l.stats.stl ?? 0;
    p.totals.blk += l.stats.blk ?? 0;
    p.totals.tov += l.stats.tov ?? 0;
    p.contributions.push({
      gameKey: l.gameKey,
      date: r.localDate,
      opponent: l.opponentAbbr,
      isHome: l.isHome,
      rating: value,
      pts: l.stats.pts ?? 0,
      reb: l.stats.reb ?? 0,
      ast: l.stats.ast ?? 0,
    });
    p.cumulative.push({ date: r.localDate, value: p.total });
  }

  const ranking = [...byPlayer.values()].map((p) => ({ ...p, avgRating: p.total / p.games }));
  ranking.sort((a, b) => {
    for (const t of PERIOD_TIEBREAKS) {
      const c = t.cmp(a, b);
      if (c !== 0) return c;
    }
    return 0;
  });

  const winner = ranking[0] ?? null;
  const tiedAtTop = winner ? ranking.filter((p) => p.total === winner.total) : [];
  let tieBreak: string | undefined;
  if (tiedAtTop.length > 1) {
    const [a, b] = tiedAtTop;
    tieBreak = PERIOD_TIEBREAKS.slice(1).find((t) => t.cmp(a, b) !== 0)?.name ?? "orden alfabético";
  }

  return { from, to, winner, ranking, tiedAtTop, tieBreak, considered: pool.length, excluded };
}
