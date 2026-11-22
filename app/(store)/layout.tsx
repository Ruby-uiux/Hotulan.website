import type { ReactNode } from "react";
import CartDrawerHost from "@/components/store/cart/CartDrawerHost";
import { CartProvider } from "@/components/store/cart/CartProvider";
import MobileTabBar from "@/components/store/shell/MobileTabBar";
import { ShellProvider } from "@/components/store/shell/ShellProvider";
import StoreFooter from "@/components/store/StoreFooter";
import StoreHeader from "@/components/store/StoreHeader";
import { getStoreShell, toMenuCategories } from "@/lib/server/storefront";

// Catalog, stock and settings are edited live from /admin — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

const PAYMENT_BADGE: Record<string, string> = { qpay: "QPay", cod: "Бэлэн, карт" };

/**
 * Chrome shared by every storefront page: header, footer, cart (provider + drawer) and,
 * on phones, the bottom tab bar. /admin has its own layout and none of this.
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const { tree, settings, appearance, zones, paymentMethods } = await getStoreShell();
  const categories = toMenuCategories(tree);
  const menuCategories = toMenuCategories(tree.filter((c) => c.showInMenu));
  const announcement = appearance.announcement.enabled && appearance.announcement.text ? appearance.announcement : null;

  return (
    <ShellProvider>
      <CartProvider>
        {/* Bottom padding keeps the footer clear of the phone tab bar. */}
        <div className="flex min-h-dvh flex-col bg-slate-50 pb-[68px] lg:pb-0">
          <StoreHeader
            storeName={settings.storeName}
            supportPhone={settings.supportPhone}
            freeDeliveryThreshold={settings.freeDeliveryThreshold}
            announcement={announcement}
            categories={categories}
            menuCategories={menuCategories}
          />
          <div className="flex-1">{children}</div>
          <StoreFooter
            storeName={settings.storeName}
            supportPhone={settings.supportPhone}
            supportEmail={settings.supportEmail}
            workingHours={settings.workingHours}
            address={settings.address}
            categoryCount={tree.length}
            paymentBadges={[...paymentMethods.flatMap((m) => (PAYMENT_BADGE[m] ? [PAYMENT_BADGE[m]] : [])), "И-баримт"]}
          />
        </div>
        <MobileTabBar />
        <CartDrawerHost
          zones={zones}
          paymentMethods={paymentMethods}
          freeDeliveryThreshold={settings.freeDeliveryThreshold}
          oversizedFee={settings.oversizedFee}
        />
      </CartProvider>
    </ShellProvider>
  );
}
