/**
 * Store structure every installation starts with — categories, delivery zones,
 * slots and home sections. Used both for a fresh demo DB and for the JSON import.
 * All values are editable later from /admin.
 */
import type { CategoryIconKey } from "@/lib/categories";
import type { DeliverySlot, DeliveryZone } from "@/lib/delivery";
import type { HomeSection } from "@/lib/content";

interface RootSeed {
  id: string;
  name: string;
  icon: CategoryIconKey;
  children?: Array<{ id: string; name: string }>;
}

/**
 * 20 root categories from design/Main.dc.html. The first four keep the ids/slugs used
 * by existing products (toys, home, electronics, sports) with the new, longer names.
 */
export const CATEGORY_SEED: RootSeed[] = [
  {
    id: "toys",
    name: "Хүүхдийн тоглоом",
    icon: "toys",
    children: [
      { id: "toys-building", name: "Барилгын тоглоом" },
      { id: "toys-rc", name: "Зайнаас удирдлагатай" },
      { id: "toys-plush", name: "Зөөлөн тоглоом" },
      { id: "toys-educational", name: "Оюуны тоглоом" },
    ],
  },
  {
    id: "home",
    name: "Гэр ахуй",
    icon: "home",
    children: [
      { id: "home-cleaning", name: "Цэвэрлэгээ" },
      { id: "home-appliances", name: "Гал тогооны цахилгаан" },
      { id: "home-lighting", name: "Гэрэлтүүлэг" },
      { id: "home-bedding", name: "Ор дэрний хэрэгсэл" },
      { id: "home-air", name: "Агаар цэвэршүүлэгч" },
    ],
  },
  {
    id: "electronics",
    name: "Цахилгаан бараа",
    icon: "tv",
    children: [
      { id: "electronics-tv", name: "ТВ" },
      { id: "electronics-phones", name: "Гар утас" },
      { id: "electronics-laptops", name: "Ноутбук" },
      { id: "electronics-headphones", name: "Чихэвч" },
      { id: "electronics-speakers", name: "Чанга яригч" },
      { id: "electronics-gaming", name: "Тоглоомын хэрэгсэл" },
      { id: "electronics-wearables", name: "Ухаалаг цаг" },
    ],
  },
  {
    id: "sports",
    name: "Спорт, фитнес",
    icon: "sport",
    children: [
      { id: "sports-fitness", name: "Фитнес" },
      { id: "sports-yoga", name: "Йога" },
      { id: "sports-bikes", name: "Дугуй" },
    ],
  },
  { id: "kitchen", name: "Гал тогоо", icon: "pot" },
  { id: "beauty", name: "Гоо сайхан", icon: "beauty" },
  { id: "clothing", name: "Хувцас", icon: "shirt" },
  { id: "shoes", name: "Гутал", icon: "shoe" },
  { id: "bags", name: "Цүнх, аксессуар", icon: "bag" },
  { id: "books", name: "Ном, бичиг хэрэг", icon: "book" },
  { id: "phones", name: "Гар утас", icon: "phone" },
  { id: "computers", name: "Компьютер", icon: "laptop" },
  { id: "furniture", name: "Тавилга", icon: "sofa" },
  { id: "health", name: "Эрүүл мэнд", icon: "health" },
  { id: "baby", name: "Нялх хүүхэд", icon: "baby" },
  { id: "pets", name: "Тэжээвэр амьтан", icon: "pet" },
  { id: "auto", name: "Авто хэрэгсэл", icon: "car" },
  { id: "outdoor", name: "Аялал, зугаалга", icon: "tent" },
  { id: "food", name: "Хүнс", icon: "food" },
  { id: "garden", name: "Цэцэрлэг, засвар", icon: "garden" },
];

/** Known product → subcategory for the demo catalogue (also applied on JSON import). */
export const SUBCATEGORY_BY_PRODUCT: Record<string, string> = {
  "toy-blocks-1000": "toys-building",
  "toy-rc-car": "toys-rc",
  "toy-mini-drone": "toys-rc",
  "toy-teddy-60": "toys-plush",
  "toy-wood-puzzle": "toys-educational",
  "toy-magnetic-board": "toys-educational",
  "home-air-purifier": "home-air",
  "home-robot-vacuum": "home-cleaning",
  "home-kettle": "home-appliances",
  "home-espresso": "home-appliances",
  "home-desk-lamp": "home-lighting",
  "home-bedding-set": "home-bedding",
  "elec-anc-headphones": "electronics-headphones",
  "elec-smartwatch": "electronics-wearables",
  "elec-tv-55": "electronics-tv",
  "elec-bt-speaker": "electronics-speakers",
  "elec-laptop-14": "electronics-laptops",
  "elec-gamepad": "electronics-gaming",
  "sport-yoga-mat": "sports-yoga",
  "sport-adjustable-dumbbell": "sports-fitness",
  "sport-mtb-275": "sports-bikes",
};

/**
 * Fees/ETAs from design/AdminDelivery.dc.html (example values — set real ones in admin).
 * Khoroo counts are approximate and editable; verify against the current district list.
 */
export const ZONE_SEED: DeliveryZone[] = [
  { id: "bayangol", name: "Баянгол", region: "central", fee: 5_000, etaHours: 24, khorooCount: 34, active: true, sortOrder: 0 },
  { id: "bayanzurkh", name: "Баянзүрх", region: "central", fee: 5_000, etaHours: 24, khorooCount: 43, active: true, sortOrder: 1 },
  { id: "songinokhairkhan", name: "Сонгинохайрхан", region: "central", fee: 6_000, etaHours: 24, khorooCount: 43, active: true, sortOrder: 2 },
  { id: "sukhbaatar", name: "Сүхбаатар", region: "central", fee: 5_000, etaHours: 24, khorooCount: 20, active: true, sortOrder: 3 },
  { id: "khan-uul", name: "Хан-Уул", region: "central", fee: 5_000, etaHours: 24, khorooCount: 25, active: true, sortOrder: 4 },
  { id: "chingeltei", name: "Чингэлтэй", region: "central", fee: 5_000, etaHours: 24, khorooCount: 24, active: true, sortOrder: 5 },
  { id: "nalaikh", name: "Налайх", region: "remote", fee: 15_000, etaHours: 48, khorooCount: 8, active: true, sortOrder: 6 },
  { id: "baganuur", name: "Багануур", region: "remote", fee: 25_000, etaHours: 72, khorooCount: 5, active: true, sortOrder: 7 },
  { id: "bagakhangai", name: "Багахангай", region: "remote", fee: 25_000, etaHours: 72, khorooCount: 2, active: true, sortOrder: 8 },
];

export const SLOT_SEED: DeliverySlot[] = [
  { id: "morning", label: "10:00–14:00", capacity: 25, active: true, sortOrder: 0 },
  { id: "afternoon", label: "14:00–19:00", capacity: 30, active: true, sortOrder: 1 },
];

/** Home page sections from design/AdminAppearance.dc.html, in display order. */
export const HOME_SECTION_SEED: HomeSection[] = [
  { key: "hero", title: "Гол баннер", description: "Слайд, 5 секунд тутам солигдоно", enabled: true, sortOrder: 0, config: { intervalMs: 5000 } },
  { key: "usp", title: "Давуу талын мөр", description: "Хүргэлт, баталгаа, төлбөр, буцаалт", enabled: true, sortOrder: 1, config: {} },
  { key: "categories", title: "Ангиллууд", description: "Ангиллын икон жагсаалт", enabled: true, sortOrder: 2, config: {} },
  { key: "flash_sale", title: "Өдрийн хямдрал", description: "Цаг тоолуур + 5 бараа", enabled: true, sortOrder: 3, config: { limit: 5, endsAt: null } },
  { key: "promo_banners", title: "2 сурталчилгааны баннер", description: "Хоёр жижиг баннер", enabled: true, sortOrder: 4, config: {} },
  { key: "new_arrivals", title: "Шинэ ирсэн бараа", description: "10 бараа, ангиллын таб", enabled: true, sortOrder: 5, config: { limit: 10 } },
  { key: "brands", title: "Брэндүүд", description: "Лого жагсаалт", enabled: false, sortOrder: 6, config: {} },
];
