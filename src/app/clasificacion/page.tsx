import { seasonLabel } from "@/lib/dates";
import { getTz, one, parseSeason, seasonOptions, type PageProps } from "@/lib/params";
import { DataStatus } from "@/components/DataStatus";
import { Field, FilterForm } from "@/components/FilterForm";
import { StandingsLegend, StandingsTable } from "@/components/StandingsTable";
import { Card, PageTitle } from "@/components/ui";
import { getStandings } from "@/services/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clasificación" };

export default async function StandingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const season = parseSeason(one(sp.temporada), tz);
  const data = await getStandings(season);
  const empty = data.east.rows.length === 0 && data.west.rows.length === 0;

  return (
    <div className="space-y-6">
      <PageTitle title="Clasificación" subtitle={`Temporada regular ${seasonLabel(season)}`} />
      <FilterForm action="/clasificacion">
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
      </FilterForm>

      {empty ? (
        <Card>
          <p className="font-medium">No hay clasificación disponible para esta temporada.</p>
          <p className="mt-1 text-sm text-muted">Ninguna de las dos fuentes devolvió datos. Revisa los avisos al final de la página.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          <StandingsTable table={data.east} />
          <StandingsTable table={data.west} />
          <StandingsLegend />
        </div>
      )}

      <div className="border-t border-line pt-4">
        <DataStatus meta={data.meta} tz={tz} />
      </div>
    </div>
  );
}
