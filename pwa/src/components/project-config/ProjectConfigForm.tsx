"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  fetchProjectConfig,
  saveProjectConfig,
  type ProjectConfigData,
} from "@/lib/project-config-data";
import { ProjectMembersEditor } from "@/components/project-members/ProjectMembersEditor";

interface Props {
  projectId: string;
}

const STATUS_OPTIONS = ["active", "sales", "ended", "frozen", "lost"];
const FEE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "monthly_fixed", label: "monthly_fixed (毎月固定)" },
  { value: "milestone", label: "milestone (マイルストーン)" },
  { value: "variable", label: "variable (変動)" },
];
const PAYMENT_DUE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "issue_month_eom", label: "発行月末" },
  { value: "next_month_eom", label: "翌月末" },
  { value: "next_month_15", label: "翌月25日" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  sales: "bg-blue-500/10 text-blue-700 border-blue-200",
  ended: "bg-zinc-500/10 text-zinc-500 border-zinc-200",
  frozen: "bg-amber-500/10 text-amber-700 border-amber-200",
  lost: "bg-red-500/10 text-red-600 border-red-200",
};

interface FormState {
  status: string;
  reportEmails: string;
  startYm: string;
  endYm: string;
  feeType: string;
  feeAmount: string;
  invoiceSendDeadlineRule: string;
  paymentDueRule: string;
  invoiceSendManual: boolean;
  invoiceToEmails: string;
  invoiceCcEmails: string;
  invoiceBccEmails: string;
}

function formStateFromData(d: ProjectConfigData): FormState {
  return {
    status: d.project.status,
    reportEmails: d.project.reportEmails ?? "",
    startYm: d.project.startYm ?? "",
    endYm: d.project.endYm ?? "",
    feeType: d.project.feeType ?? "",
    feeAmount: d.project.feeAmount != null ? String(d.project.feeAmount) : "",
    invoiceSendDeadlineRule: d.project.invoiceSendDeadlineRule ?? "10",
    paymentDueRule: d.project.paymentDueRule ?? "",
    invoiceSendManual: d.project.invoiceSendManual,
    invoiceToEmails: d.project.invoiceToEmails ?? "",
    invoiceCcEmails: d.project.invoiceCcEmails ?? "",
    invoiceBccEmails: d.project.invoiceBccEmails ?? "",
  };
}

export function ProjectConfigForm({ projectId }: Props) {
  const [data, setData] = useState<ProjectConfigData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isErr: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchProjectConfig(projectId);
      if (!d) {
        setError(`PJ が見つからない: ${projectId}`);
        setData(null);
        return;
      }
      setData(d);
      setForm(formStateFromData(d));
      setDirty(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "取得失敗";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const showToast = (msg: string, isErr = false) => {
    setToast({ msg, isErr });
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!data || !form) return;
    setSaving(true);
    try {
      const feeAmountNum = form.feeAmount.trim() === "" ? null : Number(form.feeAmount);
      if (feeAmountNum !== null && Number.isNaN(feeAmountNum)) {
        showToast("業務委託料額が数値ではない", true);
        setSaving(false);
        return;
      }
      const isYm = (s: string) => s === "" || /^\d{6}$/.test(s);
      if (!isYm(form.startYm) || !isYm(form.endYm)) {
        showToast("開始/終了 ym は yyyymm 形式で入力", true);
        setSaving(false);
        return;
      }

      const projectRes = await saveProjectConfig(data.project.id, {
        status: form.status,
        reportEmails: form.reportEmails.trim() || null,
        startYm: form.startYm.trim() || null,
        endYm: form.endYm.trim() || null,
        feeType: form.feeType.trim() || null,
        feeAmount: feeAmountNum,
        invoiceSendDeadlineRule: form.invoiceSendDeadlineRule.trim() || null,
        paymentDueRule: form.paymentDueRule.trim() || null,
        invoiceSendManual: form.invoiceSendManual,
        invoiceToEmails: form.invoiceToEmails.trim() || null,
        invoiceCcEmails: form.invoiceCcEmails.trim() || null,
        invoiceBccEmails: form.invoiceBccEmails.trim() || null,
      });
      if (!projectRes.ok) {
        showToast(`PJ 保存失敗: ${projectRes.message}`, true);
        setSaving(false);
        return;
      }

      // メンバー編集は ProjectMembersEditor 側で完結 (= POST /api/admin/project-members/bulk)。
      // この handleSave は projects テーブルの基本情報・契約情報のみ更新する。
      showToast(`保存完了 ✓`);
      setDirty(false);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-muted-foreground text-sm py-16">読み込み中...</div>
    );
  }
  if (error || !data || !form) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="text-sm text-destructive">{error ?? "取得失敗"}</p>
        <button onClick={reload} className="text-xs text-primary underline">再読み込み</button>
      </div>
    );
  }

  const badgeCls = STATUS_BADGE[data.project.status] ?? "bg-muted text-muted-foreground border-border";

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/project/${projectId}/cockpit`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full border border-border"
        >
          ← コックピット
        </Link>
        <h1 className="text-lg font-bold">{data.project.projectName}</h1>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeCls}`}>{data.project.status || "—"}</span>
      </div>

      {/* Section 1: 基本情報 */}
      <Section title="基本情報">
        <Grid>
          <ReadField label="PJ 名" value={data.project.projectName} />
          <ReadField label="freee 取引先名" value={data.project.clientName ?? "—"} />
          <ReadField label="PM" value={data.project.pmName || "—"} />
          <ReadField label="クローザー" value={data.project.closerName || "—"} />
          <SelectField
            label="ステータス"
            value={form.status}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(v) => updateForm("status", v)}
          />
          <TextField
            label="関係先メールアドレス"
            value={form.reportEmails}
            onChange={(v) => updateForm("reportEmails", v)}
            full
            placeholder="a@b.com, c@d.com"
          />
        </Grid>
      </Section>

      {/* Section 2: メンバー
          ProjectMembersEditor (共通) を埋め込み。保存は editor 内で完結し、
          admin/projects の「メンバー」列モーダルと同じ POST /api/admin/project-members/bulk を叩く (2026-05-13)。
       */}
      <Section title="メンバー">
        <ProjectMembersEditor
          projectId={data.project.projectId}
          initialMembers={data.members}
          initialMemberMaster={data.memberMaster}
          onSaved={() => reload()}
        />
      </Section>

      {/* Section 3: 契約・料金 */}
      <Section title="契約・料金">
        <Grid>
          <TextField
            label="PJ 開始月 (yyyymm)"
            value={form.startYm}
            onChange={(v) => updateForm("startYm", v)}
            placeholder="202401"
          />
          <TextField
            label="PJ 終了月 (yyyymm)"
            value={form.endYm}
            onChange={(v) => updateForm("endYm", v)}
            placeholder="202512"
          />
          <SelectField
            label="業務委託料タイプ"
            value={form.feeType}
            options={FEE_TYPE_OPTIONS}
            onChange={(v) => updateForm("feeType", v)}
          />
          <NumberField
            label="業務委託料額 (円)"
            value={form.feeAmount}
            onChange={(v) => updateForm("feeAmount", v)}
          />
          <DeadlineDayField
            label="請求書発行期日"
            value={form.invoiceSendDeadlineRule}
            onChange={(v) => updateForm("invoiceSendDeadlineRule", v)}
          />
          <SelectField
            label="支払期日"
            value={form.paymentDueRule}
            options={PAYMENT_DUE_OPTIONS}
            onChange={(v) => updateForm("paymentDueRule", v)}
          />
        </Grid>
      </Section>

      {/* Section 4: 請求書送付
          → 「請求書送付」設定は admin/projects の PJ リスト列で一括管理する方針に変更 (2026-05-07)。
          ここのセクションは削除。
       */}

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-3 flex justify-end gap-3 z-50">
        {dirty && <span className="text-xs text-amber-700 self-center">未保存の変更あり</span>}
        <button
          onClick={reload}
          disabled={saving}
          className="text-sm px-4 py-2 rounded-md border border-border bg-muted hover:bg-muted/80 disabled:opacity-50"
        >
          リセット
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="text-sm px-6 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 right-6 px-5 py-2.5 rounded-md text-sm font-medium shadow-lg z-50 ${
            toast.isErr ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 内部 UI helpers
// ============================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-background border border-border rounded-lg p-5 mb-5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 ${className}`}>{children}</div>;
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm py-1 min-h-[24px]">{value || "—"}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  full = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeadlineDayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const days: Array<{ value: string; label: string }> = [];
  for (let i = 1; i <= 30; i++) days.push({ value: String(i), label: String(i) });
  days.push({ value: "末", label: "末" });
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <span>毎月</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {days.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <span>日までに送付</span>
      </div>
    </div>
  );
}
