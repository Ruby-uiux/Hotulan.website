import Link from "next/link";
import Logo from "./shell/Logo";

export interface StoreFooterProps {
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  workingHours: string;
  address: string;
  /** Visible root categories, for the blurb ("N ангиллын бараа"). */
  categoryCount: number;
  /** Enabled checkout payment methods, shown as badges. */
  paymentBadges: string[];
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const SHOPPER_LINKS = [
  { href: "/track", label: "Захиалга хянах" },
  { href: "/info/delivery", label: "Хүргэлтийн нөхцөл" },
  { href: "/info/returns", label: "Буцаалт, солилт" },
  { href: "/info/warranty", label: "Баталгаат засвар" },
  { href: "/info/faq", label: "Түгээмэл асуулт" },
];
const ABOUT_LINKS = [
  { href: "/info/about", label: "Компанийн танилцуулга" },
  { href: "/info/terms", label: "Үйлчилгээний нөхцөл" },
  { href: "/info/privacy", label: "Нууцлалын бодлого" },
  { href: "/info/careers", label: "Ажлын байр" },
];

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <span className="mb-1 font-bold text-white">{title}</span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="w-fit hover:text-white">
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** design/StoreFooter. No "official" claim (flaw #17) — only what the store can stand behind. */
export default function StoreFooter({ storeName, supportPhone, supportEmail, workingHours, address, categoryCount, paymentBadges }: StoreFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#020617] text-slate-300">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 pt-14 pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-8">
          <div className="flex flex-col gap-3.5">
            <Logo name={storeName} tone="dark" withMark={false} />
            <p className="text-sm leading-[1.7]">
              {categoryCount > 0 ? `${categoryCount} ангиллын баталгаат бараа. ` : ""}Улаанбаатар хотод 24–48 цагт хүргэнэ.
            </p>
            {address && <p className="text-sm leading-[1.7]">{address}, Улаанбаатар</p>}
          </div>
          <Column title="Худалдан авагчид" links={SHOPPER_LINKS} />
          <Column title="Бидний тухай" links={ABOUT_LINKS} />
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="mb-1 font-bold text-white">Холбоо барих</span>
            <a href={telHref(supportPhone)} className="w-fit text-xl font-bold text-white">
              {supportPhone}
            </a>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="w-fit hover:text-white">
                {supportEmail}
              </a>
            )}
            {workingHours && <span>{workingHours}</span>}
            {paymentBadges.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {paymentBadges.map((b) => (
                  <span key={b} className="rounded-sm border border-slate-700 px-2.5 py-1.5 text-xs font-semibold">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-5 text-[13px] text-slate-400">
          <span>
            © {year} {storeName}. Бүх эрх хуулиар хамгаалагдсан.
          </span>
          <span>Хүргэлт зөвхөн Улаанбаатар хотын хилийн дотор</span>
        </div>
      </div>
    </footer>
  );
}
