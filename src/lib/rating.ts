import type { PlayerGameLine, StatKey } from "@/lib/types";

/**
 * VALORACIÓN PROPIA DE LA APLICACIÓN. No es una métrica oficial de la NBA.
 *
 *   puntos + 1,2·rebotes + 1,5·asistencias + 3·robos + 3·bloqueos
 *   − 0,5·tiros de campo fallados − 0,5·tiros libres fallados − pérdidas
 *
 * Para cambiar ponderaciones basta con editar RATING_WEIGHTS.
 */
export const RATING_WEIGHTS = {
  pts: 1,
  reb: 1.2,
  ast: 1.5,
  stl: 3,
  blk: 3,
  fgMiss: -0.5,
  ftMiss: -0.5,
  tov: -1,
} as const;
export type RatingWeights = { [K in keyof typeof RATING_WEIGHTS]: number };

export const RATING_LABEL = "Valoración propia (no oficial)";
export const RATING_FORMULA =
  "Puntos + 1,2 × rebotes + 1,5 × asistencias + 3 × robos + 3 × bloqueos − 0,5 × tiros de campo fallados − 0,5 × tiros libres fallados − pérdidas";

export interface RatingComponent {
  key: keyof RatingWeights;
  label: string;
  /** Cantidad en el partido (p. ej. 8 rebotes). */
  amount: number;
  weight: number;
  contribution: number;
}

export interface Rating {
  /** false si falta algún dato necesario: no entra en rankings ni MVP. */
  complete: boolean;
  total: number | null;
  components: RatingComponent[];
  missing: string[];
}

const LABELS: Record<keyof RatingWeights, string> = {
  pts: "Puntos",
  reb: "Rebotes",
  ast: "Asistencias",
  stl: "Robos",
  blk: "Bloqueos",
  fgMiss: "Tiros de campo fallados",
  ftMiss: "Tiros libres fallados",
  tov: "Pérdidas",
};

const REQUIRED: StatKey[] = ["pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta"];

export function computeRating(
  stats: Record<StatKey, number | null>,
  weights: RatingWeights = RATING_WEIGHTS,
): Rating {
  const missing = REQUIRED.filter((k) => stats[k] === null || stats[k] === undefined);
  // Datos incoherentes (más aciertos que intentos) se tratan como faltantes, no se corrigen.
  const incoherent: string[] = [];
  if (stats.fgm !== null && stats.fga !== null && stats.fgm > stats.fga) incoherent.push("fgm>fga");
  if (stats.ftm !== null && stats.fta !== null && stats.ftm > stats.fta) incoherent.push("ftm>fta");

  if (missing.length || incoherent.length) {
    return { complete: false, total: null, components: [], missing: [...missing, ...incoherent] };
  }

  const amounts: Record<keyof RatingWeights, number> = {
    pts: stats.pts!,
    reb: stats.reb!,
    ast: stats.ast!,
    stl: stats.stl!,
    blk: stats.blk!,
    fgMiss: stats.fga! - stats.fgm!,
    ftMiss: stats.fta! - stats.ftm!,
    tov: stats.tov!,
  };

  const components = (Object.keys(weights) as Array<keyof RatingWeights>).map((key) => ({
    key,
    label: LABELS[key],
    amount: amounts[key],
    weight: weights[key],
    contribution: round2(amounts[key] * weights[key]),
  }));
  const total = round2(components.reduce((acc, c) => acc + c.contribution, 0));
  return { complete: true, total, components, missing: [] };
}

export function rateLine(line: PlayerGameLine, weights?: RatingWeights): Rating {
  if (!line.played) return { complete: false, total: null, components: [], missing: ["no jugó"] };
  return computeRating(line.stats, weights);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
