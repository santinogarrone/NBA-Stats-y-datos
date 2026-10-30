import Link from "next/link";
import { formatYmd } from "@/lib/dates";
import { fmt, playerSlug } from "@/lib/format";
import type { DayMvp, PeriodMvp } from "@/lib/mvp";
import { PlayerPhoto, TeamLogo } from "@/components/images";
import { Badge, EmptyState } from "@/components/ui";
import { RatingBreakdown } from "@/components/RatingBreakdown";
import type { Team } from "@/lib/types";

export function DayMvpCard({ mvp, teams, compact = false }: { mvp: DayMvp; teams: Map<string, Team>; compact?: boolean }) {
  const w = mvp.winner;
  if (!w) {
    return <EmptyState title="Sin MVP para esta fecha" hint="No hay partidos finalizados con estadísticas completas." />;
  }
  const l = w.line;
  const team = teams.get(l.teamAbbr);
  const s = l.stats;
  return (
    <div>
      <div className="flex items-center gap-4">
        <PlayerPhoto name={l.playerName} src={l.headshot} size={compact ? 56 : 72} />
        <div className="min-w-0">
          <Link href={`/jugadores/${playerSlug(l.playerId)}`} className="block truncate text-lg font-semibold hover:underline">
            {l.playerName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <TeamLogo abbr={l.teamAbbr} logo={team?.logo} size={18} />
            <span>{team?.fullName ?? l.teamAbbr}</span>
            <span>
              {l.isHome ? "vs" : "@"} {teams.get(l.opponentAbbr)?.fullName ?? l.opponentAbbr}
            </span>
          </div>
        </div>
      </div>
      <dl className="num mt-3 grid grid-cols-4 gap-2 text-center text-sm sm:grid-cols-7">
        {[
          ["MIN", fmt(s.min, 0)],
          ["PTS", s.pts],
          ["REB", s.reb],
          ["AST", s.ast],
          ["ROB", s.stl],
          ["BLQ", s.blk],
          ["PER", s.tov],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-md bg-surface-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="font-semibold">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="num mt-2 text-xs text-muted">
        TC {s.fgm}/{s.fga} · 3P {s.fg3m ?? "—"}/{s.fg3a ?? "—"} · TL {s.ftm}/{s.fta}
      </p>
      {mvp.tiedAtTop.length > 1 && (
        <p className="mt-2 text-sm">
          <Badge tone="accent">Empate</Badge> {mvp.tiedAtTop.length} jugadores con {fmt(w.rating.total, 1)}. Desempate: {mvp.tieBreak}.
        </p>
      )}
      {!compact && (
        <div className="mt-4">
          <RatingBreakdown rating={w.rating} />
        </div>
      )}
      {compact && (
        <p className="mt-2 text-sm">
          Valoración propia: <span className="num font-semibold text-accent">{fmt(w.rating.total, 1)}</span>
        </p>
      )}
    </div>
  );
}

export function PeriodMvpCard({ mvp, teams, compact = false }: { mvp: PeriodMvp; teams: Map<string, Team>; compact?: boolean }) {
  const w = mvp.winner;
  if (!w) {
    return (
      <EmptyState
        title="Sin MVP para este periodo"
        hint={`No hay partidos finalizados con estadísticas completas entre ${formatYmd(mvp.from)} y ${formatYmd(mvp.to)}.`}
      />
    );
  }
  const team = teams.get(w.teamAbbr);
  return (
    <div>
      <div className="flex items-center gap-4">
        <PlayerPhoto name={w.playerName} src={w.headshot} size={compact ? 56 : 72} />
        <div className="min-w-0">
          <Link href={`/jugadores/${playerSlug(w.playerId)}`} className="block truncate text-lg font-semibold hover:underline">
            {w.playerName}
          </Link>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <TeamLogo abbr={w.teamAbbr} logo={team?.logo} size={18} />
            <span>{team?.fullName ?? w.teamAbbr}</span>
          </div>
        </div>
      </div>
      <dl className="num mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md bg-surface-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Valoración total</dt>
          <dd className="font-semibold text-accent">{fmt(w.total, 1)}</dd>
        </div>
        <div className="rounded-md bg-surface-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Partidos</dt>
          <dd className="font-semibold">{w.games}</dd>
        </div>
        <div className="rounded-md bg-surface-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Media</dt>
          <dd className="font-semibold">{fmt(w.avgRating, 1)}</dd>
        </div>
      </dl>
      <p className="num mt-2 text-xs text-muted">
        Promedios: {fmt(w.totals.pts / w.games)} PTS · {fmt(w.totals.reb / w.games)} REB · {fmt(w.totals.ast / w.games)} AST
      </p>
      {w.excludedGames > 0 && (
        <p className="mt-2 text-xs text-bad">
          {w.excludedGames} partido(s) de este jugador no cuentan por estadísticas incompletas: su total puede estar subestimado.
        </p>
      )}
      {mvp.tiedAtTop.length > 1 && (
        <p className="mt-2 text-sm">
          <Badge tone="accent">Empate</Badge> {mvp.tiedAtTop.length} jugadores con {fmt(w.total, 1)}. Desempate: {mvp.tieBreak}.
        </p>
      )}
    </div>
  );
}
