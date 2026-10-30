import Link from "next/link";
import { CONFERENCE_LABEL } from "@/config/nba-structure";
import { fmt, fmtWinPct } from "@/lib/format";
import { playoffZoneLabel, type ConferenceTable } from "@/lib/standings";
import { TeamLogo } from "@/components/images";
import { Badge } from "@/components/ui";

const ZONE_STYLE = { direct: "border-l-good", playin: "border-l-accent", out: "border-l-transparent" } as const;

export function StandingsTable({ table, compact = false, limit }: { table: ConferenceTable; compact?: boolean; limit?: number }) {
  const rows = limit ? table.rows.slice(0, limit) : table.rows;
  const tone = table.conference === "East" ? "east" : "west";
  const anyStreak = rows.some((r) => r.streak);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Badge tone={tone}>{CONFERENCE_LABEL[table.conference]}</Badge> Conferencia {CONFERENCE_LABEL[table.conference]}
        </h3>
      </div>
      <div className="table-frame overflow-x-auto rounded-xl border">
        <table className="data-table w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Clasificación de la Conferencia {CONFERENCE_LABEL[table.conference]}</caption>
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">#</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Equipo</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Victorias">V</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Derrotas">D</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Porcentaje de victorias">PCT</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Partidos de diferencia con el líder">DIF</th>
              {!compact && (
                <>
                  <th scope="col" className="px-3 py-2 text-right font-medium" title="Récord como local">Local</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium" title="Récord como visitante">Visit.</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium" title="Récord contra equipos de la conferencia">Conf.</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium" title="Últimos diez partidos">U10</th>
                </>
              )}
              {anyStreak && <th scope="col" className="px-3 py-2 text-right font-medium" title="Racha actual">Racha</th>}
              {!compact && <th scope="col" className="px-3 py-2 text-left font-medium" title="Según la posición actual; no indica clasificación matemática">Zona</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamAbbr} className={`border-t border-line/70 border-l-4 hover:bg-surface-2/50 ${r.zone ? ZONE_STYLE[r.zone] : "border-l-transparent"}`}>
                <td className="num px-3 py-2">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link href={`/equipos/${r.teamAbbr}`} className="flex items-center gap-2 hover:underline">
                    <TeamLogo abbr={r.teamAbbr} logo={r.logo} size={22} />
                    <span className={compact ? "" : "font-medium"}>{compact ? r.teamAbbr : r.teamName}</span>
                  </Link>
                </td>
                <td className="num px-3 py-2 text-right">{r.wins}</td>
                <td className="num px-3 py-2 text-right">{r.losses}</td>
                <td className="num px-3 py-2 text-right">{fmtWinPct(r.pct)}</td>
                <td className="num px-3 py-2 text-right">{r.rank === 1 ? "—" : fmt(r.gamesBehind, 1)}</td>
                {!compact && (
                  <>
                    <td className="num px-3 py-2 text-right">{r.home ?? "—"}</td>
                    <td className="num px-3 py-2 text-right">{r.road ?? "—"}</td>
                    <td className="num px-3 py-2 text-right">{r.conferenceRecord ?? "—"}</td>
                    <td className="num px-3 py-2 text-right">{r.lastTen ?? "—"}</td>
                  </>
                )}
                {anyStreak && (
                  <td className={`num px-3 py-2 text-right ${r.streak?.startsWith("W") ? "text-good" : r.streak?.startsWith("L") ? "text-bad" : ""}`}>
                    {r.streak ?? "—"}
                  </td>
                )}
                {!compact && <td className="px-3 py-2 text-muted">{playoffZoneLabel(r.zone)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="mt-2 text-xs text-muted">{table.note}</p>}
      {table.orderedBy === "source-seed" && (
        <p className="mt-2 text-xs text-muted">Orden según la clasificación de la fuente (desempates oficiales de la NBA ya aplicados).</p>
      )}
    </div>
  );
}

export function StandingsLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
      <li><span className="mr-1.5 inline-block h-3 w-1 rounded-sm bg-good align-middle" />Puestos 1-6: zona de playoffs directos</li>
      <li><span className="mr-1.5 inline-block h-3 w-1 rounded-sm bg-accent align-middle" />Puestos 7-10: zona de play-in</li>
      <li>La zona sale de la posición actual, no de una clasificación matemática. No se muestra hasta que haya partidos jugados.</li>
    </ul>
  );
}
