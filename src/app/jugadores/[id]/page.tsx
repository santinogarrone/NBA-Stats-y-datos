import Link from "next/link";
import { notFound } from "next/navigation";
import {
  aggregatePlayers,
  dedupeLines,
  fg3Pct,
  fgPct,
  ftPct,
  perGame,
  ratingPerGame,
  splitByTeam,
  type PlayerAggregate,
} from "@/lib/averages";
import { addDays, formatYmd, formatYmdShort, seasonLabel, todayInTz } from "@/lib/dates";
import { fmt, fmtPct, normalizeName, playerIdFromSlug, playerSlug } from "@/lib/format";
import { getTz, one, parseSeason, seasonOptions, withParams, type PageProps } from "@/lib/params";
import { buildRanking, RANKINGS } from "@/lib/rankings";
import { rateLine } from "@/lib/rating";
import type { PlayerGameLine, StatKey } from "@/lib/types";
import { DataStatus } from "@/components/DataStatus";
import { Field, FilterForm } from "@/components/FilterForm";
import { PlayerPhoto, TeamLogo } from "@/components/images";
import { LineChart } from "@/components/LineChart";
import { RatingBreakdown } from "@/components/RatingBreakdown";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Badge, Card, EmptyState, SectionTitle, StatTile } from "@/components/ui";
import { getRoster, getSeasonLines, getTeamMap, newBudget, type SeasonFilter } from "@/services/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jugador" };

const RANGE_OPTIONS = [
  { value: "temporada", label: "Toda la temporada" },
  { value: "5", label: "Últimos 5 partidos" },
  { value: "10", label: "Últimos 10 partidos" },
  { value: "20", label: "Últimos 20 partidos" },
  { value: "30d", label: "Últimos 30 días" },
];

type LogRow = { line: PlayerGameLine; result: string; rating: number | null };

const LOG_SORT: Record<string, (r: LogRow) => number> = {
  fecha: (r) => new Date(r.line.startUtc).getTime(),
  pts: (r) => r.line.stats.pts ?? -1,
  reb: (r) => r.line.stats.reb ?? -1,
  ast: (r) => r.line.stats.ast ?? -1,
  stl: (r) => r.line.stats.stl ?? -1,
  blk: (r) => r.line.stats.blk ?? -1,
  fg3m: (r) => r.line.stats.fg3m ?? -1,
  min: (r) => r.line.stats.min ?? -1,
  val: (r) => r.rating ?? -Infinity,
};

export default async function PlayerPage({ params, searchParams }: PageProps<{ id: string }>) {
  const { id: slug } = await params;
  if (!/^(espn|bdl)-\d+$/.test(slug)) notFound();
  const playerId = playerIdFromSlug(slug);

  const sp = await searchParams;
  const tz = await getTz();
  const today = todayInTz(tz);
  const season = parseSeason(one(sp.temporada), tz);
  const rangeKey = RANGE_OPTIONS.some((o) => o.value === one(sp.rango)) ? one(sp.rango)! : "temporada";
  const typeParam = one(sp.tipo);
  const type: SeasonFilter = typeParam === "playoffs" || typeParam === "all" ? typeParam : "regular";
  const sortKey = one(sp.orden) && LOG_SORT[one(sp.orden)!] ? one(sp.orden)! : "fecha";
  const sortDir = one(sp.dir) === "asc" ? "asc" : "desc";
  const compareSlug = one(sp.comparar);
  const compareId = compareSlug && /^(espn|bdl)-\d+$/.test(compareSlug) ? playerIdFromSlug(compareSlug) : undefined;

  const [{ teams }, data] = await Promise.all([getTeamMap(), getSeasonLines(season, tz, newBudget(), type)]);

  const seasonAggs = aggregatePlayers(data.lines);
  const playedLines = dedupeLines(data.lines.filter((l) => l.playerId === playerId && l.played));
  const gameByKey = new Map(data.games.map((g) => [g.key, g]));

  // Rango temporal elegido.
  let lines = [...playedLines].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  if (/^\d+$/.test(rangeKey)) lines = lines.slice(-Number(rangeKey));
  if (rangeKey === "30d") lines = lines.filter((l) => l.etDate >= addDays(today, -30));

  const [agg] = aggregatePlayers(lines);
  const seasonAgg = seasonAggs.find((a) => a.playerId === playerId);
  const ref = lines[lines.length - 1] ?? playedLines[playedLines.length - 1];
  const name = ref?.playerName ?? "Jugador";
  const teamAbbr = ref?.teamAbbr;

  // Datos biográficos desde la plantilla del equipo actual.
  const roster = teamAbbr ? await getRoster(teamAbbr) : null;
  const bio = roster?.data.find((p) => p.id === playerId || normalizeName(p.name) === normalizeName(name));

  // Posición en los rankings (de la temporada completa, no del rango).
  const positions = RANKINGS.map((def) => {
    const res = buildRanking(seasonAggs, def.id, { limit: 100000 });
    const hit = res.entries.find((e) => e.player.playerId === playerId);
    return { def, rank: hit?.rank ?? null, total: res.eligible, value: hit?.value ?? null, criteria: res.criteria };
  });

  const rows: LogRow[] = lines.map((l) => {
    const g = gameByKey.get(l.gameKey);
    const mine = g ? (g.home.abbr === l.teamAbbr ? g.home.score : g.away.score) : null;
    const theirs = g ? (g.home.abbr === l.teamAbbr ? g.away.score : g.home.score) : null;
    const result = mine !== null && theirs !== null ? `${mine > theirs ? "V" : "D"} ${mine}-${theirs}` : "—";
    return { line: l, result, rating: rateLine(l).total };
  });
  const sortedRows = [...rows].sort((a, b) => (sortDir === "asc" ? 1 : -1) * (LOG_SORT[sortKey](a) - LOG_SORT[sortKey](b)));

  // Mejor actuación (por valoración propia, solo partidos completos).
  const best = rows.filter((r) => r.rating !== null).sort((a, b) => b.rating! - a.rating!)[0];
  const bestRating = best ? rateLine(best.line) : null;

  const split = seasonAgg && seasonAgg.teams.length > 1 ? [...splitByTeam(data.lines, playerId).entries()] : [];

  const compareAgg: PlayerAggregate | undefined = compareId ? seasonAggs.find((a) => a.playerId === compareId) : undefined;
  const compareOptions = [...seasonAggs].filter((a) => a.playerId !== playerId).sort((a, b) => (perGame(b, "pts") ?? 0) - (perGame(a, "pts") ?? 0)).slice(0, 60);

  if (playedLines.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{bio?.name ?? "Jugador"}</h1>
        <EmptyState
          title="Sin partidos cargados para este jugador en la temporada elegida"
          hint="Puede que no haya jugado, que sea otra temporada o que los box scores aún se estén cargando (ver cobertura abajo)."
        />
        <DataStatus meta={data.meta} coverage={data.coverage} tz={tz} />
      </div>
    );
  }

  const hrefLog = (key: string) => withParams(`/jugadores/${slug}`, sp, { orden: key, dir: sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : "desc" });
  const labels = lines.map((l) => formatYmdShort(l.etDate));
  const series = (k: StatKey, name: string, color: string) => ({ name, color, values: lines.map((l) => l.stats[k]) });

  const logCols: Column<LogRow>[] = [
    { key: "fecha", label: "Fecha", sortable: true, cell: (r) => formatYmdShort(r.line.etDate) },
    { key: "rival", label: "Rival", cell: (r) => `${r.line.isHome ? "vs" : "@"} ${r.line.opponentAbbr}${split.length ? ` (${r.line.teamAbbr})` : ""}` },
    { key: "res", label: "Res.", cell: (r) => r.result },
    { key: "min", label: "MIN", sortable: true, align: "right", cell: (r) => fmt(r.line.stats.min, 0) },
    { key: "pts", label: "PTS", sortable: true, align: "right", className: "font-semibold", cell: (r) => r.line.stats.pts ?? "—" },
    { key: "reb", label: "REB", sortable: true, align: "right", cell: (r) => r.line.stats.reb ?? "—" },
    { key: "ast", label: "AST", sortable: true, align: "right", cell: (r) => r.line.stats.ast ?? "—" },
    { key: "stl", label: "ROB", sortable: true, align: "right", cell: (r) => r.line.stats.stl ?? "—" },
    { key: "blk", label: "BLQ", sortable: true, align: "right", cell: (r) => r.line.stats.blk ?? "—" },
    { key: "tov", label: "PER", align: "right", cell: (r) => r.line.stats.tov ?? "—" },
    { key: "tc", label: "TC", align: "right", cell: (r) => (r.line.stats.fgm === null ? "—" : `${r.line.stats.fgm}/${r.line.stats.fga}`) },
    { key: "fg3m", label: "3P", sortable: true, align: "right", cell: (r) => (r.line.stats.fg3m === null ? "—" : `${r.line.stats.fg3m}/${r.line.stats.fg3a}`) },
    { key: "tl", label: "TL", align: "right", cell: (r) => (r.line.stats.ftm === null ? "—" : `${r.line.stats.ftm}/${r.line.stats.fta}`) },
    { key: "val", label: "VAL", sortable: true, align: "right", className: "text-accent", cell: (r) => (r.rating === null ? "incompl." : fmt(r.rating, 1)) },
  ];

  const statCells = (a: PlayerAggregate | undefined) => [
    ["PJ", a ? String(a.games) : "—"],
    ["MIN", a ? fmt(perGame(a, "min")) : "—"],
    ["PTS", a ? fmt(perGame(a, "pts")) : "—"],
    ["REB", a ? fmt(perGame(a, "reb")) : "—"],
    ["AST", a ? fmt(perGame(a, "ast")) : "—"],
    ["ROB", a ? fmt(perGame(a, "stl")) : "—"],
    ["BLQ", a ? fmt(perGame(a, "blk")) : "—"],
    ["PER", a ? fmt(perGame(a, "tov")) : "—"],
    ["3PM", a ? fmt(perGame(a, "fg3m")) : "—"],
    ["FG%", a ? fmtPct(fgPct(a)) : "—"],
    ["3P%", a ? fmtPct(fg3Pct(a)) : "—"],
    ["TL%", a ? fmtPct(ftPct(a)) : "—"],
    ["VAL/P", a ? fmt(ratingPerGame(a)) : "—"],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <PlayerPhoto name={name} src={bio?.headshot ?? ref?.headshot} size={96} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {teamAbbr && (
              <Link href={`/equipos/${teamAbbr}`} className="inline-flex items-center gap-1.5 hover:underline">
                <TeamLogo abbr={teamAbbr} logo={teams.get(teamAbbr)?.logo} size={20} />
                {teams.get(teamAbbr)?.fullName ?? teamAbbr}
              </Link>
            )}
            {(bio?.position ?? ref?.position) && <Badge>{bio?.position ?? ref?.position}</Badge>}
            {(bio?.jersey ?? ref?.jersey) && <span>#{bio?.jersey ?? ref?.jersey}</span>}
            {bio?.age && <span>{bio.age} años</span>}
            {bio?.height && <span>{bio.height}</span>}
            {bio?.weight && <span>{bio.weight}</span>}
            {bio?.experienceYears !== undefined && <span>{bio.experienceYears} años de experiencia</span>}
          </div>
          {!bio && <p className="mt-1 text-xs text-muted">Edad, altura y peso no disponibles en la fuente de datos usada.</p>}
        </div>
      </div>

      <FilterForm action={`/jugadores/${slug}`}>
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
        <Field label="Rango" name="rango" value={rangeKey} options={RANGE_OPTIONS} />
        <Field label="Tipo" name="tipo" value={type} options={[{ value: "regular", label: "Temporada regular" }, { value: "playoffs", label: "Playoffs" }, { value: "all", label: "Todos" }]} />
        <Field
          label="Comparar con"
          name="comparar"
          value={compareSlug ?? ""}
          options={[{ value: "", label: "Nadie" }, ...compareOptions.map((a) => ({ value: playerSlug(a.playerId), label: `${a.playerName} (${a.teamAbbr})` }))]}
        />
        <input type="hidden" name="orden" value={sortKey} />
        <input type="hidden" name="dir" value={sortDir} />
      </FilterForm>

      <section aria-labelledby="promedios">
        <SectionTitle
          id="promedios"
          title="Promedios"
          subtitle={`Temporada ${seasonLabel(season)} · ${RANGE_OPTIONS.find((o) => o.value === rangeKey)!.label}${lines.length ? ` (${formatYmd(lines[0].etDate)} – ${formatYmd(lines[lines.length - 1].etDate)})` : ""}`}
        />
        {compareAgg ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-max text-sm">
              <caption className="sr-only">Comparación de promedios</caption>
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Promedio</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{name}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{compareAgg.playerName}</th>
                </tr>
              </thead>
              <tbody>
                {statCells(seasonAgg).map(([k, v], i) => (
                  <tr key={k} className="border-t border-line/70">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted">{k}</th>
                    <td className="num px-3 py-1.5 text-right">{v}</td>
                    <td className="num px-3 py-1.5 text-right">{statCells(compareAgg)[i][1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted">La comparación usa la temporada completa del tipo elegido, sin el filtro de rango.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {statCells(agg).map(([k, v]) => <StatTile key={k} label={k} value={v} />)}
          </div>
        )}
        {compareId && !compareAgg && <p className="mt-2 text-sm text-muted">El jugador a comparar no tiene partidos en esta temporada.</p>}
      </section>

      {agg && (
        <section aria-labelledby="totales">
          <SectionTitle id="totales" title="Totales acumulados" subtitle="Suma del periodo seleccionado" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            <StatTile label="Minutos" value={fmt(agg.totals.min, 0)} />
            <StatTile label="Puntos" value={agg.totals.pts} />
            <StatTile label="Rebotes" value={agg.totals.reb} />
            <StatTile label="Asistencias" value={agg.totals.ast} />
            <StatTile label="Robos" value={agg.totals.stl} />
            <StatTile label="Bloqueos" value={agg.totals.blk} />
            <StatTile label="Triples" value={agg.totals.fg3m} />
            <StatTile label="Valoración" value={fmt(agg.ratingTotal, 1)} hint={agg.ratingPartial ? `${agg.ratedGames} de ${agg.games} PJ completos` : "Propia, no oficial"} />
          </div>
        </section>
      )}

      {split.length > 0 && (
        <section aria-labelledby="equipos-split">
          <SectionTitle id="equipos-split" title="Datos por equipo" subtitle="Cambió de equipo: cada partido cuenta una sola vez en el total y aquí se desglosa" />
          <SortableTable
            caption="Promedios por equipo"
            rows={split}
            rowKey={([t]) => t}
            columns={[
              { key: "t", label: "Equipo", cell: ([t]) => t },
              { key: "g", label: "PJ", align: "right", cell: ([, a]) => a.games },
              { key: "pts", label: "PTS", align: "right", cell: ([, a]) => fmt(perGame(a, "pts")) },
              { key: "reb", label: "REB", align: "right", cell: ([, a]) => fmt(perGame(a, "reb")) },
              { key: "ast", label: "AST", align: "right", cell: ([, a]) => fmt(perGame(a, "ast")) },
              { key: "fg", label: "FG%", align: "right", cell: ([, a]) => fmtPct(fgPct(a)) },
              { key: "v", label: "VAL/P", align: "right", cell: ([, a]) => fmt(ratingPerGame(a)) },
            ]}
          />
        </section>
      )}

      <section aria-labelledby="evolucion" className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <SectionTitle id="evolucion" title="Evolución" subtitle="Puntos, rebotes y asistencias partido a partido" />
          <LineChart
            title={`Evolución de puntos, rebotes y asistencias de ${name}`}
            labels={labels}
            series={[series("pts", "Puntos", "var(--accent)"), series("reb", "Rebotes", "var(--east)"), series("ast", "Asistencias", "var(--good)")]}
            height={220}
            decimals={0}
          />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="mejor">
          <SectionTitle id="mejor" title="Mejor actuación" subtitle="Mayor valoración propia en el periodo" />
          {best && bestRating ? (
            <Card>
              <p className="mb-3 text-sm text-muted">
                {formatYmd(best.line.etDate)} · {best.line.isHome ? "vs" : "@"} {best.line.opponentAbbr} · {best.result} · {best.line.stats.pts} PTS, {best.line.stats.reb} REB, {best.line.stats.ast} AST
              </p>
              <RatingBreakdown rating={bestRating} />
            </Card>
          ) : (
            <EmptyState title="Sin partidos con valoración completa" />
          )}
        </section>

        <section aria-labelledby="posiciones">
          <SectionTitle id="posiciones" title="Posición en los rankings" subtitle={`Temporada ${seasonLabel(season)}, entre jugadores que cumplen el mínimo`} />
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Posición del jugador en cada ranking</caption>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.def.id} className="border-t border-line/70 first:border-t-0">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted">{p.def.label}</th>
                    <td className="num px-3 py-1.5 text-right">
                      {p.rank ? (
                        <>
                          <span className="font-semibold">#{p.rank}</span> <span className="text-muted">de {p.total}</span>
                        </>
                      ) : (
                        <span className="text-muted" title={p.criteria}>No clasifica</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section aria-labelledby="historial">
        <SectionTitle id="historial" title="Historial de partidos" subtitle={`${rows.length} partido(s) · ordenado por ${sortKey}`} />
        <SortableTable caption="Estadísticas por partido" columns={logCols} rows={sortedRows} rowKey={(r) => r.line.gameKey} sortKey={sortKey} sortDir={sortDir} hrefFor={hrefLog} />
        <p className="mt-2 text-xs text-muted">VAL = valoración propia de la aplicación, no oficial. «—» = dato no informado por la fuente.</p>
      </section>

      <div className="space-y-2 border-t border-line pt-4">
        <DataStatus meta={data.meta} coverage={data.coverage} tz={tz} />
        {roster && <DataStatus meta={roster.meta} tz={tz} />}
      </div>
    </div>
  );
}
