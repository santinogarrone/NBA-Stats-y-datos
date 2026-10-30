import { fmt } from "@/lib/format";

export interface ChartSeries {
  name: string;
  color: string;
  values: Array<number | null>;
}

/**
 * Gráfico de líneas en SVG (sin dependencias). Los huecos (null) cortan la línea en lugar
 * de dibujarse como 0. Incluye una tabla accesible equivalente.
 */
export function LineChart({
  labels,
  series,
  height = 180,
  decimals = 1,
  title,
}: {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  decimals?: number;
  title: string;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (labels.length === 0 || all.length === 0) {
    return <p className="text-sm text-muted">No hay datos suficientes para el gráfico.</p>;
  }
  let min = Math.min(0, ...all);
  let max = Math.max(...all);
  if (max === min) max = min + 1;
  const range = max - min;
  const x = (i: number) => pad.l + (labels.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (labels.length - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / range) * (H - pad.t - pad.b);
  const ticks = [min, min + range / 2, max];
  min = Math.min(min, 0);

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  });

  const step = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {fmt(t, 0)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => (
          <g key={s.name}>
            <path d={paths[si]} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) =>
              v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={labels.length > 30 ? 1.8 : 3} fill={s.color} />,
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </figcaption>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Ver datos del gráfico</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-max text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-medium">Fecha</th>
                {series.map((s) => (
                  <th key={s.name} className="px-2 py-1 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}>
                  <td className="px-2 py-0.5">{l}</td>
                  {series.map((s) => (
                    <td key={s.name} className="num px-2 py-0.5 text-right">
                      {fmt(s.values[i], decimals)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
