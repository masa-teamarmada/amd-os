import type { Metadata } from "next";
import { loadTargetData } from "@/app/api/admin/payouts/route";
import {
  buildKiyoOverviewRows,
  type KiyoBillingCycleInput,
  type KiyoBillingLogInput,
  type KiyoCellState,
  type KiyoPayoutCycleInput,
  type KiyoPayoutEntryInput,
  type KiyoProjectInput,
  type KiyoReimbursementInput,
} from "@/lib/admin-kiyo";
import { currentYmJst } from "@/lib/payment-groups";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "きよ月次経理 - AMD OS" } };

function displayYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function nextMonthStart(ym: string) {
  const next = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function yen(value: number) {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}

function StatusBadge({ state, label }: { state: KiyoCellState; label: string }) {
  return (
    <span className={cn(
      "inline-flex min-h-7 items-center rounded-md px-2 py-1 text-xs font-medium",
      state === "done" && "bg-accent text-accent-foreground",
      state === "attention" && "border border-foreground/20 bg-background text-foreground",
      state === "pending" && "bg-muted text-foreground",
      state === "empty" && "bg-muted/50 text-muted-foreground",
      state === "unknown" && "border border-dashed border-border text-muted-foreground",
    )}>
      {label}
    </span>
  );
}

function ProjectName({ projectName, clientName }: { projectName: string; clientName: string | null }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-foreground" title={projectName}>{projectName}</div>
      {clientName && clientName !== projectName ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={clientName}>{clientName}</div>
      ) : null}
    </div>
  );
}

export default async function AdminKiyoPage() {
  const ym = currentYmJst();
  const dateStart = `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
  const supabase = await createClient();

  const [payoutResult, projectsResult, billingResult, datedReimbursementsResult, billedReimbursementsResult, logsResult] = await Promise.all([
    loadTargetData(ym, { includeAgreementGate: false })
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => ({ data: null, error })),
    supabase.from("projects").select("project_id, project_name, client_name, status").eq("status", "active").order("project_name"),
    supabase.from("billing_cycles").select("project_id, invoice_sent_at, invoice_sent_by").eq("ym", ym),
    supabase.from("reimbursements").select("reimbursement_id, project_id, status").gte("date", dateStart).lt("date", nextMonthStart(ym)),
    supabase.from("reimbursements").select("reimbursement_id, project_id, status").eq("billed_ym", ym),
    supabase.from("billing_log").select("project_id, action, actor").eq("ym", ym),
  ]);

  const projectFallback = ((payoutResult.data?.projects ?? []) as KiyoProjectInput[]).filter((project) => project.status === "active");
  const projects = (projectsResult.data ?? projectFallback) as KiyoProjectInput[];
  const reimbursementMap = new Map<string, KiyoReimbursementInput>();
  for (const row of [
    ...((datedReimbursementsResult.data ?? []) as KiyoReimbursementInput[]),
    ...((billedReimbursementsResult.data ?? []) as KiyoReimbursementInput[]),
  ]) reimbursementMap.set(row.reimbursement_id, row);

  const availability = {
    payout: payoutResult.data !== null,
    billing: !billingResult.error,
    billingLogs: !logsResult.error,
    reimbursements: !datedReimbursementsResult.error && !billedReimbursementsResult.error,
  };
  const rows = buildKiyoOverviewRows({
    projects,
    payoutCycles: (payoutResult.data?.cycles ?? []) as KiyoPayoutCycleInput[],
    payoutEntries: (payoutResult.data?.expectedEntries ?? []) as KiyoPayoutEntryInput[],
    billingCycles: (billingResult.data ?? []) as KiyoBillingCycleInput[],
    billingLogs: (logsResult.data ?? []) as KiyoBillingLogInput[],
    reimbursements: [...reimbursementMap.values()],
    availability,
  });

  const unavailable = [
    payoutResult.error ? "メンバー支払" : null,
    projectsResult.error && projectFallback.length === 0 ? "PJ台帳" : null,
    billingResult.error ? "請求書送付" : null,
    datedReimbursementsResult.error || billedReimbursementsResult.error ? "立替精算" : null,
    logsResult.error ? "経理証跡" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">きよ月次経理</h1>
          <span className="text-sm text-muted-foreground">{displayYm(ym)} · 読み取り専用</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          active PJのメンバー支払、立替精算、請求書送付を月次で確認する。操作は各専用画面で行う。
        </p>
      </header>

      {unavailable.length > 0 ? (
        <div role="alert" className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="font-medium text-foreground">一部データを取得できなかった</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {unavailable.join("、")}は未確認として表示している。0件や完了には置き換えていない。
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-background px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">表示できるactive PJがない</p>
          <p className="mt-1 text-xs text-muted-foreground">PJ台帳の取得状態とstatusを確認してね。</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="w-[31%] px-4 py-3">PJ</th>
                  <th scope="col" className="w-[23%] px-4 py-3">メンバー支払</th>
                  <th scope="col" className="w-[23%] px-4 py-3">立替精算</th>
                  <th scope="col" className="w-[23%] px-4 py-3">請求書送付</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const sentAt = dateLabel(row.invoice.sentAt);
                  return (
                    <tr key={row.projectId} className="align-top">
                      <th scope="row" className="px-4 py-4 font-normal"><ProjectName projectName={row.projectName} clientName={row.clientName} /></th>
                      <td className="px-4 py-4">
                        <StatusBadge state={row.payout.state} label={row.payout.label} />
                        {row.payout.amountYen !== null ? <div className="mt-1.5 text-sm tabular-nums text-foreground">{yen(row.payout.amountYen)}</div> : null}
                      </td>
                      <td className="px-4 py-4"><StatusBadge state={row.reimbursement.state} label={row.reimbursement.label} /></td>
                      <td className="px-4 py-4">
                        <StatusBadge state={row.invoice.state} label={row.invoice.label} />
                        {sentAt ? <div className="mt-1.5 text-xs text-muted-foreground">送付記録 {sentAt}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const sentAt = dateLabel(row.invoice.sentAt);
              return (
                <section key={row.projectId} className="rounded-lg border border-border bg-background p-4">
                  <ProjectName projectName={row.projectName} clientName={row.clientName} />
                  <dl className="mt-4 divide-y divide-border text-sm">
                    <div className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <dt className="text-xs text-muted-foreground">メンバー支払</dt>
                      <dd className="text-right">
                        <StatusBadge state={row.payout.state} label={row.payout.label} />
                        {row.payout.amountYen !== null ? <div className="mt-1 text-xs tabular-nums text-foreground">{yen(row.payout.amountYen)}</div> : null}
                      </dd>
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <dt className="text-xs text-muted-foreground">立替精算</dt>
                      <dd><StatusBadge state={row.reimbursement.state} label={row.reimbursement.label} /></dd>
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <dt className="text-xs text-muted-foreground">請求書送付</dt>
                      <dd className="text-right">
                        <StatusBadge state={row.invoice.state} label={row.invoice.label} />
                        {sentAt ? <div className="mt-1 text-xs text-muted-foreground">送付記録 {sentAt}</div> : null}
                      </dd>
                    </div>
                  </dl>
                </section>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        「経理確認」は請求書送付記録に経理アドレスの証跡がある場合だけ表示する。送付済みでも証跡が無い行は「要確認」。
      </p>
    </div>
  );
}
