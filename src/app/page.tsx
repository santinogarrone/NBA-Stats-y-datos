import Link from "next/link";
import { aggregatePlayers } from "@/lib/averages";
import { addDays, formatYmd, monthOf, monthRange, monthNameEs, seasonBounds, seasonForDate, seasonLabel, todayInTz, weekRange, ymdInTz } from "@/lib/dates";
import { mvpOfDay, mvpOfPeriod } from "@/lib/mvp";
import { one, parseDate, getTz, type PageProps } from "@/lib/params";
import { buildRanking } from "@/lib/rankings";
import { DataStatus } from "@/components/DataStatus";
import { DateField, FilterForm } from "@/components/FilterForm";
import { GameCard } from "@/components/GameCard";
import { DayMvpCard, PeriodMvpCard } from "@/components/MvpCards";
import { RankingList } from "@/components/RankingList";
import { StandingsTable } from "@/components/StandingsTable";
import { Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { getGamesByEtDays, getPlayerLines, getStandings, getTeamMap, newBudget } from "@/services/data";
import { eachDay } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const today = todayInTz(tz);
  const day = parseDate(one(sp.fecha), tz);
  const season = seasonForDate(day);
  const budget = newBudget();

  const bounds = seasonBounds(season);
  const linesTo = today < bounds.end ? today : bounds.end;

  const [{ teams, meta: teamsMeta }, gamesRes, standings, seasonData] = await Promise.all([
    getTeamMap(),
    getGamesByEtDays(eachDay(addDays(day, -1), addDays(day, 3)), budget),
    getStandings(season),
    linesTo >= bounds.start
      ? getPlayerLines(bounds.start, linesTo, tz, { type: "all", budget })
      : Promise.resolve(null),
  ]);

  const local = (g: { startUtc: string }) => ymdInTz(g.startUtc, tz);
  const dayGames = gamesRes.data.filter((g) => local(g) === day);
  const live = dayGames.filter((g) => g.status === "live");
  const finals = dayGames.filter((g) => g.status === "final");
  const scheduledToday = dayGames.filter((g) => g.status === "scheduled" || g.status === "postponed");
  const upcoming = gamesRes.data.filter((g) => local(g) > day && g.status === "scheduled").slice(0, 6);

  const lines = seasonData?.lines ?? [];
  const week = weekRange(day);
  const { year, month } = monthOf(day);
  const mRange = monthRange(year, month);
  const dayMvp = mvpOfDay(lines, day, tz);
  const weekMvp = mvpOfPeriod(lines, week.from, week.to, tz);
  const monthMvp = mvpOfPeriod(lines, mRange.from, mRange.to, tz);
  const aggs = aggregatePlayers(lines);
  const best = buildRanking(aggs, "ratingPg", { limit: 8 });

  const dayLabel = day === today ? "Hoy" : formatYmd(day);

  return (
    <div className="space-y-8">
      <PageTitle title="NBA hoy" subtitle={`Temporada ${seasonLabel(season)} · ${formatYmd(day)} (${tz.replace("_", " ")})`} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterForm action="/">
          <DateField label="Fecha" name="fecha" value={day} />
        </FilterForm>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={`/?fecha=${addDays(day, -1)}`}>← Día anterior</Link>
          {day !== today && <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href="/">Hoy</Link>}
          <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={`/?fecha=${addDays(day, 1)}`}>Día siguiente →</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="partidos" className="space-y-6 lg:col-span-2">
          <SectionTitle id="partidos" title={`Partidos · ${dayLabel}`} subtitle={`${dayGames.length} partido(s) en la fecha seleccionada`} />
          {dayGames.length === 0 && <EmptyState title="No hay partidos este día" hint="Prueba con otra fecha o mira los próximos partidos." />}
          {live.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-live">En vivo</h3>
              <div className="grid gap-3 sm:grid-cols-2">{live.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} />)}</div>
            </div>
          )}
          {scheduledToday.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Por jugar</h3>
              <div className="grid gap-3 sm:grid-cols-2">{scheduledToday.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} />)}</div>
            </div>
          )}
          {finals.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Resultados</h3>
              <div className="grid gap-3 sm:grid-cols-2">{finals.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} />)}</div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <SectionTitle title="MVP del día" subtitle={formatYmd(day)} action={<Link className="text-sm text-accent hover:underline" href={`/mvp?modo=dia&fecha=${day}`}>Detalle</Link>} />
            <DayMvpCard mvp={dayMvp} teams={teams} compact />
          </Card>
          <Card>
            <SectionTitle title="Próximos partidos" />
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No hay partidos programados en los próximos días.</p>
            ) : (
              <div className="space-y-3">{upcoming.map((g) => <GameCard key={g.key} game={g} teams={teams} tz={tz} showDate />)}</div>
            )}
          </Card>
        </aside>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle
            title="MVP de la semana"
            subtitle={`${formatYmd(week.from)} – ${formatYmd(week.to)}`}
            action={<Link className="text-sm text-accent hover:underline" href={`/mvp?modo=semana&fecha=${day}`}>Detalle</Link>}
          />
          <PeriodMvpCard mvp={weekMvp} teams={teams} compact />
        </Card>
        <Card>
          <SectionTitle
            title="MVP del mes"
            subtitle={`${monthNameEs(month)} de ${year}`}
            action={<Link className="text-sm text-accent hover:underline" href={`/mvp?modo=mes&mes=${year}-${String(month).padStart(2, "0")}`}>Detalle</Link>}
          />
          <PeriodMvpCard mvp={monthMvp} teams={teams} compact />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Mejores jugadores de la temporada"
            subtitle={`Valoración propia por partido · ${best.criteria}`}
            action={<Link className="text-sm text-accent hover:underline" href={`/rankings?temporada=${season}`}>Todos los rankings</Link>}
          />
          <RankingList result={best} teams={teams} size="sm" />
        </Card>
        <div className="space-y-6">
          <Card>
            <SectionTitle title="Clasificación" action={<Link className="text-sm text-accent hover:underline" href={`/clasificacion?temporada=${season}`}>Ver completa</Link>} />
            <div className="space-y-5">
              <StandingsTable table={standings.east} compact limit={8} />
              <StandingsTable table={standings.west} compact limit={8} />
            </div>
          </Card>
        </div>
      </div>

      <nav aria-label="Accesos directos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["/equipos", "Equipos", "30 equipos por conferencia y división"],
          ["/jugadores", "Jugadores", "Promedios de la temporada"],
          ["/rankings", "Estadísticas", "Líderes en 11 categorías"],
          ["/mvp", "MVP", "Día, semana y mes"],
        ].map(([href, title, hint]) => (
          <Link key={href} href={href} className="rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2">
            <div className="font-semibold">{title}</div>
            <div className="mt-0.5 text-xs text-muted">{hint}</div>
          </Link>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line pt-4">
        <DataStatus meta={gamesRes.meta} tz={tz} />
        {seasonData && <DataStatus meta={seasonData.meta} coverage={seasonData.coverage} tz={tz} />}
        <DataStatus meta={standings.meta} tz={tz} />
        {teamsMeta.warnings.length > 0 && <DataStatus meta={teamsMeta} tz={tz} />}
      </div>
    </div>
  );
}
