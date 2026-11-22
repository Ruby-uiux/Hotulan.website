"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/components/ui";
import type { Banner } from "@/lib/content";
import SafeImage from "../SafeImage";

/** "11.20 – 12.05" in Ulaanbaatar time, from a banner's schedule. */
export function bannerDates(b: Pick<Banner, "startsAt" | "endsAt">): string | null {
  const fmt = (iso: string) => {
    const d = new Date(Date.parse(iso) + 8 * 3600_000);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  if (b.startsAt && b.endsAt) return `${fmt(b.startsAt)} – ${fmt(b.endsAt)}`;
  if (b.endsAt) return `${fmt(b.endsAt)} хүртэл`;
  return null;
}

/**
 * Main hero slot (design/Home: 2/3 width, 400px; design/MHome: full-width card). Slides
 * auto-advance every `intervalMs`, pause while hovered or focused, and stay put for
 * people who prefer reduced motion.
 */
export default function HeroCarousel({ slides, intervalMs }: { slides: Banner[]; intervalMs: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), Math.max(3000, intervalMs));
    return () => window.clearInterval(t);
  }, [count, paused, reduced, intervalMs]);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  if (count === 0) return null;
  const b = slides[index];
  const dates = bannerDates(b);
  const image = b.imageDesktop;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Онцлох урамшуулал"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative flex min-h-[200px] overflow-hidden rounded-xl lg:min-h-[400px]"
      style={{ background: b.background, color: b.foreground }}
    >
      <div
        key={b.id}
        aria-roledescription="slide"
        aria-label={`${index + 1} / ${count}`}
        className="flex flex-1 animate-fade-in justify-between gap-6 p-6 lg:p-12"
      >
        <div className="flex flex-col justify-center gap-4 lg:gap-5">
          {dates && (
            <span className="self-start rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold lg:text-[13px]">{dates}</span>
          )}
          <h1 className="max-w-[520px] text-2xl leading-[1.15] font-extrabold tracking-[-0.03em] lg:text-[46px] lg:leading-[1.05]">{b.title}</h1>
          {b.subtitle && <p className="hidden max-w-[460px] text-[17px] leading-[1.6] opacity-85 lg:block">{b.subtitle}</p>}
          {b.ctaLabel && (
            <Link
              href={b.href}
              className="flex h-11 items-center self-start rounded-md bg-white px-5 text-[15px] font-bold text-brand transition-opacity hover:opacity-90 lg:h-12 lg:px-6"
            >
              <span className="lg:hidden">Үзэх</span>
              <span className="hidden lg:inline">{b.ctaLabel}</span>
            </Link>
          )}
        </div>
        {image && (
          <div className="relative hidden w-[340px] shrink-0 overflow-hidden rounded-lg lg:block">
            <SafeImage src={image} alt="" eager className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="absolute bottom-5 left-6 flex gap-1.5 lg:left-12">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1}-р слайд`}
              aria-current={i === index ? "true" : undefined}
              className="grid h-6 place-items-center"
            >
              <span className={cn("block h-1.5 rounded-[3px] transition-all", i === index ? "w-6 bg-current" : "w-1.5 bg-current opacity-50")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
