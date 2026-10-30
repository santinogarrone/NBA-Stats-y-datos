import "server-only";
import { ENDPOINTS } from "@/config/endpoints";
import { fetchJson } from "@/lib/http";
import type { Game, PlayerGameLine, PlayerInfo, StandingRow } from "@/lib/types";
import {
  adaptBoxscore,
  adaptEvents,
  adaptRoster,
  adaptStandings,
  adaptTeams,
  type EspnTeamInfo,
} from "./espn-adapters";

export type { EspnTeamInfo };

/** Marcador de un día (ymd = "YYYY-MM-DD"). */
export async function fetchScoreboard(ymd: string): Promise<Game[]> {
  return adaptEvents(await fetchJson(ENDPOINTS.espn.scoreboard(ymd)));
}

export async function fetchBoxscore(game: Game): Promise<PlayerGameLine[]> {
  return adaptBoxscore(await fetchJson(ENDPOINTS.espn.summary(game.sourceId)), game);
}

export async function fetchTeams(): Promise<EspnTeamInfo[]> {
  return adaptTeams(await fetchJson(ENDPOINTS.espn.teams));
}

export async function fetchRoster(espnTeamId: string, teamAbbr: string): Promise<PlayerInfo[]> {
  return adaptRoster(await fetchJson(ENDPOINTS.espn.roster(espnTeamId)), teamAbbr);
}

/** Partidos de un equipo (pasados y futuros) según el calendario de ESPN. */
export async function fetchTeamSchedule(espnTeamId: string): Promise<Game[]> {
  return adaptEvents(await fetchJson(ENDPOINTS.espn.teamSchedule(espnTeamId)));
}

export async function fetchStandings(seasonEndYear: number): Promise<StandingRow[]> {
  return adaptStandings(await fetchJson(ENDPOINTS.espn.standings(seasonEndYear)));
}
