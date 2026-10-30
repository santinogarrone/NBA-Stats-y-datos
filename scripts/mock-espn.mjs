// Servidor ESPN simulado para pruebas locales. Replica las estructuras reales verificadas.
// Uso: node scripts/mock-espn.mjs  (puerto 4010)  y  ESPN_API_BASE=http://localhost:4010
import http from "node:http";

const TEAMS = [
  ["1","ATL","Atlanta Hawks"],["2","BOS","Boston Celtics"],["17","BKN","Brooklyn Nets"],["30","CHA","Charlotte Hornets"],
  ["4","CHI","Chicago Bulls"],["5","CLE","Cleveland Cavaliers"],["6","DAL","Dallas Mavericks"],["7","DEN","Denver Nuggets"],
  ["8","DET","Detroit Pistons"],["9","GS","Golden State Warriors"],["10","HOU","Houston Rockets"],["11","IND","Indiana Pacers"],
  ["12","LAC","LA Clippers"],["13","LAL","Los Angeles Lakers"],["29","MEM","Memphis Grizzlies"],["14","MIA","Miami Heat"],
  ["15","MIL","Milwaukee Bucks"],["16","MIN","Minnesota Timberwolves"],["3","NO","New Orleans Pelicans"],["18","NY","New York Knicks"],
  ["25","OKC","Oklahoma City Thunder"],["19","ORL","Orlando Magic"],["20","PHI","Philadelphia 76ers"],["21","PHX","Phoenix Suns"],
  ["22","POR","Portland Trail Blazers"],["23","SAC","Sacramento Kings"],["24","SA","San Antonio Spurs"],["28","TOR","Toronto Raptors"],
  ["26","UTAH","Utah Jazz"],["27","WSH","Washington Wizards"],
];
const EAST = new Set(["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NY","ORL","PHI","TOR","WSH"]);
const byAbbr = Object.fromEntries(TEAMS.map(([id, a, n]) => [a, { id, a, n }]));
const logo = (a) => `https://a.espncdn.com/i/teamlogos/nba/500/${a.toLowerCase()}.png`;
const teamObj = (a) => ({ id: byAbbr[a].id, abbreviation: a, displayName: byAbbr[a].n, logo: logo(a), color: "336699" });

// [fecha ISO, visitante, local, estado]
const GAMES = [
  ["2026-10-20T23:00Z","BOS","NY","post"],["2026-10-21T02:30Z","LAL","GS","post"],["2026-10-21T03:30Z","DEN","OKC","post"],
  ["2026-10-21T23:00Z","ATL","ORL","post"],["2026-10-21T23:00Z","MIL","WSH","post"],["2026-10-21T23:30Z","MIN","MIA","post"],
  ["2026-10-22T23:00Z","PHI","BKN","post"],["2026-10-22T23:30Z","DAL","HOU","post"],["2026-10-22T23:30Z","SA","PHX","post"],
  ["2026-10-23T23:00Z","CLE","DET","in"],["2026-10-23T23:30Z","TOR","CHI","pre"],["2026-10-24T00:00Z","MEM","POR","pre"],
  ["2026-10-25T23:00Z","BOS","MIA","pre"],
];
const evId = (i) => String(401900000 + i);
const rnd = (seed) => { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

function playersOf(abbr) {
  const base = Number(byAbbr[abbr].id) * 100;
  return Array.from({ length: 9 }, (_, i) => ({ id: String(base + i), name: `${byAbbr[abbr].n.split(" ").pop()} Jugador ${i + 1}`, jersey: String(i + 1), pos: ["PG","SG","SF","PF","C"][i % 5] }));
}

function event(i) {
  const [date, away, home, st] = GAMES[i];
  const state = st;
  const sc = (a, h) => (state === "pre" ? "0" : String(a + Math.floor(rnd(i * 7 + h) * 25)));
  const status = { type: { id: state === "post" ? "3" : state === "in" ? "2" : "1", name: state === "post" ? "STATUS_FINAL" : state === "in" ? "STATUS_IN_PROGRESS" : "STATUS_SCHEDULED", state, completed: state === "post", detail: state === "post" ? "Final" : state === "in" ? "5:12 - 3rd Quarter" : "Scheduled", shortDetail: state === "post" ? "Final" : state === "in" ? "5:12 - 3rd" : "Scheduled" } };
  return {
    id: evId(i), date, name: `${byAbbr[away].n} at ${byAbbr[home].n}`, season: { year: 2027, type: 2, slug: "regular-season" }, status,
    competitions: [{ status, competitors: [
      { homeAway: "home", score: sc(100, 1), team: teamObj(home) },
      { homeAway: "away", score: sc(98, 2), team: teamObj(away) },
    ] }],
  };
}
const etDate = (iso) => new Date(new Date(iso).getTime() - 4 * 3600e3).toISOString().slice(0, 10).replaceAll("-", "");

function boxscore(i) {
  const [, away, home] = GAMES[i];
  const labels = ["MIN","PTS","FG","3PT","FT","REB","AST","TO","STL","BLK","OREB","DREB","PF","+/-"];
  const mk = (abbr, side) => ({
    team: teamObj(abbr),
    statistics: [{ labels, athletes: playersOf(abbr).map((p, k) => {
      if (k === 8) return { didNotPlay: true, reason: "COACH'S DECISION", athlete: { id: p.id, displayName: p.name, jersey: p.jersey, position: { abbreviation: p.pos } }, stats: [] };
      const r = (n) => Math.floor(rnd(i * 131 + side * 17 + k * 3 + n) * 1000);
      const fga = 6 + (r(1) % 16), fgm = Math.min(fga, Math.floor(fga * (0.3 + rnd(i + k) * 0.35)));
      const tpa = r(2) % 8, tpm = Math.min(tpa, fgm, Math.floor(tpa * 0.4));
      const fta = r(3) % 9, ftm = Math.floor(fta * 0.8);
      const pts = (fgm - tpm) * 2 + tpm * 3 + ftm + (fgm >= 0 ? 0 : 0);
      const stats = [String(18 + (r(4) % 20)), String(pts), `${fgm}-${fga}`, `${tpm}-${tpa}`, `${ftm}-${fta}`, String(r(5) % 12), String(r(6) % 10), String(r(7) % 5), String(r(8) % 4), String(r(9) % 3), "1", "3", String(r(10) % 5), `${(r(11) % 21) - 10}`];
      // Caso de dato faltante: un jugador sin tiros libres informados
      if (i === 4 && side === 0 && k === 1) stats[4] = "--";
      return { starter: k < 5, athlete: { id: p.id, displayName: p.name, jersey: p.jersey, headshot: { href: `https://a.espncdn.com/i/headshots/nba/players/full/${p.id}.png` }, position: { abbreviation: p.pos } }, stats };
    }) }],
  });
  return { boxscore: { players: [mk(away, 0), mk(home, 1)] } };
}

function standings() {
  const rec = {}; TEAMS.forEach(([, a]) => (rec[a] = { w: 0, l: 0 }));
  GAMES.forEach((g, i) => { if (g[3] !== "post") return; const e = event(i).competitions[0].competitors; const h = Number(e[0].score), a = Number(e[1].score); (h > a ? [g[2], g[1]] : [g[1], g[2]]).forEach((t, k) => (k === 0 ? rec[t].w++ : rec[t].l++)); });
  const mkEntry = (a) => {
    const { w, l } = rec[a]; const g = w + l;
    return { team: { id: byAbbr[a].id, abbreviation: a, displayName: byAbbr[a].n, logos: [{ href: logo(a), rel: ["full", "default"] }] },
      stats: [
        { name: "wins", value: w, displayValue: String(w) }, { name: "losses", value: l, displayValue: String(l) },
        { name: "winPercent", value: g ? w / g : 0, displayValue: g ? (w / g).toFixed(3) : ".000" },
        { name: "gamesBehind", value: 0, displayValue: "0" }, { name: "streak", value: w > l ? 1 : -1, displayValue: g ? (w > l ? "W1" : "L1") : "-" },
        { name: "pointsFor", value: 100 * g, displayValue: "" }, { name: "pointsAgainst", value: 98 * g, displayValue: "" },
        { name: "Home", summary: `${w}-0`, displayValue: `${w}-0` }, { name: "Road", summary: `0-${l}`, displayValue: `0-${l}` },
        { name: "vs. Conf.", summary: `${w}-${l}`, displayValue: "" }, { name: "Last Ten Games", summary: `${w}-${l}`, displayValue: "" },
      ] };
  };
  const conf = (name, set) => {
    const list = TEAMS.map((t) => t[1]).filter((a) => set(a)).map(mkEntry);
    // Sin playoffSeed (caso real a inicio de temporada): obliga al cálculo propio.
    return { name, abbreviation: name.startsWith("E") ? "East" : "West", standings: { seasonDisplayName: "2026-27", entries: list } };
  };
  return { children: [conf("Eastern Conference", (a) => EAST.has(a)), conf("Western Conference", (a) => !EAST.has(a))] };
}

const routes = [
  [/\/scoreboard$/, (q) => { const d = q.get("dates"); return { events: GAMES.map((_, i) => i).filter((i) => !d || etDate(GAMES[i][0]) === d).map(event) }; }],
  [/\/summary$/, (q) => { const i = Number(q.get("event")) - 401900000; return GAMES[i] ? boxscore(i) : null; }],
  [/\/teams$/, () => ({ sports: [{ leagues: [{ teams: TEAMS.map(([id, a, n]) => ({ team: { id, abbreviation: a, displayName: n, color: "336699", logos: [{ href: logo(a), rel: ["default"] }] } })) }] }] })],
  [/\/teams\/(\d+)\/roster$/, (_q, m) => { const t = TEAMS.find((x) => x[0] === m[1]); if (!t) return null; return { athletes: playersOf(t[1]).map((p, k) => ({ id: p.id, fullName: p.name, jersey: p.jersey, age: 21 + k, displayHeight: `6' ${k + 2}"`, displayWeight: "210 lbs", position: { abbreviation: p.pos }, headshot: { href: `https://a.espncdn.com/i/headshots/nba/players/full/${p.id}.png` }, experience: { years: k } })) }; }],
  [/\/teams\/(\d+)\/schedule$/, (_q, m) => { const t = TEAMS.find((x) => x[0] === m[1]); if (!t) return null; return { events: GAMES.map((_, i) => i).filter((i) => GAMES[i][1] === t[1] || GAMES[i][2] === t[1]).map(event) }; }],
  [/\/standings$/, () => standings()],
];

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (process.env.MOCK_FAIL && u.pathname.includes(process.env.MOCK_FAIL)) { res.writeHead(500); return res.end("boom"); }
  for (const [re, fn] of routes) {
    const m = re.exec(u.pathname);
    if (m) { const body = fn(u.searchParams, m); if (!body) { res.writeHead(404); return res.end("{}"); } res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(body)); }
  }
  res.writeHead(404); res.end("{}");
}).listen(4010, () => console.log("mock ESPN en :4010"));
