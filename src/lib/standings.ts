import type { Conference, StandingRow } from "@/lib/types";

export type PlayoffZone = "direct" | "playin" | "out" | null;

export interface RankedStanding extends StandingRow {
  zone: PlayoffZone;
}

export interface ConferenceTable {
  conference: Conference;
  rows: RankedStanding[];
  /** "source-seed": orden de la fuente. "computed": calculado por la aplicación. */
  orderedBy: "source-seed" | "computed";
  note?: string;
}

const diff = (r: StandingRow) =>
  r.pointsFor != null && r.pointsAgainst != null ? r.pointsFor - r.pointsAgainst : null;

/**
 * Orden de una conferencia.
 * 1) Si la fuente da un puesto (playoffSeed) único para todos los equipos, se respeta: es el
 *    orden oficial con los desempates de la NBA ya aplicados.
 * 2) Si no, se calcula: porcentaje de victorias (no victorias brutas, porque los equipos
 *    pueden haber jugado distinto número de partidos), luego victorias y diferencia de puntos.
 *    Este cálculo NO aplica la cadena completa de desempates de la NBA (resultado entre equipos,
 *    récord de división, etc.), por lo que puede diferir en empates exactos.
 */
export function rankConference(conference: Conference, input: StandingRow[]): ConferenceTable {
  const rows = input.filter((r) => r.conference === conference).map((r) => ({ ...r }));

  const seeds = rows.map((r) => r.seed);
  const seedsUsable =
    rows.length > 0 &&
    seeds.every((s): s is number => typeof s === "number" && s > 0) &&
    new Set(seeds).size === rows.length;

  let orderedBy: ConferenceTable["orderedBy"];
  let note: string | undefined;
  if (seedsUsable) {
    rows.sort((a, b) => a.seed! - b.seed!);
    orderedBy = "source-seed";
  } else {
    rows.sort(
      (a, b) =>
        (b.pct ?? -1) - (a.pct ?? -1) ||
        b.wins - a.wins ||
        (diff(b) ?? -Infinity) - (diff(a) ?? -Infinity) ||
        a.teamName.localeCompare(b.teamName, "es"),
    );
    orderedBy = "computed";
    note =
      "Orden calculado por porcentaje de victorias, victorias y diferencia de puntos. No aplica todos los desempates oficiales de la NBA.";
  }

  const leader = rows[0];
  const anyPlayed = rows.some((r) => r.wins + r.losses > 0);

  const ranked: RankedStanding[] = rows.map((r, i) => {
    const rank = i + 1;
    const gb =
      r.gamesBehind ??
      (leader ? (leader.wins - r.wins + (r.losses - leader.losses)) / 2 : null);
    // Sin partidos jugados no se puede hablar de zona de playoffs.
    const zone: PlayoffZone = !anyPlayed ? null : rank <= 6 ? "direct" : rank <= 10 ? "playin" : "out";
    return { ...r, rank, gamesBehind: gb, zone };
  });

  return { conference, rows: ranked, orderedBy, note };
}

export function playoffZoneLabel(zone: PlayoffZone): string {
  if (zone === "direct") return "Zona playoffs";
  if (zone === "playin") return "Zona play-in";
  if (zone === "out") return "Fuera de zona";
  return "—";
}
