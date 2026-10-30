import Link from "next/link";
import { APP_CONFIG } from "@/config/app";
import { CONFERENCE_LABEL } from "@/config/nba-structure";
import { aggregatePlayers } from "@/lib/averages";
import { formatYmd, seasonLabel, todayInTz } from "@/lib/dates";
import { playerSlug } from "@/lib/format";
import { getTz, one, parseDate, parseIntIn, parseSeason, seasonOptions, withParams, type PageProps } from "@/lib/params";
import { parseMode, resolvePeriod } from "@/lib/period";
import { buildRanking, RANKING_BY_ID, RANKINGS, type RankingId } from "@/lib/rankings";
import type { Conference } from "@/lib/types";
import { DataStatus } from "@/components/DataStatus";
import { DateField, Field, FilterForm } from "@/components/FilterForm";
import { PlayerPhoto, TeamLogo } from "@/components/images";
import { formatRankingValue, RankingList } from "@/components/RankingList";
import { SortableTable } from "@/components/SortableTable";
import { Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { getPlayerLines, getTeamMap, newBudget, type SeasonFilter } from "@/services/data";
import { NBA_TEAMS } from "@/config/nba-structure";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rankings" };

const MIN_GAMES_OPTIONS = [0, 1, 3, 5, 10, 20, 30, 40] as const;

export default async function RankingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const today = todayInTz(tz);
  const season = parseSeason(one(sp.temporada), tz);
  const mode = parseMode(one(sp.periodo));
  const fecha = parseDate(one(sp.fecha), tz);
  const period = resolvePeriod(mode, { season, tz, fecha, mes: one(sp.mes) });
  const statId = (one(sp.stat) && RANKING_BY_ID.has(one(sp.stat) as RankingId) ? one(sp.stat) : "pts") as RankingId;
  const limit = parseIntIn(one(sp.n), APP_CONFIG.rankings.limits, APP_CONFIG.rankings.defaultLimit);
  const minParam = parseIntIn(one(sp.min), MIN_GAMES_OPTIONS, 0);
  const typeParam = one(sp.tipo);
  const type: SeasonFilter = typeParam === "playoffs" || typeParam === "all" ? typeParam : "regular";
  const team = NBA_TEAMS.find((t) => t.abbr === one(sp.equipo))?.abbr;
  const conf: Conference | undefined = one(sp.conf) === "East" ? "East" : one(sp.conf) === "West" ? "West" : undefined;

  const to = period.to < today ? period.to : today;
  const budget = newBudget();
  const [{ teams }, data] = await Promise.all([
    getTeamMap(),
    period.from <= to ? getPlayerLines(period.from, to, tz, { type, budget }) : Promise.resolve(null),
  ]);

  const aggs = aggregatePlayers(data?.lines ?? []);
  const opts = { limit, minGames: minParam > 0 ? minParam : undefined, team, conference: conf };
  const main = buildRanking(aggs, statId, opts);
  const all = RANKINGS.map((r) => buildRanking(aggs, r.id, { ...opts, limit: 5 }));

  const withStat = (id: string) => withParams("/rankings", sp, { stat: id });

  return (
    <div className="space-y-6">
      <PageTitle title="Rankings estadísticos" subtitle={`Temporada ${seasonLabel(season)} · ${period.label}`} />

      <FilterForm action="/rankings">
        <input type="hidden" name="stat" value={statId} />
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
        <Field label="Periodo" name="periodo" value={mode} options={[{ value: "temporada", label: "Temporada" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }]} />
        {mode !== "temporada" && <DateField label={mode === "mes" ? "Día del mes" : "Día de la semana"} name="fecha" value={fecha} />}
        <Field label="Tipo" name="tipo" value={type} options={[{ value: "regular", label: "Temporada regular" }, { value: "playoffs", label: "Playoffs" }, { value: "all", label: "Todos" }]} />
        <Field label="Jugadores" name="n" value={String(limit)} options={APP_CONFIG.rankings.limits.map((n) => ({ value: String(n), label: `Top ${n}` }))} />
        <Field label="Mín. partidos" name="min" value={String(minParam)} options={MIN_GAMES_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? "Automático" : String(n) }))} />
        <Field label="Equipo" name="equipo" value={team ?? ""} options={[{ value: "", label: "Todos" }, ...NBA_TEAMS.map((t) => ({ value: t.abbr, label: `${t.city} ${t.name}` }))]} />
        <Field label="Conferencia" name="conf" value={conf ?? ""} options={[{ value: "", label: "Ambas" }, { value: "East", label: CONFERENCE_LABEL.East }, { value: "West", label: CONFERENCE_LABEL.West }]} />
      </FilterForm>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categoría">
        {RANKINGS.map((r) => (
          <Link
            key={r.id}
            href={withStat(r.id)}
            aria-current={r.id === statId ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${r.id === statId ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            {r.short}
          </Link>
        ))}
        <Link href={`/mvp?modo=dia&fecha=${today}`} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink">
          MVP día/semana/mes →
        </Link>
      </div>

      {!data ? (
        <EmptyState title="El periodo elegido todavía no ha empezado" hint="Elige una fecha anterior o la temporada completa." />
      ) : (
        <Card>
          <SectionTitle title={main.def.label} subtitle={`Criterio aplicado: ${main.criteria || "sin mínimos"} · ${main.eligible} jugadores cumplen, ${main.excluded} excluidos`} />
          {(main.def.kind === "rating-avg" || main.def.kind === "rating-total") && (
            <div className="mb-3"><Notice tone="info">Valoración propia de la aplicación (no oficial). Solo cuentan partidos con estadísticas completas.</Notice></div>
          )}
          <SortableTable
            caption={main.def.label}
            rows={main.entries}
            rowKey={(e) => e.player.playerId}
            empty={<EmptyState title="Ningún jugador cumple el criterio" hint="Baja el mínimo de partidos, amplía el periodo o quita filtros." />}
            columns={[
              { key: "rank", label: "#", cell: (e) => e.rank },
              {
                key: "player",
                label: "Jugador",
                cell: (e) => (
                  <Link href={`/jugadores/${playerSlug(e.player.playerId)}`} className="flex items-center gap-2.5 hover:underline">
                    <PlayerPhoto name={e.player.playerName} src={e.player.headshot} size={30} />
                    <span className="font-medium">{e.player.playerName}</span>
                  </Link>
                ),
              },
              {
                key: "team",
                label: "Equipo",
                cell: (e) => (
                  <span className="inline-flex items-center gap-1.5">
                    <TeamLogo abbr={e.player.teamAbbr} logo={teams.get(e.player.teamAbbr)?.logo} size={18} />
                    {e.player.teams.length > 1 ? e.player.teams.join("/") : e.player.teamAbbr}
                  </span>
                ),
              },
              { key: "games", label: "PJ", align: "right", cell: (e) => e.player.games },
              ...(main.def.kind === "pct"
                ? [
                    { key: "made", label: "Aciertos", align: "right" as const, cell: (e: (typeof main.entries)[number]) => (statId === "fgPct" ? e.player.totals.fgm : statId === "fg3Pct" ? e.player.totals.fg3m : e.player.totals.ftm) },
                    { key: "att", label: "Intentos", align: "right" as const, cell: (e: (typeof main.entries)[number]) => e.attempts ?? "—" },
                  ]
                : []),
              {
                key: "value",
                label: main.def.short,
                align: "right",
                className: "font-semibold",
                cell: (e) => formatRankingValue(main.def.kind, e.value, main.def.decimals),
              },
            ]}
          />
        </Card>
      )}

      <section aria-labelledby="todas">
        <SectionTitle id="todas" title="Todas las categorías" subtitle="Top 5 de cada una con los mismos filtros" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {all.map((r) => (
            <Card key={r.def.id}>
              <SectionTitle title={r.def.label} action={<Link className="text-sm text-accent hover:underline" href={withStat(r.def.id)}>Ver top {limit}</Link>} />
              <RankingList result={r} teams={teams} size="sm" />
              {r.criteria && <p className="mt-2 text-xs text-muted">{r.criteria}</p>}
            </Card>
          ))}
        </div>
      </section>

      {data && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">Periodo analizado: {formatYmd(period.from)} – {formatYmd(to)}.</p>
          <DataStatus meta={data.meta} coverage={data.coverage} tz={tz} />
        </div>
      )}
      <p className="text-xs text-muted">Los porcentajes de tiro se calculan con aciertos e intentos totales, no promediando porcentajes de cada partido.</p>
    </div>
  );
}
