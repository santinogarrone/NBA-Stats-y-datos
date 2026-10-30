import { fmt, fmtSigned } from "@/lib/format";
import { RATING_FORMULA, RATING_LABEL, type Rating } from "@/lib/rating";

/** Desglose de la valoración propia. Siempre rotulada como no oficial. */
export function RatingBreakdown({ rating }: { rating: Rating }) {
  if (!rating.complete || rating.total === null) {
    return (
      <p className="text-sm text-muted">
        Valoración incompleta: faltan datos ({rating.missing.join(", ")}). No entra en rankings ni MVP.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted">{RATING_LABEL}</span>
        <span className="num text-2xl font-bold text-accent">{fmt(rating.total, 1)}</span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Componentes de la valoración</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-1 text-left font-medium">Concepto</th>
            <th scope="col" className="py-1 text-right font-medium">Cantidad</th>
            <th scope="col" className="py-1 text-right font-medium">Peso</th>
            <th scope="col" className="py-1 text-right font-medium">Aporte</th>
          </tr>
        </thead>
        <tbody>
          {rating.components.map((c) => (
            <tr key={c.key} className="border-t border-line/60">
              <td className="py-1">{c.label}</td>
              <td className="num py-1 text-right">{c.amount}</td>
              <td className="num py-1 text-right text-muted">{fmt(c.weight, 1)}</td>
              <td className={`num py-1 text-right ${c.contribution < 0 ? "text-bad" : ""}`}>{fmtSigned(c.contribution, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Fórmula: {RATING_FORMULA}. Métrica propia de la aplicación; no es una valoración oficial de la NBA.</p>
    </div>
  );
}
