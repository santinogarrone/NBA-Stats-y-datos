/** Modelo interno uniforme. Las dos APIs se transforman a estos tipos en los adaptadores. */

export type Conference = "East" | "West";
export type Division =
  | "Atlantic"
  | "Central"
  | "Southeast"
  | "Northwest"
  | "Pacific"
  | "Southwest";

/** "computed" = calculado por la aplicación a partir de datos reales. */
export type DataSource = "espn" | "balldontlie" | "static" | "computed";
export type SeasonType = "preseason" | "regular" | "playoffs" | "playin";
export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export interface Team {
  abbr: string;
  city: string;
  name: string;
  fullName: string;
  conference: Conference;
  division: Division;
  logo?: string;
  color?: string;
  espnId?: string;
}

export interface GameTeamRef {
  abbr: string;
  /** null cuando el partido no empezó o la fuente no informa marcador. */
  score: number | null;
}

export interface Game {
  /** Identificador interno estable entre fuentes: "<fecha ET>_<visitante>@<local>". */
  key: string;
  source: "espn" | "balldontlie";
  /** Identificador propio de la fuente. No se asume igual entre fuentes. */
  sourceId: string;
  startUtc: string;
  /** Fecha del partido en la costa este (día de partido NBA). */
  etDate: string;
  status: GameStatus;
  statusDetail: string;
  home: GameTeamRef;
  away: GameTeamRef;
  /** Año en que empieza la temporada (2026 = 2026-27). */
  season: number;
  seasonType: SeasonType;
}

export const STAT_KEYS = [
  "min",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "oreb",
  "dreb",
  "pf",
  "plusMinus",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export interface PlayerGameLine {
  gameKey: string;
  etDate: string;
  startUtc: string;
  /** "espn:123" o "bdl:456". El prefijo evita mezclar espacios de identificadores. */
  playerId: string;
  playerName: string;
  teamAbbr: string;
  opponentAbbr: string;
  isHome: boolean;
  /** false si no jugó (DNP). Esas líneas no cuentan como partido disputado. */
  played: boolean;
  starter?: boolean;
  position?: string;
  jersey?: string;
  headshot?: string;
  /** null = la fuente no informó el dato. Nunca se sustituye por 0. */
  stats: Record<StatKey, number | null>;
  source: "espn" | "balldontlie";
}

export interface PlayerInfo {
  id: string;
  name: string;
  teamAbbr?: string;
  position?: string;
  jersey?: string;
  height?: string;
  weight?: string;
  age?: number;
  headshot?: string;
  experienceYears?: number;
  source: "espn" | "balldontlie";
}

export interface StandingRow {
  teamAbbr: string;
  teamName: string;
  logo?: string;
  conference: Conference;
  /** Posición en la conferencia. */
  rank: number;
  wins: number;
  losses: number;
  pct: number | null;
  gamesBehind: number | null;
  streak?: string;
  home?: string;
  road?: string;
  conferenceRecord?: string;
  divisionRecord?: string;
  lastTen?: string;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  /** Posición oficial de la fuente, si la informa. */
  seed?: number | null;
}

export interface Meta {
  source: DataSource;
  fetchedAt: string;
  /** Fuente primaria que falló, si se usó el respaldo. */
  fallbackFrom?: DataSource;
  warnings: string[];
}

export interface Result<T> {
  data: T;
  meta: Meta;
}

export interface Coverage {
  days: { total: number; loaded: number; failed: number };
  boxscores: { total: number; loaded: number; failed: number };
  /** true cuando todo lo necesario está cargado. */
  complete: boolean;
}
