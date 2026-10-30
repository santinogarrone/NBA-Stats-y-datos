"use client";

import { useRef, type ReactNode } from "react";

/** Formulario GET que se envía al cambiar cualquier selector. Sin JavaScript queda el botón. */
export function FilterForm({ children, action }: { children: ReactNode; action: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      onChange={(e) => {
        // Los campos de texto se envían con el botón o Intro, no con cada tecla.
        const t = e.target;
        if (t instanceof HTMLInputElement && (t.type === "search" || t.type === "text")) return;
        ref.current?.requestSubmit();
      }}
      className="filter-bar flex flex-wrap items-end gap-3"
    >
      {children}
      <noscript>
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
          Aplicar
        </button>
      </noscript>
    </form>
  );
}

export function Field({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateField({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
      />
    </label>
  );
}
