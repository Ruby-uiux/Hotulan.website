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
| `lib/server/store.ts` | Өгөгдөл хадгалах давхарга — `data/store.json` |

Өгөгдөл анх ажиллуулахад жишээ бараа, захиалгаар автоматаар үүснэ. Нэг серверт зориулсан
файл-суурьтай хадгалалт тул олон instance эсвэл serverless орчинд `lib/server/store.ts`-ийг
мэдээллийн сангаар солино.
