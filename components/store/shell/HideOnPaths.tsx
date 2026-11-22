"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Pages that bring their own phone chrome (design/MProduct: full-bleed photo with a back
 * button and a sticky buy bar) hide the shared phone header and tab bar.
 */
export const OWN_PHONE_CHROME = ["/p/"];

export function usesOwnPhoneChrome(pathname: string): boolean {
  return OWN_PHONE_CHROME.some((p) => pathname.startsWith(p));
}

export default function HideOnPaths({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return usesOwnPhoneChrome(pathname) ? null : <>{children}</>;
}
