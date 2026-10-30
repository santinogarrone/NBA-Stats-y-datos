import Link from "next/link";
import { notFound } from "next/navigation";
import { CONFERENCE_LABEL, DIVISION_LABEL, TEAM_BY_ABBR } from "@/config/nba-structure";
import { aggregatePlayers } from "@/lib/averages";
import { seasonLabel } from "@/lib/dates";
import { fmt, fmtPct, fmtSigned, fmtWinPct } from "@/lib/format";
import { getTz, one, parseSeason, seasonOptions, withParams, type PageProps } from "@/lib/params";
import { defaultDir, joinRoster, sortPlayerRows } from "@/lib/playerRows";
import type { Game } from "@/lib/types";
import { DataStatus } from "@/components/DataStatus";
import { Field, FilterForm } from "@/components/FilterForm";
import { GameCard } from "@/components/GameCard";
import { TeamLogo } from "@/components/images";
import { PlayerStatsTable } from "@/components/PlayerStatsTable";
import { Badge, EmptyState, SectionTitle, StatTile } from "@/components/ui";
import { getRoster, getSeasonLines, getStandings, getTeamMap, getTeamSchedule, newBudget } from "@/services/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<{ abbr: string }>) {
  const { abbr } = await params;
  const t = TEAM_BY_ABBR.get(abbr.toUpperCase());
  return { title: t ? `${t.city} ${t.name}` : "Equipo" };
}

export default async function TeamPage({ params, searchParams }: PageProps<{ abbr: string }>) {
  const { abbr: raw } = await params;
  const abbr = raw.toUpperCase();
  const info = TEAM_BY_ABBR.get(abbr);
  if (!info) notFound();

  const sp = await searchParams;
  const tz = await getTz();
  const season = parseSeason(one(sp.temporada), tz);
  const sortKey = one(sp.orden) ?? "pts";
  const sortDir = one(sp.dir) === "asc" || one(sp.dir) === "desc" ? (one(sp.dir) as "asc" | "desc") : defaultDir(sortKey);
  const budget = newBudget();

  const [{ teams }, standings, roster, schedule, seasonData] = await Promise.all([
    getTeamMap(),
    getStandings(season),
    getRoster(abbr),
    getTeamSchedule(abbr),
    getSeasonLines(season, tz, budget),
  ]);

  const team = teams.get(abbr)!;
  const row = [...standings.east.rows, ...standings.west.rows].find((r) => r.teamAbbr === abbr);

  // Estadísticas del equipo: solo con partidos de este equipo ya cargados.
  const teamLines = seasonData.lines.filter((l) => l.teamAbbr === abbr);
  const teamGames = seasonData.games.filter((g) => g.home.abbr === abbr || g.away.abbr === abbr);
  const gamesWithLines = new Set(teamLines.map((l) => l.gameKey));
  const n = gamesWithLines.size;
  const sum = (k: "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "fgm" | "fga" | "fg3m" | "fg3a" | "ftm" | "fta") =>
    teamLines.reduce((acc, l) => acc + (l.stats[k] ?? 0), 0);
  const pf = teamGames.reduce((a, g) => a + ((g.home.abbr === abbr ? g.home.score : g.away.score) ?? 0), 0);
  const pa = teamGames.reduce((a, g) => a + ((g.home.abbr === abbr ? g.away.score : g.home.score) ?? 0), 0);

  // Resultados y próximos: calendario de ESPN + partidos ya cargados, sin duplicar por clave.
  const merged = new Map<string, Game>();
  [...teamGames, ...schedule.data].forEach((g) => {
    const prev = merged.get(g.key);
    if (!prev || (prev.status !== "final" && g.status === "final")) merged.set(g.key, g);
  });
  const all = [...merged.values()].filter((g) => g.season === season).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const results = all.filter((g) => g.status === "final").slice(-5).reverse();
  const upcoming = all.filter((g) => g.status === "scheduled" || g.status === "live").slice(0, 5);

  const aggs = aggregatePlayers(teamLines);
  const { current, former } = joinRoster(roster.data, aggs);
  const hrefFor = (key: string) =>
    withParams(`/equipos/${abbr}`, sp, { orden: key, dir: sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : defaultDir(key) });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <TeamLogo abbr={abbr} logo={team.logo} size={72} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{team.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge>{abbr}</Badge>
            <Badge tone={info.conference === "East" ? "east" : "west"}>Conferencia {CONFERENCE_LABEL[info.conference]}</Badge>
            <span>División {DIVISION_LABEL[info.division]}</span>
            <span>· Temporada {seasonLabel(season)}</span>
          </div>
        </div>
      </div>

      <FilterForm action={`/equipos/${abbr}`}>
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
      </FilterForm>

      <section aria-labelledby="record">
        <SectionTitle id="record" title="Clasificación" />
        {row ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatTile label={`Puesto (${CONFERENCE_LABEL[info.conference]})`} value={`${row.rank}º`} />
            <StatTile label="Victorias-derrotas" value={`${row.wins}-${row.losses}`} />
            <StatTile label="% victorias" value={fmtWinPct(row.pct)} />
            <StatTile label="Local" value={row.home ?? "—"} />
            <StatTile label="Visitante" value={row.road ?? "—"} />
            <StatTile label="Racha" value={row.streak ?? "—"} />
          </div>
        ) : (
          <EmptyState title="Sin clasificación disponible para este equipo" />
        )}
      </section>

      <section aria-labelledby="colectivas">
        <SectionTitle id="colectivas" title="Estadísticas colectivas" subtitle={n > 0 ? `Calculadas con ${n} partido(s) cargados` : undefined} />
        {n === 0 ? (
          <EmptyState title="Sin partidos cargados todavía" hint="Las estadísticas colectivas se calculan a partir de los box scores." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatTile label="Puntos a favor" value={fmt(pf / teamGames.length)} />
            <StatTile label="Puntos en contra" value={fmt(pa / teamGames.length)} />
            <StatTile label="Diferencia" value={fmtSigned((pf - pa) / teamGames.length)} />
            <StatTile label="Rebotes" value={fmt(sum("reb") / n)} />
            <StatTile label="Asistencias" value={fmt(sum("ast") / n)} />
            <StatTile label="Robos" value={fmt(sum("stl") / n)} />
            <StatTile label="Bloqueos" value={fmt(sum("blk") / n)} />
            <StatTile label="Pérdidas" value={fmt(sum("tov") / n)} />
            <StatTile label="Tiros de campo" value={fmtPct(sum("fga") > 0 ? sum("fgm") / sum("fga") : null)} />
            <StatTile label="Triples" value={fmtPct(sum("fg3a") > 0 ? sum("fg3m") / sum("fg3a") : null)} />
            <StatTile label="Triples por partido" value={fmt(sum("fg3m") / n)} />
            <StatTile label="Tiros libres" value={fmtPct(sum("fta") > 0 ? sum("ftm") / sum("fta") : null)} />
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="recientes">
          <SectionTitle id="recientes" title="Resultados recientes" />
          {results.length === 0 ? <EmptyState title="Aún no hay resultados" /> : <div className="space-y-3">{results.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} showDate />)}</div>}
        </section>
        <section aria-labelledby="proximos">
          <SectionTitle id="proximos" title="Próximos partidos" />
          {upcoming.length === 0 ? (
            <EmptyState title="No hay partidos programados" hint={schedule.meta.warnings[0]} />
          ) : (
            <div className="space-y-3">{upcoming.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} showDate />)}</div>
          )}
        </section>
      </div>

      <section aria-labelledby="plantilla">
        <SectionTitle id="plantilla" title="Plantilla y promedios individuales" subtitle={`${current.length} jugadores en la plantilla actual`} />
        <PlayerStatsTable
          rows={sortPlayerRows(current, sortKey, sortDir)}
          caption={`Plantilla de ${team.fullName}`}
          sortKey={sortKey}
          sortDir={sortDir}
          hrefFor={hrefFor}
          showBio
          showTeam={false}
          empty={<EmptyState title="Plantilla no disponible" hint={roster.meta.warnings.join(" ")} />}
        />
        {former.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-muted">Con partidos para este equipo y fuera de la plantilla actual</h3>
            <PlayerStatsTable rows={sortPlayerRows(former, sortKey, sortDir)} caption="Jugadores que ya no están en la plantilla" sortKey={sortKey} sortDir={sortDir} hrefFor={hrefFor} showTeam={false} />
          </div>
        )}
      </section>

      <div className="space-y-2 border-t border-line pt-4">
        <DataStatus meta={roster.meta} tz={tz} />
        <DataStatus meta={seasonData.meta} coverage={seasonData.coverage} tz={tz} />
        <DataStatus meta={standings.meta} tz={tz} />
        <p className="text-xs text-muted">
          <Link className="text-accent hover:underline" href="/equipos">← Todos los equipos</Link>
        </p>
      </div>
    </div>
  );
}
