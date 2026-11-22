import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

// Cyrillic subset is required — Mongolian glyphs (Ө, Ү) fall back to system fonts otherwise.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  // Pages set a short title ("Хүүхдийн тоглоом"); the store name is appended.
  title: { default: `${SITE_NAME} — тоглоом, гэр ахуй, цахилгаан бараа`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "mn_MN", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0000ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        {/* One toast stack for the storefront and /admin; call useToast() from any client component. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
