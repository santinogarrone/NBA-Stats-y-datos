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
    <div className={compact ? "space-y-0" : "mvp-feature"}>
      {!compact && (
        <div className="mvp-feature-topline">
          <span className="mvp-kicker">Actuación número uno</span>
          <span className="mvp-score">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Valoración</span>
            <span className="mvp-score-value">{fmt(w.rating.total, 1)}</span>
          </span>
        </div>
      )}
      <div className={compact ? "flex items-center gap-4" : "mvp-feature-player"}>
        {compact ? (
          <PlayerPhoto name={l.playerName} src={l.headshot} size={56} />
        ) : (
          <div className="mvp-photo-frame">
            <PlayerPhoto name={l.playerName} src={l.headshot} size={160} />
          </div>
        )}
        <div className="min-w-0">
          <Link href={`/jugadores/${playerSlug(l.playerId)}`} className={`mvp-player-name hover:underline ${compact ? "!text-lg !font-semibold !tracking-normal" : ""}`}>
            {l.playerName}
          </Link>
          <div className={compact ? "mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted" : "mvp-team-line"}>
            <TeamLogo abbr={l.teamAbbr} logo={team?.logo} size={18} />
            <span>{team?.fullName ?? l.teamAbbr}</span>
            <span>
              {l.isHome ? "vs" : "@"} {teams.get(l.opponentAbbr)?.fullName ?? l.opponentAbbr}
            </span>
          </div>
        </div>
      </div>
      <dl className={`num mt-3 grid gap-2 text-center text-sm ${compact ? "grid-cols-4 sm:grid-cols-7" : "mvp-feature-stats grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"}`}>
        {[
          ["MIN", fmt(s.min, 0)],
          ["PTS", s.pts],
          ["REB", s.reb],
          ["AST", s.ast],
          ["ROB", s.stl],
          ["BLQ", s.blk],
          ["PER", s.tov],
        ].map(([k, v]) => (
          <div key={String(k)} className="mini-stat rounded-lg py-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="font-semibold">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <p className={`num mt-2 text-xs ${compact ? "text-muted" : "mvp-secondary"}`}>
        TC {s.fgm}/{s.fga} · 3P {s.fg3m ?? "—"}/{s.fg3a ?? "—"} · TL {s.ftm}/{s.fta}
      </p>
      {mvp.tiedAtTop.length > 1 && (
        <p className="mt-2 text-sm">
          <Badge tone="accent">Empate</Badge> {mvp.tiedAtTop.length} jugadores con {fmt(w.rating.total, 1)}. Desempate: {mvp.tieBreak}.
        </p>
      )}
      {!compact && (
        <div className="mt-6 border-t border-white/10 pt-5">
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
    <div className={compact ? "space-y-0" : "mvp-feature"}>
      {!compact && (
        <div className="mvp-feature-topline">
          <span className="mvp-kicker">Líder del periodo</span>
          <span className="mvp-score">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Valoración total</span>
            <span className="mvp-score-value">{fmt(w.total, 1)}</span>
          </span>
        </div>
      )}
      <div className={compact ? "flex items-center gap-4" : "mvp-feature-player"}>
        {compact ? (
          <PlayerPhoto name={w.playerName} src={w.headshot} size={56} />
        ) : (
          <div className="mvp-photo-frame">
            <PlayerPhoto name={w.playerName} src={w.headshot} size={160} />
          </div>
        )}
        <div className="min-w-0">
          <Link href={`/jugadores/${playerSlug(w.playerId)}`} className={`mvp-player-name hover:underline ${compact ? "!text-lg !font-semibold !tracking-normal" : ""}`}>
            {w.playerName}
          </Link>
          <div className={compact ? "mt-0.5 flex items-center gap-2 text-sm text-muted" : "mvp-team-line"}>
            <TeamLogo abbr={w.teamAbbr} logo={team?.logo} size={18} />
            <span>{team?.fullName ?? w.teamAbbr}</span>
          </div>
        </div>
      </div>
      <dl className={`num mt-3 grid grid-cols-3 gap-2 text-center text-sm ${compact ? "" : "mvp-feature-stats"}`}>
        <div className="mini-stat rounded-lg py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Valoración total</dt>
          <dd className="font-semibold text-accent">{fmt(w.total, 1)}</dd>
        </div>
        <div className="mini-stat rounded-lg py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Partidos</dt>
          <dd className="font-semibold">{w.games}</dd>
        </div>
        <div className="mini-stat rounded-lg py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Media</dt>
          <dd className="font-semibold">{fmt(w.avgRating, 1)}</dd>
        </div>
      </dl>
      <p className={`num mt-2 text-xs ${compact ? "text-muted" : "mvp-secondary"}`}>
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
