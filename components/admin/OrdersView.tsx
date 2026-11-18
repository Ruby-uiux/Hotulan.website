"use client";

import { ChevronDown, ChevronRight, Inbox, MapPin, Phone, Search, SearchX, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { formatMNT } from "@/lib/catalog";
import {
  ORDER_STATUSES,
  PAYMENT_LABEL,
  STATUS_META,
  byNewest,
  formatDateTime,
  orderItemCount,
  orderTotal,
  type Order,
  type OrderStatus,
} from "@/lib/admin-data";
import { Button, Input } from "@/components/ui";
import { EmptyState } from "./ui";

interface OrdersViewProps {
  orders: Order[];
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}

export default function OrdersView({ orders, onStatusChange }: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<OrderStatus | "all", number> = { all: orders.length, new: 0, paid: 0, delivery: 0, completed: 0 };
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/[\s-]/g, "");
    return [...orders]
      .sort(byNewest)
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (!needle) return true;
        // Phone and ID searches ignore dashes/spaces: "99112345" finds "9911-2345".
        const hay = `${o.id}${o.customer}${o.phone}`.toLowerCase().replace(/[\s-]/g, "");
        return hay.includes(needle);
      });
  }, [orders, statusFilter, query]);

  const tabs: ReadonlyArray<{ id: OrderStatus | "all"; label: string }> = [
    { id: "all", label: "Бүгд" },
    ...ORDER_STATUSES.map((s) => ({ id: s.id, label: s.label })),
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="orders-heading">
      <header className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="orders-heading" className="text-base font-bold text-slate-900">
              Захиалгууд
            </h2>
            <p className="text-xs text-slate-500">Төлөвийг жагсаалтаас шууд өөрчилнө</p>
          </div>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ID, нэр эсвэл утас"
            aria-label="Захиалга хайх"
            className="w-full sm:w-72"
            leading={<Search className="h-4 w-4" />}
            trailing={
              query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="grid h-8 w-8 place-items-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Хайлт цэвэрлэх"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )
            }
          />
        </div>

        <div className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Төлөвөөр шүүх">
          {tabs.map((t) => {
            const active = t.id === statusFilter;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.id !== "all" && <span className={`h-2 w-2 rounded-full ${STATUS_META[t.id].dot}`} aria-hidden="true" />}
                {t.label}
                <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState icon={Inbox} title="Захиалга ирээгүй байна" body="Дэлгүүрээс шинэ захиалга орж ирэхэд энд жагсана." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query.trim() ? `“${query.trim()}” — захиалга олдсонгүй` : `“${STATUS_META[statusFilter as OrderStatus]?.label}” төлөвтэй захиалга алга`}
          body="Өөр төлөв сонгох эсвэл хайлтаа өөрчилнө үү."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
            >
              Бүх захиалга харах
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="w-10 py-3 pl-4"><span className="sr-only">Дэлгэрэнгүй</span></th>
                <th scope="col" className="px-3 py-3">Захиалгын ID</th>
                <th scope="col" className="px-3 py-3">Харилцагч</th>
                <th scope="col" className="px-3 py-3">Огноо</th>
                <th scope="col" className="px-3 py-3 text-right">Нийт дүн</th>
                <th scope="col" className="px-3 py-3">Төлбөр</th>
                <th scope="col" className="px-5 py-3">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr className={`border-b border-slate-100 transition ${isOpen ? "bg-slate-50" : "hover:bg-slate-50/70"}`}>
                      <td className="py-3 pl-4">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : o.id)}
                          aria-expanded={isOpen}
                          aria-label={`${o.id} — бараа харах`}
                          className="grid h-7 w-7 place-items-center rounded-sm text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700">{o.id}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{o.customer}</p>
                        <p className="text-xs text-slate-500">{orderItemCount(o)} бараа</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">{formatDateTime(o.createdAt)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">{formatMNT(orderTotal(o))}</td>
                      <td className="px-3 py-3 text-slate-600">{PAYMENT_LABEL[o.payment]}</td>
                      <td className="px-5 py-3">
                        <StatusSelect status={o.status} orderId={o.id} onChange={(s) => onStatusChange(o.id, s)} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td />
                        <td colSpan={6} className="px-3 pb-5 pt-1">
                          <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_16rem]">
                            <ul className="divide-y divide-slate-100">
                              {o.lines.map((l) => (
                                <li key={l.productId} className="flex items-center justify-between gap-4 py-2 first:pt-0">
                                  <span className="text-slate-800">
                                    {l.title} <span className="text-slate-400">× {l.quantity}</span>
                                  </span>
                                  <span className="tabular-nums font-medium text-slate-900">{formatMNT(l.unitPrice * l.quantity)}</span>
                                </li>
                              ))}
                              <li className="flex justify-between py-2 text-slate-500">
                                <span>Хүргэлт</span>
                                <span className="tabular-nums">{o.deliveryFee === 0 ? "Үнэгүй" : formatMNT(o.deliveryFee)}</span>
                              </li>
                            </ul>
                            <dl className="space-y-2 text-sm md:border-l md:border-slate-100 md:pl-4">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                <dt className="sr-only">Утас</dt>
                                <dd className="tabular-nums">{o.phone}</dd>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                <dt className="sr-only">Дүүрэг</dt>
                                <dd>{o.district} дүүрэг</dd>
                              </div>
                            </dl>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Native select (keyboard + mobile pickers for free) dressed as the status badge it controls. */
function StatusSelect({ status, orderId, onChange }: { status: OrderStatus; orderId: string; onChange: (s: OrderStatus) => void }) {
  const meta = STATUS_META[status];
  return (
    <div className="relative inline-flex">
      <span className={`pointer-events-none absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${meta.dot}`} aria-hidden="true" />
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as OrderStatus)}
        aria-label={`${orderId} — төлөв өөрчлөх`}
        className={`h-8 cursor-pointer appearance-none rounded-full py-0 pl-6 pr-8 text-xs font-semibold ring-1 ring-inset transition focus:outline-none focus:ring-2 focus:ring-brand ${meta.tone}`}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" aria-hidden="true" />
    </div>
  );
}
