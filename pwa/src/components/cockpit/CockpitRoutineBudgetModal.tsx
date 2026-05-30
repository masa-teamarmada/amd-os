"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunctionPOST } from "@/lib/supabase/edge-functions";
import { notifyPlReview } from "@/lib/notify-pl";

interface Props {
  projectId: string;
  ym: string;
  open: boolean;
  onClose: () => void;
}

interface BudgetData {
  status: string | null;
  budgetReportedAmount: number | null;
  budgetBufferAmount: number | null;
  budgetReportedAt: string | null;
  budgetReportedBy: string | null;
  budgetConfirmedAt: string | null;
  budgetYen: number | null;
  projectName: string | null;
  feeType: string | null;
  feeAmount: number | null;
}

const supabase = createClient();

function ymLabel(ym: string) {
  if (ym.length !== 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function fmtYen(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  if (amount < 0) return "—";
  return `¥${Math.round(amount).toLocaleString()}`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  if (val.length >= 10 && val.includes("T")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return val;
}

function calcPjBudget(invoice: number, buffer: number): number {
  return Math.max(0, Math.round(invoice * 0.65) - buffer);
}

async function fetchBudget(projectId: string, ym: string): Promise<BudgetData> {
  const [cycleRes, projectRes] = await Promise.all([
    supabase
      .from("billing_cycles")
      .select(
        "status, budget_reported_amount, budget_buffer_amount, budget_reported_at, budget_reported_by, budget_confirmed_at, budget_yen"
      )
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    supabase.from("projects").select("project_name, fee_type, fee_amount").eq("project_id", projectId).maybeSingle(),
  ]);

  const c = cycleRes.data;
  const p = projectRes.data;
  return {
    status: c?.status ?? null,
    budgetReportedAmount: c?.budget_reported_amount ?? null,
    budgetBufferAmount: c?.budget_buffer_amount ?? null,
    budgetReportedAt: c?.budget_reported_at ?? null,
    budgetReportedBy: c?.budget_reported_by ?? null,
    budgetConfirmedAt: c?.budget_confirmed_at ?? null,
    budgetYen: c?.budget_yen ?? null,
    projectName: p?.project_name ?? null,
    feeType: p?.fee_type ?? null,
    feeAmount: p?.fee_amount ?? null,
  };
}

async function fetchPreviousInvoiceAmount(projectId: string, currentYm: string): Promise<number | null> {
  const { data } = await supabase
    .from("billing_cycles")
    .select("ym, budget_reported_amount")
    .eq("project_id", projectId)
    .lt("ym", currentYm)
    .order("ym", { ascending: false })
    .limit(6);
  for (const row of (data || []) as Array<{ ym: string; budget_reported_amount: number | null }>) {
    if (row.budget_reported_amount && row.budget_reported_amount > 0) return row.budget_reported_amount;
  }
  return null;
}

export function CockpitRoutineBudgetModal({ projectId, ym, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BudgetData | null>(null);
  const [prevInvoice, setPrevInvoice] = useState<number | null>(null);

  const [invoiceText, setInvoiceText] = useState("");
  const [bufferText, setBufferText] = useState("");
  const [showEditArea, setShowEditArea] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState<"approve" | "reject" | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setToast(null);
    setShowEditArea(false);

    (async () => {
      try {
        const b = await fetchBudget(projectId, ym);
        if (cancelled) return;
        setData(b);

        const isMonthlyFixed = (b.feeType || "").toLowerCase() === "monthly_fixed";
        const prev = isMonthlyFixed ? null : await fetchPreviousInvoiceAmount(projectId, ym);
        if (cancelled) return;
        setPrevInvoice(prev);

        const status = b.status || "not_started";
        const isDraft = !["allocation_confirmed", "budget_confirmed", "reported"].includes(status);
        if (isDraft) {
          if (isMonthlyFixed && b.feeAmount && b.feeAmount > 0) {
            setInvoiceText(String(Math.round(b.feeAmount)));
          } else if (prev && prev > 0) {
            setInvoiceText(String(Math.round(prev)));
          } else {
            setInvoiceText("");
          }
          setBufferText("");
        } else {
          setInvoiceText("");
          setBufferText("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, ym]);

  const invoiceAmount = Number(invoiceText) || 0;
  const bufferAmount = Number(bufferText) || 0;
  const pjBudget = calcPjBudget(invoiceAmount, bufferAmount);

  const isMonthlyFixed = (data?.feeType || "").toLowerCase() === "monthly_fixed";
  const fixedInvoiceAmount = isMonthlyFixed && data?.feeAmount && data.feeAmount > 0
    ? Math.round(data.feeAmount)
    : null;
  const invoicePlaceholder = isMonthlyFixed && data?.feeAmount
    ? `${Math.round(data.feeAmount)}`
    : prevInvoice && prevInvoice > 0
      ? `${Math.round(prevInvoice)}`
      : "例: 500000";

  async function submit() {
    if (invoiceAmount <= 0) {
      setToast({ msg: "請求額を入力してください", isError: true });
      return;
    }
    setSubmitting(true);
    setToast(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const byEmail = userData.user?.email || "";
      const body: Record<string, unknown> = {
        project_id: projectId,
        ym,
        status: "reported",
        budget_reported_amount: invoiceAmount,
        budget_buffer_amount: bufferAmount,
        budget_reported_at: new Date().toISOString(),
        budget_reported_by: byEmail,
        member_allocations_json: null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .upsert(body, { onConflict: "project_id,ym" });
      if (updateError) throw updateError;

      // admin に Slack DM (失敗してもノーエラー)
      callEdgeFunctionPOST("send-budget-approval-nudge", {
        projectId,
        ym,
        pmEmail: byEmail,
      }).catch(() => { /* ignore */ });

      // PL にも確認依頼を Slack DM (#13)
      const plRes = await notifyPlReview({ projectId, ym, taskKind: "budget", taskLabel: "請求額確定" });

      setToast({
        msg: plRes.sent > 0 ? `請求額案を保存しました (PL ${plRes.sent} 名に通知)` : "請求額案を保存しました",
        isError: false,
      });
      setTimeout(() => onClose(), 1300);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    setWithdrawing(true);
    setToast(null);
    try {
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update({
          status: "draft",
          budget_reported_amount: null,
          budget_buffer_amount: null,
          budget_reported_at: null,
          budget_reported_by: null,
          budget_yen: null,
          budget_confirmed_at: null,
          budget_confirmed_by: null,
          member_allocations_json: null,
        })
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (updateError) throw updateError;
      setToast({ msg: "取り下げました", isError: false });
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setWithdrawing(false);
      setShowWithdrawConfirm(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    setApprovalBusy(decision);
    setToast(null);
    try {
      const res = await fetch("/api/admin/budget-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, decision }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        invoiceYen?: number;
        bufferYen?: number;
        budgetYen?: number;
        status?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData((prev) => prev
        ? {
            ...prev,
            status: json.status || (decision === "approve" ? "budget_confirmed" : "budget_rejected"),
            budgetReportedAmount: json.invoiceYen ?? prev.budgetReportedAmount,
            budgetBufferAmount: json.bufferYen ?? prev.budgetBufferAmount,
            budgetYen: decision === "approve" ? (json.budgetYen ?? prev.budgetYen) : null,
            budgetConfirmedAt: decision === "approve" ? new Date().toISOString() : null,
          }
        : prev
      );
      setToast({ msg: decision === "approve" ? "請求額とPJ予算を確定しました" : "差し戻しました", isError: false });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setApprovalBusy(null);
    }
  }

  const status = data?.status || "not_started";
  const isConfirmed = status === "allocation_confirmed" || status === "budget_confirmed";
  const isReported = status === "reported";
  const isRejected = status === "budget_rejected";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>請求額確定</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>}
        {error && (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between text-sm">
              <span className="font-semibold">{data.projectName}</span>
              <span className="text-muted-foreground">{ymLabel(ym)}</span>
            </div>

            {isConfirmed && (
              <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 space-y-2 text-sm">
                <div className="font-semibold text-emerald-700">✓ 請求額確定済み</div>
                <InfoRow label="確定請求額" value={fmtYen(data.budgetReportedAmount)} />
                <InfoRow label="バッファ" value={fmtYen(data.budgetBufferAmount ?? 0)} />
                <InfoRow label="PJ予算（承認額）" value={fmtYen(data.budgetYen)} />
                <InfoRow label="承認日時" value={fmtDate(data.budgetConfirmedAt)} />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={withdrawing}
                >
                  {withdrawing ? "取り下げ中..." : "取り下げる"}
                </Button>
              </section>
            )}

            {isReported && (
              <>
                <section className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2 text-sm">
                  <div className="font-semibold text-orange-700">⏳ 請求額案（admin承認待ち）</div>
                  <InfoRow label="請求額案" value={fmtYen(data.budgetReportedAmount)} />
                  <InfoRow label="バッファ" value={fmtYen(data.budgetBufferAmount ?? 0)} />
                  <InfoRow
                    label="PJ予算（65%−バッファ）"
                    value={fmtYen(calcPjBudget(data.budgetReportedAmount || 0, data.budgetBufferAmount || 0))}
                  />
                  <InfoRow label="入力日時" value={fmtDate(data.budgetReportedAt)} />
                  <InfoRow label="入力者" value={data.budgetReportedBy || "—"} />
                </section>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => decide("approve")}
                    disabled={!!approvalBusy}
                    className="h-8"
                  >
                    {approvalBusy === "approve" ? "承認中..." : "承認する"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => decide("reject")}
                    disabled={!!approvalBusy}
                    className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {approvalBusy === "reject" ? "差し戻し中..." : "差し戻す"}
                  </Button>
                  <span className="flex-1 basis-4" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditArea((v) => !v);
                      if (!showEditArea) {
                        setInvoiceText(
                          data.budgetReportedAmount && data.budgetReportedAmount > 0
                            ? String(Math.round(data.budgetReportedAmount))
                            : fixedInvoiceAmount
                              ? String(fixedInvoiceAmount)
                              : ""
                        );
                        setBufferText(
                          data.budgetBufferAmount && data.budgetBufferAmount > 0
                            ? String(Math.round(data.budgetBufferAmount))
                            : ""
                        );
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showEditArea ? "修正をやめる" : "修正する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWithdrawConfirm(true)}
                    className="text-destructive hover:underline"
                    disabled={withdrawing}
                  >
                    取り下げる
                  </button>
                </div>
              </>
            )}

            {isRejected && !showEditArea && (
              <section className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2 text-sm">
                <div className="font-semibold text-red-700">差し戻し済み</div>
                <InfoRow label="前回の請求額案" value={fmtYen(data.budgetReportedAmount)} />
                <InfoRow label="前回バッファ" value={fmtYen(data.budgetBufferAmount ?? 0)} />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setInvoiceText(
                      data.budgetReportedAmount && data.budgetReportedAmount > 0
                        ? String(Math.round(data.budgetReportedAmount))
                        : fixedInvoiceAmount
                          ? String(fixedInvoiceAmount)
                          : ""
                    );
                    setBufferText(
                      data.budgetBufferAmount && data.budgetBufferAmount > 0
                        ? String(Math.round(data.budgetBufferAmount))
                        : ""
                    );
                    setShowEditArea(true);
                  }}
                >
                  再入力する
                </Button>
              </section>
            )}

            {(!isConfirmed && !isReported && !isRejected) || ((isReported || isRejected) && showEditArea) ? (
              <div className="space-y-4">
                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">
                      {fixedInvoiceAmount ? `今月も${fmtYen(fixedInvoiceAmount)}でおけ？` : "今月の請求額を入力"}
                    </h3>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      ここで入力した金額がOSの請求額になる。freee請求書を発行した後は、freee発行時の明細合計を入金確認の正本にする。
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invoice-amount" className="text-xs text-muted-foreground">
                      請求額（税抜）
                      {isMonthlyFixed && data.feeAmount && data.feeAmount > 0 && (
                        <span className="ml-2 text-[10px] text-muted-foreground/70">月額固定: {fmtYen(data.feeAmount)}</span>
                      )}
                      {!isMonthlyFixed && prevInvoice && prevInvoice > 0 && (
                        <span className="ml-2 text-[10px] text-muted-foreground/70">前月: {fmtYen(prevInvoice)}</span>
                      )}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="invoice-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder={invoicePlaceholder}
                        value={invoiceText}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setInvoiceText(e.target.value.replace(/\D/g, ""))}
                      />
                      <span className="text-sm text-muted-foreground">円</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="buffer-amount" className="text-xs text-muted-foreground">バッファ（任意）</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="buffer-amount"
                        type="text"
                        inputMode="numeric"
                        value={bufferText}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setBufferText(e.target.value.replace(/\D/g, ""))}
                      />
                      <span className="text-sm text-muted-foreground">円</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">バッファ分だけPJ予算が減ります</p>
                  </div>
                  {invoiceAmount > 0 && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>PJ予算</span>
                        <span className="text-[10px]">
                          = {fmtYen(invoiceAmount)} × 65%
                          {bufferAmount > 0 && ` − ${fmtYen(bufferAmount)}`}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-blue-700">{fmtYen(pjBudget)}</div>
                    </div>
                  )}
                </section>

                <div className="flex flex-col gap-2">
                  <Button onClick={submit} disabled={submitting || !invoiceText}>
                    {submitting
                      ? "保存中..."
                      : fixedInvoiceAmount && invoiceAmount === fixedInvoiceAmount
                        ? `${fmtYen(fixedInvoiceAmount)}でPLに確認依頼する`
                        : "PLに確認依頼する"}
                  </Button>
                </div>
              </div>
            ) : null}

            {toast && (
              <div
                className={`rounded-md px-3 py-2 text-xs ${
                  toast.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {toast.msg}
              </div>
            )}
          </div>
        )}

        {showWithdrawConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-background rounded-xl p-4 w-full max-w-sm space-y-3 shadow-xl">
              <h3 className="font-semibold">請求額案を取り下げますか？</h3>
              <p className="text-xs text-muted-foreground">
                入力済みの請求額案・承認額がクリアされ、未入力状態に戻ります。
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowWithdrawConfirm(false)} disabled={withdrawing}>
                  キャンセル
                </Button>
                <Button variant="destructive" size="sm" onClick={withdraw} disabled={withdrawing}>
                  {withdrawing ? "取り下げ中..." : "取り下げる"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
