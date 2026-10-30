import Link from "next/link";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  title?: string;
  align?: "left" | "right";
  cell: (row: T, index: number) => ReactNode;
  /** Si es true, el encabezado es un enlace que ordena por esta columna. */
  sortable?: boolean;
  className?: string;
}

/**
 * Tabla ordenable desde el servidor: el orden vive en la URL (?orden=…&dir=…), así se
 * puede compartir, funciona sin JavaScript y no necesita estado de cliente.
 */
export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir,
  hrefFor,
  caption,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  hrefFor?: (key: string) => string;
  caption: string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => {
              const active = sortKey === c.key;
              const aria = active ? (sortDir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  aria-sort={aria}
                  className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"} ${c.className ?? ""}`}
                >
                  {c.sortable && hrefFor ? (
                    <Link href={hrefFor(c.key)} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-accent" : ""}`}>
                      {c.label}
                      <span aria-hidden>{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row)} className="border-t border-line/70 hover:bg-surface-2/50">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${c.align === "right" ? "num text-right" : "text-left"} ${c.className ?? ""}`}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
