"use client";

import { useTransition } from "react";
import { refreshData, setTimeZone } from "@/app/actions";

export function RefreshButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => refreshData())}
      disabled={pending}
      className="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60"
      aria-live="polite"
    >
      {pending ? "Actualizando…" : "Actualizar datos"}
    </button>
  );
}

export function TimeZoneSelect({ current, options }: { current: string; options: readonly string[] }) {
  const [pending, start] = useTransition();
  const list = options.includes(current) ? options : [current, ...options];
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only sm:not-sr-only">Zona horaria</span>
      <select
        defaultValue={current}
        disabled={pending}
        aria-label="Zona horaria"
        onChange={(e) => {
          const fd = new FormData();
          fd.set("tz", e.target.value);
          start(() => setTimeZone(fd));
        }}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
      >
        {list.map((tz) => (
          <option key={tz} value={tz}>
            {tz.replace("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
