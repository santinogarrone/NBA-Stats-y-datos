import {
  fg3Pct,
  fgPct,
  ftPct,
  perGame,
  ratingPerGame,
  type PlayerAggregate,
} from "@/lib/averages";
import { normalizeName } from "@/lib/format";
import type { PlayerInfo } from "@/lib/types";

export interface PlayerRow {
  id: string;
  name: string;
  teamAbbr?: string;
  position?: string;
  jersey?: string;
  age?: number;
  height?: string;
  headshot?: string;
  /** null si no tiene partidos en el periodo cargado. */
  agg: PlayerAggregate | null;
}

type Getter = (r: PlayerRow) => number | string | null;

export const PLAYER_SORTERS: Record<string, Getter> = {
  name: (r) => r.name,
  team: (r) => r.teamAbbr ?? null,
  games: (r) => r.agg?.games ?? null,
  min: (r) => (r.agg ? perGame(r.agg, "min") : null),
  pts: (r) => (r.agg ? perGame(r.agg, "pts") : null),
  reb: (r) => (r.agg ? perGame(r.agg, "reb") : null),
  ast: (r) => (r.agg ? perGame(r.agg, "ast") : null),
  stl: (r) => (r.agg ? perGame(r.agg, "stl") : null),
  blk: (r) => (r.agg ? perGame(r.agg, "blk") : null),
  tov: (r) => (r.agg ? perGame(r.agg, "tov") : null),
  fg3m: (r) => (r.agg ? perGame(r.agg, "fg3m") : null),
  fgPct: (r) => (r.agg ? fgPct(r.agg) : null),
  fg3Pct: (r) => (r.agg ? fg3Pct(r.agg) : null),
  ftPct: (r) => (r.agg ? ftPct(r.agg) : null),
  ratingPg: (r) => (r.agg ? ratingPerGame(r.agg) : null),
  ratingTotal: (r) => (r.agg && r.agg.ratedGames > 0 ? r.agg.ratingTotal : null),
};

export function sortPlayerRows(rows: PlayerRow[], key: string, dir: "asc" | "desc"): PlayerRow[] {
  const get = PLAYER_SORTERS[key] ?? PLAYER_SORTERS.pts;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return a.name.localeCompare(b.name, "es");
    if (x === null) return 1; // los datos que faltan siempre al final
    if (y === null) return -1;
    if (typeof x === "string" && typeof y === "string") return sign * x.localeCompare(y, "es");
    return sign * ((x as number) - (y as number)) || a.name.localeCompare(b.name, "es");
  });
}

export function defaultDir(key: string): "asc" | "desc" {
  return key === "name" || key === "team" ? "asc" : "desc";
}

/**
 * Une la plantilla (info biográfica) con los agregados estadísticos. Primero por id y, si
 * las fuentes difieren, por nombre normalizado. Los jugadores con estadísticas pero fuera de la
 * plantilla actual (traspasados) se devuelven aparte.
 */
export function joinRoster(
  roster: PlayerInfo[],
  aggs: PlayerAggregate[],
): { current: PlayerRow[]; former: PlayerRow[] } {
  const byId = new Map(aggs.map((a) => [a.playerId, a]));
  const byName = new Map(aggs.map((a) => [normalizeName(a.playerName), a]));
  const used = new Set<string>();

  const current = roster.map((p): PlayerRow => {
    const agg = byId.get(p.id) ?? byName.get(normalizeName(p.name)) ?? null;
    if (agg) used.add(agg.playerId);
    return {
      id: agg?.playerId ?? p.id,
      name: p.name,
      teamAbbr: p.teamAbbr,
      position: p.position ?? agg?.position,
      jersey: p.jersey ?? agg?.jersey,
      age: p.age,
      height: p.height,
      headshot: p.headshot ?? agg?.headshot,
      agg,
    };
  });

  const former = aggs
    .filter((a) => !used.has(a.playerId))
    .map(
      (a): PlayerRow => ({
        id: a.playerId,
        name: a.playerName,
        teamAbbr: a.teamAbbr,
        position: a.position,
        jersey: a.jersey,
        headshot: a.headshot,
        agg: a,
      }),
    );
  return { current, former };
}

export function rowFromAggregate(a: PlayerAggregate): PlayerRow {
  return {
    id: a.playerId,
    name: a.playerName,
    teamAbbr: a.teamAbbr,
    position: a.position,
    jersey: a.jersey,
    headshot: a.headshot,
    agg: a,
  };
}
