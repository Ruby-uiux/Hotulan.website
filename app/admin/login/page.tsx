import type { Metadata } from "next";
import { ShieldCheck, Store } from "lucide-react";
import LoginForm from "@/components/admin/LoginForm";
import { redirect } from "next/navigation";
import { readSessionSecret } from "@/lib/auth/session";
import { getStaffSession } from "@/lib/server/actor";

export const metadata: Metadata = {
  title: "Нэвтрэх — hotulan.mn админ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Only same-site admin paths are accepted as a post-login destination (no open redirect). */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const configured = readSessionSecret() !== null;
  // Still signed in (checked against the staff table) → skip the form.
  if (configured && (await getStaffSession())) redirect(safeNext(params.next));

  return (
    <main className="grid min-h-screen bg-slate-100/70 lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[48px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-brand">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">hotulan.mn</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight">Дэлгүүрийн удирдлагын төв</h2>
          <p className="mt-4 text-base leading-relaxed text-blue-100">
            Захиалга, барааны үлдэгдэл, борлуулалтаа нэг дороос хянаарай.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-blue-100">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Зөвхөн эрх бүхий ажилтанд зориулагдсан
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white">
              <Store className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="font-extrabold tracking-tight text-slate-900">
              hotulan<span className="text-brand">.mn</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Админ нэвтрэх</h1>
          <p className="mt-1.5 text-sm text-slate-500">Үргэлжлүүлэхийн тулд бүртгэлээрээ нэвтэрнэ үү.</p>

          {configured ? (
            <LoginForm next={safeNext(params.next)} expired={params.expired === "1"} />
          ) : (
            <div role="alert" className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Нэвтрэлт тохируулагдаагүй байна</p>
              <p className="mt-1">
                Серверийн <code className="rounded bg-amber-100 px-1">.env.local</code> файлд{" "}
                <code className="rounded bg-amber-100 px-1">SESSION_SECRET</code> (32+ тэмдэгт), анхны удаад{" "}
                <code className="rounded bg-amber-100 px-1">ADMIN_USERNAME</code>,{" "}
                <code className="rounded bg-amber-100 px-1">ADMIN_PASSWORD_HASH</code> утгуудыг оруулаад серверийг дахин
                асаана уу. Аюулгүй байдлын үүднээс тохиргоо дутуу үед админ хэсэг хаалттай байна.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
