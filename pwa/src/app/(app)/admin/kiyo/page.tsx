import type { Metadata } from "next";
import Link from "next/link";
import AdminInvoicesPage from "@/app/(app)/admin/invoices/page";
import AdminPayoutsPage from "@/app/(app)/admin/payouts/page";
import { ReimburseWorkspace } from "@/app/(app)/reimburse/page";
import { KiyoMoneyFlowPanel } from "@/components/admin/kiyo-money-flow/KiyoMoneyFlowPanel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "きよ - AMD OS" } };

const KIYO_TASKS = [
  {
    id: "money-flow",
    step: "00",
    label: "お金の流れ",
    description: "どこから入り何に使ったか",
  },
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
      <header className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">きよ</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          月次経理の処理をここで完了する。立替精算、請求書、メンバー支払を作業順に進めてね。
        </p>
      </header>

      <div className="mb-3">
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
                href={`/admin/kiyo?task=${task.id}`}
                role="tab"
                aria-selected={selected}
                aria-current={selected ? "page" : undefined}
                aria-controls={`kiyo-panel-${task.id}`}
                className={cn(
                  "flex min-h-11 w-[168px] shrink-0 flex-col justify-center gap-0.5 rounded-none border border-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-full",
                  index > 0 && "-ml-px",
                  selected
                    ? "relative z-10 -mb-px border-t-2 border-t-foreground border-b-background bg-background"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{task.step}</span>
                  <span className={cn("text-sm", selected ? "font-semibold text-foreground" : "font-medium")}>
                    {task.label}
                  </span>
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{task.description}</span>
              </Link>
            );
          })}
        </div>

        <section
          id={`kiyo-panel-${activeTask}`}
          role="tabpanel"
          aria-labelledby={`kiyo-tab-${activeTask}`}
          className="rounded-none border border-border bg-background p-3"
        >
          {activeTask === "money-flow" ? <KiyoMoneyFlowPanel /> : null}
          {activeTask === "reimbursements" ? <ReimburseWorkspace embedded /> : null}
          {activeTask === "invoices" ? <AdminInvoicesPage embedded /> : null}
          {activeTask === "payouts" ? <AdminPayoutsPage embedded /> : null}
        </section>
      </div>
    </div>
  );
}
