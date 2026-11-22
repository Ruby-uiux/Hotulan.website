/**
 * Storefront screenshots for comparing against design/png.
 *
 *   npm run build && npm start            (or any running server)
 *   node scripts/screenshots.mjs [baseUrl] [--only=Home,MHome]
 *
 * Writes screenshots/<DesignName>.png (desktop 1440px, phones 390px — the same names as
 * design/png) and screenshots/report.html, which puts each one next to its design.
 *
 * It places one real order (for OrderSuccess), so point it at a development or
 * throw-away database, never at production data.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "screenshots");
const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function json(url, init) {
  const res = await fetch(BASE + url, { ...init, headers: { "content-type": "application/json", origin: BASE, ...init?.headers } });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

/** Picks real data so every page has something to show. */
async function fixtures() {
  const { products } = await json("/api/products");
  const inStock = products.filter((p) => p.stock > 2 && p.variants.length === 0);
  // The fullest category, and a search word that matches several products (like the design's "чихэвч").
  const byCategory = new Map();
  for (const p of products) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
  const category = [...byCategory].sort((a, b) => b[1] - a[1])[0][0];
  const words = new Map();
  for (const p of products)
    for (const w of new Set(p.title.toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length >= 4))) words.set(w, (words.get(w) ?? 0) + 1);
  const query = [...words].sort((a, b) => b[1] - a[1])[0]?.[0] ?? products[0].title.split(" ")[0];
  const product = inStock.find((p) => p.category === category && p.compareAtPrice) ?? inStock.find((p) => p.compareAtPrice) ?? inStock[0];
  const cart = inStock.slice(0, 3).map((p) => ({ productId: p.id, variantId: null, quantity: 1 }));
  return { product, cart, category, query };
}

async function placeOrder(cart) {
  const body = { customer: "Б. Сарангэрэл", phone: "99112345", zoneId: "khan-uul", khoroo: 15, address: "Зайсан, 52-р байр, 2 орц, 41 тоот", payment: "qpay", lines: cart };
  const res = await json("/api/orders", { method: "POST", body: JSON.stringify(body) });
  return res.accessUrl ?? `/order/${res.order.id}`;
}

function shots(fx) {
  const withCart = async (page) => {
    await page.addInitScript((c) => {
      window.localStorage.setItem("hotulan.cart.v2", JSON.stringify(c));
      // A returning shopper: district and contact remembered from an earlier order.
      window.localStorage.setItem("hotulan.zone", "khan-uul");
      window.localStorage.setItem("hotulan.contact", JSON.stringify({ name: "Б. Сарангэрэл", phone: "9911-2345" }));
    }, fx.cart);
  };
  return [
    { name: "Home", url: "/", viewport: DESKTOP },
    { name: "Category", url: `/c/${fx.category}`, viewport: DESKTOP },
    { name: "Search", url: `/search?q=${encodeURIComponent(fx.query)}`, viewport: DESKTOP },
    { name: "Product", url: `/p/${fx.product.id}`, viewport: DESKTOP },
    { name: "Checkout", url: "/checkout", viewport: DESKTOP, before: withCart },
    { name: "OrderSuccess", url: async () => placeOrder(fx.cart.slice(0, 2)), viewport: DESKTOP },
    { name: "StoreHeader", url: "/", viewport: DESKTOP, element: "header#site-header" },
    { name: "StoreFooter", url: "/", viewport: DESKTOP, element: "footer" },
    { name: "MHome", url: "/", viewport: PHONE },
    { name: "MCategory", url: `/c/${fx.category}`, viewport: PHONE },
    {
      name: "MFilter",
      url: `/c/${fx.category}`,
      viewport: PHONE,
      fullPage: false,
      action: async (page) => {
        await page.getByRole("button", { name: /Шүүлтүүр/ }).first().click();
        await page.waitForTimeout(400);
      },
    },
    { name: "MProduct", url: `/p/${fx.product.id}`, viewport: PHONE },
    {
      name: "MCart",
      url: "/",
      viewport: PHONE,
      fullPage: false,
      before: withCart,
      action: async (page) => {
        await page.getByRole("navigation", { name: "Үндсэн" }).getByRole("button", { name: /Сагс/ }).click();
        await page.waitForTimeout(600);
      },
    },
    { name: "MCheckout", url: "/checkout", viewport: PHONE, before: withCart },
  ];
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const fx = await fixtures();
  const browser = await chromium.launch();
  const results = [];
  for (const s of shots(fx)) {
    if (only && !only.includes(s.name)) continue;
    const context = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: 1, locale: "mn-MN", reducedMotion: "reduce" });
    const page = await context.newPage();
    // Only the app itself: third-party photos (Unsplash demo images) make runs slow and
    // non-deterministic, and the design PNGs use placeholders anyway.
    const origin = new URL(BASE).origin;
    await page.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // Aborted third-party requests (see the route above) and 404s (reported by URL below) are not repeated here.
      if (m.type() === "error" && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    // Link prefetches of pages that arrive in phase 6 are expected 404s; anything else is a bug.
    const LATER = /^\/(info\/|track|login|saved|orders)/;
    page.on("response", (r) => {
      if (r.status() !== 404 || !r.url().startsWith(origin)) return;
      const p = new URL(r.url()).pathname;
      if (!LATER.test(p)) errors.push(`404 ${p}`);
    });
    try {
      if (s.before) await s.before(page);
      const url = typeof s.url === "function" ? await s.url() : s.url;
      await page.goto(BASE + url, { waitUntil: "load" });
      // Link prefetching keeps the network busy, so "networkidle" may never come; give
      // fonts, hydration and the cart fetch a moment instead.
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (s.action) await s.action(page);
      const file = path.join(OUT, `${s.name}.png`);
      const fullPage = s.fullPage ?? true;
      if (fullPage && s.viewport === PHONE) {
        // A full-page capture would paint fixed bottom bars mid-page; pin them to the end of
        // the document instead, as the design frames show them.
        await page.addStyleTag({
          content: "body{position:relative} .fixed.bottom-0, .fixed.inset-x-0.bottom-0{position:absolute!important;top:auto!important;bottom:0!important}",
        });
        await page.waitForTimeout(100);
      }
      if (s.element) await page.locator(s.element).first().screenshot({ path: file });
      else await page.screenshot({ path: file, fullPage });
      results.push({ name: s.name, url, errors });
      console.log(`✓ ${s.name.padEnd(13)} ${url}${errors.length ? `  (${errors.length} console errors: ${[...new Set(errors)].slice(0, 3).join(" | ").slice(0, 300)})` : ""}`);
    } catch (err) {
      results.push({ name: s.name, url: String(s.url), errors: [String(err.message ?? err)], failed: true });
      console.log(`✗ ${s.name.padEnd(13)} ${err.message ?? err}`);
    }
    await context.close();
  }
  await browser.close();
  await writeReport(results);
}

async function writeReport(results) {
  let notes = {};
  try {
    notes = JSON.parse(await readFile(path.join(OUT, "notes.json"), "utf8"));
  } catch {}
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rows = results
    .map(
      (r) => `
  <section id="${r.name}">
    <h2>${r.name} <code>${esc(r.url)}</code></h2>
    ${notes[r.name] ? `<div class="notes">${notes[r.name].map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
    ${r.errors.length ? `<p class="err">Console: ${r.errors.map(esc).join(" · ")}</p>` : ""}
    <div class="pair ${r.name.startsWith("M") ? "phone" : ""}">
      <figure><figcaption>Дизайн · design/png/${r.name}.png</figcaption><img loading="lazy" src="../design/png/${r.name}.png" alt="${r.name} design"></figure>
      <figure><figcaption>Хэрэгжүүлэлт · screenshots/${r.name}.png</figcaption>${r.failed ? "<p class=err>Зураг авч чадсангүй</p>" : `<img loading="lazy" src="${r.name}.png" alt="${r.name} screenshot">`}</figure>
    </div>
  </section>`,
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storefront vs design</title>
<style>
:root{color-scheme:light;--bg:#f8fafc;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line);padding:12px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header h1{font-size:18px;margin:0}header nav{display:flex;gap:10px;flex-wrap:wrap;font-size:13px}header a{color:#0000ff;text-decoration:none}
main{padding:24px;display:flex;flex-direction:column;gap:40px}
section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}
h2{margin:0 0 12px;font-size:18px}code{font-size:12px;color:var(--muted);font-weight:400}
.notes{background:#eef0ff;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px}.notes p{margin:4px 0}
.err{color:#991b1b;font-size:13px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.pair.phone{grid-template-columns:repeat(2,minmax(0,420px))}
figure{margin:0}figcaption{font-size:12px;color:var(--muted);margin-bottom:6px}
img{width:100%;height:auto;border:1px solid var(--line);border-radius:6px;display:block}
@media (max-width:800px){.pair,.pair.phone{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Дэлгүүр ↔ дизайн</h1><nav>${results.map((r) => `<a href="#${r.name}">${r.name}</a>`).join("")}</nav><span style="color:var(--muted);font-size:12px">${esc(BASE)} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</span></header>
<main>${notes._intro ? `<section class="notes">${notes._intro.map((n) => `<p>${esc(n)}</p>`).join("")}</section>` : ""}${rows}</main></body></html>`;
  await writeFile(path.join(OUT, "report.html"), html);
  console.log(`\nReport: ${path.join(OUT, "report.html")}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
