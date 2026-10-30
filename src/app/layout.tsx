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
        <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="text-lg font-bold tracking-tight">
                NBA<span className="text-accent"> Stats</span>
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
        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-6 text-xs text-muted">
          <div className="mx-auto max-w-6xl space-y-1">
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
