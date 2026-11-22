"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0"));
}

/**
 * Time left until a real, admin-set deadline (home_sections.flash_sale.config.endsAt).
 * Never a fake daily reset: without an end time the section shows no timer at all,
 * and once the deadline passes the timer disappears.
 */
export default function Countdown({ endsAt }: { endsAt: string }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Render nothing until mounted, so server and client HTML agree.
  if (now === null || !Number.isFinite(end) || end <= now) return null;
  const [h, m, s] = parts(end - now);
  const box = "rounded-sm bg-slate-900 px-2 py-1.5 text-[15px] leading-none font-bold text-white tabular-nums";
  return (
    <span className="flex items-center gap-1" role="timer" aria-label={`Дуусахад ${h} цаг ${m} минут`}>
      <span className={box}>{h}</span>
      <span aria-hidden="true" className="font-bold">:</span>
      <span className={box}>{m}</span>
      <span aria-hidden="true" className="font-bold">:</span>
      <span className={box}>{s}</span>
    </span>
  );
}
