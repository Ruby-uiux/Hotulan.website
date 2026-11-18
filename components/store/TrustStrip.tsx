import { CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "100% Албан ёсны баталгаа",
    body: "Бүх бараа үйлдвэрлэгчийн албан ёсны баталгаатай, 2 жил хүртэлх засвар үйлчилгээтэй.",
  },
  {
    icon: Headphones,
    title: "24/7 Цагийн тусламж",
    body: "Утас, чат, имэйлээр шөнө дөлөөр ч мэргэжлийн зөвлөх тусална.",
  },
  {
    icon: Truck,
    title: "Хурдан хүргэлт",
    body: "Улаанбаатар хотод 24 цагт, орон нутагт 2–4 хоногт хүргэнэ.",
  },
  {
    icon: CreditCard,
    title: "Аюулгүй төлбөр",
    body: "QPay, SocialPay, банкны карт, хуваан төлөлтийн нөхцөлтэй.",
  },
] as const;

export default function TrustStrip() {
  return (
    <section id="trust" aria-labelledby="trust-title" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="trust-title" className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Яагаад hotulan.mn-ийг сонгох вэ?
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
