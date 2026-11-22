import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Countdown from "@/components/store/home/Countdown";
import HeroCarousel from "@/components/store/home/HeroCarousel";
import LegacyHashRedirect from "@/components/store/home/LegacyHashRedirect";
import JsonLd from "@/components/store/JsonLd";
import NewArrivals from "@/components/store/home/NewArrivals";
import ProductCard from "@/components/store/product/ProductCard";
import CategoryIcon from "@/components/store/shell/CategoryIcon";
import { cn } from "@/components/ui";
import type { Banner, HomeSection } from "@/lib/content";
import type { CategoryNode } from "@/lib/categories";
import { discountPercent, formatMNT, type Product } from "@/lib/catalog";
import { listHomeSections, listLiveBanners } from "@/lib/server/repo/marketing";
import { categoryIcons, getAllCategories, getStoreProducts, getStoreShell } from "@/lib/server/storefront";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** design/Home (desktop) and design/MHome (phones). Sections follow Админ → Харагдах байдал. */
export default async function HomePage() {
  const [{ tree, settings, zones, paymentMethods }, products, categories, sections, banners] = await Promise.all([
    getStoreShell(),
    getStoreProducts(),
    getAllCategories(),
    listHomeSections(),
    listLiveBanners(),
  ]);
  const icons = categoryIcons(categories);
  const slugById = Object.fromEntries(tree.map((c) => [c.id, c.slug]));

  const render: Record<string, (s: HomeSection) => ReactNode> = {
    hero: (s) => (
      <Hero
        banners={banners.length > 0 ? banners : [fallbackBanner(settings.freeDeliveryThreshold, zones, products.some((p) => discountPercent(p) > 0))]}
        intervalMs={Number(s.config.intervalMs) || 5000}
      />
    ),
    usp: () => <Usp products={products} zones={zones} paymentMethods={paymentMethods} returnDays={settings.returnDays} />,
    categories: (s) => <Categories title={s.title} tree={tree.filter((c) => c.showOnHome)} />,
    flash_sale: (s) => <FlashSale title={s.title} config={s.config} products={products} icons={icons} />,
    promo_banners: () => <PromoTiles tree={tree} />,
    new_arrivals: (s) => <NewArrivalsSection title={s.title} limit={Number(s.config.limit) || 10} products={products} tree={tree} icons={icons} />,
  };

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-4 pb-16 lg:gap-12 lg:px-6 lg:pt-6">
      <LegacyHashRedirect slugById={slugById} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.storeName || SITE_NAME,
          url: `${siteUrl()}/`,
          potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
        }}
      />
      {sections
        .filter((s) => s.enabled && render[s.key])
        .map((s) => (
          // Phones: the category strip comes first (design/MHome), then the banner.
          <div key={s.key} className={cn("contents", s.key === "categories" && "max-lg:[&>*]:order-first")}>
            {render[s.key](s)}
          </div>
        ))}
    </main>
  );
}

/* ------------------------------------------------------------------- Hero */

/**
 * Until an admin publishes a banner, the hero states real facts (delivery time and the
 * free-delivery threshold from settings) instead of leaving a hole at the top of the page.
 */
function fallbackBanner(threshold: number, zones: { etaHours: number }[], hasDeals: boolean): Banner {
  const eta = range(zones.map((z) => z.etaHours));
  return {
    id: "fallback",
    title: eta ? `Улаанбаатарт ${eta[0]}–${eta[1]} цагт хүргэнэ` : "Улаанбаатар хот дотор хүргэнэ",
    subtitle: `${formatMNT(threshold)}-өөс дээш захиалгад хүргэлт үнэгүй.`,
    ctaLabel: hasDeals ? "Хямдралтай бараа" : "Ангиллууд үзэх",
    href: hasDeals ? "/search?sale=1" : "/c",
    imageDesktop: null,
    imageMobile: null,
    background: "var(--color-brand)",
    foreground: "#ffffff",
    startsAt: null,
    endsAt: null,
    active: true,
    sortOrder: 0,
  };
}

function Hero({ banners, intervalMs }: { banners: Banner[]; intervalMs: number }) {
  if (banners.length === 0) return null;
  // Two side cards take banners 2–3; the carousel gets the first and any beyond the third.
  const side = banners.slice(1, 3);
  const slides = [banners[0], ...banners.slice(3)];
  return (
    <section aria-label="Баннер" className={cn("grid gap-4", side.length > 0 && "lg:grid-cols-3")}>
      <div className={cn(side.length > 0 && "lg:col-span-2")}>
        <HeroCarousel slides={slides} intervalMs={intervalMs} />
      </div>
      {side.length > 0 && (
        <div className="hidden flex-col gap-4 lg:flex">
          {side.map((b) => (
            <Link
              key={b.id}
              href={b.href}
              className="flex flex-1 flex-col justify-end gap-1.5 rounded-xl p-7 transition-opacity hover:opacity-95"
              style={{ background: b.background, color: b.foreground }}
            >
              {b.ctaLabel && <span className="text-xs font-bold tracking-[0.08em] uppercase opacity-80">{b.ctaLabel}</span>}
              <span className="text-[22px] leading-[1.2] font-extrabold">{b.title}</span>
              {b.subtitle && <span className="text-sm opacity-75">{b.subtitle} →</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------- USP */

function range(values: number[]): [number, number] | null {
  const v = values.filter((n) => n > 0);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
}

/**
 * Promises taken from data, not copy: delivery hours from the zones, warranty months
 * from the products, payment methods from settings. No "official" claim (flaw #17).
 */
function Usp({
  products,
  zones,
  paymentMethods,
  returnDays,
}: {
  products: Product[];
  zones: { etaHours: number }[];
  paymentMethods: string[];
  returnDays: number;
}) {
  const eta = range(zones.map((z) => z.etaHours));
  const warranty = range(products.map((p) => p.warrantyMonths));
  const pay = [paymentMethods.includes("qpay") && "QPay", paymentMethods.includes("cod") && "бэлэн, карт"].filter(Boolean).join(", ");
  const items = [
    { icon: Truck, title: "Улаанбаатарт хүргэлт", text: eta ? `${eta[0] === eta[1] ? eta[0] : `${eta[0]}–${eta[1]}`} цагийн дотор` : "Хот дотор", mobile: "УБ-д хүргэлт" },
    {
      icon: ShieldCheck,
      title: "Баталгаат бараа",
      text: warranty ? `${warranty[0] === warranty[1] ? warranty[0] : `${warranty[0]}–${warranty[1]}`} сарын баталгаа` : "Баталгаатай",
      mobile: "Баталгаат бараа",
    },
    { icon: CreditCard, title: pay ? pay.charAt(0).toUpperCase() + pay.slice(1) : "Төлбөр", text: "Аюулгүй төлбөр", mobile: null },
    { icon: RotateCcw, title: `${returnDays} хоногт буцаалт`, text: "Нөхцөлийн дагуу", mobile: null },
  ];
  return (
    <section aria-label="Давуу тал" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {items.map((it) => (
        <div
          key={it.title}
          className={cn(
            "flex items-center gap-3.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3 lg:px-5 lg:py-[18px]",
            !it.mobile && "max-lg:hidden",
          )}
        >
          <span className="hidden size-11 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand lg:grid">
            <it.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold lg:text-[15px]">
              <span className="lg:hidden">{it.mobile ?? it.title}</span>
              <span className="hidden lg:inline">{it.title}</span>
            </span>
            <span className="text-xs text-slate-500 lg:text-[13px]">{it.text}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------- Categories */

function SectionHead({ title, href, tone, extra }: { title: string; href?: string; tone?: "sale"; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className={cn("text-xl font-extrabold tracking-[-0.02em] lg:text-[26px]", tone === "sale" && "text-danger")}>{title}</h2>
        {extra}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:text-brand-700">
          Бүгдийг харах →
        </Link>
      )}
    </div>
  );
}

function Categories({ title, tree }: { title: string; tree: CategoryNode[] }) {
  if (tree.length === 0) return null;
  return (
    <section aria-labelledby="home-categories" className="flex flex-col gap-[18px]">
      <div className="hidden lg:block">
        <SectionHead title={title} href="/c" />
      </div>
      <h2 id="home-categories" className="sr-only lg:hidden">
        {title}
      </h2>
      {/* Phones: one scrolling row of round icons. */}
      <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
        {tree.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center text-[11px] leading-[1.25] font-semibold">
            <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand">
              <CategoryIcon icon={c.icon} className="size-6" />
            </span>
            {c.name}
          </Link>
        ))}
      </div>
      <div className="hidden grid-cols-10 gap-3 lg:grid">
        {tree.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className="flex flex-col items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2 pt-[18px] pb-3.5 text-center transition-colors hover:border-brand-300"
          >
            <span className="grid size-[52px] place-items-center rounded-full bg-brand-50 text-brand">
              <CategoryIcon icon={c.icon} className="size-6" />
            </span>
            <span className="text-[13px] leading-[1.3] font-semibold">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Flash sale */

function FlashSale({
  title,
  config,
  products,
  icons,
}: {
  title: string;
  config: Record<string, unknown>;
  products: Product[];
  icons: Record<string, string | null>;
}) {
  const limit = Number(config.limit) || 5;
  const deals = products
    .filter((p) => p.stock > 0 && discountPercent(p) > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a))
    .slice(0, limit);
  if (deals.length === 0) return null;
  // A timer only for a real deadline set by an admin — never a fake daily reset.
  const endsAt = typeof config.endsAt === "string" ? config.endsAt : null;

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 lg:gap-[18px] lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-6"
    >
      <SectionHead title={title} tone="sale" href="/search?sale=1" extra={endsAt ? <Countdown endsAt={endsAt} /> : null} />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0">
        {deals.map((p, i) => (
          <ProductCard key={p.id} product={p} icon={icons[p.category] ?? null} priority={i < 5} className="w-[150px] shrink-0 snap-start lg:w-auto" />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Promo tiles */

const PROMO_TONES = [
  { bg: "bg-[#fef3c7]", eyebrow: "text-[#92400e]", text: "text-[#78350f]" },
  { bg: "bg-[#dcfce7]", eyebrow: "text-[#166534]", text: "text-[#14532d]" },
];

/**
 * The two wide tiles. Built from the two largest categories (name, real product count,
 * subcategories) rather than invented offers.
 */
function PromoTiles({ tree }: { tree: CategoryNode[] }) {
  const picks = [...tree].sort((a, b) => b.productCount - a.productCount).slice(0, 2);
  if (picks.length < 2) return null;
  return (
    <section aria-label="Сурталчилгаа" className="hidden gap-4 lg:grid lg:grid-cols-2">
      {picks.map((c, i) => {
        const tone = PROMO_TONES[i];
        const subs = c.children.slice(0, 3).map((s) => s.name);
        return (
          <Link key={c.id} href={`/c/${c.slug}`} className={cn("flex min-h-[180px] flex-col justify-center gap-2 rounded-xl p-8 transition-opacity hover:opacity-95", tone.bg)}>
            <span className={cn("text-xs font-bold tracking-[0.08em] uppercase", tone.eyebrow)}>{c.productCount} бараа</span>
            <span className="text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">{c.name}</span>
            <span className={cn("text-sm", tone.text)}>{subs.length ? `${subs.join(", ")} →` : "Бүгдийг үзэх →"}</span>
          </Link>
        );
      })}
    </section>
  );
}

/* ----------------------------------------------------------- New arrivals */

function NewArrivalsSection({
  title,
  limit,
  products,
  tree,
  icons,
}: {
  title: string;
  limit: number;
  products: Product[];
  tree: CategoryNode[];
  icons: Record<string, string | null>;
}) {
  const newest = [...products].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);
  if (newest.length === 0) return null;
  const counts = new Map<string, number>();
  for (const p of newest) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const tabs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .flatMap(([id]) => {
      const c = tree.find((t) => t.id === id);
      return c ? [{ id, label: c.name }] : [];
    });
  return <NewArrivals title={title} products={newest} tabs={tabs} icons={icons} />;
}
