import { APP_CONFIG } from "@/config/app";
import { TEAM_BY_ABBR } from "@/config/nba-structure";
import {
  fg3Pct,
  fgPct,
  ftPct,
  perGame,
  ratingPerGame,
  type PlayerAggregate,
} from "@/lib/averages";
import type { Conference } from "@/lib/types";

export type RankingId =
  | "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m"
  | "fgPct" | "fg3Pct" | "ftPct" | "ratingPg" | "ratingTotal";

export interface RankingDef {
  id: RankingId;
  label: string;
  short: string;
  kind: "avg" | "pct" | "rating-avg" | "rating-total";
  decimals: number;
  value: (a: PlayerAggregate) => number | null;
}

export const RANKINGS: RankingDef[] = [
  { id: "pts", label: "Puntos por partido", short: "PTS", kind: "avg", decimals: 1, value: (a) => perGame(a, "pts") },
  { id: "reb", label: "Rebotes por partido", short: "REB", kind: "avg", decimals: 1, value: (a) => perGame(a, "reb") },
  { id: "ast", label: "Asistencias por partido", short: "AST", kind: "avg", decimals: 1, value: (a) => perGame(a, "ast") },
  { id: "stl", label: "Robos por partido", short: "ROB", kind: "avg", decimals: 1, value: (a) => perGame(a, "stl") },
  { id: "blk", label: "Bloqueos por partido", short: "BLQ", kind: "avg", decimals: 1, value: (a) => perGame(a, "blk") },
  { id: "fg3m", label: "Triples convertidos por partido", short: "3PM", kind: "avg", decimals: 1, value: (a) => perGame(a, "fg3m") },
  { id: "fgPct", label: "% de tiros de campo", short: "FG%", kind: "pct", decimals: 1, value: fgPct },
  { id: "fg3Pct", label: "% de triples", short: "3P%", kind: "pct", decimals: 1, value: fg3Pct },
  { id: "ftPct", label: "% de tiros libres", short: "TL%", kind: "pct", decimals: 1, value: ftPct },
  { id: "ratingPg", label: "Valoración por partido", short: "VAL/P", kind: "rating-avg", decimals: 1, value: ratingPerGame },
  { id: "ratingTotal", label: "Valoración total acumulada", short: "VAL", kind: "rating-total", decimals: 1, value: (a) => (a.ratedGames > 0 ? a.ratingTotal : null) },
];

export const RANKING_BY_ID = new Map(RANKINGS.map((r) => [r.id, r]));

export interface RankingOptions {
  limit: number;
  /** Mínimo de partidos. Si no se indica, se calcula como proporción del máximo de la muestra. */
  minGames?: number;
  team?: string;
  conference?: Conference;
}

export interface RankingEntry {
  rank: number;
  player: PlayerAggregate;
  value: number;
  /** Intentos que respaldan un porcentaje. */
  attempts?: number;
}

export interface RankingResult {
  def: RankingDef;
  entries: RankingEntry[];
  minGames: number;
  minAttempts?: number;
  /** Texto del criterio de elegibilidad aplicado, para mostrarlo en pantalla. */
  criteria: string;
  eligible: number;
  excluded: number;
}

export function defaultMinGames(all: PlayerAggregate[]): number {
  const max = all.reduce((m, a) => Math.max(m, a.games), 0);
  return Math.max(1, Math.round(max * APP_CONFIG.rankings.minGamesShare));
}

const attemptsFor = (id: RankingId, a: PlayerAggregate) =>
  id === "fgPct" ? a.totals.fga : id === "fg3Pct" ? a.totals.fg3a : id === "ftPct" ? a.totals.fta : undefined;

const minAttemptRate = (id: RankingId) =>
  id === "fgPct" ? APP_CONFIG.rankings.minAttemptsPerGame.fg
  : id === "fg3Pct" ? APP_CONFIG.rankings.minAttemptsPerGame.fg3
  : id === "ftPct" ? APP_CONFIG.rankings.minAttemptsPerGame.ft
  : 0;

export function buildRanking(all: PlayerAggregate[], id: RankingId, opts: RankingOptions): RankingResult {
  const def = RANKING_BY_ID.get(id)!;
  const minGames = opts.minGames ?? defaultMinGames(all);
  const maxGames = all.reduce((m, a) => Math.max(m, a.games), 0);

  // Los intentos mínimos escalan con la muestra para que el criterio sea justo al inicio de temporada.
  const rate = minAttemptRate(id);
  const minAttempts = rate > 0 ? Math.max(1, Math.round(rate * Math.max(1, maxGames) * APP_CONFIG.rankings.minGamesShare)) : undefined;

  let pool = all;
  if (opts.team) pool = pool.filter((a) => a.teamAbbr === opts.team);
  if (opts.conference) pool = pool.filter((a) => TEAM_BY_ABBR.get(a.teamAbbr)?.conference === opts.conference);

  const ranked: RankingEntry[] = [];
  let excluded = 0;
  for (const player of pool) {
    const attempts = attemptsFor(id, player);
    const value = def.value(player);
    const gamesOk = player.games >= minGames;
    const attemptsOk = minAttempts === undefined || (attempts ?? 0) >= minAttempts;
    // Valoración total: se exige la misma muestra de partidos solo si el usuario la fija explícitamente.
    const needsGames = def.kind !== "rating-total" || opts.minGames !== undefined;
    if (value === null || (needsGames && !gamesOk) || !attemptsOk) {
      excluded++;
      continue;
    }
    ranked.push({ rank: 0, player, value, attempts });
  }

  ranked.sort(
    (a, b) =>
      b.value - a.value ||
      b.player.games - a.player.games ||
      a.player.playerName.localeCompare(b.player.playerName, "es"),
  );

  // Empates exactos comparten posición.
  let prev: number | null = null;
  let prevRank = 0;
  ranked.forEach((e, i) => {
    e.rank = prev !== null && e.value === prev ? prevRank : i + 1;
    prev = e.value;
    prevRank = e.rank;
  });

  const parts: string[] = [];
  if (def.kind !== "rating-total" || opts.minGames !== undefined) parts.push(`mínimo ${minGames} partidos`);
  if (minAttempts) parts.push(`mínimo ${minAttempts} intentos`);
  if (def.kind === "pct") parts.push("porcentaje calculado con aciertos e intentos totales");
  if (def.kind === "rating-total") parts.push("solo partidos con estadísticas completas");
  if (opts.team) parts.push(`equipo ${opts.team}`);
  if (opts.conference) parts.push(`conferencia ${opts.conference === "East" ? "Este" : "Oeste"}`);

  return {
    def,
    entries: ranked.slice(0, opts.limit),
    minGames,
    minAttempts,
    criteria: parts.join(" · "),
    eligible: ranked.length,
    excluded,
  };
}
