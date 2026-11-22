"use client";

import { ArrowLeft, Check, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Input, Select, Textarea, buttonClasses, cn } from "@/components/ui";
import type { PaymentMethod } from "@/lib/admin-data";
import { ApiError, api } from "@/lib/api-client";
import { formatMNT } from "@/lib/catalog";
import { estimateDelivery, type DeliverySlot, type DeliveryZone } from "@/lib/delivery";
import CouponField from "../cart/CouponField";
import { useCart } from "../cart/CartProvider";
import { useQuote } from "../cart/useQuote";
import ProductImage from "../product/ProductImage";

const ZONE_KEY = "hotulan.zone";
const CONTACT_KEY = "hotulan.contact";

const PAYMENT_TEXT: Record<PaymentMethod, { title: string; text: string }> = {
  qpay: { title: "QPay", text: "Бүх банкны аппаар QR уншуулж төлнө" },
  cod: { title: "Хүлээн авахдаа төлөх", text: "Бэлэн эсвэл картаар жолоочид" },
};

interface Props {
  zones: DeliveryZone[];
  slots: DeliverySlot[];
  paymentMethods: PaymentMethod[];
  nextDayCutoff: string;
  icons: Record<string, string | null>;
}

interface SlotOption {
  key: string;
  date: string;
  slotId: string;
  day: string;
  time: string;
}

/** Delivery choices: every active slot on the zone's earliest day and the day after. */
function slotOptions(zone: DeliveryZone | null, slots: DeliverySlot[], cutoff: string, now: number): SlotOption[] {
  if (!zone || slots.length === 0) return [];
  const first = estimateDelivery(zone, cutoff, now);
  const days = [first, { days: first.days + 1 }].map((d) => {
    const dt = new Date(now + 8 * 3600_000 + d.days * 86_400_000);
    const date = dt.toISOString().slice(0, 10);
    const md = `${String(dt.getUTCMonth() + 1).padStart(2, "0")}.${String(dt.getUTCDate()).padStart(2, "0")}`;
    return { date, day: d.days === 1 ? "Маргааш" : d.days === 2 ? "Нөгөөдөр" : md };
  });
  return days.flatMap((d) => slots.map((s) => ({ key: `${d.date}|${s.id}`, date: d.date, slotId: s.id, day: d.day, time: s.label })));
}

/** `title` on desktop; phones use the shorter `short` (design/MCheckout). */
function Card({ title, short, aside, children }: { title: string; short: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:gap-[18px] lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold lg:text-lg">
          <span className="lg:hidden">{short}</span>
          <span className="hidden lg:inline">{title}</span>
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Steps() {
  const dot = "grid size-7 place-items-center rounded-full text-sm";
  return (
    <ol aria-label="Алхам" className="hidden items-center gap-2 text-sm font-semibold lg:flex">
      <li className="flex items-center gap-2 text-success">
        <span className={cn(dot, "bg-success-soft")}>
          <Check className="size-4" aria-hidden="true" />
        </span>
        Сагс
      </li>
      <li aria-hidden="true" className="h-0.5 w-8 bg-slate-300" />
      <li aria-current="step" className="flex items-center gap-2 text-brand">
        <span className={cn(dot, "bg-brand text-white")}>2</span>
        Хүргэлт, төлбөр
      </li>
      <li aria-hidden="true" className="h-0.5 w-8 bg-slate-300" />
      <li className="flex items-center gap-2 text-slate-500">
        <span className={cn(dot, "bg-slate-200")}>3</span>
        Баталгаажуулалт
      </li>
    </ol>
  );
}

/** design/Checkout (desktop) and design/MCheckout (phones). */
export default function CheckoutForm({ zones, slots, paymentMethods, nextDayCutoff, icons }: Props) {
  const router = useRouter();
  const cart = useCart();
  const { items, ready } = cart;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [khoroo, setKhoroo] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">(paymentMethods[0] ?? "");
  const [ebarimt, setEbarimt] = useState<"person" | "company">("person");
  const [regNo, setRegNo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Restore this device's last district and contact (never sent anywhere until the order).
  useEffect(() => {
    setNow(Date.now());
    try {
      const z = window.localStorage.getItem(ZONE_KEY);
      if (z && zones.some((x) => x.id === z)) setZoneId(z);
      const c = JSON.parse(window.localStorage.getItem(CONTACT_KEY) ?? "null") as { name?: string; phone?: string } | null;
      if (c?.name) setName(c.name);
      if (c?.phone) setPhone(c.phone);
    } catch {}
  }, [zones]);

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const options = useMemo(() => (now === null ? [] : slotOptions(zone, slots, nextDayCutoff, now)), [zone, slots, nextDayCutoff, now]);
  useEffect(() => {
    if (options.length && !options.some((o) => o.key === slotKey)) setSlotKey(options[0].key);
  }, [options, slotKey]);
  const slot = options.find((o) => o.key === slotKey) ?? null;

  const phoneDigits = phone.replace(/[\s-]/g, "");
  const { quote, loading } = useQuote(items, {
    enabled: ready && items.length > 0,
    zoneId: zoneId || null,
    couponCode: cart.coupon,
    phone: /^\d{8}$/.test(phoneDigits) ? phoneDigits : null,
  });

  const errors = {
    name: name.trim().length < 2 ? "Нэрээ оруулна уу." : null,
    phone: !/^\d{8}$/.test(phoneDigits) ? "8 оронтой дугаар оруулна уу." : null,
    zone: !zone ? "Дүүргээ сонгоно уу." : null,
    khoroo: !khoroo ? "Хороогоо сонгоно уу." : null,
    address: address.trim().length < 3 ? "Байр, орц, тоотоо бичнэ үү." : null,
    payment: !payment ? "Төлбөрийн хэлбэр сонгоно уу." : null,
    regNo: ebarimt === "company" && !/^\d{7}$/.test(regNo.trim()) ? "Байгууллагын 7 оронтой РД." : null,
  };
  const show = (k: keyof typeof errors) => (submitted ? (errors[k] ?? undefined) : undefined);
  const blockingLine = quote?.lines.find((l) => l.problem);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.values(errors).some(Boolean) || submitting || items.length === 0) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ accessUrl: string }>("/api/orders", {
        method: "POST",
        body: {
          customer: name.trim(),
          phone: phoneDigits,
          zoneId,
          khoroo: Number(khoroo),
          address: address.trim(),
          deliveryNote: note.trim() || undefined,
          deliveryDate: slot?.date,
          slotId: slot?.slotId,
          payment,
          couponCode: cart.coupon ?? undefined,
          ebarimtType: ebarimt,
          ebarimtRegNo: ebarimt === "company" ? regNo.trim() : undefined,
          lines: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
        },
      });
      try {
        window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim(), phone }));
        window.localStorage.setItem(ZONE_KEY, zoneId);
      } catch {}
      cart.clear();
      router.replace(res.accessUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) void cart.refresh();
      setServerError(err instanceof Error ? err.message : "Захиалга илгээхэд алдаа гарлаа.");
      setSubmitting(false);
    }
  };

  if (ready && items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-xl bg-brand-50 text-brand">
          <ShoppingBag className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">Сагс хоосон байна</h1>
        <p className="text-sm text-slate-500">Захиалга өгөхийн тулд эхлээд бараа сагсандаа нэмнэ үү.</p>
        <Link href="/" className={cn(buttonClasses(), "mt-2")}>
          Дэлгүүр хэсэх
        </Link>
      </div>
    );
  }

  const subtotal = quote?.subtotal ?? cart.subtotal;
  const fee = quote?.deliveryFee ?? null;
  const total = quote?.total ?? subtotal;
  const feeLabel = fee === null ? "Дүүрэг сонгоно уу" : fee === 0 ? "Үнэгүй" : formatMNT(fee);

  const summary = (
    <aside aria-label="Захиалгын дүн" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6 lg:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold lg:text-lg">Таны сагс</h2>
        <span className="text-sm text-slate-500">{cart.count} бараа</span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {items.map((i) => {
          const problem = quote?.lines.find((l) => l.productId === i.productId && l.variantId === i.variantId)?.problem;
          return (
            <li key={i.key} className="flex items-center gap-3">
              <ProductImage id={i.productId} src={i.product.image} alt="" icon={icons[i.product.category] ?? null} iconClassName="size-5" className="size-[60px] shrink-0 rounded-[10px]" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm font-semibold">
                  {i.product.title}
                  {i.variant ? ` — ${i.variant.name}` : ""}
                </span>
                <span className="text-xs text-slate-500">{i.quantity} ш</span>
                {problem && <span className="text-xs font-medium text-danger-ink">{problem}</span>}
              </div>
              <span className="text-sm font-bold tabular-nums">{formatMNT(i.unitPrice * i.quantity)}</span>
            </li>
          );
        })}
      </ul>
      <CouponField coupon={cart.coupon} setCoupon={cart.setCoupon} result={quote?.coupon ?? undefined} />
      <dl className={cn("flex flex-col gap-2.5 border-t border-slate-200 pt-4 text-sm text-slate-600 transition-opacity", loading && "opacity-60")}>
        <div className="flex justify-between">
          <dt>Барааны дүн</dt>
          <dd className="tabular-nums">{formatMNT(subtotal)}</dd>
        </div>
        {(quote?.discount ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Купон ({quote!.coupon?.code})</dt>
            <dd className="font-semibold text-danger tabular-nums">−{formatMNT(quote!.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Хүргэлт{quote?.zone ? ` (${quote.zone.name})` : ""}</dt>
          <dd className={cn("tabular-nums", fee === 0 && "font-semibold text-success")}>{feeLabel}</dd>
        </div>
      </dl>
      <div className="flex items-baseline justify-between border-t border-slate-200 pt-4">
        <span className="font-bold">Нийт төлөх</span>
        <span className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums">{formatMNT(total)}</span>
      </div>
      {serverError && <Alert tone="danger" title="Захиалга илгээгдсэнгүй" description={serverError} />}
      <button
        type="submit"
        form="checkout"
        disabled={submitting || !!blockingLine}
        aria-busy={submitting || undefined}
        className="hidden h-[52px] items-center justify-center rounded-md bg-brand text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 lg:flex"
      >
        {submitting ? "Илгээж байна…" : "Захиалга батлах"}
      </button>
      <p className="text-center text-xs leading-relaxed text-slate-500">
        Захиалга батлаж{" "}
        <Link href="/info/terms" className="text-brand">
          үйлчилгээний нөхцөл
        </Link>
        -ийг зөвшөөрч байна. Улаанбаатар хотоос гадна хүргэлт хийгдэхгүй.
      </p>
    </aside>
  );

  return (
    <>
      {/* Phones: step header (design/MCheckout). */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-14 items-center gap-2 px-2">
          <button type="button" onClick={() => router.back()} aria-label="Буцах" className="grid size-11 place-items-center">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <h1 className="flex-1 text-[17px] font-bold">Захиалга</h1>
          <span className="pr-3 text-sm text-slate-500">2 / 3</span>
        </div>
        <div className="h-1 bg-slate-200" aria-hidden="true">
          <div className="h-full w-2/3 bg-brand" />
        </div>
      </div>

      <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-4 pb-32 lg:gap-6 lg:px-6 lg:pt-7 lg:pb-16">
        <div className="hidden flex-wrap items-center justify-between gap-4 lg:flex">
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">Захиалга баталгаажуулах</h1>
          <Steps />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <form id="checkout" noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_600px] lg:gap-5">
            <Card title="1. Хүлээн авагч" short="Хүлээн авагч">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Нэр" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Б. Сарангэрэл" error={show("name")} />
                <Input
                  label="Утас"
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  controlClassName="tabular-nums"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9911-2345"
                  error={show("phone")}
                />
              </div>
            </Card>

            <Card
              title="2. Хүргэлтийн хаяг"
              short="Хаяг"
              aside={
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  <span className="lg:hidden">Зөвхөн УБ</span>
                  <span className="hidden lg:inline">Зөвхөн Улаанбаатар хот</span>
                </span>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Хот" value="Улаанбаатар" disabled className="max-sm:hidden" />
                <Select
                  label="Дүүрэг"
                  required
                  value={zoneId}
                  onChange={(e) => {
                    setZoneId(e.target.value);
                    setKhoroo("");
                  }}
                  placeholder="Сонгох…"
                  error={show("zone")}
                  options={zones.map((z) => ({ value: z.id, label: z.region === "remote" ? `${z.name} (${formatMNT(z.fee)})` : z.name }))}
                />
                <Select
                  label="Хороо"
                  required
                  value={khoroo}
                  onChange={(e) => setKhoroo(e.target.value)}
                  placeholder={zone ? "Сонгох…" : "Эхлээд дүүрэг"}
                  disabled={!zone}
                  error={show("khoroo")}
                  options={Array.from({ length: zone?.khorooCount ?? 0 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}-р хороо` }))}
                />
                <Input label="Байр, орц, тоот" required autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Зайсан, 52-р байр, 2 орц, 41 тоот" error={show("address")} />
              </div>
              <Textarea label="Жолоочид өгөх тэмдэглэл" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Орцны код, ирэхээс өмнө залгах гэх мэт" />
              {options.length > 0 && (
                <fieldset className="flex flex-col gap-2.5">
                  <legend className="mb-2.5 text-[13px] font-semibold">Хүргэлтийн цаг</legend>
                  <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
                    {options.map((o) => {
                      const on = o.key === slotKey;
                      return (
                        <label
                          key={o.key}
                          className={cn(
                            "flex min-w-[120px] shrink-0 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3",
                            on ? "border-2 border-brand bg-brand-50" : "border-slate-300 bg-white hover:border-slate-400",
                          )}
                        >
                          <input type="radio" name="slot" value={o.key} checked={on} onChange={() => setSlotKey(o.key)} className="size-4.5 accent-brand" />
                          <span className="flex flex-col text-[13px] leading-tight lg:text-sm">
                            <b className="font-semibold">{o.day}</b>
                            <span className="text-slate-600">{o.time}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </Card>

            <Card title="3. Төлбөрийн хэлбэр" short="Төлбөр">
              <div role="radiogroup" aria-label="Төлбөрийн хэлбэр" className="flex flex-col gap-3">
                {paymentMethods.map((m, idx) => {
                  const on = payment === m;
                  return (
                    <label
                      key={m}
                      className={cn("flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3.5 lg:py-4", on ? "border-2 border-brand bg-brand-50" : "border border-slate-300 bg-white hover:border-slate-400")}
                    >
                      <input type="radio" name="payment" value={m} checked={on} onChange={() => setPayment(m)} className="size-5 accent-brand" />
                      <span className="flex flex-1 flex-col">
                        <b className="text-base font-bold">{PAYMENT_TEXT[m].title}</b>
                        <span className="hidden text-[13px] text-slate-600 sm:block">{PAYMENT_TEXT[m].text}</span>
                      </span>
                      {idx === 0 && paymentMethods.length > 1 && <span className="hidden rounded-sm bg-brand px-2 py-1 text-xs font-bold text-white sm:inline">Санал болгох</span>}
                    </label>
                  );
                })}
                {show("payment") && <p className="text-xs font-medium text-danger-ink">{show("payment")}</p>}
              </div>
              <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <legend className="sr-only">И-баримт</legend>
                <span aria-hidden="true" className="text-sm font-bold">
                  И-баримт:
                </span>
                {(["person", "company"] as const).map((v) => (
                  <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="ebarimt" checked={ebarimt === v} onChange={() => setEbarimt(v)} className="size-4 accent-brand" />
                    {v === "person" ? "Хувь хүн" : "Байгууллага (РД)"}
                  </label>
                ))}
                {ebarimt === "company" && (
                  <Input label="Байгууллагын РД" inputMode="numeric" value={regNo} onChange={(e) => setRegNo(e.target.value)} error={show("regNo")} className="w-full sm:w-60" />
                )}
              </fieldset>
            </Card>
          </form>
          <div className="lg:flex-[1_1_340px] lg:max-w-[400px]">{summary}</div>
        </div>
      </main>

      {/* Phones: sticky total + confirm (design/MCheckout). */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex flex-1 flex-col">
          <span className="text-xs text-slate-500">{fee === null ? "Нийт" : `Нийт · хүргэлт ${feeLabel.toLowerCase()}`}</span>
          <span className="text-xl font-extrabold tabular-nums">{formatMNT(total)}</span>
        </div>
        <button
          type="submit"
          form="checkout"
          disabled={submitting || !!blockingLine}
          className="h-[52px] flex-[1.2] rounded-md bg-brand text-base font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
        >
          {submitting ? "Илгээж байна…" : "Батлах"}
        </button>
      </div>
    </>
  );
}
