import { Check, Clock, QrCode, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses, cn } from "@/components/ui";
import { ORDER_STATUS_FLOW, formatDateTime, paymentLabel, type Order } from "@/lib/admin-data";
import { formatMNT } from "@/lib/catalog";
import { verifyOrderToken } from "@/lib/server/order-token";
import { codConfirmHours, getOrder, reservationDeadline, reservationMinutes } from "@/lib/server/repo/orders";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> };

export const metadata: Metadata = {
  title: "Захиалга",
  robots: { index: false, follow: false },
};

type Step = { title: string; text: string; state: "done" | "current" | "todo" };

/** Timeline from the order's real status (design/OrderSuccess). */
function steps(order: Order): Step[] {
  const at = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
  const qpay = order.payment === "qpay";
  const state = (i: number): Step["state"] => (at > i ? "done" : at === i ? "current" : "todo");
  const delivery = order.deliveryDate ? `${order.deliveryDate.slice(5).replace("-", ".")}${order.deliverySlot ? ` · ${order.deliverySlot}` : ""}` : "Хүргэлтийн цагийг ажилтан тохирно";
  return [
    { title: "Захиалга үүссэн", text: formatDateTime(order.createdAt), state: "done" },
    qpay
      ? { title: order.paymentStatus === "paid" ? "Төлбөр төлөгдсөн" : "Төлбөр хүлээгдэж байна", text: "QPay-ээр төлнө үү", state: order.paymentStatus === "paid" ? "done" : "current" }
      : { title: at > 0 ? "Баталгаажсан" : "Баталгаажуулалт хүлээгдэж байна", text: "Ажилтан утсаар холбогдож баталгаажуулна", state: at > 0 ? "done" : "current" },
    { title: "Савлаж байна", text: "Агуулахаас гаргана", state: at >= 2 ? state(2) : "todo" },
    { title: "Хүргэлтэнд гарсан", text: delivery, state: at >= 3 ? state(3) : "todo" },
  ];
}

/** design/OrderSuccess. Reachable only through the link returned at checkout (?t=…). */
export default async function OrderPage({ params, searchParams }: Props) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const orderId = decodeURIComponent(id);
  if (!verifyOrderToken(orderId, t)) notFound();
  const order = await getOrder(orderId);
  if (!order) notFound();

  const cancelled = order.status === "cancelled" || order.status === "returned";
  const deadline = reservationDeadline(order);
  const qpayDue = order.payment === "qpay" && order.paymentStatus !== "paid" && !cancelled;

  return (
    <main className="mx-auto flex max-w-[1000px] flex-col gap-5 px-4 pt-6 pb-16 lg:flex-row lg:items-start lg:gap-6 lg:px-6 lg:pt-10">
      <section className="flex flex-1 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 lg:p-8">
        <span className={cn("grid size-14 place-items-center rounded-full", cancelled ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
          {cancelled ? <X className="size-7" aria-hidden="true" /> : <Check className="size-7" aria-hidden="true" />}
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] lg:text-[32px]">{cancelled ? "Захиалга цуцлагдсан" : "Захиалга хүлээн авлаа"}</h1>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Захиалгын дугаар <b className="text-slate-900">{order.id}</b>.{" "}
            {cancelled
              ? "Асуулт байвал лавлах утсаар холбогдоно уу."
              : order.payment === "qpay"
                ? "Төлбөр төлөгдмөгц захиалга баталгаажна."
                : `Ажилтан ${order.phone} дугаарт холбогдож баталгаажуулна.`}
          </p>
          {deadline && !cancelled && (
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-warning-ink">
              <Clock className="size-4" aria-hidden="true" />
              {order.payment === "qpay"
                ? `${formatDateTime(deadline).slice(11)}-аас өмнө төлөөгүй бол (${reservationMinutes()} минут) захиалга автоматаар цуцлагдана.`
                : `${codConfirmHours()} цагийн дотор баталгаажаагүй захиалга автоматаар цуцлагдана.`}
            </p>
          )}
        </div>

        {!cancelled && (
          <ol className="flex flex-col">
            {steps(order).map((s, i, all) => (
              <li key={s.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                {i < all.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-slate-200" />}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] mt-0.5 size-6 shrink-0 rounded-full",
                    s.state === "done" ? "bg-success" : s.state === "current" ? "border-2 border-brand bg-white" : "border-2 border-slate-300 bg-white",
                  )}
                />
                <span className="flex flex-col">
                  <b className={cn("text-[15px] font-bold", s.state === "todo" && "text-slate-500")}>{s.title}</b>
                  <span className="text-[13px] text-slate-500">{s.text}</span>
                  <span className="sr-only">{s.state === "done" ? "(дууссан)" : s.state === "current" ? "(одоо)" : ""}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <ul className="flex flex-col gap-1.5">
            {order.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-slate-700">
                  {l.title}
                  {l.variantName ? ` (${l.variantName})` : ""} × {l.quantity}
                </span>
                <span className="tabular-nums">{formatMNT(l.unitPrice * l.quantity)}</span>
              </li>
            ))}
            {order.discount > 0 && (
              <li className="flex justify-between text-slate-600">
                <span>Купон {order.couponCode}</span>
                <span className="text-danger tabular-nums">−{formatMNT(order.discount)}</span>
              </li>
            )}
            <li className="flex justify-between text-slate-600">
              <span>Хүргэлт ({order.district})</span>
              <span className="tabular-nums">{order.deliveryFee === 0 ? "Үнэгүй" : formatMNT(order.deliveryFee)}</span>
            </li>
            <li className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span>Нийт · {paymentLabel(order.payment)}</span>
              <span className="tabular-nums">{formatMNT(order.total)}</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonClasses({ size: "lg" })}>
            Дэлгүүр үргэлжлүүлэх
          </Link>
          <Link href="/track" className={buttonClasses({ variant: "outline", size: "lg" })}>
            Захиалга хянах
          </Link>
        </div>
      </section>

      {qpayDue && (
        <aside aria-label="QPay төлбөр" className="flex flex-col items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-7 text-center lg:w-[360px]">
          <h2 className="text-base font-bold">QPay-ээр төлөх</h2>
          {/* No QPay merchant connection yet (backend integration is a separate task): no fake QR. */}
          <div className="grid size-[200px] place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400">
            <span className="flex flex-col items-center gap-2 px-6 text-xs">
              <QrCode className="size-10" aria-hidden="true" />
              QPay холболт тохируулагдсаны дараа QR код энд гарна
            </span>
          </div>
          <span className="text-[28px] font-extrabold tabular-nums">{formatMNT(order.total)}</span>
          {deadline && <span className="text-[13px] text-slate-500">{formatDateTime(deadline).slice(11)} хүртэл хүчинтэй</span>}
        </aside>
      )}
    </main>
  );
}
