/**
 * きよページ — AMD OS 本体の /admin/kiyo と同じ4タブ構成。
 *
 * 【原則】どのタブも計算しない。本体が確定させた結果を表示して、承認するだけ。
 *   00 お金の流れ  本体の集計APIをそのまま表示（中継のみ）
 *   01 立替精算    一覧を読む＋承認を本体へ取り次ぐ
 *   02 請求書      状態の確認だけ（発行は本体。freee に本物を作る操作なので）
 *   03 メンバー支払 本体が確定させた通知書を見て、送付済みにする
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentYmJst } from "@/lib/ym";
import { MoneyFlowClient } from "@/components/MoneyFlowClient";
import { ReimbursementsClient } from "@/components/ReimbursementsClient";
import { InvoicesClient } from "@/components/InvoicesClient";
import { PayoutNoticeClient } from "@/components/PayoutNoticeClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "きよ",
};

const KIYO_TASKS = [
  { id: "money-flow", step: "00", label: "お金の流れ", description: "どこから入り何に使ったか" },
  { id: "reimbursements", step: "01", label: "立替精算", description: "確認して承認する" },
  { id: "invoices", step: "02", label: "請求書", description: "発行・送付・入金の状態" },
  { id: "payouts", step: "03", label: "メンバー支払", description: "通知書を見て送付する" },
] as const;

type KiyoTask = (typeof KIYO_TASKS)[number]["id"];

function resolveTask(value: string | string[] | undefined): KiyoTask {
  const candidate = Array.isArray(value) ? value[0] : value;
  return KIYO_TASKS.some((task) => task.id === candidate)
    ? (candidate as KiyoTask)
    : "money-flow";
}

export default async function KiyoPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    redirect("/auth/login?next=/kiyo");
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
          この画面は AMD OS の admin だけが見られる。{user.email} には admin 権限がついてない。
        </p>
      </main>
    );
  }

  const params = await searchParams;
  const activeTask = resolveTask(params.task);
  const displayName = member.member_name || member.code_name || user.email;
  const ym = currentYmJst();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <header className="mb-3">
        <Link href="/" className="text-xs text-slate-500 hover:underline">
          ← きよ専用 AMD OS
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">きよ</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          月次経理をここで確認して承認する。{displayName}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="きよの月次経理"
        className="flex overflow-x-auto sm:grid sm:grid-cols-4 sm:overflow-visible"
      >
        {KIYO_TASKS.map((task, index) => {
          const selected = task.id === activeTask;
          return (
            <Link
              key={task.id}
              id={`kiyo-tab-${task.id}`}
              href={`/kiyo?task=${task.id}`}
              role="tab"
              aria-selected={selected}
              aria-current={selected ? "page" : undefined}
              aria-controls={`kiyo-panel-${task.id}`}
              className={[
                "flex min-h-11 w-[168px] shrink-0 flex-col justify-center gap-0.5 border border-slate-200 px-3 py-2 sm:w-full",
                index > 0 ? "-ml-px" : "",
                selected
                  ? "relative z-10 -mb-px border-t-2 border-t-slate-900 border-b-white bg-white"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100",
              ].join(" ")}
            >
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-slate-500">{task.step}</span>
                <span className={selected ? "text-sm font-semibold text-slate-900" : "text-sm font-medium"}>
                  {task.label}
                </span>
              </span>
              <span className="truncate text-[11px] text-slate-500">{task.description}</span>
            </Link>
          );
        })}
      </div>

      <section
        id={`kiyo-panel-${activeTask}`}
        role="tabpanel"
        aria-labelledby={`kiyo-tab-${activeTask}`}
        className="border border-slate-200 bg-white p-3"
      >
        {activeTask === "money-flow" ? <MoneyFlowClient /> : null}
        {activeTask === "reimbursements" ? <ReimbursementsClient /> : null}
        {activeTask === "invoices" ? <InvoicesClient initialYm={ym} /> : null}
        {activeTask === "payouts" ? <PayoutNoticeClient initialYm={ym} embedded /> : null}
      </section>
    </main>
  );
}
