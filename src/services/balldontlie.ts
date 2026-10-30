import "server-only";
import { APP_CONFIG } from "@/config/app";
import { ENDPOINTS } from "@/config/endpoints";
import { normalizeAbbr, TEAM_BY_ABBR } from "@/config/nba-structure";
import { cached } from "@/lib/cache";
import { ymdInTz } from "@/lib/dates";
import { createRateWindow, fetchJson, HttpError } from "@/lib/http";
import type {
  Game,
  GameStatus,
  PlayerGameLine,
  PlayerInfo,
  SeasonType,
  StandingRow,
  StatKey,
} from "@/lib/types";

export class BdlUnavailable extends Error {
  constructor(message: string, public reason: "no-key" | "plan" | "rate-limit" | "error") {
    super(message);
    this.name = "BdlUnavailable";
  }
}

/* ------------------------------------------------------------------ */
/* Cliente con clave (solo servidor), límite por minuto y paginación    */
/* ------------------------------------------------------------------ */
const g = globalThis as unknown as { __bdlRate?: ReturnType<typeof createRateWindow> };
const rate = (g.__bdlRate ??= createRateWindow(APP_CONFIG.balldontlie.requestsPerMinute));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const bdlConfigured = () => !!APP_CONFIG.balldontlie.apiKey;

type Params = Record<string, string | number | string[] | number[] | undefined>;

function buildUrl(path: string, params: Params): string {
  const url = new URL(path, ENDPOINTS.balldontlie.base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(`${k}[]`, String(x)));
    else url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function bdlGet<T>(path: string, params: Params = {}): Promise<T> {
  const key = APP_CONFIG.balldontlie.apiKey;
  if (!key) throw new BdlUnavailable("Falta BALLDONTLIE_API_KEY", "no-key");

  const wait = rate.waitTime();
  if (wait > APP_CONFIG.balldontlie.maxWaitMs) {
    throw new BdlUnavailable(
      `Límite de ${APP_CONFIG.balldontlie.requestsPerMinute} solicitudes/min alcanzado`,
      "rate-limit",
    );
  }
  if (wait > 0) await sleep(wait + 50);
  rate.record();

  try {
    return await fetchJson<T>(buildUrl(path, params), {
      headers: { Authorization: key }, // la clave va sin prefijo, según la documentación
      retries: 1,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 401 || e.status === 403) {
        throw new BdlUnavailable("Endpoint no incluido en el plan de BALLDONTLIE", "plan");
      }
      if (e.status === 429) throw new BdlUnavailable("Límite de uso de BALLDONTLIE", "rate-limit");
    }
    throw new BdlUnavailable(e instanceof Error ? e.message : "Error de BALLDONTLIE", "error");
  }
}

interface Page<T> {
  data: T[];
  meta?: { next_cursor?: number | null; per_page?: number };
}

/** Recorre todas las páginas por cursor, con tope de páginas para no agotar el plan. */
async function bdlGetAll<T>(path: string, params: Params): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < APP_CONFIG.balldontlie.maxPages; page++) {
    const res = await bdlGet<Page<T>>(path, {
      ...params,
      per_page: APP_CONFIG.balldontlie.perPage,
      cursor,
    });
    items.push(...(res.data ?? []));
    const next = res.meta?.next_cursor;
    if (!next) return { items, truncated: false };
    cursor = next;
  }
  return { items, truncated: true };
}

/* ------------------------------------------------------------------ */
/* Capacidades del plan                                                */
/* ------------------------------------------------------------------ */
export type BdlCapability = "stats" | "standings";

/** Prueba una vez (y recuerda) si el plan permite el endpoint. */
export async function bdlCan(cap: BdlCapability): Promise<boolean> {
  if (!bdlConfigured()) return false;
  const res = await cached(`bdl:cap:${cap}`, { ttlMs: APP_CONFIG.ttlMs.capability }, async () => {
    try {
      if (cap === "stats") await bdlGet(ENDPOINTS.balldontlie.stats, { per_page: 1 });
      else await bdlGet(ENDPOINTS.balldontlie.standings, { season: new Date().getFullYear() - 1 });
      return true;
    } catch (e) {
      // Un límite de uso no prueba que falte el plan: no se memoriza como "no disponible".
      if (e instanceof BdlUnavailable && e.reason === "plan") return false;
      throw e;
    }
  }).catch(() => null);
  return res?.value === true;
}

/* ------------------------------------------------------------------ */
/* Tipos crudos                                                        */
/* ------------------------------------------------------------------ */
interface RawTeam {
  id: number;
  abbreviation: string;
}
interface RawGame {
  id: number;
  date: string;
  datetime?: string | null;
  season: number;
  status: string;
  period?: number;
  time?: string | null;
  postseason?: boolean;
  postponed?: boolean;
  home_team_score?: number | null;
  visitor_team_score?: number | null;
  home_team: RawTeam;
  visitor_team: RawTeam;
}
interface RawPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  team?: RawTeam | null;
}
interface RawStat {
  min?: string | null;
  fgm?: number | null; fga?: number | null;
  fg3m?: number | null; fg3a?: number | null;
  ftm?: number | null; fta?: number | null;
  oreb?: number | null; dreb?: number | null; reb?: number | null;
  ast?: number | null; stl?: number | null; blk?: number | null;
  turnover?: number | null; pf?: number | null; pts?: number | null;
  plus_minus?: number | null;
  player: RawPlayer;
  team: RawTeam;
  game: { id: number };
}

/* ------------------------------------------------------------------ */
/* Adaptadores                                                         */
/* ------------------------------------------------------------------ */
function gameStatus(g: RawGame): { status: GameStatus; detail: string } {
  if (g.postponed) return { status: "postponed", detail: "Aplazado" };
  if (/^final/i.test(g.status)) return { status: "final", detail: g.status };
  if ((g.period ?? 0) > 0) return { status: "live", detail: `${g.status}${g.time ? ` ${g.time}` : ""}`.trim() };
  return { status: "scheduled", detail: "Programado" };
}

export function adaptGame(g: RawGame): Game | null {
  const home = normalizeAbbr(g.home_team.abbreviation);
  const away = normalizeAbbr(g.visitor_team.abbreviation);
  if (!TEAM_BY_ABBR.has(home) || !TEAM_BY_ABBR.has(away)) return null;

  const startUtc = g.datetime ?? `${g.date.slice(0, 10)}T00:00:00.000Z`;
  // Con hora real se convierte al día de partido de la costa este; sin ella se usa la fecha dada.
  const etDate = g.datetime ? ymdInTz(g.datetime, APP_CONFIG.gameDayTimeZone) : g.date.slice(0, 10);
  const { status, detail } = gameStatus(g);
  const started = status === "final" || status === "live";
  const seasonType: SeasonType = g.postseason ? "playoffs" : "regular";

  return {
    key: `${etDate}_${away}@${home}`,
    source: "balldontlie",
    sourceId: String(g.id),
    startUtc: new Date(startUtc).toISOString(),
    etDate,
    status,
    statusDetail: detail,
    home: { abbr: home, score: started ? (g.home_team_score ?? null) : null },
    away: { abbr: away, score: started ? (g.visitor_team_score ?? null) : null },
    season: g.season,
    seasonType,
  };
}

/** "34", "34:12" o vacío → minutos decimales; null si no hay dato. */
export function parseMinutes(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const m = /^(\d+):(\d{1,2})$/.exec(v.trim());
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const nn = (v: number | null | undefined) => (typeof v === "number" ? v : null);

export function adaptStat(s: RawStat, game: Game): PlayerGameLine | null {
  const abbr = normalizeAbbr(s.team.abbreviation);
  if (abbr !== game.home.abbr && abbr !== game.away.abbr) return null;
  const isHome = abbr === game.home.abbr;
  const min = parseMinutes(s.min);
  const played = (min ?? 0) > 0 || (nn(s.fga) ?? 0) > 0 || (nn(s.pts) ?? 0) > 0;

  const stats: Record<StatKey, number | null> = {
    min: played ? min : null,
    pts: played ? nn(s.pts) : null,
    reb: played ? nn(s.reb) : null,
    ast: played ? nn(s.ast) : null,
    stl: played ? nn(s.stl) : null,
    blk: played ? nn(s.blk) : null,
    tov: played ? nn(s.turnover) : null,
    fgm: played ? nn(s.fgm) : null,
    fga: played ? nn(s.fga) : null,
    fg3m: played ? nn(s.fg3m) : null,
    fg3a: played ? nn(s.fg3a) : null,
    ftm: played ? nn(s.ftm) : null,
    fta: played ? nn(s.fta) : null,
    oreb: played ? nn(s.oreb) : null,
    dreb: played ? nn(s.dreb) : null,
    pf: played ? nn(s.pf) : null,
    plusMinus: played ? nn(s.plus_minus) : null,
  };

  return {
    gameKey: game.key,
    etDate: game.etDate,
    startUtc: game.startUtc,
    playerId: `bdl:${s.player.id}`,
    playerName: `${s.player.first_name} ${s.player.last_name}`.trim(),
    teamAbbr: abbr,
    opponentAbbr: isHome ? game.away.abbr : game.home.abbr,
    isHome,
    played,
    position: s.player.position || undefined,
    jersey: s.player.jersey_number || undefined,
    stats,
    source: "balldontlie",
  };
}

/* ------------------------------------------------------------------ */
/* Consultas agrupadas                                                 */
/* ------------------------------------------------------------------ */
/** Todos los partidos entre dos fechas con una consulta paginada (no una por día). */
export async function fetchGamesRange(from: string, to: string): Promise<{ games: Game[]; truncated: boolean }> {
  const { items, truncated } = await bdlGetAll<RawGame>(ENDPOINTS.balldontlie.games, {
    start_date: from,
    end_date: to,
  });
  const byKey = new Map<string, Game>();
  for (const raw of items) {
    const game = adaptGame(raw);
    if (game && !byKey.has(game.key)) byKey.set(game.key, game);
  }
  return { games: [...byKey.values()], truncated };
}

/**
 * Estadísticas de jugadores para un rango (requiere plan ALL-STAR o superior).
 * `games` debe incluir los partidos del rango para unir ids y rivales.
 */
export async function fetchStatsRange(
  from: string,
  to: string,
  games: Game[],
): Promise<{ lines: PlayerGameLine[]; truncated: boolean }> {
  const byId = new Map(games.filter((g) => g.source === "balldontlie").map((g) => [g.sourceId, g]));
  const { items, truncated } = await bdlGetAll<RawStat>(ENDPOINTS.balldontlie.stats, {
    start_date: from,
    end_date: to,
  });

  const seen = new Set<string>();
  const lines: PlayerGameLine[] = [];
  for (const s of items) {
    const game = byId.get(String(s.game?.id));
    if (!game || game.status !== "final") continue;
    const line = adaptStat(s, game);
    if (!line) continue;
    const dedupe = `${line.gameKey}|${line.playerId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    lines.push(line);
  }
  return { lines, truncated };
}

/** Mapa abreviatura → id de equipo en BALLDONTLIE (los ids no coinciden con los de ESPN). */
export async function fetchTeamIds(): Promise<Map<string, number>> {
  const res = await bdlGet<{ data: Array<RawTeam & { conference?: string }> }>(ENDPOINTS.balldontlie.teams);
  const map = new Map<string, number>();
  for (const t of res.data ?? []) {
    const abbr = normalizeAbbr(t.abbreviation);
    // BALLDONTLIE incluye franquicias históricas con conferencia vacía: se descartan.
    if (TEAM_BY_ABBR.has(abbr) && !map.has(abbr)) map.set(abbr, t.id);
  }
  return map;
}

export async function fetchPlayersByTeam(bdlTeamIds: number[]): Promise<PlayerInfo[]> {
  const { items } = await bdlGetAll<RawPlayer>(ENDPOINTS.balldontlie.players, { team_ids: bdlTeamIds });
  return items.map((p) => ({
    id: `bdl:${p.id}`,
    name: `${p.first_name} ${p.last_name}`.trim(),
    teamAbbr: p.team ? normalizeAbbr(p.team.abbreviation) : undefined,
    position: p.position || undefined,
    jersey: p.jersey_number || undefined,
    height: p.height || undefined,
    weight: p.weight ? `${p.weight} lbs` : undefined,
    source: "balldontlie",
  }));
}

interface RawBdlStanding {
  team: RawTeam & { conference?: string };
  wins: number;
  losses: number;
  conference_rank?: number;
  home_record?: string;
  road_record?: string;
  conference_record?: string;
  division_record?: string;
}

export async function fetchStandings(season: number): Promise<StandingRow[]> {
  const res = await bdlGet<{ data: RawBdlStanding[] }>(ENDPOINTS.balldontlie.standings, { season });
  const rows: StandingRow[] = [];
  for (const r of res.data ?? []) {
    const abbr = normalizeAbbr(r.team.abbreviation);
    const info = TEAM_BY_ABBR.get(abbr);
    if (!info) continue;
    const played = r.wins + r.losses;
    rows.push({
      teamAbbr: abbr,
      teamName: `${info.city} ${info.name}`,
      conference: info.conference,
      rank: r.conference_rank ?? 0,
      wins: r.wins,
      losses: r.losses,
      pct: played > 0 ? r.wins / played : null,
      gamesBehind: null,
      home: r.home_record,
      road: r.road_record,
      conferenceRecord: r.conference_record,
      divisionRecord: r.division_record,
      seed: r.conference_rank ?? null,
    });
  }
  return rows;
}
