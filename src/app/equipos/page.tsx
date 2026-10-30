import Link from "next/link";
import { CONFERENCE_LABEL, DIVISION_LABEL, DIVISIONS_BY_CONFERENCE } from "@/config/nba-structure";
import { seasonLabel } from "@/lib/dates";
import { fmtWinPct } from "@/lib/format";
import { getTz, one, parseSeason, seasonOptions, type PageProps } from "@/lib/params";
import type { Conference, Division } from "@/lib/types";
import { DataStatus } from "@/components/DataStatus";
import { Field, FilterForm } from "@/components/FilterForm";
import { TeamLogo } from "@/components/images";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import { getStandings, getTeams } from "@/services/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipos" };

export default async function TeamsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tz = await getTz();
  const season = parseSeason(one(sp.temporada), tz);
  const confParam = one(sp.conferencia);
  const conf: Conference | "" = confParam === "East" || confParam === "West" ? confParam : "";
  const divParam = one(sp.division);
  const allDivisions = Object.keys(DIVISION_LABEL) as Division[];
  const div: Division | "" = allDivisions.includes(divParam as Division) ? (divParam as Division) : "";

  const [teams, standings] = await Promise.all([getTeams(), getStandings(season)]);
  const record = new Map([...standings.east.rows, ...standings.west.rows].map((r) => [r.teamAbbr, r]));

  const conferences = (["East", "West"] as Conference[]).filter((c) => !conf || c === conf);

  return (
    <div className="space-y-6">
      <PageTitle title="Equipos" subtitle={`Los 30 equipos por conferencia y división · récord de la temporada ${seasonLabel(season)}`} />
      <FilterForm action="/equipos">
        <Field label="Temporada" name="temporada" value={String(season)} options={seasonOptions(tz).map((s) => ({ value: String(s), label: seasonLabel(s) }))} />
        <Field label="Conferencia" name="conferencia" value={conf} options={[{ value: "", label: "Ambas" }, { value: "East", label: "Este" }, { value: "West", label: "Oeste" }]} />
        <Field
          label="División"
          name="division"
          value={div}
          options={[{ value: "", label: "Todas" }, ...allDivisions.map((d) => ({ value: d, label: DIVISION_LABEL[d] }))]}
        />
      </FilterForm>

      {conferences.map((c) => {
        const divisions = DIVISIONS_BY_CONFERENCE[c].filter((d) => !div || d === div);
        if (divisions.length === 0) return null;
        return (
          <section key={c} aria-labelledby={`conf-${c}`} className="space-y-4">
            <h2 id={`conf-${c}`} className="flex items-center gap-2 text-xl font-semibold">
              <Badge tone={c === "East" ? "east" : "west"}>{CONFERENCE_LABEL[c]}</Badge> Conferencia {CONFERENCE_LABEL[c]}
            </h2>
            <div className="grid gap-5 lg:grid-cols-3">
              {divisions.map((d) => (
                <div key={d}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{DIVISION_LABEL[d]}</h3>
                  <ul className="space-y-2">
                    {teams.data
                      .filter((t) => t.conference === c && t.division === d)
                      .map((t) => {
                        const r = record.get(t.abbr);
                        return (
                          <li key={t.abbr}>
                            <Link href={`/equipos/${t.abbr}?temporada=${season}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-surface-2">
                              <TeamLogo abbr={t.abbr} logo={t.logo} size={36} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{t.fullName}</span>
                                <span className="text-xs text-muted">{t.abbr}</span>
                              </span>
                              <span className="num text-right text-sm">
                                {r ? `${r.wins}-${r.losses}` : "—"}
                                <span className="block text-xs text-muted">{r ? fmtWinPct(r.pct) : ""}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {conferences.length === 0 && <EmptyState title="Sin equipos para ese filtro" />}

      <div className="border-t border-line pt-4 space-y-2">
        <DataStatus meta={teams.meta} tz={tz} />
        <DataStatus meta={standings.meta} tz={tz} />
      </div>
    </div>
  );
}
