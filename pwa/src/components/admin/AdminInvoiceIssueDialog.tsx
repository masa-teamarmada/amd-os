"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Plus, Save, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callEdgeFunctionPOST } from "@/lib/supabase/edge-functions";
import { createClient } from "@/lib/supabase/client";
import { contractBackedClientAmount } from "@/lib/contract-money";
import { computePaymentDueDateByRule } from "@/lib/payment-rules";

type LineSection = "base" | "adjustment";

type EditableLine = {
  id: string;
  section: LineSection;
  type: "item" | "text";
  description: string;
  quantity: string;
  unitPrice: string;
};

type ReimbItem = {
  description: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  transport_mode?: string | null;
  transport_from?: string | null;
  transport_to?: string | null;
  transport_trip?: string | null;
  tax_rate?: number | null;
};

type Preview = {
  projectName: string;
  clientName: string;
  feeType: string | null;
  feeAmount: number | null;
  freeePartnerId: string | null;
  subject: string;
  baseLines: EditableLine[];
  adjustmentLines: EditableLine[];
  reimbItems: ReimbItem[];
  reimbYen: number;
  fromPrevMonth: boolean;
  issueDate: string;
  dueDate: string;
  issuedAt: string | null;
  freeeInvoiceNumber: string | null;
  invoicePdfUrl: string | null;
};

type RawLine = {
  section?: string;
  type?: string;
  description?: string;
  quantity?: string | number;
  unit_price?: string | number;
  unitPrice?: string | number;
};

type Props = {
  projectId: string;
  ym: string;
  open: boolean;
  onClose: () => void;
  onIssued?: (patch: { invoice_issued_at: string; freee_invoice_number: string | null; invoice_subject?: string }) => void;
  onCancelled?: () => void;
};

const supabase = createClient();
const ESTIMATE_MARKER = "[[CTB_ESTIMATE_SENT]]";

function uid() {
  return Math.random().toString(36).slice(2);
}

function ymLabel(ym: string) {
  if (ym.length !== 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function todayJst() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function ymStart(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function nextYmStart(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function prevYm(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m <= 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
}

function toEditable(raw: RawLine, fallbackSection: LineSection): EditableLine {
  const type = raw.type === "text" ? "text" : "item";
  const section = raw.section === "adjustment" ? "adjustment" : fallbackSection;
  const unit = raw.unit_price ?? raw.unitPrice ?? "";
  return {
    id: uid(),
    section,
    type,
    description: String(raw.description ?? ""),
    quantity: type === "item" ? String(raw.quantity ?? "1") : "",
    unitPrice: type === "item" ? String(unit || "") : "",
  };
}

function defaultLine(ym: string, amount: number, section: LineSection = "base"): EditableLine {
  return {
    id: uid(),
    section,
    type: "item",
    description: `${ym.slice(0, 4)}年${Number(ym.slice(4))}月分 業務委託費`,
    quantity: "1",
    unitPrice: amount > 0 ? String(amount) : "",
  };
}

function emptyAdjustmentLine(): EditableLine {
  return {
    id: uid(),
    section: "adjustment",
    type: "item",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function parseStoredLines(rawJson: string | null, fallbackSection: LineSection = "base") {
  const baseLines: EditableLine[] = [];
  const adjustmentLines: EditableLine[] = [];
  if (!rawJson) return { baseLines, adjustmentLines };

  try {
    const parsed = JSON.parse(rawJson) as RawLine[];
    if (!Array.isArray(parsed)) return { baseLines, adjustmentLines };
    for (const row of parsed) {
      if (row.description === ESTIMATE_MARKER) continue;
      const line = toEditable(row, fallbackSection);
      if (!line.description.trim()) continue;
      if (line.section === "adjustment") {
        adjustmentLines.push(line);
      } else {
        baseLines.push(line);
      }
    }
  } catch {
    return { baseLines, adjustmentLines };
  }

  return { baseLines, adjustmentLines };
}

function buildAllLinesJson(baseLines: EditableLine[], adjustmentLines: EditableLine[]) {
  const lines = [...baseLines, ...adjustmentLines];
  return JSON.stringify(lines.map((line) => {
    if (line.type === "text") {
      return { section: line.section, type: "text", description: line.description };
    }
    return {
      section: line.section,
      type: "item",
      description: line.description,
      quantity: Number(line.quantity) || 1,
      unit_price: Number(line.unitPrice) || 0,
    };
  }));
}

function lineAmount(line: EditableLine) {
  if (line.type !== "item") return 0;
  return (Number(line.quantity) || 1) * (Number(line.unitPrice) || 0);
}

function yen(value: number) {
  return Math.round(value).toLocaleString();
}

function reimbLabel(item: ReimbItem) {
  const date = (item.date ?? "").replace(/^\d{4}-/, "").replace(/-/g, "/");
  const route = item.transport_from || item.transport_to
    ? `${item.transport_from ?? ""}→${item.transport_to ?? ""}`
    : "";
  const desc = [date, item.category, route, item.description].filter(Boolean).join(" ");
  return desc || "立替";
}

async function loadPreview(projectId: string, ym: string): Promise<Preview> {
  const [projectRes, cycleRes, reimbRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_name, client_name, fee_type, fee_amount, start_ym, end_ym, contract_terms_json, payment_due_rule, payment_due_day, freee_partner_id")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("billing_cycles")
      .select("status, budget_reported_amount, invoice_subject, invoice_base_lines_json, invoice_issued_at, freee_invoice_number, invoice_pdf_url")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    supabase
      .from("reimbursements")
      .select("description, amount, date, category, transport_mode, transport_from, transport_to, transport_trip, tax_rate")
      .eq("project_id", projectId)
      .eq("status", "approved")
      .gte("date", ymStart(ym))
      .lt("date", nextYmStart(ym)),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (cycleRes.error) throw cycleRes.error;
  if (reimbRes.error) throw reimbRes.error;

  const project = projectRes.data;
  const cycle = cycleRes.data;
  const projectName = project?.project_name ?? projectId;
  const contractProject = {
    fee_type: project?.fee_type ?? null,
    fee_amount: project?.fee_amount ?? null,
    start_ym: project?.start_ym ?? null,
    end_ym: project?.end_ym ?? null,
    contract_terms_json: project?.contract_terms_json ?? null,
  };

  let { baseLines, adjustmentLines } = parseStoredLines(cycle?.invoice_base_lines_json ?? null);
  let fromPrevMonth = false;

  if (baseLines.length === 0 && adjustmentLines.length === 0) {
    const prevRes = await supabase
      .from("billing_cycles")
      .select("invoice_base_lines_json")
      .eq("project_id", projectId)
      .eq("ym", prevYm(ym))
      .maybeSingle();
    if (!prevRes.error) {
      const prevParsed = parseStoredLines(prevRes.data?.invoice_base_lines_json ?? null);
      if (prevParsed.baseLines.length > 0 || prevParsed.adjustmentLines.length > 0) {
        baseLines = prevParsed.baseLines;
        adjustmentLines = prevParsed.adjustmentLines;
        fromPrevMonth = true;
      }
    }
  }

  if (baseLines.length === 0 && adjustmentLines.length === 0) {
    const invoiceAmount = contractBackedClientAmount({
      ym,
      project: contractProject,
      reportedAmount: cycle?.budget_reported_amount ?? null,
      cycleStatus: cycle?.status ?? null,
      hasInvoiceEvidence: Boolean(cycle?.invoice_issued_at || cycle?.freee_invoice_number || cycle?.invoice_base_lines_json),
    });
    baseLines = [defaultLine(ym, invoiceAmount)];
  }

  const reimbItems = (reimbRes.data ?? []) as ReimbItem[];
  const reimbYen = reimbItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return {
    projectName,
    clientName: project?.client_name ?? "",
    feeType: project?.fee_type ?? null,
    feeAmount: typeof project?.fee_amount === "number" ? project.fee_amount : Number(project?.fee_amount ?? 0) || null,
    freeePartnerId: project?.freee_partner_id ?? null,
    subject: cycle?.invoice_subject || `${projectName} ${ymLabel(ym)} 業務委託費`,
    baseLines,
    adjustmentLines,
    reimbItems,
    reimbYen,
    fromPrevMonth,
    issueDate: todayJst(),
    dueDate: computePaymentDueDateByRule(ym, project?.payment_due_rule ?? null, project?.payment_due_day ?? null),
    issuedAt: cycle?.invoice_issued_at ?? null,
    freeeInvoiceNumber: cycle?.freee_invoice_number ?? null,
    invoicePdfUrl: cycle?.invoice_pdf_url ?? null,
  };
}

export function AdminInvoiceIssueDialog({ projectId, ym, open, onClose, onIssued, onCancelled }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [baseLines, setBaseLines] = useState<EditableLine[]>([]);
  const [adjustmentLines, setAdjustmentLines] = useState<EditableLine[]>([]);
  const [subject, setSubject] = useState("");
  const [invoiceRemark, setInvoiceRemark] = useState("");
  const [issueDate, setIssueDate] = useState(todayJst());
  const [dueDate, setDueDate] = useState(todayJst());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setError(null);
    loadPreview(projectId, ym)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setBaseLines(data.baseLines.length > 0 ? data.baseLines : [defaultLine(ym, 0)]);
        setAdjustmentLines(data.adjustmentLines);
        setSubject(data.subject);
        setInvoiceRemark("");
        setIssueDate(data.issueDate);
        setDueDate(data.dueDate);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, ym]);

  const baseTotal = useMemo(() => baseLines.reduce((sum, line) => sum + lineAmount(line), 0), [baseLines]);
  const adjustmentTotal = useMemo(() => adjustmentLines.reduce((sum, line) => sum + lineAmount(line), 0), [adjustmentLines]);
  const netTotal = baseTotal + adjustmentTotal;
  const reimbYen = preview?.reimbYen ?? 0;

  const taxEstimate = Math.round((netTotal + reimbYen) * 0.1);
  const grossTotal = Math.round((netTotal + reimbYen) * 1.1);

  function updateBaseLine(id: string, patch: Partial<EditableLine>) {
    setBaseLines((prev) => prev.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function updateAdjustmentLine(id: string, patch: Partial<EditableLine>) {
    setAdjustmentLines((prev) => prev.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update({
          invoice_subject: subject,
          invoice_base_lines_json: buildAllLinesJson(baseLines, adjustmentLines),
        })
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (updateError) throw updateError;
      setMessage("下書きを保存したよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function issueInvoice() {
    if (preview?.feeType === "monthly_fixed" && preview.feeAmount && preview.feeAmount > 0 && baseTotal !== preview.feeAmount) {
      const diff = baseTotal - preview.feeAmount;
      const diffLabel = diff > 0 ? `+${yen(diff)}円 超過` : `${yen(Math.abs(diff))}円 不足`;
      const ok = window.confirm(`基本行合計（¥${yen(baseTotal)}）が契約月額（¥${yen(preview.feeAmount)}）と異なるよ（${diffLabel}）。このまま発行する？`);
      if (!ok) return;
    }
    if (preview?.issuedAt) {
      const ok = window.confirm("既に発行済みです。再発行すると送付ステータスなどを確認し直す必要があるよ。続行する？");
      if (!ok) return;
    }

    setIssuing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await callEdgeFunctionPOST<{
        ok: boolean;
        freeeInvoiceNumber?: string;
        message?: string;
      }>("issue-invoice", {
        projectId,
        ym,
        issueDate,
        dueDate,
        allLinesJson: buildAllLinesJson(baseLines, adjustmentLines),
        invoiceSubject: subject,
        invoiceRemark,
        documentType: "invoice",
      });
      if (!result.ok) throw new Error(result.message || "請求書発行に失敗したよ");
      const issuedAt = new Date().toISOString();
      onIssued?.({
        invoice_issued_at: issuedAt,
        freee_invoice_number: result.freeeInvoiceNumber || null,
        invoice_subject: subject,
      });
      setPreview((prev) => prev ? { ...prev, issuedAt, freeeInvoiceNumber: result.freeeInvoiceNumber || null } : prev);
      setMessage(result.message || `請求書を発行したよ${result.freeeInvoiceNumber ? ` (${result.freeeInvoiceNumber})` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIssuing(false);
    }
  }

  async function cancelInvoice() {
    const ok = window.confirm("請求書発行を取り消す？freee上の削除ではなく、OS側の発行情報を戻す操作だよ。");
    if (!ok) return;

    setCanceling(true);
    setMessage(null);
    setError(null);
    try {
      const result = await callEdgeFunctionPOST<{ ok: boolean; message?: string }>("cancel-invoice", {
        projectId,
        ym,
        documentType: "invoice",
      });
      if (!result.ok) throw new Error(result.message || "請求書発行の取り消しに失敗したよ");
      setPreview((prev) => prev ? { ...prev, issuedAt: null, freeeInvoiceNumber: null, invoicePdfUrl: null } : prev);
      onCancelled?.();
      setMessage(result.message || "請求書発行を取り消したよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCanceling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>請求書発行</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            読み込み中
          </div>
        )}

        {!loading && preview && (
          <div className="space-y-5">
            <section className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{preview.projectName}</p>
                  <p className="text-xs text-muted-foreground">{ymLabel(ym)} / {preview.clientName || "送付先未設定"}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{preview.freeePartnerId ? `freee ID ${preview.freeePartnerId}` : "freee取引先 未設定"}</p>
                  {preview.issuedAt && (
                    <p className="inline-flex items-center justify-end gap-1 text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      発行済み {preview.freeeInvoiceNumber || ""}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {!preview.freeePartnerId && (
              <section className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>freee取引先が未設定。PJ設定で取引先を設定してから発行してね。</span>
              </section>
            )}

            {preview.issuedAt && (
              <section className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">発行済み情報</p>
                    <p>請求書番号: <span className="font-mono">{preview.freeeInvoiceNumber || "-"}</span></p>
                    <p>発行日: {preview.issuedAt.slice(0, 10)}</p>
                    {preview.invoicePdfUrl && (
                      <a className="text-xs text-blue-700 underline" href={preview.invoicePdfUrl} target="_blank" rel="noreferrer">
                        PDFを開く
                      </a>
                    )}
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={cancelInvoice} disabled={canceling || issuing}>
                    {canceling ? <Loader2 className="animate-spin" /> : <XCircle />}
                    発行を取り消す
                  </Button>
                </div>
              </section>
            )}

            <section className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-invoice-subject">件名</label>
              <Textarea
                id="admin-invoice-subject"
                rows={1}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">基本明細行</h3>
                  <p className="text-xs text-muted-foreground">
                    {preview.feeAmount && preview.feeAmount > 0 ? `契約月額: ¥${yen(preview.feeAmount)}` : "契約月額なし"}
                    {preview.fromPrevMonth ? " / 前月から引き継ぎ" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setBaseLines((prev) => [...prev, {
                    id: uid(),
                    section: "base",
                    type: "item",
                    description: "",
                    quantity: "1",
                    unitPrice: "",
                  }])}>
                    <Plus />品目
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setBaseLines((prev) => [...prev, {
                    id: uid(),
                    section: "base",
                    type: "text",
                    description: "",
                    quantity: "",
                    unitPrice: "",
                  }])}>
                    <FileText />テキスト
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {baseLines.map((line) => (
                  <InvoiceLineEditor
                    key={line.id}
                    line={line}
                    descriptionPlaceholder={line.type === "text" ? "テキスト行" : "品目名"}
                    onUpdate={(patch) => updateBaseLine(line.id, patch)}
                    onRemove={() => setBaseLines((prev) => prev.filter((item) => item.id !== line.id))}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">立替精算</h3>
                  <p className="text-xs text-muted-foreground">承認済み立替は発行時に自動で明細へ追加される</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{preview.reimbItems.length}件</span>
              </div>
              {preview.reimbItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {preview.reimbItems.map((item, index) => (
                    <div key={`${item.date ?? ""}_${index}`} className="flex items-start justify-between gap-3 text-xs">
                      <span className="min-w-0 flex-1 text-muted-foreground">{reimbLabel(item)}</span>
                      <span className="shrink-0 font-mono">¥{yen(Number(item.amount ?? 0))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">今月の立替なし</p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">調整行</h3>
                  <p className="text-xs text-muted-foreground">値引きや追加調整があるときだけ使う</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAdjustmentLines((prev) => [...prev, emptyAdjustmentLine()])}>
                  <Plus />調整行
                </Button>
              </div>
              <div className="space-y-2">
                {adjustmentLines.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">調整行なし</p>
                ) : adjustmentLines.map((line) => (
                  <InvoiceLineEditor
                    key={line.id}
                    line={line}
                    descriptionPlaceholder="調整内容"
                    onUpdate={(patch) => updateAdjustmentLine(line.id, patch)}
                    onRemove={() => setAdjustmentLines((prev) => prev.filter((item) => item.id !== line.id))}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                請求日
                <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                支払期日
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </section>

            <section className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-invoice-remark">備考</label>
              <Textarea
                id="admin-invoice-remark"
                rows={2}
                placeholder="請求書に表示する備考（任意）"
                value={invoiceRemark}
                onChange={(event) => setInvoiceRemark(event.target.value)}
              />
            </section>

            <section className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">基本行（税抜）</span>
                <span className="font-mono">¥{yen(baseTotal)}</span>
              </div>
              {adjustmentTotal !== 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">調整行（税抜）</span>
                  <span className="font-mono">¥{yen(adjustmentTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">基本＋調整（税抜）</span>
                <span className="font-mono">¥{yen(netTotal)}</span>
              </div>
              {reimbYen > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">立替</span>
                  <span className="font-mono">¥{yen(reimbYen)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">消費税（概算）</span>
                <span className="font-mono">¥{yen(taxEstimate)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                <span>概算合計</span>
                <span className="font-mono">¥{yen(grossTotal)}</span>
              </div>
            </section>

            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={saveDraft} disabled={saving || issuing}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                下書き保存
              </Button>
              <Button
                type="button"
                onClick={issueInvoice}
                disabled={issuing || saving || canceling || netTotal <= 0 || !preview.freeePartnerId}
              >
                {issuing ? <Loader2 className="animate-spin" /> : <Send />}
                請求書を発行
              </Button>
            </div>
          </div>
        )}

        {!loading && !preview && error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceLineEditor({
  line,
  descriptionPlaceholder,
  onUpdate,
  onRemove,
}: {
  line: EditableLine;
  descriptionPlaceholder: string;
  onUpdate: (patch: Partial<EditableLine>) => void;
  onRemove: () => void;
}) {
  const amount = lineAmount(line);
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex items-start gap-2">
        {line.type === "text" && (
          <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-muted text-[10px] font-bold text-muted-foreground">
            T
          </span>
        )}
        <Textarea
          rows={1}
          className="min-h-9 flex-1"
          placeholder={descriptionPlaceholder}
          value={line.description}
          onChange={(event) => onUpdate({ description: event.target.value })}
        />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      {line.type === "item" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">数量</span>
          <Input
            className="h-8 w-20 text-right font-mono"
            value={line.quantity}
            onChange={(event) => onUpdate({ quantity: event.target.value.replace(/[^\d.]/g, "") })}
          />
          <span className="text-xs text-muted-foreground">単価</span>
          <Input
            className="h-8 w-32 text-right font-mono"
            value={line.unitPrice}
            onChange={(event) => onUpdate({ unitPrice: event.target.value.replace(/(?!^-)[^\d]/g, "").replace(/^-+/, "-") })}
          />
          <span className="ml-auto text-xs text-muted-foreground">
            = <span className="font-mono">¥{yen(amount)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
