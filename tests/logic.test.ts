import { describe, expect, it } from "vitest";
import { aggregatePlayers, dedupeLines, fgPct, perGame, splitByTeam } from "@/lib/averages";
import { addDays, monthRange, seasonForDate, weekRange, ymdInTz } from "@/lib/dates";
import { mvpOfDay, mvpOfPeriod } from "@/lib/mvp";
import { buildRanking } from "@/lib/rankings";
import { computeRating } from "@/lib/rating";
import { rankConference } from "@/lib/standings";
import { parseMadeAttempted, adaptBoxscore } from "@/services/espn-adapters";
import type { Game, PlayerGameLine, StandingRow, StatKey } from "@/lib/types";

const blank = (): Record<StatKey, number | null> => ({
  min: 30, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0,
  fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, pf: 0, plusMinus: 0,
});

function line(over: Partial<Omit<PlayerGameLine, "stats">> & { stats?: Partial<Record<StatKey, number | null>> }): PlayerGameLine {
  const { stats, ...rest } = over;
  return {
    gameKey: "2026-10-21_ATL@ORL",
    etDate: "2026-10-21",
    startUtc: "2026-10-21T23:00:00.000Z",
    playerId: "espn:1",
    playerName: "Jugador Uno",
    teamAbbr: "ORL",
    opponentAbbr: "ATL",
    isHome: true,
    played: true,
    source: "espn",
    ...rest,
    stats: { ...blank(), ...stats },
  };
}

describe("valoración", () => {
  it("aplica la fórmula inicial", () => {
    // 30 + 1,2·10 + 1,5·6 + 3·2 + 3·1 − 0,5·(20−11) − 0,5·(8−6) − 3
    const r = computeRating({ ...blank(), pts: 30, reb: 10, ast: 6, stl: 2, blk: 1, tov: 3, fgm: 11, fga: 20, ftm: 6, fta: 8 });
    expect(r.complete).toBe(true);
    expect(r.total).toBe(30 + 12 + 9 + 6 + 3 - 4.5 - 1 - 3);
  });
  it("marca incompleta si falta un dato y no lo reemplaza por cero", () => {
    const r = computeRating({ ...blank(), stl: null });
    expect(r.complete).toBe(false);
    expect(r.total).toBeNull();
    expect(r.missing).toContain("stl");
  });
  it("rechaza datos incoherentes", () => {
    expect(computeRating({ ...blank(), fgm: 5, fga: 3 }).complete).toBe(false);
  });
});

describe("promedios y porcentajes", () => {
  it("divide por partidos disputados y calcula % con totales", () => {
    const lines = [
      line({ gameKey: "g1", stats: { pts: 10, fgm: 1, fga: 10 } }),
      line({ gameKey: "g2", stats: { pts: 30, fgm: 9, fga: 10 } }),
      line({ gameKey: "g3", played: false, stats: { pts: null, fgm: null, fga: null } }),
    ];
    const [a] = aggregatePlayers(lines);
    expect(a.games).toBe(2);
    expect(perGame(a, "pts")).toBe(20);
    expect(fgPct(a)).toBe(0.5);
  });
  it("no cuenta dos veces un partido repetido", () => {
    const l = line({ gameKey: "g1" });
    expect(dedupeLines([l, { ...l }, { ...l }])).toHaveLength(1);
  });
  it("traspasado: un solo total y desglose por equipo", () => {
    const lines = [
      line({ gameKey: "g1", teamAbbr: "ORL", stats: { pts: 10 } }),
      line({ gameKey: "g2", teamAbbr: "ATL", startUtc: "2026-10-23T23:00:00.000Z", stats: { pts: 20 } }),
    ];
    const [a] = aggregatePlayers(lines);
    expect(a.games).toBe(2);
    expect(a.totals.pts).toBe(30);
    const split = splitByTeam(lines, "espn:1");
    expect(split.get("ORL")!.totals.pts).toBe(10);
    expect(split.get("ATL")!.totals.pts).toBe(20);
  });
});

describe("rankings", () => {
  const mk = (id: string, games: number, pts: number) =>
    Array.from({ length: games }, (_, i) =>
      line({ playerId: id, playerName: id, gameKey: `${id}-${i}`, stats: { pts } }),
    );
  it("excluye jugadores con pocos partidos", () => {
    const aggs = aggregatePlayers([...mk("a", 10, 20), ...mk("b", 1, 50)]);
    const r = buildRanking(aggs, "pts", { limit: 10 });
    expect(r.entries.map((e) => e.player.playerId)).toEqual(["a"]);
    expect(r.criteria).toContain("mínimo");
  });
  it("el % exige intentos mínimos", () => {
    const aggs = aggregatePlayers([
      ...mk("a", 10, 20).map((l) => ({ ...l, stats: { ...l.stats, fgm: 5, fga: 10 } })),
      ...mk("b", 10, 20).map((l) => ({ ...l, stats: { ...l.stats, fgm: 1, fga: 1 } })),
    ]);
    const r = buildRanking(aggs, "fgPct", { limit: 10 });
    expect(r.entries.map((e) => e.player.playerId)).toEqual(["a"]);
  });
});

describe("MVP", () => {
  const tz = "America/Argentina/Buenos_Aires";
  const star = (id: string, startUtc: string, pts: number, key: string) =>
    line({ playerId: id, playerName: id, gameKey: key, startUtc, stats: { pts, fga: 0, fgm: 0 } });

  it("diario: usa la fecha local y no la UTC", () => {
    // 02:30 UTC del 22 = 23:30 del 21 en Buenos Aires.
    const late = star("late", "2026-10-22T02:30:00.000Z", 40, "g-late");
    const early = star("early", "2026-10-21T23:00:00.000Z", 20, "g-early");
    expect(mvpOfDay([late, early], "2026-10-21", tz).winner?.line.playerId).toBe("late");
    expect(mvpOfDay([late, early], "2026-10-22", tz).winner).toBeNull();
  });
  it("diario: sin partidos devuelve vacío", () => {
    expect(mvpOfDay([], "2026-10-21", tz).winner).toBeNull();
  });
  it("diario: empate usa criterios transparentes", () => {
    const a = line({ playerId: "a", playerName: "A", gameKey: "g1", stats: { pts: 10, reb: 10 } }); // 10+12=22
    const b = line({ playerId: "b", playerName: "B", gameKey: "g2", stats: { pts: 22 } }); // 22
    const r = mvpOfDay([a, b], "2026-10-21", tz);
    expect(r.tiedAtTop).toHaveLength(2);
    expect(r.winner?.line.playerId).toBe("b"); // más puntos
    expect(r.tieBreak).toBe("más puntos");
  });
  it("diario: excluye líneas incompletas", () => {
    const bad = line({ playerId: "bad", gameKey: "g1", stats: { pts: 99, stl: null } });
    const ok = line({ playerId: "ok", gameKey: "g2", stats: { pts: 5 } });
    const r = mvpOfDay([bad, ok], "2026-10-21", tz);
    expect(r.winner?.line.playerId).toBe("ok");
    expect(r.excluded).toBe(1);
  });
  it("periodo: suma cinco partidos, no promedia", () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      line({ playerId: "p", gameKey: `g${i}`, startUtc: `2026-10-2${i}T23:00:00.000Z`, stats: { pts: 10 } }),
    );
    const one = line({ playerId: "q", gameKey: "gq", stats: { pts: 40 } });
    const r = mvpOfPeriod([...five, one], "2026-10-20", "2026-10-26", tz);
    expect(r.winner?.playerId).toBe("p");
    expect(r.winner?.total).toBe(50);
    expect(r.winner?.games).toBe(5);
  });
});

describe("fechas", () => {
  it("semana de lunes a domingo", () => {
    expect(weekRange("2026-10-23")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(weekRange("2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(weekRange("2026-10-19").from).toBe("2026-10-19");
  });
  it("mes calendario con distinta cantidad de días", () => {
    expect(monthRange(2027, 2).to).toBe("2027-02-28");
    expect(monthRange(2028, 2).to).toBe("2028-02-29");
    expect(monthRange(2026, 10)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("temporada y zonas horarias", () => {
    expect(seasonForDate("2026-10-23")).toBe(2026);
    expect(seasonForDate("2027-03-01")).toBe(2026);
    expect(ymdInTz("2026-10-22T02:30:00Z", "America/Argentina/Buenos_Aires")).toBe("2026-10-21");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("clasificación", () => {
  const row = (abbr: string, w: number, l: number, seed: number | null): StandingRow => ({
    teamAbbr: abbr, teamName: abbr, conference: "East", rank: 0, wins: w, losses: l,
    pct: w + l ? w / (w + l) : null, gamesBehind: null, seed,
  });
  it("respeta el puesto de la fuente cuando es único", () => {
    const t = rankConference("East", [row("A", 1, 1, 2), row("B", 2, 0, 1)]);
    expect(t.orderedBy).toBe("source-seed");
    expect(t.rows[0].teamAbbr).toBe("B");
  });
  it("calcula por porcentaje (no por victorias) con distinto nº de partidos", () => {
    const t = rankConference("East", [row("A", 5, 5, null), row("B", 3, 1, null)]);
    expect(t.orderedBy).toBe("computed");
    expect(t.rows[0].teamAbbr).toBe("B");
    expect(t.rows[1].gamesBehind).toBe(1); // ((3−5) + (5−1)) / 2
  });
  it("no asigna zona de playoffs sin partidos jugados", () => {
    const t = rankConference("East", [row("A", 0, 0, null), row("B", 0, 0, null)]);
    expect(t.rows.every((r) => r.zone === null)).toBe(true);
  });
});

describe("adaptador ESPN", () => {
  it("parsea hecho-intentado", () => {
    expect(parseMadeAttempted("5-12")).toEqual([5, 12]);
    expect(parseMadeAttempted("--")).toEqual([null, null]);
    expect(parseMadeAttempted(undefined)).toEqual([null, null]);
  });
  it("convierte un box score por etiqueta y distingue DNP", () => {
    const game: Game = {
      key: "2026-10-21_ATL@ORL", source: "espn", sourceId: "1", startUtc: "2026-10-21T23:00:00.000Z",
      etDate: "2026-10-21", status: "final", statusDetail: "Final",
      home: { abbr: "ORL", score: 125 }, away: { abbr: "ATL", score: 132 }, season: 2026, seasonType: "regular",
    };
    const labels = ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", "TO", "STL", "BLK", "OREB", "DREB", "PF", "+/-"];
    const lines = adaptBoxscore(
      {
        boxscore: {
          players: [
            {
              team: { abbreviation: "ATL" },
              statistics: [
                {
                  labels,
                  athletes: [
                    { athlete: { id: "10", displayName: "Okongwu" }, stats: ["29", "8", "3-8", "0-4", "2-2", "5", "7", "2", "0", "0", "1", "4", "2", "+10"] },
                    { athlete: { id: "11", displayName: "Banco" }, didNotPlay: true, stats: [] },
                  ],
                },
              ],
            },
          ],
        },
      },
      game,
    );
    expect(lines).toHaveLength(2);
    const [p, dnp] = lines;
    expect(p.played).toBe(true);
    expect(p.stats).toMatchObject({ min: 29, pts: 8, fgm: 3, fga: 8, fg3m: 0, fg3a: 4, ftm: 2, fta: 2, reb: 5, ast: 7, tov: 2, plusMinus: 10 });
    expect(p.opponentAbbr).toBe("ORL");
    expect(p.isHome).toBe(false);
    expect(dnp.played).toBe(false);
    expect(dnp.stats.pts).toBeNull();
  });
});
