import { Clock, Mail, MapPin, Phone, Store } from "lucide-react";

const LINK_GROUPS = [
  {
    title: "Үйлчилгээ",
    links: ["Захиалга хянах", "Хүргэлтийн нөхцөл", "Буцаалт ба солилт", "Баталгаат засвар", "Хуваан төлөлт"],
  },
  {
    title: "Мэдээлэл",
    links: ["Бидний тухай", "Салбар дэлгүүрүүд", "Байгууллагын худалдан авалт", "Ажлын байр", "Нууцлалын бодлого"],
  },
] as const;

const PAYMENT_METHODS = ["QPay", "SocialPay", "Visa", "Mastercard", "UnionPay", "Хуваан төлөлт"] as const;

export default function Footer({ supportPhone, supportEmail }: { supportPhone: string; supportEmail: string }) {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr] lg:px-8">
        <div>
          <a href="#top" className="inline-flex items-center gap-2.5 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">hotulan<span className="text-blue-400">.mn</span></span>
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Хүүхдийн тоглоом, гэр ахуй, цахилгаан бараа, спортын хэрэгслийн албан ёсны борлуулагч. 2014 оноос хойш
            Монгол өрхүүдэд итгэлтэй үйлчилж байна.
          </p>
        </div>

        {LINK_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {group.links.map((link) => (
                <li key={link}>
                  <a href="#" className="transition hover:text-white">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <address className="not-italic">
          <h2 className="text-sm font-semibold text-white">Холбоо барих</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <a href={`tel:${supportPhone.replace(/\D/g, "")}`} className="transition hover:text-white">
                {supportPhone}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <a href={`mailto:${supportEmail}`} className="transition hover:text-white">
                {supportEmail}
              </a>
            </li>
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span>Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Энхтайваны өргөн чөлөө 15</span>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span>Дэлгүүр: Өдөр бүр 10:00–21:00 · Онлайн: 24/7</span>
            </li>
          </ul>
        </address>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} hotulan.mn. Бүх эрх хуулиар хамгаалагдсан.</p>
          <ul className="flex flex-wrap gap-2" aria-label="Төлбөрийн хэрэгсэл">
            {PAYMENT_METHODS.map((m) => (
              <li key={m} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-semibold text-slate-300">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
