import Link from "next/link";
import { formatTime, formatYmdShort } from "@/lib/dates";
import { TeamLogo } from "@/components/images";
import { Badge } from "@/components/ui";
import type { Game, Team } from "@/lib/types";

export function GameCard({ game, teams, tz, showDate = false }: { game: Game; teams: Map<string, Team>; tz: string; showDate?: boolean }) {
  const away = teams.get(game.away.abbr);
  const home = teams.get(game.home.abbr);
  const final = game.status === "final";
  const live = game.status === "live";
  const awayWon = final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWon = final && (game.home.score ?? 0) > (game.away.score ?? 0);

  const row = (t: Team | undefined, abbr: string, score: number | null, won: boolean) => (
    <div className="flex items-center gap-3">
      <TeamLogo abbr={abbr} logo={t?.logo} size={32} />
      <Link href={`/equipos/${abbr}`} className={`min-w-0 flex-1 truncate hover:underline ${won ? "font-semibold" : final ? "text-muted" : ""}`}>
        {t?.fullName ?? abbr}
      </Link>
      <span className={`num w-10 text-right text-lg ${won ? "font-bold" : final ? "text-muted" : "font-semibold"}`}>
        {score ?? "–"}
      </span>
    </div>
  );

  return (
    <article className="game-card rounded-xl border p-3.5" aria-label={`${away?.fullName ?? game.away.abbr} en ${home?.fullName ?? game.home.abbr}`}>
      <div className="mb-2.5 flex items-center justify-between text-xs">
        <span className="text-muted">
          {showDate && <>{formatYmdShort(game.etDate)} · </>}
          {game.status === "scheduled" ? formatTime(game.startUtc, tz) : formatTime(game.startUtc, tz)}
        </span>
        {live ? (
          <Badge tone="live">
            <span className="live-dot inline-block size-1.5 rounded-full bg-live" /> En vivo · {game.statusDetail}
          </Badge>
        ) : final ? (
          <Badge>{game.statusDetail || "Final"}</Badge>
        ) : game.status === "postponed" ? (
          <Badge tone="accent">Aplazado</Badge>
        ) : (
          <Badge tone="neutral">Programado</Badge>
        )}
      </div>
      <div className="space-y-2">
        {row(away, game.away.abbr, game.away.score, awayWon)}
        {row(home, game.home.abbr, game.home.score, homeWon)}
      </div>
    </article>
  );
}
