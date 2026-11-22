# hotulan.mn — Design handoff (Claude Code-д зориулсан)

Дэлгэц бүр 3 хэлбэрээр байна (нэр нь адил):

| Хавтас | Юу вэ | Хэнд |
|---|---|---|
| `png/` | Дэлгэцийн бүтэн зураг | Claude Code зургийг харж харьцуулна |
| `html/` | Энгийн статик HTML, браузерт шууд нээгдэнэ | Яг px, өнгө, бүтцийг эндээс авна |
| `design/*.dc.html` | Canvas-ын эх файл | Жишээ өгөгдөл `renderVals()` дотор |

**Claude Code-д:** хуудас бүрийг хийхдээ `png/<Нэр>.png`-ийг харж, `html/<Нэр>.html`-ээс хэмжээ, өнгийг ав.
Дуусгаад өөрийн хуудсаа PNG-тэй нүдээр тулгаж шалга.

Онлайнаар харах: https://claude.ai/artifact/WvWJQSsXGkxYHQsyHtbv6k

## Эхлэх цэг

| Файл | Юу вэ |
|---|---|
| `Tokens.dc.html` | Өнгө, үсэг, зай, радиус, сүүдэр + `globals.css`-д хуулах `@theme` блок |
| `Components.dc.html` | Button, Input, ProductCard, Toast, Modal… бүх хувилбар, төлөв |
| `Main.dc.html` | Brainstorm: 20 ангилал, хүргэлтийн дүрэм, модулиуд |
| `canvas.json` | Бүх дэлгэцийн жагсаалт, гарчиг |

## Дэлгэцийн зураглал

**Дэлгүүр:** `Home`, `Category`, `Search`, `Product`, `Checkout`, `OrderSuccess`, `Login`, `MyOrders`,
`TrackOrder`, `InfoPage`, `NotFound` · компонент: `StoreHeader`, `StoreFooter`
**Админ:** `AdminLogin`, `AdminDashboard`, `AdminProducts`, `AdminProductForm`, `AdminCategories`,
`AdminOrders`, `AdminOrderDetail`, `AdminAppearance`, `AdminDelivery`, `AdminCustomers`,
`AdminPromotions`, `AdminStaff`, `AdminSettings` · компонент: `AdminSidebar`, `AdminTopbar`
**Mobile (390px):** `M*.dc.html` — desktop хуудсуудын responsive хувилбар (тусдаа хуудас биш)
**Төлөвүүд:** `StatesStore`, `StatesAdmin` — хоосон, ачаалж буй, алдаа, баталгаажуулалт

## Claude Code-д өгөх prompt-ууд (дарааллаар нь)

Нэг дор бүгдийг биш, үе шатаар нь өгвөл чанар сайн гарна. Үе шат бүрийн дараа `npm run build` ажиллуулж шалгуулаарай.

**1. Design tokens**
> `design/html/Tokens.html`-ийг уншаад `app/globals.css`-ийн `@theme`-ийг шинэчил. Одоо байгаа `brand`, `brand-dark`, `brand-soft` нэрсийг хэвээр үлдээ.

**2. Дахин ашиглагдах UI компонент**
> `design/html/Components.html`-ийн дагуу `components/ui/`-д Button, Input, Select, Switch, QuantityStepper, Badge, Toast, Modal, Skeleton компонентуудыг Tailwind-ээр хий. Бүх variant, төлөвийг prop-оор өг.

**3. Өгөгдлийн загвар**
> `design/html/Main.html` болон админ дэлгэцүүдийг уншаад `lib/server/store.ts`, `data/store.json`-ийг өргөтгө: динамик ангилал (дэд ангилал, икон, дараалал, нуух), баннер, нүүрний хэсгүүд, хүргэлтийн бүс (УБ-ын 9 дүүрэг, үнэ), купон, ажилтан ба эрх (super_admin, manager, warehouse, driver). `lib/catalog.ts`-ийн хатуу CATEGORIES-ийг өгөгдлөөс уншдаг болго.

**4. Дэлгүүрийн хуудсууд**
> `design/html/StoreHeader`, `StoreFooter`, `Home`, `Category`, `Search`, `Product`, `Checkout`, `OrderSuccess` дагуу `components/store/`-ийг шинэчил. App Router-оор `/c/[slug]`, `/p/[id]`, `/search`, `/checkout`, `/order/[id]` маршрут үүсгэ. Mobile хувилбарыг `design/html/M*.html`-ээс аваад responsive болго.

**5. Админ панел**
> `design/html/Admin*.html` дагуу `components/admin/`-ийг шинэчилж, дутуу модулиудыг (Ангилал, Харагдах байдал, Хүргэлтийн бүс, Хэрэглэгчид, Урамшуулал, Ажилтан) нэм. API-г `app/api/`-д нэм, эрхийг middleware дээр шалга. Mobile-д `design/html/MAdmin*.html`.

**6. Төлөвүүд ба нэмэлт**
> `design/html/StatesStore.html`, `StatesAdmin.html`-ийн бүх төлөвийг холбогдох хуудсуудад хэрэгжүүл. `Login`, `MyOrders`, `TrackOrder`, `InfoPage`, `NotFound`, `AdminLogin` хуудсуудыг хий.

## Санамж
- Зураг бүгд placeholder — бодит зургийг админаас оруулна.
- Үнэ, нэр, дүүргийн хүргэлтийн үнэ жишээ утга.
- `[ОГНОО]`, `[ДЭЛГҮҮРИЙН ХАЯГ]`, `[ТАНЫ ДЭЛГЭРЭНГҮЙ НӨХЦӨЛ]` гэсэн хэсгийг бодит мэдээллээр солино.
- QPay, SMS, И-баримт интеграц нь дизайнд байгаа ч backend холболтыг тусад нь хийнэ.
