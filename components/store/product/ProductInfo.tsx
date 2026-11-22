"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Tabs, tabPanelProps } from "@/components/ui";
import type { ProductSpec } from "@/lib/catalog";

type TabId = "description" | "specs";

/**
 * design/Product tabs ("Тайлбар", "Үзүүлэлт") on desktop and the stacked cards of
 * design/MProduct on phones. The design's "Сэтгэгдэл (214)" tab is left out: there are
 * no real reviews yet (flaw #17).
 */
export default function ProductInfo({ description, features, specs }: { description: string; features: string[]; specs: ProductSpec[] }) {
  const tabs: { value: TabId; label: string }[] = [
    ...(description || features.length ? [{ value: "description" as const, label: "Тайлбар" }] : []),
    ...(specs.length ? [{ value: "specs" as const, label: "Үзүүлэлт" }] : []),
  ];
  const [tab, setTab] = useState<TabId>(tabs[0]?.value ?? "description");
  if (tabs.length === 0) return null;

  const body: Record<TabId, ReactNode> = {
    description: (
      <div className="flex flex-col gap-4 text-[15px] leading-[1.7] text-slate-700">
        {description && <p className="whitespace-pre-line">{description}</p>}
        {features.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    ),
    specs: (
      <table className="w-full text-sm">
        <tbody>
          {specs.map((s) => (
            <tr key={s.label} className="border-t border-slate-200 first:border-t-0">
              <th scope="row" className="w-2/5 py-3 pr-4 text-left font-normal text-slate-500">
                {s.label}
              </th>
              <td className="py-3 font-semibold">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };

  return (
    <>
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <Tabs items={tabs} value={tab} onChange={setTab} label="Барааны мэдээлэл" idPrefix="pinfo" className="px-3" />
        <div {...tabPanelProps("pinfo", tab)} className="p-6 outline-none">
          {body[tab]}
        </div>
      </section>
      <div className="flex flex-col gap-3 lg:hidden">
        {tabs.map((t, i) => (
          <details key={t.value} open={i === 0} className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
              {t.label}
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-4">{body[t.value]}</div>
          </details>
        ))}
      </div>
    </>
  );
}
