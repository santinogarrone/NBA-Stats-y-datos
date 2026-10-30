import { formatDateTime } from "@/lib/dates";
import type { Coverage, Meta } from "@/lib/types";
import { Notice } from "@/components/ui";

const SOURCE_LABEL: Record<string, string> = {
  espn: "ESPN (no oficial)",
  balldontlie: "BALLDONTLIE",
  static: "Datos estáticos de la liga",
  computed: "Cálculo de la aplicación",
};

/** Procedencia de los datos, última actualización, cobertura y avisos. */
export function DataStatus({ meta, coverage, tz }: { meta: Meta; coverage?: Coverage; tz: string }) {
  const warnings = [...new Set(meta.warnings)];
  const total = coverage?.boxscores.total ?? 0;
  const partial = coverage && !coverage.complete;
  return (
    <div className="space-y-2 text-xs text-muted">
      <p>
        Fuente: <span className="text-ink">{SOURCE_LABEL[meta.source] ?? meta.source}</span>
        {meta.fallbackFrom && <> (respaldo; falló {SOURCE_LABEL[meta.fallbackFrom] ?? meta.fallbackFrom})</>}
        {" · "}Datos de: <time dateTime={meta.fetchedAt}>{formatDateTime(meta.fetchedAt, tz)}</time>
        {coverage && total > 0 && (
          <>
            {" · "}Box scores: {coverage.boxscores.loaded} de {total}
          </>
        )}
      </p>
      {partial && (
        <Notice>
          Cobertura parcial: los totales, rankings y MVP se calculan solo con los partidos ya cargados. Pulsa «Actualizar
          datos» o recarga la página para seguir cargando; lo ya cargado no se vuelve a pedir.
        </Notice>
      )}
      {warnings.length > 0 && (
        <details className="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-muted">
            {warnings.length} aviso{warnings.length > 1 ? "s" : ""} sobre los datos
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.slice(0, 12).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {warnings.length > 12 && <li>… y {warnings.length - 12} más.</li>}
          </ul>
        </details>
      )}
    </div>
  );
}
