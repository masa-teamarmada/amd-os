import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * きよ専用 AMD OS のトップ（ハブ）。
 * 機能を足すときは FEATURES に1行足して、対応するページを作る。
 *
 * 【原則】このアプリは金額を計算しない。AMD OS 本体が確定させた結果を
 * 表示して承認するだけ。計算やコピーを持ち込むと本体とズレて金額事故になる。
 */
const FEATURES = [
  {
    href: "/kiyo?task=money-flow",
    title: "00 お金の流れ",
    description: "どこから入って何に使ったか。本体の集計をそのまま表示する",
    status: "ready" as const,
  },
  {
    href: "/kiyo?task=reimbursements",
    title: "01 立替精算",
    description: "申請された立替を確認して、承認・却下する",
    status: "ready" as const,
  },
  {
    href: "/kiyo?task=invoices",
    title: "02 請求書",
    description: "発行・送付・入金の状態を確認する（発行操作は本体）",
    status: "ready" as const,
  },
  {
    href: "/kiyo?task=payouts",
    title: "03 メンバー支払",
    description: "確定した支払通知書を見て、送付済みにする",
    status: "ready" as const,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    redirect("/auth/login?next=/");
  }

  const { data: member } = await supabase
    .from("members")
    .select("is_admin, member_name, code_name")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!member?.is_admin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-lg font-semibold">権限がない</h1>
        <p className="mt-2 text-sm text-slate-600">
          このアプリは AMD OS の admin だけが使える。{user.email} には admin 権限がついてない。
        </p>
      </main>
    );
  }

  const displayName = member.member_name || member.code_name || user.email;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">◈ きよ専用 AMD OS</h1>
        <p className="mt-1 text-sm text-slate-500">Team ARMADA 管理業務 / {displayName}</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            <div className="text-base font-semibold group-hover:underline">{feature.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{feature.description}</p>
          </Link>
        ))}
      </section>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
        このアプリは<strong>見て承認するための道具</strong>で、金額の計算はしない。
        出ている数字はすべて AMD OS 本体が確定させたもので、報酬もPDFも本体が毎晩つくる。
        金額を決める操作・請求書の発行・PJ別収支や予算確定は、本家 AMD OS の
        <code className="mx-1">/admin/kiyo</code>
        側でやる。
      </p>
    </main>
  );
}
