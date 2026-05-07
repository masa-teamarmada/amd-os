"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunctionPOST } from "@/lib/supabase/edge-functions";
import { computePaymentDueDate } from "@/lib/japanese-holidays";
import { notifyPlReview } from "@/lib/notify-pl";

const CTB_ESTIMATE_MARKER = "[[CTB_ESTIMATE_SENT]]";

type DocumentType = "invoice" | "quotation";

interface Props {
  projectId: string;
  ym: string;
  documentType: DocumentType;
  open: boolean;
  onClose: () => void;
}

interface BaseLineRaw {
  type?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
}

interface ReimbItem {
  description: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
}

interface PreviewData {
  projectName: string;
  baseLines: BaseLineRaw[];
  reimbItems: ReimbItem[];
  reimbYen: number;
  invoiceSubject: string;
  fromPrevMonth: boolean;
  issuedAt: string;
  freeeInvoiceNumber: string;
  invoicePdfUrl: string;
  paymentDueDay: number | null;
  previousInvoiceNumber: string | null;
  previousInvoicePdfUrl: string | null;
}

interface EditableLine {
  id: string;
  lineType: "item" | "text";
  description: string;
  quantity: string;
  unitPrice: string;
}

const supabase = createClient();

function ymLabel(ym: string) {
  if (ym.length !== 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function fmtYen(v: number): string {
  return Math.round(v).toLocaleString();
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function newLine(type: "item" | "text"): EditableLine {
  return {
    id: uid(),
    lineType: type,
    description: "",
    quantity: type === "item" ? "1" : "",
    unitPrice: "",
  };
}

function prevYm(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
}

function nextYmStart(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function ymStartDate(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

// 支払期日は computePaymentDueDate (japanese-holidays.ts) を使う。
// PJ ごとの payment_due_day が設定されていればそれを翌月の N 日に、
// 無ければ翌月末をデフォルトに、土日祝なら前営業日に補正する。

function todayJst(): string {
  const d = new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function stripMarker(arr: BaseLineRaw[]): BaseLineRaw[] {
  return arr.filter((row) => row.description !== CTB_ESTIMATE_MARKER);
}

async function fetchPreview(projectId: string, ym: string): Promise<PreviewData> {
  const prev = prevYm(ym);
  const [cycleRes, projectRes, reimbRes, prevCycleRes] = await Promise.all([
    supabase
      .from("billing_cycles")
      .select(
        "invoice_base_lines_json, invoice_subject, freee_invoice_number, invoice_pdf_url, invoice_issued_at, budget_yen"
      )
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    supabase.from("projects").select("project_name, payment_due_day").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("reimbursements")
      .select("description, amount, date, category")
      .eq("project_id", projectId)
      .eq("status", "approved")
      .gte("date", ymStartDate(ym))
      .lt("date", nextYmStart(ym)),
    supabase
      .from("billing_cycles")
      .select("freee_invoice_number, invoice_pdf_url")
      .eq("project_id", projectId)
      .eq("ym", prev)
      .maybeSingle(),
  ]);

  const cycle = cycleRes.data;
  const project = projectRes.data;
  const prevCycle = prevCycleRes.data;
  const reimbs: ReimbItem[] = ((reimbRes.data as ReimbItem[] | null) || []).map((r) => ({
    description: r.description,
    amount: r.amount,
    date: r.date,
    category: r.category,
  }));

  let baseLines: BaseLineRaw[] = [];
  let fromPrevMonth = false;
  if (cycle?.invoice_base_lines_json) {
    try {
      const arr = JSON.parse(cycle.invoice_base_lines_json) as BaseLineRaw[];
      if (Array.isArray(arr)) baseLines = stripMarker(arr);
    } catch {}
  }
  if (baseLines.length === 0) {
    const { data: prev } = await supabase
      .from("billing_cycles")
      .select("invoice_base_lines_json, invoice_subject")
      .eq("project_id", projectId)
      .eq("ym", prevYm(ym))
      .maybeSingle();
    if (prev?.invoice_base_lines_json) {
      try {
        const arr = JSON.parse(prev.invoice_base_lines_json) as BaseLineRaw[];
        if (Array.isArray(arr) && arr.length > 0) {
          baseLines = stripMarker(arr);
          if (baseLines.length > 0) fromPrevMonth = true;
        }
      } catch {}
    }
  }
  if (baseLines.length === 0) {
    const ymY = ym.slice(0, 4);
    const ymM = Number(ym.slice(4, 6));
    baseLines = [
      {
        type: "item",
        description: `${ymY}年${ymM}月分　業務委託費`,
        quantity: 1,
        unit_price: cycle?.budget_yen ?? 0,
      },
    ];
  }

  const reimbYen = reimbs.reduce((s, r) => s + (r.amount ?? 0), 0);

  return {
    projectName: project?.project_name ?? projectId,
    baseLines,
    reimbItems: reimbs,
    reimbYen,
    invoiceSubject: cycle?.invoice_subject ?? "",
    fromPrevMonth,
    issuedAt: cycle?.invoice_issued_at ?? "",
    freeeInvoiceNumber: cycle?.freee_invoice_number ?? "",
    invoicePdfUrl: cycle?.invoice_pdf_url ?? "",
    paymentDueDay: project?.payment_due_day ?? null,
    previousInvoiceNumber: prevCycle?.freee_invoice_number ?? null,
    previousInvoicePdfUrl: prevCycle?.invoice_pdf_url ?? null,
  };
}

function buildAllLinesJson(lines: EditableLine[], documentType: DocumentType): string {
  const out: Array<Record<string, string>> = lines.map((line) => {
    if (line.lineType === "text") {
      return { type: "text", description: line.description };
    }
    return {
      type: "item",
      description: line.description,
      quantity: line.quantity || "1",
      unit_price: line.unitPrice || "0",
    } as Record<string, string>;
  });
  if (documentType === "quotation") {
    const filtered = out.filter((row) => row.description !== CTB_ESTIMATE_MARKER);
    filtered.push({ type: "text", description: CTB_ESTIMATE_MARKER });
    return JSON.stringify(filtered);
  }
  return JSON.stringify(out);
}

export function CockpitRoutineInvoiceModal({ projectId, ym, documentType, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [actuallyDone, setActuallyDone] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [subject, setSubject] = useState("");
  const [issueDate, setIssueDate] = useState(todayJst());
  const [dueDate, setDueDate] = useState(todayJst());
  const [issuing, setIssuing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const title = documentType === "quotation" ? "見積書発行" : "請求書発行";
  const numberLabel = documentType === "quotation" ? "見積書番号" : "請求書番号";
  const issueButtonLabel = documentType === "quotation" ? "見積書を発行する" : "請求書を発行する";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setToast(null);

    (async () => {
      try {
        const data = await fetchPreview(projectId, ym);
        if (cancelled) return;
        setPreview(data);
        setSubject(data.invoiceSubject);
        const editable: EditableLine[] = data.baseLines
          .filter((b) => (b.description || "").length > 0)
          .map((b) => ({
            id: uid(),
            lineType: b.type === "text" ? "text" : "item",
            description: b.description || "",
            quantity:
              b.quantity != null
                ? b.quantity === 1
                  ? "1"
                  : String(Math.round(b.quantity))
                : "1",
            unitPrice: b.unit_price && b.unit_price > 0 ? String(Math.round(b.unit_price)) : "",
          }));
        setLines(editable.length > 0 ? editable : [newLine("item")]);
        setIssueDate(todayJst());
        setDueDate(computePaymentDueDate(ym, data.paymentDueDay));
        setActuallyDone(documentType === "invoice" && !!data.issuedAt);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, ym, documentType]);

  const gross = useMemo(
    () =>
      lines.reduce((s, l) => {
        if (l.lineType !== "item") return s;
        const q = Number(l.quantity) || 1;
        const p = Number(l.unitPrice) || 0;
        return s + q * p;
      }, 0),
    [lines]
  );

  const reimbYen = preview?.reimbYen || 0;
  const tax = Math.round((gross + reimbYen) * 0.1);
  const total = gross + reimbYen + tax;

  function updateLine(id: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function deleteLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function moveLine(id: string, dir: -1 | 1) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  async function saveDraft() {
    setSavingDraft(true);
    setToast(null);
    try {
      const body: Record<string, unknown> = {};
      if (subject) body.invoice_subject = subject;
      const json = buildAllLinesJson(lines, documentType);
      if (json) body.invoice_base_lines_json = json;
      if (Object.keys(body).length === 0) {
        setToast({ msg: "保存する内容がありません", isError: true });
        return;
      }
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update(body)
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (updateError) throw updateError;
      setToast({ msg: "下書きを保存したよ", isError: false });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setSavingDraft(false);
    }
  }

  async function issue() {
    setIssuing(true);
    setToast(null);
    try {
      const allLinesJson = buildAllLinesJson(lines, documentType);
      const body: Record<string, unknown> = {
        projectId,
        ym,
        issueDate,
        dueDate,
        allLinesJson,
        documentType,
      };
      if (subject) body.invoiceSubject = subject;

      const result = await callEdgeFunctionPOST<{ ok: boolean; freeeInvoiceNumber?: string; message?: string }>(
        "issue-invoice",
        body
      );
      if (result.ok) {
        const num = result.freeeInvoiceNumber || "";
        const taskKind = documentType === "quotation" ? "estimateSend" : "invoiceIssue";
        const taskLabel = documentType === "quotation" ? "見積書発行" : "請求書発行";
        const plRes = await notifyPlReview({ projectId, ym, taskKind, taskLabel });
        const baseMsg = num ? `発行完了！（${num}）` : `${documentType === "quotation" ? "見積書" : "請求書"}を発行したよ！`;
        setToast({
          msg: plRes.sent > 0 ? `${baseMsg} (PL ${plRes.sent} 名に通知)` : baseMsg,
          isError: false,
        });
        setActuallyDone(true);
        setTimeout(() => onClose(), 1500);
      } else {
        setToast({ msg: result.message || "発行に失敗しました", isError: true });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setIssuing(false);
    }
  }

  async function cancel() {
    setCanceling(true);
    setShowCancelConfirm(false);
    setToast(null);
    try {
      const result = await callEdgeFunctionPOST<{ ok: boolean; message?: string }>("cancel-invoice", {
        projectId,
        ym,
        documentType,
      });
      if (result.ok) {
        setToast({
          msg: result.message || `${documentType === "quotation" ? "見積書" : "請求書"}の発行を取り消したよ`,
          isError: false,
        });
        setActuallyDone(false);
        setTimeout(() => onClose(), 1500);
      } else {
        setToast({ msg: result.message || "取り消しに失敗しました", isError: true });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setCanceling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-2xl sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>}

        {error && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{ymLabel(ym)}</span>
              {actuallyDone && <span className="text-xs text-emerald-700">✓ 発行済み</span>}
            </div>

            {/* 前月の請求書リンク (#12) — 過去の請求番号やPDFを参照しやすく */}
            {documentType === "invoice" && (preview.previousInvoiceNumber || preview.previousInvoicePdfUrl) && (
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs space-y-1">
                <div className="font-semibold text-blue-700">📎 前月の請求書</div>
                {preview.previousInvoiceNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">請求書番号</span>
                    <span className="font-mono">{preview.previousInvoiceNumber}</span>
                  </div>
                )}
                {preview.previousInvoicePdfUrl && (
                  <a
                    href={preview.previousInvoicePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline truncate"
                  >
                    {preview.previousInvoicePdfUrl}
                  </a>
                )}
              </section>
            )}

            {actuallyDone && documentType === "invoice" && (
              <section className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                <h3 className="text-xs font-semibold text-muted-foreground">発行済み情報</h3>
                {preview.freeeInvoiceNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{numberLabel}</span>
                    <span className="font-mono">{preview.freeeInvoiceNumber}</span>
                  </div>
                )}
                {preview.issuedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">発行日</span>
                    <span>{preview.issuedAt.slice(0, 10)}</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={canceling}
                >
                  {canceling ? "取り消し中..." : "✕ 発行を取り消す"}
                </Button>
              </section>
            )}

            <section className="space-y-1">
              <Label htmlFor="invoice-subject" className="text-xs text-muted-foreground">
                {documentType === "quotation" ? "件名（freee見積書の件名）" : "件名（freee請求書の件名）"}
              </Label>
              <Textarea
                id="invoice-subject"
                rows={1}
                placeholder="〇〇社 2026年4月分 業務委託費"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {documentType === "quotation" ? "見積明細" : "請求明細"}
                </h3>
                {preview.fromPrevMonth && (
                  <span className="text-[10px] text-muted-foreground">↺ 前月から引き継ぎ</span>
                )}
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={line.id} className="rounded-lg border border-border p-2 space-y-2 bg-background">
                    {line.lineType === "item" ? (
                      <>
                        <Textarea
                          rows={1}
                          placeholder="品目名・説明"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground text-xs">数量</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={line.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                            className="w-16 h-9 text-right font-mono px-2"
                          />
                          <span className="text-muted-foreground text-xs">×</span>
                          <span className="text-muted-foreground">¥</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.unitPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateLine(line.id, {
                                // マイナス記号 (先頭のみ) と数字を許可。数字以外は除外
                                unitPrice: e.target.value.replace(/(?!^-)[^\d]/g, "").replace(/^-+/, "-"),
                              })
                            }
                            className="w-32 h-9 text-right font-mono px-2"
                          />
                          <span className="flex-1" />
                          {Number(line.unitPrice) > 0 && Number(line.quantity) > 0 && (
                            <span className="font-mono text-muted-foreground text-xs">
                              = ¥{fmtYen(Number(line.unitPrice) * Number(line.quantity))}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold bg-muted-foreground/70 text-background px-1.5 py-0.5 rounded mt-0.5">
                          T
                        </span>
                        <Textarea
                          rows={1}
                          placeholder="テキスト（メモ・区切り線など）"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          className="text-sm flex-1"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 text-[10px]">
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => moveLine(line.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                        disabled={idx === lines.length - 1}
                        onClick={() => moveLine(line.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded text-destructive hover:bg-destructive/10"
                        onClick={() => deleteLine(line.id)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine("item")])}>
                  + 品目行を追加
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine("text")])}>
                  + テキスト行を追加
                </Button>
              </div>
            </section>

            {preview.reimbItems.length > 0 && (
              <section className="rounded-lg bg-muted/30 p-3 space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  立替費（{preview.reimbItems.length}件・自動集計）
                </h3>
                {preview.reimbItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      {item.category && <span className="text-[10px] text-muted-foreground">{item.category}</span>}
                      <p className="truncate">{item.description || ""}</p>
                    </div>
                    <span className="font-mono text-muted-foreground">¥{fmtYen(item.amount ?? 0)}</span>
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-lg border border-border p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">基本額（税抜）</span>
                <span className="font-mono">¥{fmtYen(gross)}</span>
              </div>
              {reimbYen > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">立替費</span>
                  <span className="font-mono">¥{fmtYen(reimbYen)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">消費税（10%）</span>
                <span className="font-mono">¥{fmtYen(tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
                <span className="font-semibold">合計（税込）</span>
                <span className="font-mono font-semibold text-blue-700">¥{fmtYen(total)}</span>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="issue-date" className="text-xs text-muted-foreground">
                  {documentType === "quotation" ? "見積日" : "請求日"}
                </Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="due-date" className="text-xs text-muted-foreground">
                  {documentType === "quotation" ? "有効期限" : "支払期日"}
                </Label>
                <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </section>
            <p className="text-[10px] text-muted-foreground">
              {documentType === "quotation"
                ? "有効期限は翌月末（休日の場合は前営業日）が自動セットされます"
                : "支払期日は翌月末（休日の場合は前営業日）が自動セットされます"}
            </p>

            {toast && (
              <div
                className={`rounded-md px-3 py-2 text-xs ${
                  toast.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {toast.msg}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={saveDraft} disabled={savingDraft || issuing}>
                {savingDraft ? "保存中..." : "💾 下書き保存"}
              </Button>
              {!actuallyDone && (
                <Button onClick={issue} disabled={issuing || gross <= 0}>
                  {issuing ? "発行中..." : `📨 PLに確認依頼する (${issueButtonLabel})`}
                </Button>
              )}
            </div>
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-background rounded-xl p-4 w-full max-w-sm space-y-3 shadow-xl">
              <h3 className="font-semibold text-sm">
                {documentType === "quotation" ? "見積書" : "請求書"}を取り消しますか？
              </h3>
              <p className="text-xs text-muted-foreground">
                admins（まさ・きよ）にSlackで通知が送られます。取り消し後、再発行可能になります。
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)} disabled={canceling}>
                  キャンセル
                </Button>
                <Button variant="destructive" size="sm" onClick={cancel} disabled={canceling}>
                  {canceling ? "取り消し中..." : "取り消す"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
