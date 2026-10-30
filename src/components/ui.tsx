import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface-card rounded-2xl border p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="page-title mb-6">
      <h1 className="bg-gradient-to-r from-ink via-ink to-muted bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/45 px-4 py-9 text-center" role="status">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "good" | "accent" | "east" | "west";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-muted",
    live: "bg-live/15 text-live",
    good: "bg-good/15 text-good",
    accent: "bg-accent/15 text-accent",
    east: "bg-east/15 text-east",
    west: "bg-west/15 text-west",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat-tile rounded-xl px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" }) {
  const cls = tone === "warn" ? "border-accent/40 bg-accent/10" : "border-line bg-surface-2";
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`} role="note">
      {children}
    </div>
  );
}
