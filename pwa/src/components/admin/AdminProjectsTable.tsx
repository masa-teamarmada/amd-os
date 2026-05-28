"use client";

import { useState, useMemo } from "react";
import { AdminProjectMembersModal } from "./AdminProjectMembersModal";
import { EmailsEditModal } from "./EmailsEditModal";
import { LaneBadges, LaneEditor } from "@/components/lanes/LaneBadges";
import type { LaneWeight } from "@/lib/aspi-lanes";
import { DEFAULT_PAYMENT_DUE_RULE, PAYMENT_DUE_RULE_OPTIONS, paymentDueRuleLabel } from "@/lib/payment-rules";

// 2026-05-11: browser auth client 直接 supabase.from("projects").update は
// RLS で UPDATE が anon / authenticated を弾く回帰が再発したため、
// 全部 service_role 経由の /api/admin/projects/[id] PATCH に統一。
//
// 旧: createBrowserAuthClient() で supabase.from("projects").update().eq("id", p.id)
// 新: fetch("/api/admin/projects/" + p.id, { method: "PATCH", body: JSON.stringify({...}) })

export interface ProjectRow {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  project_category: ProjectCategory;
  slack_channel_id: string | null;
  drive_folder_id: string | null;
  freee_partner_id: string | null;
  report_emails: string | null;
  start_ym: string | null;
  end_ym: string | null;
  fee_type: string | null;
  fee_amount: number | null;
  invoice_send_manual: boolean;
  invoice_to_emails: string | null;
  invoice_cc_emails: string | null;
  invoice_bcc_emails: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
  freeze_from_ym: string | null;
  restart_expected_ym: string | null;
  pms: string[];
  closers: string[];
  pls: string[];
  /** project_ventures 行がある SU 系 PJ。false の PJ は lanes 編集不可。 */
  has_venture_row: boolean;
  /** ASPI 8 domain weighted lanes (project_ventures.lanes 由来)。未設定 or SU 未化 PJ は null。 */
  lanes: LaneWeight[] | null;
  /** LLM (Sonnet) による lane 推定 candidate (pending、未承認)。null = 提案なし。 */
  lane_suggestion: {
    id: string;
    suggested_lanes: LaneWeight[];
    reasoning: string | null;
    confidence: number | null;
    created_at: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// 2026-05-11 まさ指摘 9 番: DB に status='draft' の PJ (= p24 CLG) があったが STATUS_OPTIONS に
// 含まれてなかった。select の value がオプションに無いと React 上で空表示 + 保存時の
// editVals.status が undefined のまま patch されない事故が起きるため、draft を追加。
const STATUS_OPTIONS = ["draft", "active", "sales", "ended", "frozen", "lost"];
const FEE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "未設定" },
  { value: "monthly_fixed", label: "固定" },
  { value: "variable", label: "変動" },
  { value: "milestone", label: "マイルストーン" },
];

type ProjectCategory = "dtsu" | "ecosystem" | "advisor" | "new_business";

const PROJECT_CATEGORY_OPTIONS: Array<{ value: ProjectCategory; label: string; note: string }> = [
  { value: "dtsu", label: "DTSU", note: "学術発SU伴走" },
  { value: "new_business", label: "新規事業創出", note: "レガシー企業DX + 研究シーズ取込" },
  { value: "ecosystem", label: "Ecosystem", note: "研究機関SUエコシステム" },
  { value: "advisor", label: "Advisor", note: "社外役員/顧問" },
];

const PROJECT_CATEGORY_COLORS: Record<ProjectCategory, string> = {
  dtsu: "border-cyan-200 bg-cyan-50 text-cyan-800",
  new_business: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ecosystem: "border-violet-200 bg-violet-50 text-violet-800",
  advisor: "border-amber-200 bg-amber-50 text-amber-800",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-300/30 text-zinc-700 border-zinc-300",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  sales: "bg-blue-500/10 text-blue-700 border-blue-200",
  ended: "bg-zinc-500/10 text-zinc-500 border-zinc-200",
  frozen: "bg-amber-500/10 text-amber-700 border-amber-200",
  lost: "bg-red-500/10 text-red-600 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-zinc-500/10 text-zinc-500 border-zinc-200";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border font-medium ${cls}`}>
      {status}
    </span>
  );
}

function fmtYen(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n > 0 && Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : "—";
}

function parseYenInput(value: string | null | undefined) {
  const n = Number(String(value ?? "").replace(/[,\s¥円]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function feeTypeLabel(value: string | null | undefined) {
  if (value === "monthly_fixed") return "固定";
  if (value === "variable") return "変動";
  if (value === "milestone") return "MS";
  return "未設定";
}

function feeTypeClass(value: string | null | undefined) {
  if (value === "monthly_fixed") return "bg-emerald-100 text-emerald-800";
  if (value === "variable") return "bg-blue-100 text-blue-800";
  if (value === "milestone") return "bg-violet-100 text-violet-800";
  return "bg-zinc-100 text-zinc-500";
}

function ProjectCategoryBadge({ value }: { value: string | null | undefined }) {
  const category = (value || "dtsu") as ProjectCategory;
  const meta = PROJECT_CATEGORY_OPTIONS.find((item) => item.value === category) ?? PROJECT_CATEGORY_OPTIONS[0];
  const cls = PROJECT_CATEGORY_COLORS[meta.value];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {meta.label}
    </span>
  );
}

interface Props {
  projects: ProjectRow[];
}

type EditVals = {
  project_name: string;
  client_name: string;
  freee_partner_id: string;
  slack_channel_id: string;
  drive_folder_id: string;
  report_emails: string;
  start_ym: string;
  end_ym: string;
  status: string;
  project_category: ProjectCategory;
  invoice_send_manual: boolean;
  fee_type: string;
  fee_amount: string;
  invoice_to_emails: string;
  invoice_cc_emails: string;
  invoice_bcc_emails: string;
  payment_due_rule: string;
  payment_due_day: string;
  freeze_from_ym: string;
  restart_expected_ym: string;
};

export function AdminProjectsTable({ projects: initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<EditVals>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [membersModal, setMembersModal] = useState<{ projectId: string; projectName: string } | null>(null);
  // #16 まさ 2026-05-24: report_emails 編集モーダル state
  const [emailsModal, setEmailsModal] = useState<{ rowId: string; projectId: string; projectName: string; emails: string[] } | null>(null);
  const [emailsSaving, setEmailsSaving] = useState(false);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterQ) {
        const q = filterQ.toLowerCase();
        if (
          !p.project_name.toLowerCase().includes(q) &&
          !p.project_id.toLowerCase().includes(q) &&
          !(p.client_name || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [projects, filterStatus, filterQ]);

  // セル単位編集に移行 (まさ要望、2026-05-07):
  // editingCell = `${rowId}:${fieldGroup}` 形式。クリックされたセルだけが編集モードになる。
  // fieldGroup は単一カラムの場合はカラム名、複合 (請求書送付・停止/再開予定) は合成名。
  const editingCell = editingId; // 互換のため変数名再利用 (state は editingId だが意味が変わった)

  const startEditCell = (p: ProjectRow, field: string) => {
    setEditingId(`${p.id}:${field}`);
    setEditVals({
      project_name: p.project_name ?? "",
      client_name: p.client_name ?? "",
      freee_partner_id: p.freee_partner_id ?? "",
      slack_channel_id: p.slack_channel_id ?? "",
      drive_folder_id: p.drive_folder_id ?? "",
      report_emails: p.report_emails ?? "",
      start_ym: p.start_ym ?? "",
      end_ym: p.end_ym ?? "",
      fee_type: p.fee_type ?? "",
      fee_amount: p.fee_amount != null ? String(Math.round(Number(p.fee_amount))) : "",
      status: p.status,
      project_category: p.project_category || "dtsu",
      invoice_send_manual: !!p.invoice_send_manual,
      invoice_to_emails: p.invoice_to_emails ?? "",
      invoice_cc_emails: p.invoice_cc_emails ?? "",
      invoice_bcc_emails: p.invoice_bcc_emails ?? "",
      payment_due_rule: p.payment_due_rule ?? DEFAULT_PAYMENT_DUE_RULE,
      payment_due_day: p.payment_due_day != null ? String(p.payment_due_day) : "",
      freeze_from_ym: p.freeze_from_ym ?? "",
      restart_expected_ym: p.restart_expected_ym ?? "",
    });
  };

  const isEditingField = (p: ProjectRow, field: string) => editingCell === `${p.id}:${field}`;
  const isEditingRow = (p: ProjectRow) => editingCell?.startsWith(`${p.id}:`) ?? false;
  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  // service_role 経由 fetch helper
  const patchProject = async (
    projectsRowId: string,
    payload: { projectsPatch?: Record<string, unknown>; venturesPatch?: Record<string, unknown> }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/projects/${projectsRowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      return j;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  // lanes は project_ventures テーブルへの書き込み
  const saveLanes = async (p: ProjectRow, lanes: LaneWeight[]) => {
    if (!p.has_venture_row) {
      setHint(`${p.project_name} は SU 未化のため lanes を保存できません`);
      return;
    }
    setSaving(p.id);
    const r = await patchProject(p.id, { venturesPatch: { lanes } });
    if (!r.ok) {
      setHint(`lanes 保存エラー: ${r.error}`);
    } else {
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, lanes } : x));
      setHint(`${p.project_name} の lanes を保存しました`);
      setEditingId(null);
    }
    setSaving(null);
  };

  // LLM 提案を採用 (= /api/admin/lane-suggestions/[id] PATCH approve)
  const approveSuggestion = async (p: ProjectRow) => {
    if (!p.lane_suggestion) return;
    setSaving(p.id);
    const sugg = p.lane_suggestion;
    try {
      const res = await fetch(`/api/admin/lane-suggestions/${sugg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setHint(`提案採用エラー: ${j.error}`);
      } else {
        setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, lanes: sugg.suggested_lanes, lane_suggestion: null } : x));
        setHint(`${p.project_name} の LLM 提案を採用しました`);
      }
    } catch (e) {
      setHint(`提案採用エラー: ${String(e)}`);
    }
    setSaving(null);
  };

  // LLM 提案を却下
  const rejectSuggestion = async (p: ProjectRow) => {
    if (!p.lane_suggestion) return;
    setSaving(p.id);
    try {
      const res = await fetch(`/api/admin/lane-suggestions/${p.lane_suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setHint(`提案却下エラー: ${j.error}`);
      } else {
        setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, lane_suggestion: null } : x));
        setHint(`${p.project_name} の LLM 提案を却下しました`);
      }
    } catch (e) {
      setHint(`提案却下エラー: ${String(e)}`);
    }
    setSaving(null);
  };

  const saveCell = async (p: ProjectRow, field: string) => {
    setSaving(p.id);
    // field ごとに patch を組む。null/empty 扱いを丁寧に。
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    switch (field) {
      case "project_name": patch.project_name = (editVals.project_name as string)?.trim() || p.project_name; break;
      case "client_name": patch.client_name = (editVals.client_name as string) || null; break;
      case "freee_partner_id": patch.freee_partner_id = (editVals.freee_partner_id as string) || null; break;
      case "slack_channel_id": patch.slack_channel_id = (editVals.slack_channel_id as string) || null; break;
      case "drive_folder_id": patch.drive_folder_id = (editVals.drive_folder_id as string) || null; break;
      case "report_emails": patch.report_emails = (editVals.report_emails as string) || null; break;
      case "start_ym": patch.start_ym = (editVals.start_ym as string) || null; break;
      case "end_ym": patch.end_ym = (editVals.end_ym as string) || null; break;
      case "fee":
        patch.fee_type = (editVals.fee_type as string) || null;
        patch.fee_amount = parseYenInput(editVals.fee_amount as string) || null;
        break;
      case "status": patch.status = editVals.status as string; break;
      case "project_category": patch.project_category = editVals.project_category || "dtsu"; break;
      case "payment_due_rule":
        patch.payment_due_rule = editVals.payment_due_rule || DEFAULT_PAYMENT_DUE_RULE;
        patch.payment_due_day = null;
        break;
      case "invoice_send":
        patch.invoice_send_manual = !!editVals.invoice_send_manual;
        patch.invoice_to_emails = (editVals.invoice_to_emails as string) || null;
        patch.invoice_cc_emails = (editVals.invoice_cc_emails as string) || null;
        patch.invoice_bcc_emails = (editVals.invoice_bcc_emails as string) || null;
        break;
      case "freeze_restart":
        patch.freeze_from_ym = (editVals.freeze_from_ym as string)?.trim() || null;
        patch.restart_expected_ym = (editVals.restart_expected_ym as string)?.trim() || null;
        break;
    }
    // updated_at は API 側で付与するので patch から除外
    const { updated_at: _drop, ...projectsPatch } = patch as Record<string, unknown> & { updated_at?: unknown };
    void _drop;
    const r = await patchProject(p.id, { projectsPatch });
    if (!r.ok) {
      setHint(`保存エラー: ${r.error}`);
    } else {
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, ...patch } : x));
      setHint(`${String(patch.project_name || p.project_name)} の ${field} を保存しました`);
      setEditingId(null);
    }
    setSaving(null);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-border rounded px-2 py-1 text-[12px] bg-background"
          >
            <option value="">（全て）</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">検索</span>
          <input
            type="text"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="PJ名 / ID / クライアント"
            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-52"
          />
        </div>
        <button
          onClick={() => { setFilterStatus(""); setFilterQ(""); }}
          className="text-[12px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-background"
        >
          リセット
        </button>
        <span className="text-[12px] text-muted-foreground ml-auto">{filtered.length} 件</span>
      </div>

      {hint && (
        <div className="text-[12px] text-muted-foreground mb-2">{hint}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="text-[12px] border-collapse" style={{ minWidth: "1740px" }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 z-40 bg-muted w-14">PJID</th>
              <th className="text-left px-3 py-2 font-medium sticky left-14 z-40 bg-muted w-32 border-r border-border">PJ名</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-32">分類</th>
              <th className="text-left px-3 py-2 font-medium w-44">Lane (ASPI)</th>
              <th className="text-left px-3 py-2 font-medium w-56">メンバー</th>
              <th className="text-left px-3 py-2 font-medium w-40">請求先</th>
              <th className="text-left px-3 py-2 font-medium w-56">関係先メールアドレス</th>
              <th className="text-left px-3 py-2 font-medium w-32">請求書送付</th>
              <th className="text-left px-3 py-2 font-medium w-36">業務委託料</th>
              <th className="text-left px-3 py-2 font-medium w-24">支払条件</th>
              <th className="text-left px-3 py-2 font-medium w-20">開始ym</th>
              <th className="text-left px-3 py-2 font-medium w-20">終了ym</th>
              <th className="text-left px-3 py-2 font-medium w-32">停止 / 再開予定</th>
              <th className="text-left px-3 py-2 font-medium w-24">freee ID</th>
              <th className="text-left px-3 py-2 font-medium w-32">Slack CH</th>
              <th className="text-left px-3 py-2 font-medium w-40">Drive Folder</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const rowEditing = isEditingRow(p);
              // セル単位の保存/取消ボタン
              const cellActions = (field: string) => (
                <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => saveCell(p, field)} disabled={saving === p.id}
                    className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50">
                    {saving === p.id ? "…" : "保存"}
                  </button>
                  <button onClick={cancelEdit}
                    className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded">
                    取消
                  </button>
                </div>
              );
              // セル click ハンドラ — 既に他セル編集中なら無効
              const enterCell = (field: string) => () => {
                if (rowEditing && !isEditingField(p, field)) return; // 他セル編集中は無視
                if (!isEditingField(p, field)) startEditCell(p, field);
              };
              const cellCls = (field: string) => isEditingField(p, field)
                ? "px-3 py-2"
                : "px-3 py-2 cursor-pointer hover:bg-muted/30";
              return (
                <tr
                  key={p.id}
                  id={p.project_id}
                  className={`border-t border-border target:bg-amber-50 ${rowEditing ? "bg-blue-50/30" : "hover:bg-muted/20"}`}
                >
                  <td className="px-3 py-2 font-mono font-bold sticky left-0 bg-background">{p.project_id}</td>

                  {/* PJ名 */}
                  <td
                    className={`${cellCls("project_name")} sticky left-14 bg-background border-r border-border font-medium max-w-[120px]`}
                    onClick={enterCell("project_name")}
                    title={p.project_name}
                  >
                    {isEditingField(p, "project_name") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editVals.project_name as string}
                          autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, project_name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCell(p, "project_name");
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background"
                        />
                        {cellActions("project_name")}
                      </div>
                    ) : (
                      <span className="truncate block">{p.project_name}</span>
                    )}
                  </td>

                  {/* status */}
	                  <td className={cellCls("status")} onClick={enterCell("status")}>
                    {isEditingField(p, "status") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <select value={editVals.status as string}
                          onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] bg-background">
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {cellActions("status")}
                      </div>
	                    ) : <StatusBadge status={p.status} />}
	                  </td>

	                  {/* project_category */}
	                  <td className={cellCls("project_category")} onClick={enterCell("project_category")}>
	                    {isEditingField(p, "project_category") ? (
	                      <div onClick={(e) => e.stopPropagation()}>
	                        <select
	                          value={editVals.project_category || "dtsu"}
	                          onChange={(e) => setEditVals((v) => ({ ...v, project_category: e.target.value as ProjectCategory }))}
	                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[12px]"
	                        >
	                          {PROJECT_CATEGORY_OPTIONS.map((item) => (
	                            <option key={item.value} value={item.value}>{item.note}</option>
	                          ))}
	                        </select>
	                        <p className="mt-1 text-[9px] text-muted-foreground">ecosystem は AMD Score 対象外</p>
	                        {cellActions("project_category")}
	                      </div>
	                    ) : (
	                      <div className="space-y-1">
	                        <ProjectCategoryBadge value={p.project_category} />
	                        <div className="text-[9px] text-muted-foreground">
	                          {PROJECT_CATEGORY_OPTIONS.find((item) => item.value === p.project_category)?.note || "通常DTSU"}
	                        </div>
	                      </div>
	                    )}
	                  </td>

	                  {/* Lane (ASPI 8 domains weighted, project_ventures.lanes)
                      lanes が null かつ LLM 提案 (lane_suggestion) があれば「採用 / 却下」UI も表示。 */}
                  <td
                    className={p.has_venture_row ? cellCls("lanes") : "px-3 py-2 text-muted-foreground"}
                    onClick={p.has_venture_row ? enterCell("lanes") : undefined}
                    title={p.has_venture_row ? "クリックで lane を編集" : "project_ventures 行がないため lane 編集不可"}
                  >
                    {!p.has_venture_row ? (
                      <div className="space-y-1">
                        <LaneBadges lanes={null} fallback="SU未化" />
                        <div className="text-[9px] text-muted-foreground leading-tight">
                          project_ventures 作成後に編集
                        </div>
                      </div>
                    ) : isEditingField(p, "lanes") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <LaneEditor
                          initial={p.lanes ?? p.lane_suggestion?.suggested_lanes ?? null}
                          onCancel={cancelEdit}
                          onSave={(lanes) => saveLanes(p, lanes)}
                          saving={saving === p.id}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <LaneBadges lanes={p.lanes} fallback={p.lanes === null ? "未設定" : null} />
                        {p.lane_suggestion && !p.lanes && (
                          <div className="mt-1 px-1.5 py-1 rounded bg-amber-50 border border-amber-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 text-[9px] text-amber-800 font-semibold mb-0.5">
                              <span>💡 LLM 提案</span>
                              {p.lane_suggestion.confidence != null && (
                                <span className="text-amber-600">conf={Math.round(p.lane_suggestion.confidence * 100)}%</span>
                              )}
                            </div>
                            <LaneBadges lanes={p.lane_suggestion.suggested_lanes} size="xs" />
                            {p.lane_suggestion.reasoning && (
                              <div className="text-[9px] text-amber-700 mt-0.5 leading-tight">
                                {p.lane_suggestion.reasoning}
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => approveSuggestion(p)}
                                disabled={saving === p.id}
                                className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded disabled:opacity-50"
                              >
                                採用
                              </button>
                              <button
                                onClick={() => rejectSuggestion(p)}
                                disabled={saving === p.id}
                                className="text-[9px] text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded disabled:opacity-50"
                              >
                                却下
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* メンバー (PL/PM/クローザー + 役割ラベル/参画月/離脱月/Active を一括編集) */}
                  <td
                    className="px-3 py-2 align-top cursor-pointer hover:bg-muted/30"
                    onClick={() => setMembersModal({ projectId: p.project_id, projectName: p.project_name })}
                    title="クリックで PJ メンバーを編集"
                  >
                    <div className="space-y-0.5 text-[11px]">
                      {p.pls.length > 0 && (
                        <div><span className="text-muted-foreground mr-1">PL:</span><span className="text-blue-700 font-semibold">{p.pls.join(", ")}</span></div>
                      )}
                      {p.pms.length > 0 && (
                        <div><span className="text-muted-foreground mr-1">PM:</span><span className="text-emerald-700 font-semibold">{p.pms.join(", ")}</span></div>
                      )}
                      {p.closers.length > 0 && (
                        <div><span className="text-muted-foreground mr-1">クローザー:</span><span className="text-orange-700 font-semibold">{p.closers.join(", ")}</span></div>
                      )}
                      {p.pls.length === 0 && p.pms.length === 0 && p.closers.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>

                  {/* client_name */}
                  <td className={cellCls("client_name")} onClick={enterCell("client_name")}>
                    {isEditingField(p, "client_name") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.client_name as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, client_name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "client_name"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("client_name")}
                      </div>
                    ) : <span className="text-muted-foreground">{p.client_name || "—"}</span>}
                  </td>

                  {/* report_emails — 省略表示 + クリックで EmailsEditModal (#16 まさ 2026-05-24) */}
                  <td className="px-3 py-2 align-top max-w-[180px]">
                    {(() => {
                      const list = (p.report_emails || "").split(",").map((e) => e.trim()).filter(Boolean);
                      const count = list.length;
                      const preview = count === 0 ? "—" : count === 1 ? list[0] : `${list[0]} +${count - 1}`;
                      return (
                        <button
                          type="button"
                          onClick={() => setEmailsModal({ rowId: p.id, projectId: p.project_id, projectName: p.project_name, emails: list })}
                          className="text-left text-[11px] font-mono text-muted-foreground hover:text-foreground hover:underline truncate w-full"
                          title={count === 0 ? "クリックして関係先メアドを追加" : `${count}件 — クリックして編集`}
                        >
                          {count > 0 && <span className="mr-1 text-foreground font-sans font-medium">{count}件</span>}
                          <span className="truncate">{preview}</span>
                          {count > 0 && <span className="ml-1 text-[10px]">▸</span>}
                        </button>
                      );
                    })()}
                  </td>

                  {/* 請求書送付 (compound) */}
                  <td className={cellCls("invoice_send")} onClick={enterCell("invoice_send")}>
                    {isEditingField(p, "invoice_send") ? (
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={editVals.invoice_send_manual ? "manual" : "auto"}
                          onChange={(e) => setEditVals((v) => ({ ...v, invoice_send_manual: e.target.value === "manual" }))}
                          className="border border-border rounded px-1.5 py-0.5 text-[11px] bg-background w-full"
                        >
                          <option value="auto">auto (自動送付)</option>
                          <option value="manual">manual (手動送付)</option>
                        </select>
                        {!editVals.invoice_send_manual && (
                          <>
                            <input type="text" value={editVals.invoice_to_emails as string}
                              onChange={(e) => setEditVals((v) => ({ ...v, invoice_to_emails: e.target.value }))}
                              placeholder="To" className="border border-border rounded px-1.5 py-0.5 text-[11px] w-full bg-background" />
                            <input type="text" value={editVals.invoice_cc_emails as string}
                              onChange={(e) => setEditVals((v) => ({ ...v, invoice_cc_emails: e.target.value }))}
                              placeholder="CC" className="border border-border rounded px-1.5 py-0.5 text-[11px] w-full bg-background" />
                            <input type="text" value={editVals.invoice_bcc_emails as string}
                              onChange={(e) => setEditVals((v) => ({ ...v, invoice_bcc_emails: e.target.value }))}
                              placeholder="BCC" className="border border-border rounded px-1.5 py-0.5 text-[11px] w-full bg-background" />
                          </>
                        )}
                        {cellActions("invoice_send")}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        <span className={p.invoice_send_manual ? "text-amber-700 font-medium" : ""}>
                          {p.invoice_send_manual ? "manual" : "auto"}
                        </span>
                        {!p.invoice_send_manual && p.invoice_to_emails && (
                          <div className="truncate max-w-[140px]" title={p.invoice_to_emails}>{p.invoice_to_emails}</div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* fee_type / fee_amount */}
                  <td className={cellCls("fee")} onClick={enterCell("fee")}>
                    {isEditingField(p, "fee") ? (
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={editVals.fee_type || ""}
                          autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, fee_type: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[12px]"
                        >
                          {FEE_TYPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editVals.fee_amount as string}
                          onChange={(e) => setEditVals((v) => ({ ...v, fee_amount: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "fee"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="固定額"
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[12px] font-mono"
                        />
                        {cellActions("fee")}
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[11px]">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ${feeTypeClass(p.fee_type)}`}>
                          {feeTypeLabel(p.fee_type)}
                        </span>
                        {p.fee_amount != null && Number(p.fee_amount) > 0 ? (
                          <div className="font-mono text-foreground">{fmtYen(p.fee_amount)}</div>
                        ) : (
                          <div className="text-muted-foreground">—</div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* payment_due_rule */}
                  <td className={cellCls("payment_due_rule")} onClick={enterCell("payment_due_rule")}>
                    {isEditingField(p, "payment_due_rule") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          value={editVals.payment_due_rule || DEFAULT_PAYMENT_DUE_RULE}
                          autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, payment_due_rule: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[12px]"
                        >
                          {PAYMENT_DUE_RULE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                        {cellActions("payment_due_rule")}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        {paymentDueRuleLabel(p.payment_due_rule, p.payment_due_day)}
                      </span>
                    )}
                  </td>

                  {/* start_ym */}
                  <td className={cellCls("start_ym")} onClick={enterCell("start_ym")}>
                    {isEditingField(p, "start_ym") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.start_ym as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, start_ym: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "start_ym"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202401" />
                        {cellActions("start_ym")}
                      </div>
                    ) : <span className="text-muted-foreground">{p.start_ym || "—"}</span>}
                  </td>

                  {/* end_ym */}
                  <td className={cellCls("end_ym")} onClick={enterCell("end_ym")}>
                    {isEditingField(p, "end_ym") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.end_ym as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, end_ym: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "end_ym"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202512" />
                        {cellActions("end_ym")}
                      </div>
                    ) : <span className="text-muted-foreground">{p.end_ym || "—"}</span>}
                  </td>

                  {/* 停止 / 再開予定 (compound: freeze_from_ym + restart_expected_ym) */}
                  <td className={`${cellCls("freeze_restart")} align-top`} onClick={enterCell("freeze_restart")}>
                    {isEditingField(p, "freeze_restart") ? (
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-14">停止開始:</span>
                          <input type="text" value={editVals.freeze_from_ym as string}
                            onChange={(e) => setEditVals((v) => ({ ...v, freeze_from_ym: e.target.value }))}
                            placeholder="202604"
                            className="border border-border rounded px-1 py-0.5 text-[11px] w-16 bg-background font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-14">再開予定:</span>
                          <input type="text" value={editVals.restart_expected_ym as string}
                            onChange={(e) => setEditVals((v) => ({ ...v, restart_expected_ym: e.target.value }))}
                            placeholder="202606"
                            className="border border-border rounded px-1 py-0.5 text-[11px] w-16 bg-background font-mono" />
                        </div>
                        <p className="text-[9px] text-muted-foreground">両方セットすると「N月〜M月停止中」</p>
                        {cellActions("freeze_restart")}
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[11px]">
                        {p.freeze_from_ym && p.restart_expected_ym && (
                          <div className="text-slate-700">❄️ {p.freeze_from_ym} 〜 {p.restart_expected_ym} 直前 停止中</div>
                        )}
                        {p.freeze_from_ym && !p.restart_expected_ym && (
                          <div className="text-amber-700">⚠️ {p.freeze_from_ym} から停止</div>
                        )}
                        {!p.freeze_from_ym && p.restart_expected_ym && (
                          <div className="text-blue-700">📅 {p.restart_expected_ym} から再開予定</div>
                        )}
                        {!p.freeze_from_ym && !p.restart_expected_ym && <span className="text-muted-foreground">—</span>}
                      </div>
                    )}
                  </td>

                  {/* freee_partner_id */}
                  <td className={cellCls("freee_partner_id")} onClick={enterCell("freee_partner_id")}>
                    {isEditingField(p, "freee_partner_id") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.freee_partner_id as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, freee_partner_id: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "freee_partner_id"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background font-mono" />
                        {cellActions("freee_partner_id")}
                      </div>
                    ) : <span className="font-mono text-muted-foreground">{p.freee_partner_id || "—"}</span>}
                  </td>

                  {/* slack_channel_id */}
                  <td className={cellCls("slack_channel_id")} onClick={enterCell("slack_channel_id")}>
                    {isEditingField(p, "slack_channel_id") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.slack_channel_id as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, slack_channel_id: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "slack_channel_id"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                        {cellActions("slack_channel_id")}
                      </div>
                    ) : <span className="font-mono text-muted-foreground text-[11px]">{p.slack_channel_id || "—"}</span>}
                  </td>

                  {/* drive_folder_id */}
                  <td className={cellCls("drive_folder_id")} onClick={enterCell("drive_folder_id")}>
                    {isEditingField(p, "drive_folder_id") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.drive_folder_id as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, drive_folder_id: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "drive_folder_id"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                        {cellActions("drive_folder_id")}
                      </div>
                    ) : <span className="font-mono text-muted-foreground text-[11px] truncate block max-w-[150px]">{p.drive_folder_id || "—"}</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={17} className="px-3 py-4 text-center text-muted-foreground">
                  該当なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {membersModal && (
        <AdminProjectMembersModal
          projectId={membersModal.projectId}
          projectName={membersModal.projectName}
          open
          onClose={() => setMembersModal(null)}
          onSaved={() => {
            // メンバー更新後にページリロードで表示反映 (PJ × メンバー多くないので軽い)
            window.location.reload();
          }}
        />
      )}

      {/* #16 まさ 2026-05-24: 関係先メアド編集モーダル */}
      <EmailsEditModal
        open={emailsModal !== null}
        title={emailsModal ? `${emailsModal.projectName} (${emailsModal.projectId})` : undefined}
        emails={emailsModal?.emails ?? []}
        saving={emailsSaving}
        onOpenChange={(open) => { if (!open && !emailsSaving) setEmailsModal(null); }}
        onSave={async (newEmails) => {
          if (!emailsModal) return;
          setEmailsSaving(true);
          try {
            const joined = newEmails.join(", ");
            const res = await fetch(`/api/admin/projects/${emailsModal.rowId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectsPatch: { report_emails: joined || null } }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              setHint(`✕ 保存失敗: ${j.error || res.status}`);
              return;
            }
            // local state も更新 (= reload なし)
            setProjects((prev) => prev.map((p) => p.id === emailsModal.rowId ? { ...p, report_emails: joined || null } : p));
            setHint(`✓ ${emailsModal.projectName} の関係先メアド (${newEmails.length}件) を保存`);
            setEmailsModal(null);
            setTimeout(() => setHint(""), 2500);
          } catch (e) {
            setHint(`✕ 保存失敗: ${e instanceof Error ? e.message : "unknown"}`);
          } finally {
            setEmailsSaving(false);
          }
        }}
      />
    </div>
  );
}
