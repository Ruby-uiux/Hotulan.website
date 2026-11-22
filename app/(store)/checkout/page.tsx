import type { Metadata } from "next";
import CheckoutForm from "@/components/store/checkout/CheckoutForm";
import { listSlots } from "@/lib/server/repo/delivery";
import { categoryIcons, getAllCategories, getStoreShell } from "@/lib/server/storefront";

export const metadata: Metadata = {
  title: "Захиалга баталгаажуулах",
  robots: { index: false, follow: false },
};

/** design/Checkout, design/MCheckout. The cart lives in the browser; the form is a client component. */
export default async function CheckoutPage() {
  const [{ zones, settings, paymentMethods }, slots, categories] = await Promise.all([getStoreShell(), listSlots({ activeOnly: true }), getAllCategories()]);
  return (
    <CheckoutForm
      zones={zones}
      slots={slots}
      paymentMethods={paymentMethods}
      nextDayCutoff={settings.nextDayCutoff}
      icons={categoryIcons(categories)}
    />
  );
}
