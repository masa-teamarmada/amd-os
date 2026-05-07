"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  fetchProjectConfig,
  saveProjectConfig,
  saveProjectMembers,
  type ProjectConfigData,
  type ProjectConfigMember,
  type MemberInput,
} from "@/lib/project-config-data";

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

interface MemberRow extends MemberInput {
  rowKey: string;
  codeName: string;
}

function memberRowFromExisting(m: ProjectConfigMember): MemberRow {
  return {
    rowKey: m.id,
    memberId: m.memberId,
    codeName: m.codeName,
    isPM: m.isPM,
    isCloser: m.isCloser,
    isPL: m.isPL,
    roleLabel: m.roleLabel,
    joinYm: m.joinYm,
    leaveYm: m.leaveYm,
    isActive: m.isActive,
  };
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
  const [members, setMembers] = useState<MemberRow[]>([]);
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
      setMembers(d.members.map(memberRowFromExisting));
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

  const updateMember = <K extends keyof MemberRow>(rowKey: string, key: K, value: MemberRow[K]) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.rowKey !== rowKey) return m;
        const next = { ...m, [key]: value };
        if (key === "memberId" && typeof value === "string") {
          const master = data?.memberMaster.find((mm) => mm.memberId === value);
          if (master) next.codeName = master.codeName || master.memberName;
        }
        return next;
      })
    );
    setDirty(true);
  };

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        rowKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        memberId: "",
        codeName: "",
        isPM: false,
        isCloser: false,
        isPL: false,
        roleLabel: "",
        joinYm: "",
        leaveYm: "",
        isActive: true,
      },
    ]);
    setDirty(true);
  };

  const deleteMember = (rowKey: string) => {
    setMembers((prev) => prev.filter((m) => m.rowKey !== rowKey));
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

      // メンバー編集は admin/projects に移動した (#14)。config 保存ではメンバーを更新しない。
      const memberRes = { saved: 0 };
      if (false as boolean) {
        const _unused: MemberInput[] = [];
        void _unused;
        showToast("", true);
        setSaving(false);
        return;
      }

      showToast(`保存完了 ✓`);
      void memberRes;
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
          → メンバー編集 (PL/PM/クローザー含む) は admin/projects のリスト列に集約 (#14, 2026-05-07)。
          このセクションは案内のみ。
       */}
      <Section title="メンバー">
        <p className="text-xs text-muted-foreground">
          メンバーの追加・編集 (PL / PM / クローザー / 役割ラベル / 参画月 / 離脱月) は
          <a href="/admin/projects" className="text-blue-600 hover:underline mx-1">PJ台帳 (admin/projects)</a>
          の該当 PJ 行 → 「✏️ 編集」から行ってください。
        </p>
      </Section>

      {/* 旧メンバー編集 UI — PL/PM/クローザーは admin/projects に移動したため非表示 */}
      <div className="hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-[11px] uppercase text-muted-foreground border-b-2 border-border">
                <th className="text-left p-2">メンバー</th>
                <th className="text-left p-2">役割ラベル</th>
                <th className="text-center p-2">PM</th>
                <th className="text-center p-2">クローザー</th>
                <th className="text-left p-2">参画月</th>
                <th className="text-left p-2">離脱月</th>
                <th className="text-center p-2">Active</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-4">
                    メンバーが登録されていない
                  </td>
                </tr>
              )}
              {members.map((m) => (
                <tr key={m.rowKey} className="border-b border-border/50">
                  <td className="p-2 min-w-[180px]">
                    <select
                      value={m.memberId}
                      onChange={(e) => updateMember(m.rowKey, "memberId", e.target.value)}
                      className="w-full border border-border rounded px-2 py-1 text-[13px] bg-background"
                    >
                      <option value="">選択...</option>
                      {data.memberMaster.map((mm) => (
                        <option key={mm.memberId} value={mm.memberId}>
                          {mm.codeName ? `${mm.codeName} (${mm.memberName})` : mm.memberName}
                        </option>
                      ))}
                      {m.memberId && !data.memberMaster.some((mm) => mm.memberId === m.memberId) && (
                        <option value={m.memberId}>
                          {m.codeName || m.memberId} (inactive)
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={m.roleLabel}
                      onChange={(e) => updateMember(m.rowKey, "roleLabel", e.target.value)}
                      className="w-28 border border-border rounded px-2 py-1 text-[13px] bg-background"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={m.isPM}
                      onChange={(e) => updateMember(m.rowKey, "isPM", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={m.isCloser}
                      onChange={(e) => updateMember(m.rowKey, "isCloser", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={m.joinYm}
                      onChange={(e) => updateMember(m.rowKey, "joinYm", e.target.value)}
                      placeholder="yyyymm"
                      className="w-20 border border-border rounded px-2 py-1 text-[13px] bg-background"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={m.leaveYm}
                      onChange={(e) => updateMember(m.rowKey, "leaveYm", e.target.value)}
                      placeholder="yyyymm"
                      className="w-20 border border-border rounded px-2 py-1 text-[13px] bg-background"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={m.isActive}
                      onChange={(e) => updateMember(m.rowKey, "isActive", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteMember(m.rowKey)}
                      className="text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <button
            onClick={addMember}
            className="text-xs border border-border rounded px-3 py-1.5 hover:bg-muted"
          >
            ＋ メンバー追加
          </button>
        </div>
      </div>

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
