/**
 * Storefront content managed under Админ → Харагдах байдал: hero banners, home page
 * sections and site-wide appearance. Client-safe types.
 */

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  /** Internal path ("/c/toys") or absolute URL. */
  href: string;
  /** 1600×640 */
  imageDesktop: string | null;
  /** 800×800 */
  imageMobile: string | null;
  /** Fallback colours when there is no image yet. */
  background: string;
  foreground: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
}

export type BannerState = "active" | "scheduled" | "expired" | "disabled";

export function bannerState(b: Pick<Banner, "active" | "startsAt" | "endsAt">, now = Date.now()): BannerState {
  if (!b.active) return "disabled";
  if (b.startsAt && Date.parse(b.startsAt) > now) return "scheduled";
  if (b.endsAt && Date.parse(b.endsAt) <= now) return "expired";
  return "active";
}

/** Fixed set of home sections; admin can toggle and reorder them. */
export const HOME_SECTION_KEYS = [
  "hero",
  "usp",
  "categories",
  "flash_sale",
  "promo_banners",
  "new_arrivals",
  "brands",
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export interface HomeSection {
  key: HomeSectionKey;
  title: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  /** Section-specific options (e.g. product count, flash sale end time). */
  config: Record<string, unknown>;
}

export interface AnnouncementBar {
  enabled: boolean;
  text: string;
  href: string | null;
}

export interface AppearanceSettings {
  logo: string | null;
  favicon: string | null;
  /** HEX; defaults to the brand token. */
  primaryColor: string;
  font: "inter" | "manrope" | "roboto";
  announcement: AnnouncementBar;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  logo: null,
  favicon: null,
  primaryColor: "#0000ff",
  font: "inter",
  announcement: { enabled: false, text: "", href: null },
};
