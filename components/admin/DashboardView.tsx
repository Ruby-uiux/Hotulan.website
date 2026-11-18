"use client";

import { AlertTriangle, ArrowRight, Boxes, Inbox, PackageCheck, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMNT, type Product } from "@/lib/catalog";
import {
  byNewest,
  ORDER_STATUSES,
  dayKey,
  formatDateTime,
  orderTotal,
  type AdminView,
  type Order,
} from "@/lib/admin-data";
import SafeImage from "@/components/store/SafeImage";
import { EmptyState, StatusBadge, StockBadge } from "./ui";

interface DashboardViewProps {
  products: Product[];
  orders: Order[];
  lowStockThreshold: number;
  onNavigate: (view: AdminView, preset?: { stockFilter?: "low" }) => void;
  /** Reference "now" for the 7-day chart; passed in so server and client render the same buckets. */
  now: Date;
}

const WEEKDAY_MN = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

/** Revenue only counts money actually received; "new" orders are still awaiting payment. */
const isPaid = (o: Order) => o.status !== "new";

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} сая₮`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} мян₮`;
  return formatMNT(value);
}

export default function DashboardView({ products, orders, lowStockThreshold, onNavigate, now }: DashboardViewProps) {
  const stats = useMemo(() => {
    const paid = orders.filter(isPaid);
    const pending = orders.filter((o) => !isPaid(o));
    const lowOrOut = products.filter((p) => p.stock <= lowStockThreshold);
    return {
      revenue: paid.reduce((s, o) => s + orderTotal(o), 0),
      pendingAmount: pending.reduce((s, o) => s + orderTotal(o), 0),
      orderCount: orders.length,
      newCount: pending.length,
      unitsInStock: products.reduce((s, p) => s + Math.max(0, p.stock), 0),
      skuCount: products.length,
      lowCount: lowOrOut.length,
      outCount: lowOrOut.filter((p) => p.stock <= 0).length,
    };
  }, [orders, products, lowStockThreshold]);

  const lowStockItems = useMemo(
    () => products.filter((p) => p.stock <= lowStockThreshold).sort((a, b) => a.stock - b.stock).slice(0, 5),
    [products, lowStockThreshold],
  );

  const recentOrders = useMemo(
    () => [...orders].sort(byNewest).slice(0, 5),
    [orders],
  );

  return (
    <div className="space-y-6">
      <section aria-label="Гол үзүүлэлтүүд" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Нийт борлуулалт"
          value={formatMNT(stats.revenue)}
          hint={`Төлбөр хүлээгдэж буй: ${formatMNT(stats.pendingAmount)}`}
          emphasis
        />
        <StatCard
          icon={ShoppingBag}
          label="Нийт захиалгын тоо"
          value={stats.orderCount.toLocaleString("en-US")}
          hint={`${stats.newCount} шинэ захиалга шийдвэрлэх`}
          onClick={() => onNavigate("orders")}
        />
        <StatCard
          icon={Boxes}
          label="Нийт барааны үлдэгдэл"
          value={`${stats.unitsInStock.toLocaleString("en-US")} ш`}
          hint={`${stats.skuCount} нэр төрлийн бараа`}
          onClick={() => onNavigate("products")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Барааны үлдэгдэл бага"
          value={`${stats.lowCount} бараа`}
          hint={stats.outCount > 0 ? `${stats.outCount} нь бүрэн дууссан` : `${lowStockThreshold}-аас доош үлдэгдэлтэй`}
          warning={stats.lowCount > 0}
          onClick={() => onNavigate("products", { stockFilter: "low" })}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RevenueChart orders={orders} now={now} />
        <StatusBreakdown orders={orders} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="recent-orders">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 id="recent-orders" className="text-sm font-bold text-slate-900">
              Сүүлийн захиалгууд
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Бүгдийг харах <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </header>
          {recentOrders.length === 0 ? (
            <EmptyState icon={Inbox} title="Захиалга алга" body="Шинэ захиалга ирэхэд энд харагдана." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {o.customer.split(" ").pop()?.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{o.customer}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{o.id}</span> · {formatDateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="w-28 text-right text-sm font-bold tabular-nums text-slate-900">{formatMNT(orderTotal(o))}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="low-stock">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 id="low-stock" className="text-sm font-bold text-slate-900">
              Нөхөх шаардлагатай бараа
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("products", { stockFilter: "low" })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Удирдах <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </header>
          {lowStockItems.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Бүх бараа хангалттай" body={`${lowStockThreshold}-аас доош үлдэгдэлтэй бараа алга.`} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockItems.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <SafeImage src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      Үлдэгдэл: <span className="font-semibold tabular-nums text-slate-800">{p.stock} ш</span>
                    </p>
                  </div>
                  <StockBadge stock={p.stock} threshold={lowStockThreshold} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
  warning?: boolean;
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, hint, emphasis, warning, onClick }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`group rounded-lg border bg-white p-5 text-left shadow-sm transition ${
        emphasis ? "border-brand/30 ring-1 ring-brand/10" : "border-slate-200"
      } ${onClick ? "hover:border-slate-300 hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
            emphasis ? "bg-brand text-white" : warning ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-extrabold tracking-tight tabular-nums ${emphasis ? "text-brand" : "text-slate-900"}`}>
        {value}
      </p>
      <p className={`mt-1 text-xs ${warning ? "font-medium text-amber-700" : "text-slate-500"}`}>{hint}</p>
    </Wrapper>
  );
}

/** Single-series bar chart of paid revenue over the last 7 days, with a per-bar hover tooltip. */
function RevenueChart({ orders, now }: { orders: Order[]; now: Date }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const days = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - (6 - i) * 86_400_000);
      return { key: dayKey(date), date, revenue: 0, count: 0 };
    });
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const o of orders) {
      if (!isPaid(o)) continue;
      const i = index.get(dayKey(new Date(o.createdAt)));
      if (i === undefined) continue;
      buckets[i].revenue += orderTotal(o);
      buckets[i].count += 1;
    }
    return buckets;
  }, [orders, now]);

  const weekTotal = days.reduce((s, d) => s + d.revenue, 0);
  // Round the axis ceiling up to a clean step so gridline labels read as round numbers.
  const rawMax = Math.max(...days.map((d) => d.revenue), 1);
  const step = rawMax > 2_000_000 ? 1_000_000 : rawMax > 500_000 ? 500_000 : 100_000;
  const ceiling = Math.ceil(rawMax / step) * step;
  const gridlines = [ceiling, ceiling / 2, 0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="revenue-chart">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="revenue-chart" className="text-sm font-bold text-slate-900">
            Өдөр тутмын борлуулалт
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Сүүлийн 7 хоног · төлөгдсөн захиалга</p>
        </div>
        <p className="text-right">
          <span className="block text-xl font-extrabold tracking-tight tabular-nums text-slate-900">{formatMNT(weekTotal)}</span>
          <span className="text-xs text-slate-500">7 хоногийн нийт</span>
        </p>
      </header>

      <div className="relative mt-6 h-56 pl-16" role="img" aria-label={`7 хоногийн борлуулалт: ${days.map((d) => `${WEEKDAY_MN[d.date.getUTCDay()]} ${formatMNT(d.revenue)}`).join(", ")}`}>
        {gridlines.map((g) => (
          <div key={g} className="absolute inset-x-0 flex items-center" style={{ bottom: `${(g / ceiling) * 100}%` }}>
            <span className="w-16 -translate-y-px whitespace-nowrap pr-3 text-right text-[11px] tabular-nums text-slate-400">{formatCompact(g)}</span>
            <span className={`h-px flex-1 ${g === 0 ? "bg-slate-300" : "bg-slate-100"}`} />
          </div>
        ))}

        <div className="relative flex h-full items-end gap-[2px]">
          {days.map((d, i) => {
            const pct = (d.revenue / ceiling) * 100;
            const isToday = i === days.length - 1;
            return (
              <div
                key={d.key}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className={`w-full max-w-10 rounded-t-[4px] transition-colors ${
                    hovered === null || hovered === i ? "bg-brand" : "bg-brand/30"
                  } ${d.revenue === 0 ? "opacity-0" : ""}`}
                  style={{ height: `${Math.max(pct, d.revenue > 0 ? 1.5 : 0)}%` }}
                />
                {hovered === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-y-1 rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                    <p className="font-semibold">
                      {d.key.slice(5).replace("-", ".")} ({WEEKDAY_MN[d.date.getUTCDay()]})
                    </p>
                    <p className="mt-0.5 tabular-nums">{formatMNT(d.revenue)}</p>
                    <p className="text-slate-400">{d.count} захиалга</p>
                  </div>
                )}
                {isToday && <span className="sr-only">Өнөөдөр</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] pl-16">
        {days.map((d, i) => (
          <span
            key={d.key}
            className={`flex-1 text-center text-[11px] ${i === days.length - 1 ? "font-bold text-slate-900" : "text-slate-500"}`}
          >
            {i === days.length - 1 ? "Өнөөдөр" : WEEKDAY_MN[d.date.getUTCDay()]}
          </span>
        ))}
      </div>
    </section>
  );
}

function StatusBreakdown({ orders }: { orders: Order[] }) {
  const counts = ORDER_STATUSES.map((s) => ({ ...s, count: orders.filter((o) => o.status === s.id).length }));
  const total = orders.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="status-breakdown">
      <h2 id="status-breakdown" className="text-sm font-bold text-slate-900">
        Захиалгын төлөв
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Нийт {total} захиалга</p>

      {total === 0 ? (
        <EmptyState icon={Inbox} title="Захиалга алга" body="Төлөвийн задаргаа захиалга ирсний дараа харагдана." />
      ) : (
        <>
          <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
            {counts
              .filter((c) => c.count > 0)
              .map((c) => (
                <span key={c.id} className={c.dot} style={{ width: `${(c.count / total) * 100}%` }} />
              ))}
          </div>
          <ul className="mt-5 space-y-3">
            {counts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-[4px] ${c.dot}`} aria-hidden="true" />
                  {c.label}
                </span>
                <span className="tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-900">{c.count}</span>
                  <span className="ml-2 inline-block w-10 text-right">{Math.round((c.count / total) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
