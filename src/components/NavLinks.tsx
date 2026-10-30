"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/equipos", label: "Equipos" },
  { href: "/jugadores", label: "Jugadores" },
  { href: "/rankings", label: "Rankings" },
  { href: "/mvp", label: "MVP" },
  { href: "/clasificacion", label: "Clasificación" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`nav-link whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              active ? "nav-link-active" : "text-muted hover:border-line hover:bg-surface-2/80 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
