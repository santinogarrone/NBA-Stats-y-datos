import { rateLine } from "@/lib/rating";
import type { PlayerGameLine, StatKey } from "@/lib/types";

/** Una línea por (partido, jugador). Si llegan repetidas se conserva la primera. */
export function dedupeLines(lines: PlayerGameLine[]): PlayerGameLine[] {
  const seen = new Set<string>();
  const out: PlayerGameLine[] = [];
  for (const l of lines) {
    const k = `${l.gameKey}|${l.playerId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

type Totals = Record<StatKey, number>;
type Counts = Record<StatKey, number>;

export interface PlayerAggregate {
  playerId: string;
  playerName: string;
  /** Equipo de la última línea (el más reciente). */
  teamAbbr: string;
  teams: string[];
  headshot?: string;
  position?: string;
  jersey?: string;
  /** Partidos efectivamente disputados. */
  games: number;
  /** Partidos con la valoración completa. */
  ratedGames: number;
  /** Cuántos partidos aportan dato en cada estadística (para no dividir por partidos sin dato). */
  counts: Counts;
  totals: Totals;
  ratingTotal: number;
  /** true si algún partido quedó fuera de la valoración por datos incompletos. */
  ratingPartial: boolean;
  firstDate: string;
  lastDate: string;
}

const zeroTotals = (): Totals => ({
  min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
  ftm: 0, fta: 0, oreb: 0, dreb: 0, pf: 0, plusMinus: 0,
});

/**
 * Agrega líneas por jugador. Cada partido se cuenta una sola vez aunque el jugador haya
 * cambiado de equipo: el equipo solo sirve para desglosar (ver `splitByTeam`).
 */
export function aggregatePlayers(input: PlayerGameLine[]): PlayerAggregate[] {
  const map = new Map<string, PlayerAggregate & { _last: string }>();
  for (const l of dedupeLines(input)) {
    if (!l.played) continue;
    let a = map.get(l.playerId);
    if (!a) {
      a = {
        playerId: l.playerId,
        playerName: l.playerName,
        teamAbbr: l.teamAbbr,
        teams: [],
        games: 0,
        ratedGames: 0,
        counts: zeroTotals(),
        totals: zeroTotals(),
        ratingTotal: 0,
        ratingPartial: false,
        firstDate: l.etDate,
        lastDate: l.etDate,
        _last: l.startUtc,
      };
      map.set(l.playerId, a);
    }
    a.games++;
    if (!a.teams.includes(l.teamAbbr)) a.teams.push(l.teamAbbr);
    if (l.startUtc >= a._last) {
      a._last = l.startUtc;
      a.teamAbbr = l.teamAbbr;
      a.lastDate = l.etDate;
      a.headshot = l.headshot ?? a.headshot;
      a.position = l.position ?? a.position;
      a.jersey = l.jersey ?? a.jersey;
    }
    if (l.etDate < a.firstDate) a.firstDate = l.etDate;

    for (const k of Object.keys(a.totals) as StatKey[]) {
      const v = l.stats[k];
      if (v !== null && v !== undefined) {
        a.totals[k] += v;
        a.counts[k]++;
      }
    }
    const r = rateLine(l);
    if (r.complete && r.total !== null) {
      a.ratedGames++;
      a.ratingTotal += r.total;
    } else a.ratingPartial = true;
  }
  return [...map.values()].map(({ _last, ...rest }) => (void _last, rest));
}

/** Promedio por partido = total / partidos con dato. null si no hay ningún dato. */
export function perGame(a: PlayerAggregate, k: StatKey): number | null {
  return a.counts[k] > 0 ? a.totals[k] / a.counts[k] : null;
}

/** true si algún partido no aportó dato para esa estadística (el promedio es parcial). */
export function isPartial(a: PlayerAggregate, k: StatKey): boolean {
  return a.counts[k] > 0 && a.counts[k] < a.games;
}

/** Porcentaje desde totales de aciertos e intentos (no el promedio de porcentajes por partido). */
export function shootingPct(made: number, attempted: number): number | null {
  return attempted > 0 ? made / attempted : null;
}

export const fgPct = (a: PlayerAggregate) => shootingPct(a.totals.fgm, a.totals.fga);
export const fg3Pct = (a: PlayerAggregate) => shootingPct(a.totals.fg3m, a.totals.fg3a);
export const ftPct = (a: PlayerAggregate) => shootingPct(a.totals.ftm, a.totals.fta);

export function ratingPerGame(a: PlayerAggregate): number | null {
  return a.ratedGames > 0 ? a.ratingTotal / a.ratedGames : null;
}

/** Desglose por equipo para jugadores traspasados. */
export function splitByTeam(lines: PlayerGameLine[], playerId: string): Map<string, PlayerAggregate> {
  const byTeam = new Map<string, PlayerGameLine[]>();
  for (const l of dedupeLines(lines)) {
    if (l.playerId !== playerId) continue;
    const arr = byTeam.get(l.teamAbbr) ?? [];
    arr.push(l);
    byTeam.set(l.teamAbbr, arr);
  }
  const out = new Map<string, PlayerAggregate>();
  for (const [team, ls] of byTeam) {
    const [agg] = aggregatePlayers(ls);
    if (agg) out.set(team, agg);
  }
  return out;
}
