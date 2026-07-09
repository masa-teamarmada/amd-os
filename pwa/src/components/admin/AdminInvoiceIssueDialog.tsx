"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
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
import { contractBackedClientAmount, isWithinContractPeriod } from "@/lib/contract-money";
import { computePaymentDueDateByRule } from "@/lib/payment-rules";

type EditableLine = {
  id: string;
  type: "item" | "text";
  description: string;
  quantity: string;
  unitPrice: string;
};

type Preview = {
  projectName: string;
  clientName: string;
  freeePartnerId: string | null;
  subject: string;
  lines: EditableLine[];
  issueDate: string;
  dueDate: string;
  issuedAt: string | null;
  freeeInvoiceNumber: string | null;
};

type RawLine = {
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
};

const supabase = createClient();

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

function toEditable(raw: RawLine): EditableLine {
  const type = raw.type === "text" ? "text" : "item";
  const unit = raw.unit_price ?? raw.unitPrice ?? "";
  return {
    id: uid(),
    type,
    description: String(raw.description ?? ""),
    quantity: type === "item" ? String(raw.quantity ?? "1") : "",
    unitPrice: type === "item" ? String(unit || "") : "",
  };
}

function defaultLine(ym: string, amount: number): EditableLine {
  return {
    id: uid(),
    type: "item",
    description: `${ym.slice(0, 4)}年${Number(ym.slice(4))}月分 業務委託費`,
    quantity: "1",
    unitPrice: amount > 0 ? String(amount) : "",
  };
}

function buildAllLinesJson(lines: EditableLine[]) {
  return JSON.stringify(lines.map((line) => {
    if (line.type === "text") return { type: "text", description: line.description };
    return {
      type: "item",
      description: line.description,
      quantity: Number(line.quantity) || 1,
      unit_price: Number(line.unitPrice) || 0,
    };
  }));
}

function yen(value: number) {
  return Math.round(value).toLocaleString();
}

async function loadPreview(projectId: string, ym: string): Promise<Preview> {
  const [projectRes, cycleRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_name, client_name, fee_type, fee_amount, start_ym, end_ym, payment_due_rule, payment_due_day, freee_partner_id")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("billing_cycles")
      .select("status, budget_yen, budget_reported_amount, invoice_subject, invoice_base_lines_json, invoice_issued_at, freee_invoice_number")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (cycleRes.error) throw cycleRes.error;

  const project = projectRes.data;
  const cycle = cycleRes.data;
  const projectName = project?.project_name ?? projectId;
  const contractProject = {
    fee_type: project?.fee_type ?? null,
    fee_amount: project?.fee_amount ?? null,
    start_ym: project?.start_ym ?? null,
    end_ym: project?.end_ym ?? null,
  };

  let lines: EditableLine[] = [];
  if (cycle?.invoice_base_lines_json) {
    try {
      const parsed = JSON.parse(cycle.invoice_base_lines_json) as RawLine[];
      if (Array.isArray(parsed)) {
        lines = parsed
          .filter((row) => row.description !== "[[CTB_ESTIMATE_SENT]]")
          .map(toEditable)
          .filter((line) => line.description.trim());
      }
    } catch {
      lines = [];
    }
  }

  if (lines.length === 0) {
    const invoiceAmount = contractBackedClientAmount({
      ym,
      project: contractProject,
      reportedAmount: cycle?.budget_reported_amount ?? null,
      cycleStatus: cycle?.status ?? null,
      hasInvoiceEvidence: Boolean(cycle?.invoice_issued_at || cycle?.freee_invoice_number || cycle?.invoice_base_lines_json),
    });
    const fallbackAmount = invoiceAmount > 0
      ? invoiceAmount
      : isWithinContractPeriod(contractProject, ym) && (cycle?.budget_yen ?? 0) > 0
        ? Math.round(Number(cycle?.budget_yen ?? 0) / 0.65)
        : 0;
    lines = [defaultLine(ym, fallbackAmount)];
  }

  return {
    projectName,
    clientName: project?.client_name ?? "",
    freeePartnerId: project?.freee_partner_id ?? null,
    subject: cycle?.invoice_subject || `${projectName} ${ymLabel(ym)} 業務委託費`,
    lines,
    issueDate: todayJst(),
    dueDate: computePaymentDueDateByRule(ym, project?.payment_due_rule ?? null, project?.payment_due_day ?? null),
    issuedAt: cycle?.invoice_issued_at ?? null,
    freeeInvoiceNumber: cycle?.freee_invoice_number ?? null,
  };
}

export function AdminInvoiceIssueDialog({ projectId, ym, open, onClose, onIssued }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [subject, setSubject] = useState("");
  const [issueDate, setIssueDate] = useState(todayJst());
  const [dueDate, setDueDate] = useState(todayJst());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
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
        setLines(data.lines.length > 0 ? data.lines : [defaultLine(ym, 0)]);
        setSubject(data.subject);
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

  const netTotal = useMemo(() => lines.reduce((sum, line) => {
    if (line.type !== "item") return sum;
    return sum + (Number(line.quantity) || 1) * (Number(line.unitPrice) || 0);
  }, 0), [lines]);

  const grossTotal = Math.round(netTotal * 1.1);

  function updateLine(id: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((line) => line.id === id ? { ...line, ...patch } : line));
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
          invoice_base_lines_json: buildAllLinesJson(lines),
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
        allLinesJson: buildAllLinesJson(lines),
        invoiceSubject: subject,
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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
          <div className="space-y-4">
            <section className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{preview.projectName}</p>
                  <p className="text-xs text-muted-foreground">{ymLabel(ym)} / {preview.clientName || "送付先未設定"}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{preview.freeePartnerId ? `freee ID ${preview.freeePartnerId}` : "freee取引先 未設定"}</p>
                  {preview.issuedAt && <p className="text-emerald-700">発行済み {preview.freeeInvoiceNumber || ""}</p>}
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-invoice-subject">件名</label>
              <Textarea
                id="admin-invoice-subject"
                rows={1}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">請求明細</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, {
                    id: uid(),
                    type: "item",
                    description: "",
                    quantity: "1",
                    unitPrice: "",
                  }])}>
                    <Plus />品目
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, {
                    id: uid(),
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
                {lines.map((line) => (
                  <div key={line.id} className="rounded-lg border border-border p-2">
                    <div className="flex items-start gap-2">
                      <Textarea
                        rows={1}
                        className="min-h-9 flex-1"
                        placeholder={line.type === "text" ? "テキスト行" : "品目名"}
                        value={line.description}
                        onChange={(event) => updateLine(line.id, { description: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines((prev) => prev.filter((item) => item.id !== line.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {line.type === "item" && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-xs text-muted-foreground">数量</span>
                        <Input
                          className="h-8 w-20 text-right font-mono"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: event.target.value.replace(/[^\d.]/g, "") })}
                        />
                        <span className="text-xs text-muted-foreground">単価</span>
                        <Input
                          className="h-8 w-32 text-right font-mono"
                          value={line.unitPrice}
                          onChange={(event) => updateLine(line.id, { unitPrice: event.target.value.replace(/(?!^-)[^\d]/g, "").replace(/^-+/, "-") })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">税抜</span>
                <span className="font-mono">¥{yen(netTotal)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>税込</span>
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
                disabled={issuing || netTotal <= 0 || !preview.freeePartnerId}
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
