# hotulan.mn

Хүүхдийн тоглоом, гэр ахуй, цахилгаан бараа, спортын барааны онлайн дэлгүүр болон админ самбар.
Next.js 15 (App Router), Tailwind CSS v4, Lucide icons.

## Эхлүүлэх

```bash
npm install
cp .env.example .env.local
npm run admin:hash        # нууц үг асууна → гарсан утгуудыг .env.local-д хуулна
npm run build && npm start
```

- Дэлгүүр: http://localhost:3000
- Админ: http://localhost:3000/admin (`.env.local` дутуу бол хаалттай байна)

## Бүтэц

| Зам | Агуулга |
|---|---|
| `app/page.tsx`, `components/store/` | Дэлгүүр: хайлт, шүүлтүүр, сагс, захиалга |
| `app/admin/`, `components/admin/` | Админ: хяналтын панел, бараа, захиалга, тохиргоо |
| `app/api/` | REST API (бараа, захиалга, тохиргоо, нэвтрэлт) |
| `middleware.ts`, `lib/auth/` | Админ нэвтрэлт (scrypt + гарын үсэгтэй cookie) |
| `lib/server/db/` | SQLite (Drizzle ORM + libSQL): `schema.ts`, холболт, migration |
| `lib/server/repo/` | Өгөгдлийн давхарга — route, хуудас зөвхөн эндээс уншиж бичнэ |
| `lib/server/seed/` | Анхны бүтэц (20 ангилал, 9 дүүрэг…), жишээ өгөгдөл, хуучин JSON хөрвүүлэгч |
| `lib/catalog.ts`, `lib/categories.ts`, `lib/delivery.ts`, `lib/coupons.ts`, `lib/admin-data.ts`, `lib/permissions.ts` | Төрөл ба цэвэр функцууд (сервер, клиент хоёуланд) |
| `components/ui/` | Дизайн системийн компонентууд (`design/Components.dc.html`) |
| `drizzle/` | SQL migration — сервер асахдаа автоматаар хэрэглэгдэнэ |

## Өгөгдлийн сан

Анх ажиллуулахад `data/hotulan.db` үүсч, migration хийгдээд жишээ өгөгдлөөр дүүрнэ.

```bash
npm run db:generate   # schema.ts өөрчилсний дараа шинэ migration үүсгэх
npm run db:studio     # өгөгдлийг браузерт харах
```

**Хуучин `data/store.json`-оос шилжих (нэг удаа):**

```bash
npm run db:import -- --dry-run   # юу импортлогдохыг харах
npm run db:import                # импортлоод store.json-г store.backup-<огноо>.json болгоно
```

Захиалгын төлөв `delivery → shipping`, `completed → delivered` болж хөрвөнө. Хуучин
төлбөрийн утгууд (socialpay, card, cash) хэвээр үлдэж, админд "(хуучин)" гэж харагдана.
`store.json` импортлогдоогүй байхад сайт demo өгөгдөл үүсгэхгүй, алдааны мэдэгдэл харуулна.

**PostgreSQL руу шилжих:** бүх query `lib/server/repo/`-д Drizzle query builder-ээр бичигдсэн.
`schema.ts`-ийг `pg-core` төрлүүдээр сольж, `drizzle.config.ts`-ийн `dialect`-ийг `postgresql`
болгоод, `lib/server/db/client.ts`-д `drizzle-orm/node-postgres` холболт ашиглана. Мөнгө
бүхэл тоо, огноо ISO текст, JSON нь `jsonb` болж шууд шилжинэ. `writeTx`-ийн дараалал
Postgres-д шаардлагагүй (нөөцийн хасалт аль хэдийн `WHERE stock >= n` нөхцөлтэй).
