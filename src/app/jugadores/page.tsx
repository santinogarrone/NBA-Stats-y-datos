import { NBA_TEAMS } from "@/config/nba-structure";
import { aggregatePlayers } from "@/lib/averages";
import { seasonLabel } from "@/lib/dates";
import { normalizeName } from "@/lib/format";
import { getTz, one, parseSeason, seasonOptions, withParams, type PageProps } from "@/lib/params";
import { defaultDir, rowFromAggregate, sortPlayerRows } from "@/lib/playerRows";
import { defaultMinGames } from "@/lib/rankings";
import { DataStatus } from "@/components/DataStatus";
import { Field, FilterForm } from "@/components/FilterForm";
import { PlayerStatsTable } from "@/components/PlayerStatsTable";
import { EmptyState, PageTitle } from "@/components/ui";
import { getSeasonLines, newBudget } from "@/services/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jugadores" };

export default async function PlayersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const season = parseSeason(one(sp.temporada), tz);
  const q = (one(sp.q) ?? "").trim().slice(0, 60);
  const team = NBA_TEAMS.find((t) => t.abbr === one(sp.equipo))?.abbr;
  const sortKey = one(sp.orden) ?? "pts";
  const sortDir = one(sp.dir) === "asc" || one(sp.dir) === "desc" ? (one(sp.dir) as "asc" | "desc") : defaultDir(sortKey);
  const all = one(sp.todos) === "1";

  const data = await getSeasonLines(season, tz, newBudget());
  const aggs = aggregatePlayers(data.lines);
  const minGames = all ? 1 : Math.max(1, Math.floor(defaultMinGames(aggs) / 2));

  let rows = aggs.filter((a) => a.games >= minGames).map(rowFromAggregate);
  if (team) rows = rows.filter((r) => r.agg!.teams.includes(team));
  if (q) {
    const nq = normalizeName(q);
    rows = rows.filter((r) => normalizeName(r.name).includes(nq));
  }

  const hrefFor = (key: string) => withParams("/jugadores", sp, { orden: key, dir: sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : defaultDir(key) });

  return (
    <div className="space-y-6">
      <PageTitle title="Jugadores" subtitle={`Promedios por partido · temporada ${seasonLabel(season)} · ${rows.length} jugadores${all ? "" : ` con al menos ${minGames} partido(s)`}`} />
      <FilterForm action="/jugadores">
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
        <Field label="Equipo" name="equipo" value={team ?? ""} options={[{ value: "", label: "Todos" }, ...NBA_TEAMS.map((t) => ({ value: t.abbr, label: `${t.city} ${t.name}` }))]} />
        <Field label="Mostrar" name="todos" value={all ? "1" : ""} options={[{ value: "", label: "Con partidos suficientes" }, { value: "1", label: "Todos los que jugaron" }]} />
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nombre"
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
          />
        </label>
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">Aplicar</button>
      </FilterForm>

      <PlayerStatsTable
        rows={sortPlayerRows(rows, sortKey, sortDir).slice(0, 150)}
        caption="Promedios de los jugadores"
        sortKey={sortKey}
        sortDir={sortDir}
        hrefFor={hrefFor}
        empty={<EmptyState title="No hay jugadores con estadísticas" hint="Aún no hay box scores cargados para esta temporada o el filtro no coincide con nadie." />}
      />
      {rows.length > 150 && <p className="text-xs text-muted">Se muestran los primeros 150. Usa la búsqueda o filtra por equipo para ver el resto.</p>}

      <div className="border-t border-line pt-4">
        <DataStatus meta={data.meta} coverage={data.coverage} tz={tz} />
      </div>
    </div>
  );
}
