import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { adaptGame, adaptStat, parseMinutes } from "@/services/balldontlie";
import { computeRating } from "@/lib/rating";

// Formas según https://docs.balldontlie.io (no se han probado contra la API real).
const rawGame = {
  id: 15907925,
  date: "2026-10-21",
  datetime: "2026-10-21T23:00:00.000Z",
  season: 2026,
  status: "Final",
  period: 4,
  time: "",
  postseason: false,
  postponed: false,
  home_team_score: 125,
  visitor_team_score: 132,
  home_team: { id: 22, abbreviation: "ORL" },
  visitor_team: { id: 1, abbreviation: "ATL" },
};

describe("adaptador BALLDONTLIE", () => {
  it("convierte minutos en formatos distintos", () => {
    expect(parseMinutes("34")).toBe(34);
    expect(parseMinutes("34:30")).toBe(34.5);
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes(null)).toBeNull();
  });

  it("adapta un partido finalizado y genera la clave común con ESPN", () => {
    const g = adaptGame(rawGame)!;
    expect(g.key).toBe("2026-10-21_ATL@ORL");
    expect(g.status).toBe("final");
    expect(g.home.score).toBe(125);
    expect(g.away.score).toBe(132);
    expect(g.season).toBe(2026);
  });

  it("un partido programado no muestra marcador", () => {
    const g = adaptGame({ ...rawGame, status: "2026-10-25T23:00:00Z", period: 0, home_team_score: 0, visitor_team_score: 0 })!;
    expect(g.status).toBe("scheduled");
    expect(g.home.score).toBeNull();
  });

  it("el día de partido es el de la costa este aunque la fecha UTC cambie", () => {
    const g = adaptGame({ ...rawGame, date: "2026-10-22", datetime: "2026-10-22T02:30:00.000Z" })!;
    expect(g.etDate).toBe("2026-10-21");
  });

  it("descarta equipos que no son de la NBA", () => {
    expect(adaptGame({ ...rawGame, home_team: { id: 99, abbreviation: "XXX" } })).toBeNull();
  });

  it("adapta una línea de estadísticas y deja null lo que falta", () => {
    const game = adaptGame(rawGame)!;
    const base = {
      min: "29", fgm: 3, fga: 8, fg3m: 0, fg3a: 4, ftm: 2, fta: 2, oreb: 1, dreb: 4, reb: 5,
      ast: 7, stl: 0, blk: 0, turnover: 2, pf: 2, pts: 8, plus_minus: 10,
      player: { id: 1, first_name: "Onyeka", last_name: "Okongwu", position: "C", jersey_number: "17" },
      team: { id: 1, abbreviation: "ATL" },
      game: { id: 15907925 },
    };
    const ok = adaptStat(base, game)!;
    expect(ok.playerId).toBe("bdl:1");
    expect(ok.isHome).toBe(false);
    expect(ok.opponentAbbr).toBe("ORL");
    expect(computeRating(ok.stats).complete).toBe(true);

    const missing = adaptStat({ ...base, stl: null }, game)!;
    expect(missing.stats.stl).toBeNull();
    expect(computeRating(missing.stats).complete).toBe(false);
  });

  it("minutos 0 y sin intentos cuenta como no jugó", () => {
    const game = adaptGame(rawGame)!;
    const dnp = adaptStat(
      { min: "00", fgm: 0, fga: 0, pts: 0, player: { id: 2, first_name: "A", last_name: "B" }, team: { id: 1, abbreviation: "ATL" }, game: { id: 1 } },
      game,
    )!;
    expect(dnp.played).toBe(false);
    expect(dnp.stats.pts).toBeNull();
  });
});
