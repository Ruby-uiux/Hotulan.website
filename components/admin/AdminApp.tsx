"use client";

import { AlertCircle, Bell, CheckCircle2, LogOut, Menu } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { api } from "@/lib/api-client";
import {
  STATUS_META,
  byNewest,
  type AdminView,
  type Order,
  type OrderStatus,
  type StoreSettings,
} from "@/lib/admin-data";
import DashboardView from "./DashboardView";
import OrdersView from "./OrdersView";
import ProductsView, { type StockFilter } from "./ProductsView";
import SettingsView from "./SettingsView";
import Sidebar, { NAV_ITEMS } from "./Sidebar";

const VIEW_SUBTITLE: Record<AdminView, string> = {
  dashboard: "Борлуулалт, захиалга, агуулахын товч тойм",
  products: "Бараа нэмэх, засах, үлдэгдэл шинэчлэх",
  orders: "Ирсэн захиалгыг шийдвэрлэх, төлөв шинэчлэх",
  settings: "Дэлгүүрийн ерөнхий тохиргоо",
};

/** How often the panel pulls new orders and stock changes made by shoppers. */
const POLL_INTERVAL_MS = 15_000;

interface AdminAppProps {
  initialProducts: Product[];
  initialOrders: Order[];
  initialSettings: StoreSettings;
  /** Server render time — keeps the 7-day chart identical between SSR and hydration. */
  renderedAt: string;
  /** Signed-in operator, from the verified session. */
  adminName: string;
}

type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminApp({ initialProducts, initialOrders, initialSettings, renderedAt, adminName }: AdminAppProps) {
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // Hard navigation drops all in-memory admin data from the page.
      window.location.assign("/admin/login");
    }
  }, []);
  const initials =
    adminName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  const [view, setView] = useState<AdminView>("dashboard");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>(() => [...initialOrders].sort(byNewest));
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [now, setNow] = useState(() => new Date(renderedAt));

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Dashboard shortcuts can open the product list pre-filtered (e.g. "low stock"). */
  const [productPreset, setProductPreset] = useState<{ stockFilter: StockFilter; nonce: number }>({ stockFilter: "all", nonce: 0 });
  const [toast, setToast] = useState<Toast | null>(null);

  /**
   * Bumped on every local mutation. A poll that started before a mutation is discarded,
   * otherwise its (older) snapshot could briefly undo an optimistic update.
   */
  const mutationSeq = useRef(0);
  const knownOrderIds = useRef(new Set(initialOrders.map((o) => o.id)));

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.tone === "error" ? 5000 : 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);
  const notifyError = useCallback(
    (err: unknown, fallback: string) => notify(err instanceof Error ? err.message : fallback, "error"),
    [notify],
  );

  // ——— Live sync with the storefront ———

  const pull = useCallback(async () => {
    const seqAtStart = mutationSeq.current;
    try {
      const [{ orders: freshOrders }, { products: freshProducts }] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders"),
        api<{ products: Product[] }>("/api/products"),
      ]);
      if (seqAtStart !== mutationSeq.current) return;

      const arrived = freshOrders.filter((o) => !knownOrderIds.current.has(o.id));
      knownOrderIds.current = new Set(freshOrders.map((o) => o.id));
      setOrders(freshOrders);
      setProducts(freshProducts);
      setNow(new Date());
      if (arrived.length > 0) {
        notify(arrived.length === 1 ? `Шинэ захиалга: ${arrived[0].id} — ${arrived[0].customer}` : `${arrived.length} шинэ захиалга ирлээ`);
      }
    } catch {
      // Transient network blips are retried on the next tick; no toast spam.
    }
  }, [notify]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void pull();
    };
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pull]);

  const navigate = useCallback((next: AdminView, preset?: { stockFilter?: StockFilter }) => {
    if (next === "products") {
      setProductPreset((p) => ({ stockFilter: preset?.stockFilter ?? "all", nonce: p.nonce + 1 }));
    }
    setView(next);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  // ——— Product mutations ———

  /** Throws on failure so the form can show the server's message and stay open. */
  const saveProduct = useCallback(
    async (draft: Product) => {
      mutationSeq.current++;
      const isNew = !products.some((p) => p.id === draft.id);
      const { product } = isNew
        ? await api<{ product: Product }>("/api/products", { method: "POST", body: draft })
        : await api<{ product: Product }>(`/api/products/${encodeURIComponent(draft.id)}`, { method: "PUT", body: draft });

      setProducts((prev) => (isNew ? [product, ...prev] : prev.map((p) => (p.id === product.id ? product : p))));
      notify(isNew ? "Шинэ бараа нэмэгдэж, дэлгүүрт нийтлэгдлээ" : "Барааны мэдээлэл шинэчлэгдлээ");
    },
    [notify, products],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      mutationSeq.current++;
      try {
        await api(`/api/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        notify("Бараа устгагдлаа");
      } catch (err) {
        notifyError(err, "Устгахад алдаа гарлаа.");
      }
    },
    [notify, notifyError],
  );

  /** Optimistic: the stepper must feel instant during restocking; rolled back if the server refuses. */
  const changeStock = useCallback(
    async (productId: string, stock: number) => {
      mutationSeq.current++;
      const previous = products.find((p) => p.id === productId)?.stock;
      const next = Math.max(0, Math.floor(stock));
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: next } : p)));
      try {
        await api(`/api/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: { stock: next } });
      } catch (err) {
        if (previous !== undefined) {
          setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: previous } : p)));
        }
        notifyError(err, "Үлдэгдэл хадгалагдсангүй.");
      }
    },
    [products, notifyError],
  );

  // ——— Order mutations ———

  const changeOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      mutationSeq.current++;
      const previous = orders.find((o) => o.id === orderId)?.status;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      try {
        await api(`/api/orders/${encodeURIComponent(orderId)}`, { method: "PATCH", body: { status } });
        notify(`${orderId} → ${STATUS_META[status].label}`);
      } catch (err) {
        if (previous) setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: previous } : o)));
        notifyError(err, "Төлөв хадгалагдсангүй.");
      }
    },
    [orders, notify, notifyError],
  );

  const saveSettings = useCallback(
    async (next: StoreSettings) => {
      mutationSeq.current++;
      try {
        const { settings: saved } = await api<{ settings: StoreSettings }>("/api/settings", { method: "PUT", body: next });
        setSettings(saved);
        notify("Тохиргоо хадгалагдлаа");
      } catch (err) {
        notifyError(err, "Тохиргоо хадгалагдсангүй.");
      }
    },
    [notify, notifyError],
  );

  const resetDemoData = useCallback(async () => {
    mutationSeq.current++;
    try {
      const data = await api<{ products: Product[]; orders: Order[] }>("/api/admin/reset", { method: "POST" });
      setProducts(data.products);
      setOrders(data.orders);
      knownOrderIds.current = new Set(data.orders.map((o) => o.id));
      notify("Демо өгөгдөл анхны байдалд орлоо");
    } catch (err) {
      notifyError(err, "Сэргээхэд алдаа гарлаа.");
    }
  }, [notify, notifyError]);

  const badges = useMemo(
    () => ({
      orders: orders.filter((o) => o.status === "new").length,
      products: products.filter((p) => p.stock <= settings.lowStockThreshold).length,
    }),
    [orders, products, settings.lowStockThreshold],
  );

  const activeLabel = NAV_ITEMS.find((n) => n.id === view)?.label ?? "";

  return (
    <div className="flex min-h-screen bg-slate-100/70">
      <Sidebar
        view={view}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        badges={badges}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Цэс нээх"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{activeLabel}</h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">{VIEW_SUBTITLE[view]}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 md:flex" title="15 секунд тутам шинэчлэгдэнэ">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Дэлгүүртэй холбогдсон
            </span>
            <button
              type="button"
              onClick={() => navigate("orders")}
              className="relative grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={badges.orders > 0 ? `${badges.orders} шинэ захиалга` : "Шинэ захиалга алга"}
            >
              <Bell className="h-5 w-5" />
              {badges.orders > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-white" />}
            </button>
            <div className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 sm:border sm:border-slate-200">
              <span className="grid h-7 w-7 place-items-center rounded-sm bg-slate-900 text-xs font-bold text-white">{initials}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[10rem] truncate text-xs font-semibold text-slate-900">{adminName}</span>
                <span className="block text-[11px] text-slate-500">Админ</span>
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              title="Гарах"
              className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
              aria-label="Системээс гарах"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
          {view === "dashboard" && (
            <DashboardView
              products={products}
              orders={orders}
              lowStockThreshold={settings.lowStockThreshold}
              onNavigate={navigate}
              now={now}
            />
          )}
          {view === "products" && (
            <ProductsView
              key={productPreset.nonce}
              products={products}
              lowStockThreshold={settings.lowStockThreshold}
              initialStockFilter={productPreset.stockFilter}
              onSave={saveProduct}
              onDelete={deleteProduct}
              onStockChange={changeStock}
            />
          )}
          {view === "orders" && <OrdersView orders={orders} onStatusChange={changeOrderStatus} />}
          {view === "settings" && (
            <SettingsView
              key={JSON.stringify(settings)}
              settings={settings}
              onSave={saveSettings}
              onResetDemoData={resetDemoData}
            />
          )}
        </main>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60] max-w-sm">
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : undefined}
            className={`flex animate-pop-in items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-2xl ${
              toast.tone === "error" ? "bg-rose-700" : "bg-slate-900"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="mt-px h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-px h-4.5 w-4.5 shrink-0 text-emerald-400" aria-hidden="true" />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
