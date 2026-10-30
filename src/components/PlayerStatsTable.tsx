import Link from "next/link";
import { isPartial, perGame, fgPct, fg3Pct, ftPct, ratingPerGame } from "@/lib/averages";
import { fmt, fmtPct, playerSlug } from "@/lib/format";
import type { PlayerRow } from "@/lib/playerRows";
import type { StatKey } from "@/lib/types";
import { PlayerPhoto } from "@/components/images";
import { SortableTable, type Column } from "@/components/SortableTable";

const avgCol = (key: string, label: string, stat: StatKey, title: string, decimals = 1): Column<PlayerRow> => ({
  key,
  label,
  title,
  align: "right",
  sortable: true,
  cell: (r) => {
    if (!r.agg) return "—";
    const v = perGame(r.agg, stat);
    return (
      <span title={isPartial(r.agg, stat) ? "Promedio parcial: algunos partidos no traen este dato" : undefined}>
        {fmt(v, decimals)}
        {v !== null && isPartial(r.agg, stat) ? "*" : ""}
      </span>
    );
  },
});

export function PlayerStatsTable({
  rows,
  caption,
  sortKey,
  sortDir,
  hrefFor,
  showBio = false,
  showTeam = true,
  empty,
}: {
  rows: PlayerRow[];
  caption: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  hrefFor: (key: string) => string;
  showBio?: boolean;
  showTeam?: boolean;
  empty?: React.ReactNode;
}) {
  const columns: Column<PlayerRow>[] = [
    {
      key: "name",
      label: "Jugador",
      sortable: true,
      cell: (r) => (
        <Link href={`/jugadores/${playerSlug(r.id)}`} className="flex items-center gap-2.5 hover:underline">
          <PlayerPhoto name={r.name} src={r.headshot} size={30} />
          <span className="font-medium">{r.name}</span>
        </Link>
      ),
    },
    ...(showTeam ? [{ key: "team", label: "Eq.", sortable: true, cell: (r: PlayerRow) => r.agg && r.agg.teams.length > 1 ? r.agg.teams.join("/") : (r.teamAbbr ?? "—") }] : []),
    { key: "pos", label: "Pos", cell: (r) => r.position ?? "—" },
    ...(showBio
      ? ([
          { key: "jersey", label: "#", align: "right", cell: (r) => r.jersey ?? "—" },
          { key: "age", label: "Edad", align: "right", cell: (r) => r.age ?? "—" },
          { key: "height", label: "Alt.", align: "right", cell: (r) => r.height ?? "—" },
        ] as Column<PlayerRow>[])
      : []),
    { key: "games", label: "PJ", title: "Partidos disputados", align: "right", sortable: true, cell: (r) => r.agg?.games ?? "—" },
    avgCol("min", "MIN", "min", "Minutos por partido"),
    avgCol("pts", "PTS", "pts", "Puntos por partido"),
    avgCol("reb", "REB", "reb", "Rebotes por partido"),
    avgCol("ast", "AST", "ast", "Asistencias por partido"),
    avgCol("stl", "ROB", "stl", "Robos por partido"),
    avgCol("blk", "BLQ", "blk", "Bloqueos por partido"),
    avgCol("tov", "PER", "tov", "Pérdidas por partido"),
    avgCol("fg3m", "3PM", "fg3m", "Triples convertidos por partido"),
    { key: "fgPct", label: "FG%", title: "% de tiros de campo (aciertos / intentos totales)", align: "right", sortable: true, cell: (r) => (r.agg ? fmtPct(fgPct(r.agg)) : "—") },
    { key: "fg3Pct", label: "3P%", title: "% de triples", align: "right", sortable: true, cell: (r) => (r.agg ? fmtPct(fg3Pct(r.agg)) : "—") },
    { key: "ftPct", label: "TL%", title: "% de tiros libres", align: "right", sortable: true, cell: (r) => (r.agg ? fmtPct(ftPct(r.agg)) : "—") },
    {
      key: "ratingPg",
      label: "VAL",
      title: "Valoración propia por partido (no oficial)",
      align: "right",
      sortable: true,
      cell: (r) => (r.agg ? fmt(ratingPerGame(r.agg), 1) : "—"),
    },
  ];

  return (
    <div>
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sortKey={sortKey}
        sortDir={sortDir}
        hrefFor={hrefFor}
        caption={caption}
        empty={empty}
      />
      <p className="mt-2 text-xs text-muted">
        Promedios por partido = total ÷ partidos disputados. «—» indica dato no disponible (no es un cero). * promedio parcial. VAL es una
        valoración propia, no oficial.
      </p>
    </div>
  );
}
