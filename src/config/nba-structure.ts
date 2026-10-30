import type { Conference, Division } from "@/lib/types";

/**
 * Estructura estática de la liga (conferencia y división). Ni ESPN (equipos)
 * ni BALLDONTLIE (plan gratuito, sin clasificación) la dan de forma fiable
 * en todos los casos, y cambia solo si la NBA reorganiza la liga.
 */
export interface TeamStatic {
  abbr: string;
  city: string;
  name: string;
  conference: Conference;
  division: Division;
}

export const NBA_TEAMS: TeamStatic[] = [
  { abbr: "BOS", city: "Boston", name: "Celtics", conference: "East", division: "Atlantic" },
  { abbr: "BKN", city: "Brooklyn", name: "Nets", conference: "East", division: "Atlantic" },
  { abbr: "NYK", city: "New York", name: "Knicks", conference: "East", division: "Atlantic" },
  { abbr: "PHI", city: "Philadelphia", name: "76ers", conference: "East", division: "Atlantic" },
  { abbr: "TOR", city: "Toronto", name: "Raptors", conference: "East", division: "Atlantic" },
  { abbr: "CHI", city: "Chicago", name: "Bulls", conference: "East", division: "Central" },
  { abbr: "CLE", city: "Cleveland", name: "Cavaliers", conference: "East", division: "Central" },
  { abbr: "DET", city: "Detroit", name: "Pistons", conference: "East", division: "Central" },
  { abbr: "IND", city: "Indiana", name: "Pacers", conference: "East", division: "Central" },
  { abbr: "MIL", city: "Milwaukee", name: "Bucks", conference: "East", division: "Central" },
  { abbr: "ATL", city: "Atlanta", name: "Hawks", conference: "East", division: "Southeast" },
  { abbr: "CHA", city: "Charlotte", name: "Hornets", conference: "East", division: "Southeast" },
  { abbr: "MIA", city: "Miami", name: "Heat", conference: "East", division: "Southeast" },
  { abbr: "ORL", city: "Orlando", name: "Magic", conference: "East", division: "Southeast" },
  { abbr: "WAS", city: "Washington", name: "Wizards", conference: "East", division: "Southeast" },
  { abbr: "DEN", city: "Denver", name: "Nuggets", conference: "West", division: "Northwest" },
  { abbr: "MIN", city: "Minnesota", name: "Timberwolves", conference: "West", division: "Northwest" },
  { abbr: "OKC", city: "Oklahoma City", name: "Thunder", conference: "West", division: "Northwest" },
  { abbr: "POR", city: "Portland", name: "Trail Blazers", conference: "West", division: "Northwest" },
  { abbr: "UTA", city: "Utah", name: "Jazz", conference: "West", division: "Northwest" },
  { abbr: "GSW", city: "Golden State", name: "Warriors", conference: "West", division: "Pacific" },
  { abbr: "LAC", city: "LA", name: "Clippers", conference: "West", division: "Pacific" },
  { abbr: "LAL", city: "Los Angeles", name: "Lakers", conference: "West", division: "Pacific" },
  { abbr: "PHX", city: "Phoenix", name: "Suns", conference: "West", division: "Pacific" },
  { abbr: "SAC", city: "Sacramento", name: "Kings", conference: "West", division: "Pacific" },
  { abbr: "DAL", city: "Dallas", name: "Mavericks", conference: "West", division: "Southwest" },
  { abbr: "HOU", city: "Houston", name: "Rockets", conference: "West", division: "Southwest" },
  { abbr: "MEM", city: "Memphis", name: "Grizzlies", conference: "West", division: "Southwest" },
  { abbr: "NOP", city: "New Orleans", name: "Pelicans", conference: "West", division: "Southwest" },
  { abbr: "SAS", city: "San Antonio", name: "Spurs", conference: "West", division: "Southwest" },
];

/** ESPN abrevia distinto a BALLDONTLIE. El identificador común es la abreviatura estándar. */
const ABBR_ALIASES: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  UTAH: "UTA",
  WSH: "WAS",
  PHO: "PHX",
  BRK: "BKN",
  CHO: "CHA",
  NOH: "NOP",
};

export function normalizeAbbr(abbr: string): string {
  const up = abbr.trim().toUpperCase();
  return ABBR_ALIASES[up] ?? up;
}

export const TEAM_BY_ABBR = new Map(NBA_TEAMS.map((t) => [t.abbr, t]));

export const CONFERENCE_LABEL: Record<Conference, string> = {
  East: "Este",
  West: "Oeste",
};

export const DIVISION_LABEL: Record<Division, string> = {
  Atlantic: "Atlántico",
  Central: "Central",
  Southeast: "Sureste",
  Northwest: "Noroeste",
  Pacific: "Pacífico",
  Southwest: "Suroeste",
};

export const DIVISIONS_BY_CONFERENCE: Record<Conference, Division[]> = {
  East: ["Atlantic", "Central", "Southeast"],
  West: ["Northwest", "Pacific", "Southwest"],
};
