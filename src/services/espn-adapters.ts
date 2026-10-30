import { normalizeAbbr, TEAM_BY_ABBR } from "@/config/nba-structure";
import { APP_CONFIG } from "@/config/app";
import { ymdInTz } from "@/lib/dates";
import type {
  Conference,
  Game,
  GameStatus,
  PlayerGameLine,
  PlayerInfo,
  SeasonType,
  StandingRow,
  StatKey,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Tipos crudos (solo los campos que usamos; ESPN no es oficial)       */
/* ------------------------------------------------------------------ */
interface RawTeam {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  logo?: string;
  logos?: Array<{ href: string; rel?: string[] }>;
}
interface RawCompetitor {
  homeAway?: "home" | "away";
  score?: string | number | { value?: number; displayValue?: string };
  team?: RawTeam;
}
interface RawEvent {
  id: string;
  date: string;
  season?: { year?: number; type?: number; slug?: string };
  seasonType?: { type?: number };
  status?: RawStatus;
  competitions?: Array<{ status?: RawStatus; competitors?: RawCompetitor[] }>;
}
interface RawStatus {
  type?: { name?: string; state?: string; completed?: boolean; detail?: string; shortDetail?: string };
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("+", ""));
  return Number.isFinite(n) ? n : null;
}

function scoreOf(c: RawCompetitor | undefined): number | null {
  const s = c?.score;
  if (s && typeof s === "object") return toNumber(s.value ?? s.displayValue);
  return toNumber(s);
}

function logoOf(team?: RawTeam): string | undefined {
  if (!team) return undefined;
  if (team.logo) return team.logo;
  const logos = team.logos ?? [];
  return (logos.find((l) => l.rel?.includes("default")) ?? logos[0])?.href;
}

function statusOf(status?: RawStatus): { status: GameStatus; detail: string } {
  const t = status?.type;
  const name = t?.name ?? "";
  if (name.includes("POSTPONED") || name.includes("CANCELED")) {
    return { status: "postponed", detail: t?.detail ?? "Aplazado" };
  }
  if (t?.state === "in") return { status: "live", detail: t.shortDetail ?? t.detail ?? "En juego" };
  if (t?.state === "post" || t?.completed) return { status: "final", detail: t?.shortDetail ?? "Final" };
  return { status: "scheduled", detail: t?.shortDetail ?? t?.detail ?? "Programado" };
}

function seasonTypeOf(ev: RawEvent): SeasonType {
  const type = ev.season?.type ?? ev.seasonType?.type;
  if (type === 1) return "preseason";
  if (type === 3) return "playoffs";
  if (type === 5) return "playin";
  return "regular";
}

export function gameKey(etDate: string, away: string, home: string): string {
  return `${etDate}_${away}@${home}`;
}

/* ------------------------------------------------------------------ */
/* Adaptador: evento ESPN → Game                                       */
/* ------------------------------------------------------------------ */
export function adaptEvent(ev: RawEvent): Game | null {
  const comp = ev.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;

  const homeAbbr = normalizeAbbr(home.team.abbreviation);
  const awayAbbr = normalizeAbbr(away.team.abbreviation);
  // Equipos fuera de la NBA (All-Star, amistosos internacionales) no se incluyen.
  if (!TEAM_BY_ABBR.has(homeAbbr) || !TEAM_BY_ABBR.has(awayAbbr)) return null;

  const { status, detail } = statusOf(comp?.status ?? ev.status);
  const etDate = ymdInTz(ev.date, APP_CONFIG.gameDayTimeZone);
  // ESPN indica el año en que termina la temporada (2027 = 2026-27).
  const endYear = ev.season?.year;
  const season = endYear ? endYear - 1 : Number(etDate.slice(0, 4)) - (Number(etDate.slice(5, 7)) >= 10 ? 0 : 1);
  const started = status === "final" || status === "live";

  return {
    key: gameKey(etDate, awayAbbr, homeAbbr),
    source: "espn",
    sourceId: ev.id,
    startUtc: new Date(ev.date).toISOString(),
    etDate,
    status,
    statusDetail: detail,
    home: { abbr: homeAbbr, score: started ? scoreOf(home) : null },
    away: { abbr: awayAbbr, score: started ? scoreOf(away) : null },
    season,
    seasonType: seasonTypeOf(ev),
  };
}

/* ------------------------------------------------------------------ */
/* Marcador de un día                                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Box score                                                           */
/* ------------------------------------------------------------------ */
interface RawAthleteLine {
  starter?: boolean;
  didNotPlay?: boolean;
  athlete?: {
    id?: string;
    displayName?: string;
    jersey?: string;
    headshot?: { href?: string };
    position?: { abbreviation?: string };
  };
  stats?: string[];
}
interface RawSummary {
  boxscore?: {
    players?: Array<{
      team?: RawTeam;
      statistics?: Array<{ labels?: string[]; athletes?: RawAthleteLine[] }>;
    }>;
  };
}

/** "5-12" → [5, 12]. Cualquier otro formato → [null, null]. */
export function parseMadeAttempted(v: string | undefined): [number | null, number | null] {
  if (!v) return [null, null];
  const m = /^(\d+)-(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2])] : [null, null];
}

const EMPTY_STATS = (): Record<StatKey, number | null> => ({
  min: null, pts: null, reb: null, ast: null, stl: null, blk: null, tov: null,
  fgm: null, fga: null, fg3m: null, fg3a: null, ftm: null, fta: null,
  oreb: null, dreb: null, pf: null, plusMinus: null,
});

/**
 * Convierte un summary de ESPN en líneas por jugador. Las columnas se localizan por su
 * etiqueta (no por posición) para tolerar cambios de orden. Un dato ausente queda en null.
 */
export function adaptBoxscore(raw: RawSummary, game: Game): PlayerGameLine[] {
  const lines: PlayerGameLine[] = [];
  const seen = new Set<string>();

  for (const teamBlock of raw.boxscore?.players ?? []) {
    const abbr = teamBlock.team?.abbreviation ? normalizeAbbr(teamBlock.team.abbreviation) : undefined;
    if (!abbr || (abbr !== game.home.abbr && abbr !== game.away.abbr)) continue;
    const isHome = abbr === game.home.abbr;
    const opponentAbbr = isHome ? game.away.abbr : game.home.abbr;

    for (const block of teamBlock.statistics ?? []) {
      const labels = block.labels ?? [];
      const idx = (l: string) => labels.indexOf(l);
      const at = (s: string[], l: string) => {
        const i = idx(l);
        return i >= 0 ? s[i] : undefined;
      };

      for (const a of block.athletes ?? []) {
        const id = a.athlete?.id;
        if (!id || seen.has(id)) continue; // evita duplicados dentro del mismo partido
        seen.add(id);

        const s = a.stats ?? [];
        const played = !a.didNotPlay && s.length > 0;
        const stats = EMPTY_STATS();

        if (played) {
          const [fgm, fga] = parseMadeAttempted(at(s, "FG"));
          const [fg3m, fg3a] = parseMadeAttempted(at(s, "3PT"));
          const [ftm, fta] = parseMadeAttempted(at(s, "FT"));
          Object.assign(stats, {
            min: toNumber(at(s, "MIN")),
            pts: toNumber(at(s, "PTS")),
            reb: toNumber(at(s, "REB")),
            ast: toNumber(at(s, "AST")),
            stl: toNumber(at(s, "STL")),
            blk: toNumber(at(s, "BLK")),
            tov: toNumber(at(s, "TO")),
            oreb: toNumber(at(s, "OREB")),
            dreb: toNumber(at(s, "DREB")),
            pf: toNumber(at(s, "PF")),
            plusMinus: toNumber(at(s, "+/-")),
            fgm, fga, fg3m, fg3a, ftm, fta,
          });
        }

        lines.push({
          gameKey: game.key,
          etDate: game.etDate,
          startUtc: game.startUtc,
          playerId: `espn:${id}`,
          playerName: a.athlete?.displayName ?? "Jugador sin nombre",
          teamAbbr: abbr,
          opponentAbbr,
          isHome,
          played,
          starter: a.starter,
          position: a.athlete?.position?.abbreviation,
          jersey: a.athlete?.jersey,
          headshot: a.athlete?.headshot?.href,
          stats,
          source: "espn",
        });
      }
    }
  }
  return lines;
}


/* ------------------------------------------------------------------ */
/* Equipos, plantillas, calendario                                     */
/* ------------------------------------------------------------------ */
export interface EspnTeamInfo {
  abbr: string;
  espnId: string;
  logo?: string;
  color?: string;
}


interface RawRosterAthlete {
  id?: string;
  fullName?: string;
  displayName?: string;
  jersey?: string;
  age?: number;
  displayHeight?: string;
  displayWeight?: string;
  headshot?: { href?: string };
  position?: { abbreviation?: string };
  experience?: { years?: number };
}


/** Partidos de un equipo (pasados y futuros) según el calendario de ESPN. */

/* ------------------------------------------------------------------ */
/* Clasificación                                                       */
/* ------------------------------------------------------------------ */
interface RawStandingStat {
  name?: string;
  value?: number;
  displayValue?: string;
  summary?: string;
}
interface RawStandingsResponse {
  children?: Array<{
    name?: string;
    abbreviation?: string;
    standings?: {
      seasonDisplayName?: string;
      entries?: Array<{ team?: RawTeam; stats?: RawStandingStat[] }>;
    };
  }>;
}

export function adaptStandings(raw: RawStandingsResponse): StandingRow[] {
  const rows: StandingRow[] = [];
  for (const child of raw.children ?? []) {
    const conference: Conference | null = /east/i.test(child.name ?? child.abbreviation ?? "")
      ? "East"
      : /west/i.test(child.name ?? child.abbreviation ?? "")
        ? "West"
        : null;
    if (!conference) continue;

    for (const e of child.standings?.entries ?? []) {
      const abbr = e.team?.abbreviation ? normalizeAbbr(e.team.abbreviation) : undefined;
      if (!abbr || !TEAM_BY_ABBR.has(abbr)) continue;
      const stats = e.stats ?? [];
      const num = (n: string) => {
        const s = stats.find((x) => x.name === n);
        return s ? toNumber(s.value) : null;
      };
      const display = (n: string) => stats.find((x) => x.name === n)?.displayValue;
      const split = (n: string) => stats.find((x) => x.name === n)?.summary;

      const wins = num("wins");
      const losses = num("losses");
      if (wins === null || losses === null) continue;
      const played = wins + losses;
      const seed = num("playoffSeed");

      rows.push({
        teamAbbr: abbr,
        teamName: e.team?.displayName ?? TEAM_BY_ABBR.get(abbr)!.name,
        logo: logoOf(e.team),
        conference,
        rank: 0, // lo fija rankConference()
        wins,
        losses,
        // Sin partidos jugados no hay porcentaje: se deja null en lugar de 0.
        pct: played > 0 ? (num("winPercent") ?? wins / played) : null,
        gamesBehind: num("gamesBehind"),
        streak: display("streak"),
        home: split("Home"),
        road: split("Road"),
        conferenceRecord: split("vs. Conf."),
        divisionRecord: split("vs. Div."),
        lastTen: split("Last Ten Games"),
        pointsFor: num("pointsFor"),
        pointsAgainst: num("pointsAgainst"),
        seed: seed && seed > 0 ? seed : null,
      });
    }
  }
  return rows;
}


export function adaptTeams(raw: {
  sports?: Array<{ leagues?: Array<{ teams?: Array<{ team: RawTeam & { color?: string } }> }> }>;
}): EspnTeamInfo[] {
  const out: EspnTeamInfo[] = [];
  for (const { team } of raw.sports?.[0]?.leagues?.[0]?.teams ?? []) {
    if (!team.id || !team.abbreviation) continue;
    out.push({ abbr: normalizeAbbr(team.abbreviation), espnId: team.id, logo: logoOf(team), color: team.color });
  }
  return out;
}

export function adaptRoster(raw: { athletes?: RawRosterAthlete[] }, teamAbbr: string): PlayerInfo[] {
  const players: PlayerInfo[] = [];
  const seen = new Set<string>();
  for (const a of raw.athletes ?? []) {
    if (!a.id || seen.has(a.id)) continue;
    seen.add(a.id);
    players.push({
      id: `espn:${a.id}`,
      name: a.fullName ?? a.displayName ?? "Jugador sin nombre",
      teamAbbr,
      position: a.position?.abbreviation,
      jersey: a.jersey,
      height: a.displayHeight,
      weight: a.displayWeight,
      age: a.age,
      headshot: a.headshot?.href,
      experienceYears: a.experience?.years,
      source: "espn",
    });
  }
  return players;
}

export function adaptEvents(raw: { events?: RawEvent[] }): Game[] {
  const seen = new Set<string>();
  const games: Game[] = [];
  for (const ev of raw.events ?? []) {
    const g = adaptEvent(ev);
    if (!g || seen.has(g.key)) continue;
    seen.add(g.key);
    games.push(g);
  }
  return games;
}
