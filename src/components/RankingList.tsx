import Link from "next/link";
import { fmt, fmtPct, playerSlug } from "@/lib/format";
import type { RankingResult } from "@/lib/rankings";
import { PlayerPhoto, TeamLogo } from "@/components/images";
import { EmptyState } from "@/components/ui";
import type { Team } from "@/lib/types";

export function formatRankingValue(kind: RankingResult["def"]["kind"], v: number, decimals: number) {
  return kind === "pct" ? fmtPct(v, decimals) : fmt(v, decimals);
}

export function RankingList({
  result,
  teams,
  size = "md",
}: {
  result: RankingResult;
  teams: Map<string, Team>;
  size?: "sm" | "md";
}) {
  if (result.entries.length === 0) {
    return (
      <EmptyState
        title="Ningún jugador cumple el criterio"
        hint={result.criteria || "Aún no hay partidos suficientes."}
      />
    );
  }
  const photo = size === "sm" ? 32 : 40;
  return (
    <ol className="divide-y divide-line/60">
      {result.entries.map((e) => (
        <li key={e.player.playerId} className="flex items-center gap-3 py-2">
          <span className="num w-6 text-right text-sm text-muted">{e.rank}</span>
          <PlayerPhoto name={e.player.playerName} src={e.player.headshot} size={photo} />
          <div className="min-w-0 flex-1">
            <Link href={`/jugadores/${playerSlug(e.player.playerId)}`} className="block truncate font-medium hover:underline">
              {e.player.playerName}
            </Link>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <TeamLogo abbr={e.player.teamAbbr} logo={teams.get(e.player.teamAbbr)?.logo} size={14} />
              {e.player.teams.length > 1 ? e.player.teams.join(" / ") : e.player.teamAbbr} · {e.player.games} PJ
              {e.attempts !== undefined && <> · {e.attempts} int.</>}
            </span>
          </div>
          <span className="num text-lg font-semibold">{formatRankingValue(result.def.kind, e.value, result.def.decimals)}</span>
        </li>
      ))}
    </ol>
  );
}
