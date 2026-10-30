/** Ajustes de la aplicación. Los valores sensibles se leen de variables de entorno (solo servidor). */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const APP_CONFIG = {
  /** Zona horaria con la que el usuario ve las fechas. Configurable desde la interfaz (cookie "tz"). */
  defaultTimeZone:
    process.env.DEFAULT_TIME_ZONE ?? "America/Argentina/Buenos_Aires",
  /** El "día de partido" de la NBA se identifica con la fecha de la costa este de EE. UU. */
  gameDayTimeZone: "America/New_York",

  /** Máximo de solicitudes externas nuevas por carga de página. El resto queda pendiente y se avisa. */
  fetchBudgetPerRequest: num(process.env.NBA_FETCH_BUDGET, 150),
  espnConcurrency: 8,

  balldontlie: {
    apiKey: process.env.BALLDONTLIE_API_KEY?.trim() || undefined,
    /** Solicitudes por minuto del plan: Free 5, ALL-STAR 60, GOAT 600. */
    requestsPerMinute: num(process.env.BALLDONTLIE_RPM, 5),
    /** Tiempo máximo que una carga de página espera por el límite antes de usar el respaldo. */
    maxWaitMs: 8_000,
    perPage: 100,
    maxPages: 15,
  },

  /** "auto" prueba BALLDONTLIE y cae a ESPN. También: "espn" o "balldontlie". */
  statsSource: (process.env.STATS_SOURCE ?? "auto") as
    | "auto"
    | "espn"
    | "balldontlie",

  ttlMs: {
    liveDay: 60_000,
    recentDay: 5 * 60_000,
    teams: 24 * 3_600_000,
    roster: 6 * 3_600_000,
    standings: 5 * 60_000,
    capability: 6 * 3_600_000,
    capabilityFailure: 10 * 60_000,
  },

  rankings: {
    /** Partidos mínimos = esta proporción del máximo de partidos jugados por algún jugador. */
    minGamesShare: 0.7,
    /** Intentos mínimos por partido (× máximo de partidos) para listar porcentajes de tiro. */
    minAttemptsPerGame: { fg: 5, fg3: 2, ft: 2 },
    defaultLimit: 15,
    limits: [10, 15, 25, 50],
  },

  seasonsToOffer: 5,
} as const;

export const TIME_ZONE_OPTIONS = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
] as const;
