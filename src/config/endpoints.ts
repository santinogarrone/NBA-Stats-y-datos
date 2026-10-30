/**
 * Todas las URLs externas viven aquí. Ningún otro módulo construye URLs a mano.
 * ESPN no es oficial: la estructura puede cambiar sin aviso.
 */
/** ESPN_API_BASE solo sirve para pruebas locales con un servidor simulado (scripts/mock-espn.mjs). */
const ESPN_ORIGIN = process.env.ESPN_API_BASE?.replace(/\/$/, "") ?? "https://site.api.espn.com";
const ESPN_SITE = `${ESPN_ORIGIN}/apis/site/v2/sports/basketball/nba`;
const ESPN_V2 = `${ESPN_ORIGIN}/apis/v2/sports/basketball/nba`;
const BDL_BASE = "https://api.balldontlie.io";

export const ENDPOINTS = {
  espn: {
    /** ymd = "YYYY-MM-DD". Sin fecha devuelve el día actual de ESPN. */
    scoreboard: (ymd?: string) =>
      `${ESPN_SITE}/scoreboard${ymd ? `?dates=${ymd.replaceAll("-", "")}` : ""}`,
    summary: (eventId: string) =>
      `${ESPN_SITE}/summary?event=${encodeURIComponent(eventId)}`,
    teams: `${ESPN_SITE}/teams`,
    teamSchedule: (teamId: string) => `${ESPN_SITE}/teams/${encodeURIComponent(teamId)}/schedule`,
    roster: (teamId: string) => `${ESPN_SITE}/teams/${encodeURIComponent(teamId)}/roster`,
    /** seasonEndYear: ESPN usa el año en que termina la temporada (2026-27 → 2027). */
    standings: (seasonEndYear: number) =>
      `${ESPN_V2}/standings?season=${seasonEndYear}&seasontype=2`,
  },
  balldontlie: {
    base: BDL_BASE,
    teams: "/v1/teams",
    players: "/v1/players",
    games: "/v1/games",
    stats: "/v1/stats",
    standings: "/v1/standings",
    seasonAverages: "/nba/v1/season_averages",
  },
} as const;
