import type { Metadata } from "next";
import Link from "next/link";
import AdminInvoicesPage from "@/app/(app)/admin/invoices/page";
import AdminPayoutsPage from "@/app/(app)/admin/payouts/page";
import { ReimburseWorkspace } from "@/app/(app)/reimburse/page";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "きよ - AMD OS" } };

const KIYO_TASKS = [
  {
    id: "reimbursements",
    step: "01",
    label: "立替精算",
    description: "申請・PM承認・admin承認",
  },
  {
    id: "invoices",
    step: "02",
    label: "請求書",
    description: "発行前確認・freee発行・取消",
  },
  {
    id: "payouts",
    step: "03",
    label: "メンバー支払",
    description: "支払確認・通知書発行・送付",
  },
] as const;

type KiyoTask = (typeof KIYO_TASKS)[number]["id"];

function resolveTask(value: string | string[] | undefined): KiyoTask {
  const candidate = Array.isArray(value) ? value[0] : value;
  return KIYO_TASKS.some((task) => task.id === candidate) ? candidate as KiyoTask : "reimbursements";
}

export default async function AdminKiyoPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeTask = resolveTask(params.task);

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">きよ</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          月次経理の処理をここで完了する。立替精算、請求書、メンバー支払を作業順に進めてね。
        </p>
      </header>

      <nav aria-label="きよの月次経理" className="mb-6 grid gap-2 sm:grid-cols-3">
        {KIYO_TASKS.map((task) => {
          const selected = task.id === activeTask;
          return (
            <Link
              key={task.id}
              href={`/admin/kiyo?task=${task.id}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "group min-h-16 rounded-lg border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground/25 bg-accent text-accent-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent/50",
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{task.step}</span>
                <span className="text-sm font-semibold">{task.label}</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{task.description}</span>
            </Link>
          );
        })}
      </nav>

      <section aria-label={KIYO_TASKS.find((task) => task.id === activeTask)?.label}>
        {activeTask === "reimbursements" ? <ReimburseWorkspace embedded /> : null}
        {activeTask === "invoices" ? <AdminInvoicesPage /> : null}
        {activeTask === "payouts" ? <AdminPayoutsPage /> : null}
      </section>
    </div>
  );
}
