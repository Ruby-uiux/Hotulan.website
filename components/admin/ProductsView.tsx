"use client";

import { Minus, PackagePlus, PackageSearch, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { CATEGORY_LABEL, formatMNT, type CategoryId, type Product } from "@/lib/catalog";
import { CATEGORY_OPTIONS } from "@/lib/admin-data";
import SafeImage from "@/components/store/SafeImage";
import ProductFormModal from "./ProductFormModal";
import { EmptyState, Modal, StockBadge, btn, inputClass, stockLevel, type StockLevel } from "./ui";

export type StockFilter = "all" | "low" | "out" | "ok";

interface ProductsViewProps {
  products: Product[];
  lowStockThreshold: number;
  initialStockFilter: StockFilter;
  onSave: (product: Product) => Promise<void>;
  onDelete: (productId: string) => void;
  onStockChange: (productId: string, stock: number) => void;
}

const STOCK_FILTERS: ReadonlyArray<{ id: StockFilter; label: string }> = [
  { id: "all", label: "Бүх үлдэгдэл" },
  { id: "low", label: "Бага / дууссан" },
  { id: "out", label: "Дууссан" },
  { id: "ok", label: "Хангалттай" },
];

function matchesStock(level: StockLevel, filter: StockFilter): boolean {
  if (filter === "all") return true;
  if (filter === "low") return level !== "ok";
  return level === filter;
}

export default function ProductsView({
  products,
  lowStockThreshold,
  initialStockFilter,
  onSave,
  onDelete,
  onStockChange,
}: ProductsViewProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>(initialStockFilter);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        matchesStock(stockLevel(p.stock, lowStockThreshold), stockFilter) &&
        (!needle || p.title.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle) || p.brand.toLowerCase().includes(needle)),
    );
  }, [products, query, category, stockFilter, lowStockThreshold]);

  const hasFilters = query.trim() !== "" || category !== "all" || stockFilter !== "all";
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setStockFilter("all");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setFormOpen(true);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="products-heading">
      <header className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="products-heading" className="text-base font-bold text-slate-900">
              Бараа
            </h2>
            <p className="text-xs text-slate-500">
              {filtered.length === products.length
                ? `Нийт ${products.length} бараа`
                : `${products.length}-аас ${filtered.length} бараа харагдаж байна`}
            </p>
          </div>
          <button type="button" onClick={openCreate} className={btn.primary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Бараа нэмэх
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Нэр, брэнд эсвэл ID-аар хайх"
              aria-label="Бараа хайх"
              className={`${inputClass} pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Хайлт цэвэрлэх"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId | "all")}
            aria-label="Ангиллаар шүүх"
            className={`${inputClass} sm:w-44`}
          >
            <option value="all">Бүх ангилал</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            aria-label="Үлдэгдлээр шүүх"
            className={`${inputClass} sm:w-44`}
          >
            {STOCK_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {products.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="Бараа бүртгэгдээгүй байна"
          body="Эхний бараагаа нэмээд дэлгүүртээ нийтлээрэй."
          action={
            <button type="button" onClick={openCreate} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Бараа нэмэх
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Шүүлтүүрт тохирох бараа алга"
          body="Хайлтын үг эсвэл шүүлтүүрээ өөрчилж үзнэ үү."
          action={
            hasFilters && (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Шүүлтүүр арилгах
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-3">Бараа</th>
                <th scope="col" className="px-3 py-3">Ангилал</th>
                <th scope="col" className="px-3 py-3 text-right">Үнэ</th>
                <th scope="col" className="px-3 py-3">Үлдэгдэл</th>
                <th scope="col" className="px-3 py-3">Төлөв</th>
                <th scope="col" className="px-5 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <SafeImage src={p.image} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
                      <div className="min-w-0">
                        <p className="max-w-[18rem] truncate font-semibold text-slate-900">{p.title}</p>
                        <p className="font-mono text-[11px] text-slate-400">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{CATEGORY_LABEL[p.category]}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <p className="font-semibold text-slate-900">{formatMNT(p.price)}</p>
                    {p.compareAtPrice && <p className="text-xs text-slate-400 line-through">{formatMNT(p.compareAtPrice)}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <StockStepper key={`${p.id}:${p.stock}`} product={p} onCommit={(n) => onStockChange(p.id, n)} />
                  </td>
                  <td className="px-3 py-3">
                    <StockBadge stock={p.stock} threshold={lowStockThreshold} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Засах
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(p)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Устгах
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSave={async (p) => {
          await onSave(p); // rejects on server error — the form shows it and stays open
          setFormOpen(false);
        }}
      />

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Бараа устгах уу?"
        footer={
          <>
            <button type="button" data-autofocus onClick={() => setPendingDelete(null)} className={btn.secondary}>
              Болих
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
              className={btn.danger}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Устгах
            </button>
          </>
        }
      >
        {pendingDelete && (
          <div className="flex gap-3">
            <SafeImage src={pendingDelete.image} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" />
            <div className="text-sm">
              <p className="font-semibold text-slate-900">{pendingDelete.title}</p>
              <p className="mt-1 text-slate-500">
                Дэлгүүрээс шууд хасагдана. Өмнөх захиалгын түүх өөрчлөгдөхгүй. Энэ үйлдлийг буцаах боломжгүй.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

/**
 * Inline stock editor for fast restocking. Typing is buffered locally and committed on
 * blur/Enter so a half-typed "1" on the way to "120" never flashes a low-stock badge.
 */
function StockStepper({ product, onCommit }: { product: Product; onCommit: (stock: number) => void }) {
  const [draft, setDraft] = useState(String(product.stock));

  const commit = (value: string) => {
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : product.stock;
    setDraft(String(next));
    if (next !== product.stock) onCommit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setDraft(String(product.stock));
      e.currentTarget.blur();
    }
  };

  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => commit(String(product.stock - 1))}
        disabled={product.stock <= 0}
        className="grid h-full w-7 place-items-center text-slate-500 transition hover:text-brand disabled:text-slate-300"
        aria-label={`${product.title} — үлдэгдэл хасах`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={onKeyDown}
        inputMode="numeric"
        aria-label={`${product.title} — үлдэгдэл`}
        className="h-full w-12 border-x border-slate-200 text-center text-sm font-semibold tabular-nums text-slate-900 focus:bg-brand-soft focus:outline-none"
      />
      <button
        type="button"
        onClick={() => commit(String(product.stock + 1))}
        className="grid h-full w-7 place-items-center text-slate-500 transition hover:text-brand"
        aria-label={`${product.title} — үлдэгдэл нэмэх`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
