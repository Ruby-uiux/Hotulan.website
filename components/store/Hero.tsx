import { ArrowRight, ArrowUpRight, BadgeCheck, CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";
import { formatMNT } from "@/lib/catalog";
import SafeImage from "./SafeImage";

/** Per root-category id; categories with no visible products are simply absent. */
export type CategorySummary = Record<string, { count: number; minPrice: number | null }>;

interface HeroProps {
  /** Live per-category counts so tile captions never drift from the actual catalog. */
  categories: CategorySummary;
  freeDeliveryThreshold: number;
  supportPhone: string;
}

function tileMeta({ count, minPrice }: { count: number; minPrice: number | null }, withPrice: boolean): string {
  if (count === 0) return "Удахгүй";
  return withPrice && minPrice !== null ? `${count} бараа · ${formatMNT(minPrice)}-өөс` : `${count} бараа`;
}

const photo = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Each tile is a category shortcut; StoreFront turns the hash into a filter + scroll. */
const CATEGORY_TILES = [
  {
    href: "#category-toys",
    category: "toys",
    label: "Хүүхдийн тоглоом",
    withPrice: true,
    image: photo("photo-1587654780291-39c9404d746b", 1000),
    alt: "Өнгө өнгийн барилгын блок",
    layout: "col-span-2 row-span-2 sm:col-span-1",
  },
  {
    href: "#category-home",
    category: "home",
    label: "Гэр ахуй",
    withPrice: false,
    image: photo("photo-1556228453-efd6c1ff04f6"),
    alt: "Орчин үеийн гал тогоо",
    layout: "col-span-1",
  },
  {
    href: "#category-electronics",
    category: "electronics",
    label: "Цахилгаан бараа",
    withPrice: false,
    image: photo("photo-1505740420928-5e560c06d30e"),
    alt: "Утасгүй чихэвч",
    layout: "col-span-1",
  },
] as const;

const STATS = [
  { value: "25,000+", label: "Сэтгэл хангалуун хэрэглэгч" },
  { value: "4.8/5", label: "Дундаж үнэлгээ" },
  { value: "24 цаг", label: "УБ хотод хүргэлт" },
] as const;

/** Server component — interactivity is plain anchors, so the hero ships no JavaScript. */
export default function Hero({ categories, freeDeliveryThreshold, supportPhone }: HeroProps) {
  const ASSURANCES = [
    { icon: ShieldCheck, title: "Албан ёсны баталгаа", body: "2 жил хүртэл" },
    { icon: Truck, title: "Хурдан хүргэлт", body: `${formatMNT(freeDeliveryThreshold)}-өөс үнэгүй` },
    { icon: Headphones, title: "24/7 тусламж", body: supportPhone },
    { icon: CreditCard, title: "Аюулгүй төлбөр", body: "QPay · Дансаар · Хүлээн авахдаа" },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-slate-200 bg-white">
      {/* Faint dot grid on the left only: gives texture behind the headline without competing with imagery. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[size:22px_22px] opacity-40 [mask-image:linear-gradient(to_right,black,transparent)]"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 md:pt-14 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-16 lg:pt-16">
        <div className="flex flex-col justify-center lg:col-span-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-700 shadow-sm">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-white">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Албан ёсны
            </span>
            <span className="whitespace-nowrap">Эрхтэй борлуулагч</span>
          </p>

          <h1
            id="hero-title"
            className="mt-6 text-[2rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]"
          >
            Хүүхдийн тоглоом ба Гэр ахуйн барааны{" "}
            <span className="relative text-brand sm:whitespace-nowrap">
              албан ёсны дэлгүүр
              <svg
                aria-hidden="true"
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-2.5 w-full text-brand/25"
              >
                <path d="M2 9C60 3 140 1 298 6" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Үйлдвэрлэгчийн баталгаатай, жинхэнэ бараа. Өнөөдөр захиалаад маргааш гэртээ хүлээн аваарай —
            Улаанбаатар хотод 24 цагийн дотор хүргэнэ.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#category-all"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark"
            >
              Бүх бараа үзэх
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href="#category-toys"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-brand hover:text-brand"
            >
              Тоглоомын ангилал
            </a>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-4 first:pl-0">
                <dt className="sr-only">{label}</dt>
                <dd className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{value}</dd>
                <dd className="mt-0.5 text-xs leading-snug text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <nav aria-label="Онцлох ангилал" className="lg:col-span-6">
          <ul className="grid h-full auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:gap-4 lg:auto-rows-[1fr]">
            {CATEGORY_TILES.map((tile, i) => (
              <li key={tile.href} className={tile.layout}>
                <a
                  href={tile.href}
                  className="group relative block h-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
                >
                  <SafeImage
                    eager={i === 0}
                    src={tile.image}
                    alt={tile.alt}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                    <span>
                      <span className="block text-base font-bold text-white sm:text-lg">{tile.label}</span>
                      <span className="block text-xs text-white/75">{tileMeta(categories[tile.category] ?? { count: 0, minPrice: null }, tile.withPrice)}</span>
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-900 transition group-hover:bg-brand group-hover:text-white">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                </a>
              </li>
            ))}

            <li className="col-span-2">
              <a
                href="#category-sports"
                className="group relative flex h-full items-center justify-between gap-4 overflow-hidden rounded-2xl bg-brand p-5 text-white sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[28px] border-white/10"
                />
                <span className="relative">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                    Өвлийн улирлын хямдрал
                  </span>
                  <span className="mt-1 block text-xl font-extrabold sm:text-2xl">30% хүртэл хөнгөлөлт</span>
                  <span className="mt-1 block text-sm text-white/80">Спорт ба фитнесийн бараа</span>
                </span>
                <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-brand transition group-hover:bg-blue-50">
                  Үзэх
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="relative border-t border-slate-200 bg-slate-50/80">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {ASSURANCES.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className={`flex items-center gap-3 py-4 ${i % 2 === 1 ? "pl-4" : "pr-4"} lg:px-6 lg:first:pl-0 ${
                i > 0 ? "lg:border-l lg:border-slate-200" : ""
              } ${i < 2 ? "border-b border-slate-200 lg:border-b-0" : ""}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-brand ring-1 ring-slate-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="block truncate text-xs text-slate-500">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
