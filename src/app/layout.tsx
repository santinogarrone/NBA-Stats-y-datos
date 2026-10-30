import type { Metadata } from "next";
import Link from "next/link";
import { TIME_ZONE_OPTIONS } from "@/config/app";
import { NavLinks } from "@/components/NavLinks";
import { RefreshButton, TimeZoneSelect } from "@/components/HeaderControls";
import { getTz } from "@/lib/params";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NBA Stats", template: "%s · NBA Stats" },
  description: "Partidos, equipos, jugadores, rankings, MVP y clasificación de la NBA con datos de ESPN y BALLDONTLIE.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tz = await getTz();
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-accent-ink">
          Saltar al contenido
        </a>
        <header className="site-header sticky top-0 z-40 border-b backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
                <span className="brand-mark" aria-hidden="true">NBA</span>
                <span>NBA<span className="text-accent"> Stats</span></span>
              </Link>
              <div className="flex items-center gap-2 sm:hidden">
                <TimeZoneSelect current={tz} options={TIME_ZONE_OPTIONS} />
              </div>
            </div>
            <NavLinks />
            <div className="hidden items-center gap-2 sm:flex">
              <TimeZoneSelect current={tz} options={TIME_ZONE_OPTIONS} />
              <RefreshButton />
            </div>
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </main>
        <footer className="border-t border-line/70 bg-surface/35 px-4 py-6 text-xs text-muted">
          <div className="mx-auto max-w-7xl space-y-2 sm:px-6">
            <p className="sm:hidden">
              <RefreshButton />
            </p>
            <p>
              Datos de ESPN (API no oficial, puede cambiar sin aviso) y BALLDONTLIE. La valoración que se muestra es una métrica
              propia de esta aplicación, no una valoración oficial de la NBA. Proyecto no afiliado a la NBA.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
