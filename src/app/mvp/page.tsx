import Link from "next/link";
import { addDays, formatYmd, formatYmdShort, monthNameEs, monthRange, todayInTz, weekRange } from "@/lib/dates";
import { fmt, playerSlug } from "@/lib/format";
import { mvpOfDay, mvpOfPeriod } from "@/lib/mvp";
import { getTz, one, parseDate, type PageProps } from "@/lib/params";
import { RATING_FORMULA, RATING_LABEL } from "@/lib/rating";
import { DataStatus } from "@/components/DataStatus";
import { DateField, Field, FilterForm } from "@/components/FilterForm";
import { PlayerPhoto, TeamLogo } from "@/components/images";
import { LineChart } from "@/components/LineChart";
import { DayMvpCard, PeriodMvpCard } from "@/components/MvpCards";
import { SortableTable } from "@/components/SortableTable";
import { Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { getPlayerLines, getTeamMap, newBudget } from "@/services/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "MVP" };

type Mode = "dia" | "semana" | "mes";

export default async function MvpPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const today = todayInTz(tz);
  const mode: Mode = one(sp.modo) === "semana" ? "semana" : one(sp.modo) === "mes" ? "mes" : "dia";
  const fecha = parseDate(one(sp.fecha), tz);

  const curYear = Number(today.slice(0, 4));
  const yearOpts = Array.from({ length: 6 }, (_, i) => curYear + 1 - i);
  const mmParam = Number(one(sp.mm));
  const aaParam = Number(one(sp.aa));
  const month = mmParam >= 1 && mmParam <= 12 ? mmParam : Number(fecha.slice(5, 7));
  const year = yearOpts.includes(aaParam) ? aaParam : Number(fecha.slice(0, 4));

  const range =
    mode === "dia" ? { from: fecha, to: fecha } : mode === "semana" ? weekRange(fecha) : monthRange(year, month);
  const fetchTo = range.to < today ? range.to : today;
  const budget = newBudget();

  const [{ teams }, data] = await Promise.all([
    getTeamMap(),
    range.from <= fetchTo ? getPlayerLines(range.from, fetchTo, tz, { type: "all", budget }) : Promise.resolve(null),
  ]);
  const lines = data?.lines ?? [];

  const day = mode === "dia" ? mvpOfDay(lines, fecha, tz) : null;
  const period = mode !== "dia" ? mvpOfPeriod(lines, range.from, range.to, tz) : null;

  const title = mode === "dia" ? `MVP del día · ${formatYmd(fecha)}` : mode === "semana" ? `MVP de la semana · ${formatYmdShort(range.from)} – ${formatYmdShort(range.to)}` : `MVP del mes · ${monthNameEs(month)} de ${year}`;
  const step = mode === "dia" ? 1 : mode === "semana" ? 7 : 0;
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const prevHref = mode === "mes" ? `/mvp?modo=mes&aa=${prevMonth.y}&mm=${prevMonth.m}` : `/mvp?modo=${mode}&fecha=${addDays(fecha, -step)}`;
  const nextHref = mode === "mes" ? `/mvp?modo=mes&aa=${nextMonth.y}&mm=${nextMonth.m}` : `/mvp?modo=${mode}&fecha=${addDays(fecha, step)}`;

  const winner = period?.winner;

  return (
    <div className="space-y-6">
      <PageTitle title={title} subtitle={`${RATING_LABEL}. Solo partidos finalizados con estadísticas completas.`} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterForm action="/mvp">
          <Field label="Modo" name="modo" value={mode} options={[{ value: "dia", label: "Día" }, { value: "semana", label: "Semana (lun–dom)" }, { value: "mes", label: "Mes calendario" }]} />
          {mode !== "mes" && <DateField label={mode === "dia" ? "Fecha local" : "Día de la semana"} name="fecha" value={fecha} />}
          {mode === "mes" && (
            <>
              <Field label="Mes" name="mm" value={String(month)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthNameEs(i + 1) }))} />
              <Field label="Año" name="aa" value={String(year)} options={yearOpts.map((y) => ({ value: String(y), label: String(y) }))} />
            </>
          )}
        </FilterForm>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={prevHref}>← Anterior</Link>
          <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={nextHref}>Siguiente →</Link>
        </div>
      </div>
      <p className="text-xs text-muted">
        Fecha local según la zona horaria elegida ({tz.replace("_", " ")}): un partido cuenta en el día en que empieza para ti, no en la fecha UTC.
      </p>

      {!data ? (
        <EmptyState title="Ese periodo todavía no ha empezado" hint="Elige una fecha de hoy o anterior." />
      ) : mode === "dia" && day ? (
        <>
          <Card>
            <DayMvpCard mvp={day} teams={teams} />
          </Card>
          {day.excluded > 0 && <Notice>{day.excluded} línea(s) de jugador quedaron fuera del cálculo por estadísticas incompletas.</Notice>}
          {day.ranking.length > 0 && (
            <section aria-labelledby="top-dia">
              <SectionTitle id="top-dia" title="Mejores actuaciones del día" subtitle={`${day.considered} jugadores con valoración completa`} />
              <SortableTable
                caption="Mejores actuaciones del día"
                rows={day.ranking.slice(0, 15)}
                rowKey={(r) => `${r.line.gameKey}-${r.line.playerId}`}
                columns={[
                  { key: "i", label: "#", cell: (_r, i) => i + 1 },
                  { key: "p", label: "Jugador", cell: (r) => (
                    <Link href={`/jugadores/${playerSlug(r.line.playerId)}`} className="flex items-center gap-2.5 hover:underline">
                      <PlayerPhoto name={r.line.playerName} src={r.line.headshot} size={28} />
                      <span className="font-medium">{r.line.playerName}</span>
                    </Link>
                  ) },
                  { key: "t", label: "Equipo", cell: (r) => (
                    <span className="inline-flex items-center gap-1.5"><TeamLogo abbr={r.line.teamAbbr} logo={teams.get(r.line.teamAbbr)?.logo} size={16} />{r.line.teamAbbr} <span className="text-muted">{r.line.isHome ? "vs" : "@"} {r.line.opponentAbbr}</span></span>
                  ) },
                  { key: "pts", label: "PTS", align: "right", cell: (r) => r.line.stats.pts },
                  { key: "reb", label: "REB", align: "right", cell: (r) => r.line.stats.reb },
                  { key: "ast", label: "AST", align: "right", cell: (r) => r.line.stats.ast },
                  { key: "stl", label: "ROB", align: "right", cell: (r) => r.line.stats.stl },
                  { key: "blk", label: "BLQ", align: "right", cell: (r) => r.line.stats.blk },
                  { key: "v", label: "VAL", align: "right", className: "font-semibold text-accent", cell: (r) => fmt(r.rating.total, 1) },
                ]}
              />
            </section>
          )}
        </>
      ) : period ? (
        <>
          <Card>
            <PeriodMvpCard mvp={period} teams={teams} />
          </Card>
          {period.excluded > 0 && <Notice>{period.excluded} línea(s) de jugador quedaron fuera del cálculo por estadísticas incompletas.</Notice>}

          {period.ranking.length > 0 && (
            <section aria-labelledby="top-periodo">
              <SectionTitle id="top-periodo" title="Clasificación del periodo" subtitle="Suma de las valoraciones de cada partido (no promedio)" />
              <SortableTable
                caption="Mejores jugadores del periodo"
                rows={period.ranking.slice(0, 15)}
                rowKey={(r) => r.playerId}
                columns={[
                  { key: "i", label: "#", cell: (_r, i) => i + 1 },
                  { key: "p", label: "Jugador", cell: (r) => (
                    <Link href={`/jugadores/${playerSlug(r.playerId)}`} className="flex items-center gap-2.5 hover:underline">
                      <PlayerPhoto name={r.playerName} src={r.headshot} size={28} />
                      <span className="font-medium">{r.playerName}</span>
                    </Link>
                  ) },
                  { key: "t", label: "Eq.", cell: (r) => r.teamAbbr },
                  { key: "g", label: "PJ", align: "right", cell: (r) => r.games },
                  { key: "pts", label: "PTS/P", align: "right", cell: (r) => fmt(r.totals.pts / r.games) },
                  { key: "reb", label: "REB/P", align: "right", cell: (r) => fmt(r.totals.reb / r.games) },
                  { key: "ast", label: "AST/P", align: "right", cell: (r) => fmt(r.totals.ast / r.games) },
                  { key: "avg", label: "VAL/P", align: "right", cell: (r) => fmt(r.avgRating, 1) },
                  { key: "tot", label: "VAL total", align: "right", className: "font-semibold text-accent", cell: (r) => fmt(r.total, 1) },
                ]}
              />
            </section>
          )}

          {winner && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="partidos-mvp">
                <SectionTitle id="partidos-mvp" title={`Partidos de ${winner.playerName}`} subtitle="Cada fila suma a la valoración total" />
                <SortableTable
                  caption="Partidos que contribuyeron a la valoración"
                  rows={winner.contributions}
                  rowKey={(c) => c.gameKey}
                  columns={[
                    { key: "d", label: "Fecha", cell: (c) => formatYmdShort(c.date) },
                    { key: "o", label: "Rival", cell: (c) => `${c.isHome ? "vs" : "@"} ${c.opponent}` },
                    { key: "pts", label: "PTS", align: "right", cell: (c) => c.pts },
                    { key: "reb", label: "REB", align: "right", cell: (c) => c.reb },
                    { key: "ast", label: "AST", align: "right", cell: (c) => c.ast },
                    { key: "v", label: "VAL", align: "right", cell: (c) => fmt(c.rating, 1) },
                  ]}
                />
                <p className="num mt-2 text-sm text-muted">
                  Total: {winner.contributions.map((c) => fmt(c.rating, 1)).join(" + ")} = <span className="font-semibold text-ink">{fmt(winner.total, 1)}</span>
                </p>
              </section>
              <section aria-labelledby="evolucion">
                <SectionTitle id="evolucion" title="Evolución en el periodo" subtitle="Valoración por partido y acumulada" />
                <LineChart
                  title={`Evolución de la valoración de ${winner.playerName}`}
                  labels={winner.contributions.map((c) => formatYmdShort(c.date))}
                  series={[
                    { name: "Por partido", color: "var(--accent)", values: winner.contributions.map((c) => c.rating) },
                    { name: "Acumulada", color: "var(--east)", values: winner.cumulative.map((c) => c.value) },
                  ]}
                />
              </section>
            </div>
          )}
        </>
      ) : null}

      <div className="space-y-3 border-t border-line pt-4">
        {data && <DataStatus meta={data.meta} coverage={data.coverage} tz={tz} />}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Cómo se calcula la valoración</summary>
          <p className="mt-2">{RATING_FORMULA}.</p>
          <p className="mt-1">
            Tiros fallados = intentos − convertidos. Métrica propia de la aplicación, configurable en <code>src/lib/rating.ts</code>; no es una valoración oficial de la NBA.
            Desempate diario: puntos, rebotes + asistencias, menos minutos, orden alfabético. Desempate de periodo: más partidos, mayor media, más puntos, orden alfabético.
           
          </p>
        </details>
      </div>
    </div>
  );
}
