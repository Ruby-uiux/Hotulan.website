/**
 * Demo orders in the v1 (store.json) shape — seeded through the same converter as a
 * real import, so the demo exercises legacy statuses ("delivery", "completed") and
 * legacy payment methods (socialpay, card, cash) exactly like migrated data.
 */
import { DEFAULT_SETTINGS } from "@/lib/admin-data";
import { computeDeliveryFee } from "@/lib/delivery";
import { ZONE_SEED } from "./baseline";
import { DEMO_PRODUCTS } from "./demo-products";
import type { LegacyOrder } from "./types";

const byId = new Map(DEMO_PRODUCTS.map((p) => [p.id, p]));

function line(productId: string, quantity: number): LegacyOrder["lines"][number] {
  const p = byId.get(productId)!;
  return { productId, title: p.title, unitPrice: p.price, quantity };
}

/** Same fee rule as checkout: the seeded zone's fee, waived above the free-delivery threshold. */
function makeOrder(o: Omit<LegacyOrder, "deliveryFee">): LegacyOrder {
  const zone = ZONE_SEED.find((z) => z.name === o.district);
  if (!zone) throw new Error(`Demo order ${o.id}: unknown district ${o.district}`);
  const subtotal = o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const deliveryFee = computeDeliveryFee({
    zone,
    subtotal,
    freeDeliveryThreshold: DEFAULT_SETTINGS.freeDeliveryThreshold,
    hasOversized: false,
    oversizedFee: DEFAULT_SETTINGS.oversizedFee,
  });
  return { ...o, deliveryFee };
}

export const DEMO_ORDERS: LegacyOrder[] = [
  makeOrder({ id: "HTL-482913", customer: "Б. Сарангэрэл", phone: "9911-2345", district: "Хан-Уул", createdAt: "2026-11-08T14:32:00+08:00", payment: "qpay", status: "new", lines: [line("elec-anc-headphones", 1), line("toy-teddy-60", 1)] }),
  makeOrder({ id: "HTL-482907", customer: "Г. Тэмүүлэн", phone: "8800-4512", district: "Баянзүрх", createdAt: "2026-11-08T12:05:00+08:00", payment: "socialpay", status: "new", lines: [line("home-kettle", 2)] }),
  makeOrder({ id: "HTL-482889", customer: "Д. Номин-Эрдэнэ", phone: "9505-7781", district: "Сүхбаатар", createdAt: "2026-11-08T09:47:00+08:00", payment: "card", status: "paid", lines: [line("home-air-purifier", 1)] }),
  makeOrder({ id: "HTL-482861", customer: "Э. Батбаяр", phone: "9119-0032", district: "Чингэлтэй", createdAt: "2026-11-07T19:22:00+08:00", payment: "qpay", status: "paid", lines: [line("toy-blocks-1000", 2), line("toy-wood-puzzle", 1)] }),
  makeOrder({ id: "HTL-482840", customer: "О. Анужин", phone: "8611-9087", district: "Баянгол", createdAt: "2026-11-07T15:10:00+08:00", payment: "qpay", status: "delivery", lines: [line("elec-smartwatch", 1)] }),
  makeOrder({ id: "HTL-482812", customer: "Ц. Мөнхбат", phone: "9900-1188", district: "Сонгинохайрхан", createdAt: "2026-11-06T20:41:00+08:00", payment: "cash", status: "delivery", lines: [line("sport-yoga-mat", 1), line("sport-adjustable-dumbbell", 1)] }),
  makeOrder({ id: "HTL-482790", customer: "Ж. Хулан", phone: "9977-6655", district: "Хан-Уул", createdAt: "2026-11-06T11:18:00+08:00", payment: "card", status: "completed", lines: [line("elec-tv-55", 1)] }),
  makeOrder({ id: "HTL-482755", customer: "С. Билгүүн", phone: "8080-3434", district: "Баянзүрх", createdAt: "2026-11-05T17:56:00+08:00", payment: "socialpay", status: "completed", lines: [line("toy-rc-car", 1), line("toy-mini-drone", 1)] }),
  makeOrder({ id: "HTL-482731", customer: "Н. Оюунчимэг", phone: "9191-2020", district: "Сүхбаатар", createdAt: "2026-11-05T10:02:00+08:00", payment: "qpay", status: "completed", lines: [line("home-bedding-set", 2)] }),
  makeOrder({ id: "HTL-482702", customer: "А. Энхжин", phone: "9444-8181", district: "Баянгол", createdAt: "2026-11-04T13:29:00+08:00", payment: "qpay", status: "completed", lines: [line("home-robot-vacuum", 1)] }),
  makeOrder({ id: "HTL-482688", customer: "П. Ганзориг", phone: "8899-5050", district: "Чингэлтэй", createdAt: "2026-11-03T18:44:00+08:00", payment: "card", status: "completed", lines: [line("elec-laptop-14", 1)] }),
  makeOrder({ id: "HTL-482650", customer: "Т. Мишээл", phone: "9933-7171", district: "Хан-Уул", createdAt: "2026-11-03T09:15:00+08:00", payment: "socialpay", status: "completed", lines: [line("elec-bt-speaker", 1), line("home-desk-lamp", 2)] }),
  makeOrder({ id: "HTL-482611", customer: "Х. Ариунбилэг", phone: "8686-2424", district: "Баянзүрх", createdAt: "2026-11-02T16:37:00+08:00", payment: "qpay", status: "completed", lines: [line("sport-mtb-275", 1)] }),
  makeOrder({ id: "HTL-482598", customer: "М. Дөлгөөн", phone: "9595-1313", district: "Сонгинохайрхан", createdAt: "2026-11-02T10:50:00+08:00", payment: "cash", status: "completed", lines: [line("home-espresso", 1)] }),
];
