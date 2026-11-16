import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Cyrillic subset is required — Mongolian glyphs (Ө, Ү) fall back to system fonts otherwise.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hotulan.mn — Хүүхдийн тоглоом ба Гэр ахуйн барааны албан ёсны дэлгүүр",
  description:
    "Албан ёсны баталгаатай тоглоом, гэр ахуй, цахилгаан бараа, спортын хэрэгсэл. Улаанбаатар хотод хурдан хүргэлт.",
};

export const viewport: Viewport = {
  themeColor: "#0000ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
