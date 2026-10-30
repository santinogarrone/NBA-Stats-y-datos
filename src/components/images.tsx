/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/format";

/** Logotipo solo si la fuente lo informó; si no, la abreviatura en un círculo. */
export function TeamLogo({ abbr, logo, size = 32 }: { abbr: string; logo?: string; size?: number }) {
  if (!logo) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {abbr}
      </span>
    );
  }
  return (
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function PlayerPhoto({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-surface-2 object-cover object-top"
      style={{ width: size, height: size }}
    />
  );
}
