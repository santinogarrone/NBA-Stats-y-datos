import "server-only";
import { APP_CONFIG } from "@/config/app";
import { NBA_TEAMS, TEAM_BY_ABBR } from "@/config/nba-structure";
import { cached, FetchBudget, hasFresh } from "@/lib/cache";
import {
  addDays,
  eachDay,
  seasonBounds,
  todayInTz,
  ymdInTz,
  type Ymd,
} from "@/lib/dates";
import { mapLimit } from "@/lib/http";
import { rankConference, type ConferenceTable } from "@/lib/standings";
import type {
  Coverage,
  DataSource,
  Game,
  Meta,
  PlayerGameLine,
  PlayerInfo,
  Result,
  StandingRow,
  Team,
} from "@/lib/types";
import * as bdl from "./balldontlie";
import * as espn from "./espn";

/* ------------------------------------------------------------------ */
/* Utilidades de metadatos                                             */
/* ------------------------------------------------------------------ */
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const oldest = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString());

export const newBudget = () => new FetchBudget(APP_CONFIG.fetchBudgetPerRequest);
const todayEt = () => todayInTz(APP_CONFIG.gameDayTimeZone);

/**
 * Solicitud con caché que respeta el presupuesto: lo que ya está en caché no cuesta nada;
 * lo que no, consume presupuesto. Si se agotó devuelve null (queda pendiente, no es un error).
 */
async function budgeted<T>(
  key: string,
  opts: { ttlMs: number; persist?: boolean | ((v: T) => boolean) },
  budget: FetchBudget,
  loader: () => Promise<T>,
): Promise<{ value: T; fetchedAt: string; stale: boolean } | null> {
  if (!hasFresh(key, opts.persist !== undefined && opts.persist !== false)) {
    if (!budget.take()) return null;
  }
  return cached(key, opts, loader);
}

/* ------------------------------------------------------------------ */
/* Equipos                                                             */
/* ------------------------------------------------------------------ */
export async function getTeams(): Promise<Result<Team[]>> {
  const warnings: string[] = [];
  let source: DataSource = "static";
  let fetchedAt = new Date().toISOString();
  const ext = new Map<string, espn.EspnTeamInfo>();
  try {
    const res = await cached("espn:teams", { ttlMs: APP_CONFIG.ttlMs.teams }, espn.fetchTeams);
    res.value.forEach((t) => ext.set(t.abbr, t));
    fetchedAt = res.fetchedAt;
    source = "espn";
  } catch (e) {
    warnings.push(`Logotipos no disponibles (ESPN: ${errMsg(e)}).`);
  }
  const teams: Team[] = NBA_TEAMS.map((t) => {
    const x = ext.get(t.abbr);
    return {
      abbr: t.abbr,
      city: t.city,
      name: t.name,
      fullName: `${t.city} ${t.name}`,
      conference: t.conference,
      division: t.division,
      logo: x?.logo,
      color: x?.color ? `#${x.color}` : undefined,
      espnId: x?.espnId,
    };
  });
  return { data: teams, meta: { source, fetchedAt, warnings } };
}

export async function getTeamMap(): Promise<{ teams: Map<string, Team>; meta: Meta }> {
  const { data, meta } = await getTeams();
  return { teams: new Map(data.map((t) => [t.abbr, t])), meta };
}

/* ------------------------------------------------------------------ */
/* Partidos de un día                                                  */
/* ------------------------------------------------------------------ */
const isSettled = (games: Game[]) => games.length > 0 && games.every((g) => g.status === "final" || g.status === "postponed");

async function espnDayGames(etDay: Ymd, budget: FetchBudget) {
  const live = etDay >= todayEt();
  return budgeted<Game[]>(
    `espn:sb:${etDay}`,
    { ttlMs: live ? APP_CONFIG.ttlMs.liveDay : APP_CONFIG.ttlMs.recentDay, persist: isSettled },
    budget,
    () => espn.fetchScoreboard(etDay),
  );
}

async function bdlDayGames(etDay: Ymd) {
  return cached(`bdl:games:${etDay}`, { ttlMs: APP_CONFIG.ttlMs.liveDay, persist: isSettled }, async () => {
    const { games } = await bdl.fetchGamesRange(etDay, etDay);
    return games;
  });
}

/** Partidos de varios días ET con ESPN como principal y BALLDONTLIE como respaldo. */
export async function getGamesByEtDays(etDays: Ymd[], budget = newBudget()): Promise<Result<Game[]>> {
  const warnings: string[] = [];
  const all = new Map<string, Game>();
  const stamps: string[] = [];
  let usedFallback = false;
  let pending = 0;

  await mapLimit(etDays, APP_CONFIG.espnConcurrency, async (day) => {
    try {
      const r = await espnDayGames(day, budget);
      if (!r) {
        pending++;
        return;
      }
      stamps.push(r.fetchedAt);
      r.value.forEach((g) => all.set(g.key, g));
      return;
    } catch (e) {
      if (!bdl.bdlConfigured()) {
        warnings.push(`No se pudo leer el ${day} (ESPN: ${errMsg(e)}).`);
        return;
      }
    }
    // Respaldo
    try {
      const r = await bdlDayGames(day);
      usedFallback = true;
      stamps.push(r.fetchedAt);
      r.value.forEach((g) => {
        if (!all.has(g.key)) all.set(g.key, g); // nunca se duplica un partido ya obtenido
      });
    } catch (e) {
      warnings.push(`No se pudo leer el ${day} con ninguna fuente (${errMsg(e)}).`);
    }
  });

  if (pending) warnings.push(`Quedaron ${pending} día(s) sin cargar por el límite de solicitudes. Actualiza para continuar.`);
  const games = [...all.values()].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return {
    data: games,
    meta: {
      source: usedFallback ? "balldontlie" : "espn",
      fallbackFrom: usedFallback ? "espn" : undefined,
      fetchedAt: oldest(stamps),
      warnings,
    },
  };
}

/** Partidos cuya fecha LOCAL (en `tz`) es `localDay`. Pide los días ET vecinos para no perder partidos. */
export async function getGamesForLocalDay(localDay: Ymd, tz: string, budget = newBudget()): Promise<Result<Game[]>> {
  const res = await getGamesByEtDays([addDays(localDay, -1), localDay, addDays(localDay, 1)], budget);
  return { ...res, data: res.data.filter((g) => ymdInTz(g.startUtc, tz) === localDay) };
}

/* ------------------------------------------------------------------ */
/* Líneas de jugadores en un rango                                     */
/* ------------------------------------------------------------------ */
export type SeasonFilter = "regular" | "playoffs" | "all";

export interface LinesResult {
  lines: PlayerGameLine[];
  games: Game[];
  coverage: Coverage;
  meta: Meta;
}

const inTypeFilter = (g: Game, f: SeasonFilter) =>
  f === "all" || (f === "regular" ? g.seasonType === "regular" : g.seasonType === "playoffs" || g.seasonType === "playin");

/**
 * Una sola fuente por consulta: mezclar ids de ESPN y BALLDONTLIE duplicaría jugadores.
 * Con plan ALL-STAR+ se usan consultas agrupadas de BALLDONTLIE; si no están disponibles
 * o fallan, se usa ESPN (calendario diario + box score de cada partido finalizado).
 */
export async function getPlayerLines(
  from: Ymd,
  to: Ymd,
  tz: string,
  opts: { type?: SeasonFilter; budget?: FetchBudget } = {},
): Promise<LinesResult> {
  const budget = opts.budget ?? newBudget();
  const type = opts.type ?? "all";
  const warnings: string[] = [];
  const pref = APP_CONFIG.statsSource;

  let fallbackFrom: DataSource | undefined;
  if (pref !== "espn" && (await bdl.bdlCan("stats"))) {
    try {
      return await linesFromBdl(from, to, tz, type, warnings);
    } catch (e) {
      fallbackFrom = "balldontlie";
      warnings.push(`BALLDONTLIE no respondió (${errMsg(e)}); se usa ESPN.`);
    }
  } else if (pref === "balldontlie") {
    warnings.push("BALLDONTLIE no está disponible con el plan o la clave actuales; se usa ESPN.");
  }

  const res = await linesFromEspn(from, to, tz, type, budget, warnings);
  res.meta.fallbackFrom = fallbackFrom;
  return res;
}

function emptyCoverage(): Coverage {
  return {
    days: { total: 0, loaded: 0, failed: 0 },
    boxscores: { total: 0, loaded: 0, failed: 0 },
    complete: true,
  };
}

async function linesFromBdl(from: Ymd, to: Ymd, tz: string, type: SeasonFilter, warnings: string[]): Promise<LinesResult> {
  const etFrom = addDays(from, -1);
  const etTo = addDays(to, 1) > todayEt() ? todayEt() : addDays(to, 1);
  const key = `bdl:lines:${etFrom}:${etTo}`;
  const settled = etTo < addDays(todayEt(), -1);

  const res = await cached(
    key,
    { ttlMs: APP_CONFIG.ttlMs.recentDay, persist: (v: { truncated: boolean }) => settled && !v.truncated },
    async () => {
      const g = await bdl.fetchGamesRange(etFrom, etTo);
      const s = await bdl.fetchStatsRange(etFrom, etTo, g.games);
      return { games: g.games, lines: s.lines, truncated: g.truncated || s.truncated };
    },
  );

  const gamesAll = res.value.games.filter((g) => inTypeFilter(g, type));
  const finals = gamesAll.filter((g) => g.status === "final" && ymdInTz(g.startUtc, tz) >= from && ymdInTz(g.startUtc, tz) <= to);
  const keys = new Set(finals.map((g) => g.key));
  const lines = res.value.lines.filter((l) => keys.has(l.gameKey));
  if (res.value.truncated) warnings.push("El rango superó el máximo de páginas de BALLDONTLIE: datos parciales.");
  if (res.stale) warnings.push("Datos de BALLDONTLIE de caché (la fuente no respondió).");

  const withLines = new Set(lines.map((l) => l.gameKey));
  const missing = finals.filter((g) => !withLines.has(g.key)).length;
  if (missing) warnings.push(`${missing} partido(s) finalizado(s) sin estadísticas en BALLDONTLIE.`);

  return {
    lines,
    games: finals,
    coverage: {
      days: { total: 0, loaded: 0, failed: 0 },
      boxscores: { total: finals.length, loaded: finals.length - missing, failed: missing },
      complete: !res.value.truncated && missing === 0,
    },
    meta: { source: "balldontlie", fetchedAt: res.fetchedAt, warnings },
  };
}

async function linesFromEspn(
  from: Ymd,
  to: Ymd,
  tz: string,
  type: SeasonFilter,
  budget: FetchBudget,
  warnings: string[],
): Promise<LinesResult> {
  const coverage = emptyCoverage();
  const stamps: string[] = [];

  const etFrom = addDays(from, -1);
  const etTo = addDays(to, 1) > todayEt() ? todayEt() : addDays(to, 1);
  const days = eachDay(etFrom, etTo);
  coverage.days.total = days.length;

  const games = new Map<string, Game>();
  await mapLimit(days, APP_CONFIG.espnConcurrency, async (day) => {
    try {
      const r = await espnDayGames(day, budget);
      if (!r) return;
      coverage.days.loaded++;
      stamps.push(r.fetchedAt);
      if (r.stale) warnings.push(`El ${day} viene de caché (ESPN no respondió).`);
      r.value.forEach((g) => games.set(g.key, g));
    } catch (e) {
      coverage.days.failed++;
      warnings.push(`No se pudo leer el calendario del ${day} (${errMsg(e)}).`);
    }
  });

  const finals = [...games.values()].filter(
    (g) =>
      g.status === "final" &&
      inTypeFilter(g, type) &&
      ymdInTz(g.startUtc, tz) >= from &&
      ymdInTz(g.startUtc, tz) <= to,
  );
  coverage.boxscores.total = finals.length;

  const lines: PlayerGameLine[] = [];
  await mapLimit(finals, APP_CONFIG.espnConcurrency, async (game) => {
    try {
      // Un partido finalizado no cambia: se guarda en disco sin caducidad.
      const r = await budgeted<PlayerGameLine[]>(
        `espn:box:${game.sourceId}`,
        { ttlMs: APP_CONFIG.ttlMs.recentDay, persist: (v) => v.length > 0 },
        budget,
        () => espn.fetchBoxscore(game),
      );
      if (!r) return;
      if (r.value.length === 0) {
        coverage.boxscores.failed++;
        return;
      }
      coverage.boxscores.loaded++;
      stamps.push(r.fetchedAt);
      lines.push(...r.value);
    } catch (e) {
      coverage.boxscores.failed++;
      warnings.push(`Sin box score de ${game.away.abbr} @ ${game.home.abbr} (${game.etDate}): ${errMsg(e)}.`);
    }
  });

  const pending = coverage.boxscores.total - coverage.boxscores.loaded - coverage.boxscores.failed;
  coverage.complete =
    coverage.days.failed === 0 && coverage.days.loaded === coverage.days.total && coverage.boxscores.loaded === coverage.boxscores.total;
  if (pending > 0 || coverage.days.loaded < coverage.days.total) {
    const n = pending + (coverage.days.total - coverage.days.loaded - coverage.days.failed);
    warnings.push(
      `Datos parciales: faltan ${n} consulta(s) por el límite de solicitudes por carga. Cada actualización añade más y lo ya cargado no se vuelve a pedir.`,
    );
  }

  const inRange = lines.filter((l) => {
    const d = ymdInTz(l.startUtc, tz);
    return d >= from && d <= to;
  });

  return {
    lines: inRange,
    games: finals,
    coverage,
    meta: { source: "espn", fetchedAt: oldest(stamps), warnings: [...new Set(warnings)] },
  };
}

/** Temporada completa hasta hoy. */
export async function getSeasonLines(season: number, tz: string, budget = newBudget(), type: SeasonFilter = "regular") {
  const b = seasonBounds(season);
  const today = todayInTz(tz);
  const to = today < b.end ? today : b.end;
  if (to < b.start) {
    return { lines: [], games: [], coverage: emptyCoverage(), meta: { source: "computed", fetchedAt: new Date().toISOString(), warnings: [] } as Meta } satisfies LinesResult;
  }
  return getPlayerLines(b.start, to, tz, { type, budget });
}

/* ------------------------------------------------------------------ */
/* Clasificación                                                       */
/* ------------------------------------------------------------------ */
export interface StandingsResult {
  east: ConferenceTable;
  west: ConferenceTable;
  meta: Meta;
}

export async function getStandings(season: number): Promise<StandingsResult> {
  const warnings: string[] = [];
  const pref = APP_CONFIG.statsSource;
  let rows: StandingRow[] = [];
  let source: DataSource = "espn";
  let fetchedAt = new Date().toISOString();
  let fallbackFrom: DataSource | undefined;

  const viaEspn = async () => {
    const r = await cached(`espn:standings:${season}`, { ttlMs: APP_CONFIG.ttlMs.standings }, () => espn.fetchStandings(season + 1));
    if (r.stale) warnings.push("Clasificación de caché (ESPN no respondió).");
    if (!r.value.length) throw new Error("ESPN devolvió una clasificación vacía");
    return r;
  };
  const viaBdl = async () => {
    if (!(await bdl.bdlCan("standings"))) throw new Error("el plan de BALLDONTLIE no incluye la clasificación");
    return cached(`bdl:standings:${season}`, { ttlMs: APP_CONFIG.ttlMs.standings }, () => bdl.fetchStandings(season));
  };

  const order = pref === "balldontlie" ? [viaBdl, viaEspn] : [viaEspn, viaBdl];
  const names: DataSource[] = pref === "balldontlie" ? ["balldontlie", "espn"] : ["espn", "balldontlie"];
  for (let i = 0; i < order.length; i++) {
    try {
      const r = await order[i]();
      rows = r.value;
      fetchedAt = r.fetchedAt;
      source = names[i];
      if (i > 0) fallbackFrom = names[0];
      break;
    } catch (e) {
      warnings.push(`Clasificación (${names[i] === "espn" ? "ESPN" : "BALLDONTLIE"}): ${errMsg(e)}.`);
    }
  }

  // Logotipos desde el directorio de equipos.
  if (rows.length) {
    const dir = await getTeams();
    const logo = new Map(dir.data.map((t) => [t.abbr, t.logo]));
    rows = rows.map((r) => ({ ...r, logo: r.logo ?? logo.get(r.teamAbbr) }));
  }

  return {
    east: rankConference("East", rows),
    west: rankConference("West", rows),
    meta: { source, fallbackFrom, fetchedAt, warnings: rows.length ? warnings : [...warnings, "Sin datos de clasificación."] },
  };
}

/* ------------------------------------------------------------------ */
/* Plantillas y calendario de equipo                                   */
/* ------------------------------------------------------------------ */
async function bdlTeamId(abbr: string): Promise<number | null> {
  const r = await cached("bdl:teamids", { ttlMs: APP_CONFIG.ttlMs.teams }, () => bdl.fetchTeamIds());
  return r.value.get(abbr) ?? null;
}

export async function getRoster(abbr: string): Promise<Result<PlayerInfo[]>> {
  const warnings: string[] = [];
  const team = TEAM_BY_ABBR.get(abbr);
  if (!team) return { data: [], meta: { source: "static", fetchedAt: new Date().toISOString(), warnings: ["Equipo desconocido."] } };

  const dir = await getTeams();
  const espnId = dir.data.find((t) => t.abbr === abbr)?.espnId;

  if (espnId) {
    try {
      const r = await cached(`espn:roster:${abbr}`, { ttlMs: APP_CONFIG.ttlMs.roster }, () => espn.fetchRoster(espnId, abbr));
      if (r.value.length) return { data: r.value, meta: { source: "espn", fetchedAt: r.fetchedAt, warnings } };
      warnings.push("ESPN devolvió una plantilla vacía.");
    } catch (e) {
      warnings.push(`Plantilla (ESPN): ${errMsg(e)}.`);
    }
  }

  if (bdl.bdlConfigured()) {
    try {
      const id = await bdlTeamId(abbr);
      if (id) {
        const r = await cached(`bdl:roster:${abbr}`, { ttlMs: APP_CONFIG.ttlMs.roster }, () => bdl.fetchPlayersByTeam([id]));
        warnings.push("Plantilla de BALLDONTLIE: puede incluir jugadores que ya no están en el equipo y no trae fotografías.");
        return { data: r.value, meta: { source: "balldontlie", fallbackFrom: "espn", fetchedAt: r.fetchedAt, warnings } };
      }
    } catch (e) {
      warnings.push(`Plantilla (BALLDONTLIE): ${errMsg(e)}.`);
    }
  }
  return { data: [], meta: { source: "espn", fetchedAt: new Date().toISOString(), warnings } };
}

export async function getTeamSchedule(abbr: string): Promise<Result<Game[]>> {
  const dir = await getTeams();
  const espnId = dir.data.find((t) => t.abbr === abbr)?.espnId;
  if (!espnId) {
    return { data: [], meta: { source: "espn", fetchedAt: new Date().toISOString(), warnings: ["Calendario no disponible: sin identificador de ESPN para este equipo."] } };
  }
  try {
    const r = await cached(`espn:sched:${abbr}`, { ttlMs: APP_CONFIG.ttlMs.standings }, () => espn.fetchTeamSchedule(espnId));
    return { data: r.value, meta: { source: "espn", fetchedAt: r.fetchedAt, warnings: r.stale ? ["Calendario de caché (ESPN no respondió)."] : [] } };
  } catch (e) {
    return { data: [], meta: { source: "espn", fetchedAt: new Date().toISOString(), warnings: [`Calendario no disponible (${errMsg(e)}).`] } };
  }
}
