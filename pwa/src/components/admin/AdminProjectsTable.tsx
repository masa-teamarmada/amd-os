"use client";

import { useState, useMemo } from "react";
import { createClient as createBrowserAuthClient } from "@/lib/supabase/client";
import { AdminProjectRoleEditModal, type RoleKind } from "./AdminProjectRoleEditModal";

// auth (browser) client。anon RLS で write が弾かれるため、ログイン中ユーザーで書き込む
// (例: status の CHECK / UPDATE policy が anon を弾く回帰が 2026-05-08 に発生)
const supabase = createBrowserAuthClient();

export interface ProjectRow {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  slack_channel_id: string | null;
  drive_folder_id: string | null;
  freee_partner_id: string | null;
  report_emails: string | null;
  start_ym: string | null;
  end_ym: string | null;
  invoice_send_manual: boolean;
  invoice_to_emails: string | null;
  invoice_cc_emails: string | null;
  invoice_bcc_emails: string | null;
  payment_due_day: number | null;
  freeze_from_ym: string | null;
  restart_expected_ym: string | null;
  pms: string[];
  closers: string[];
  pls: string[];
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["active", "sales", "ended", "frozen", "lost"];

const STATUS_COLORS: Record<string, string> = {
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

interface Props {
  projects: ProjectRow[];
}

type EditVals = {
  client_name: string;
  freee_partner_id: string;
  slack_channel_id: string;
  drive_folder_id: string;
  report_emails: string;
  start_ym: string;
  end_ym: string;
  status: string;
  invoice_send_manual: boolean;
  invoice_to_emails: string;
  invoice_cc_emails: string;
  invoice_bcc_emails: string;
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
  const [roleModal, setRoleModal] = useState<{ projectId: string; projectName: string; role: RoleKind } | null>(null);

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
      client_name: p.client_name ?? "",
      freee_partner_id: p.freee_partner_id ?? "",
      slack_channel_id: p.slack_channel_id ?? "",
      drive_folder_id: p.drive_folder_id ?? "",
      report_emails: p.report_emails ?? "",
      start_ym: p.start_ym ?? "",
      end_ym: p.end_ym ?? "",
      status: p.status,
      invoice_send_manual: !!p.invoice_send_manual,
      invoice_to_emails: p.invoice_to_emails ?? "",
      invoice_cc_emails: p.invoice_cc_emails ?? "",
      invoice_bcc_emails: p.invoice_bcc_emails ?? "",
      payment_due_day: p.payment_due_day != null ? String(p.payment_due_day) : "",
      freeze_from_ym: p.freeze_from_ym ?? "",
      restart_expected_ym: p.restart_expected_ym ?? "",
    });
  };

  const isEditingField = (p: ProjectRow, field: string) => editingCell === `${p.id}:${field}`;
  const isEditingRow = (p: ProjectRow) => editingCell?.startsWith(`${p.id}:`) ?? false;
  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  const saveCell = async (p: ProjectRow, field: string) => {
    setSaving(p.id);
    // field ごとに patch を組む。null/empty 扱いを丁寧に。
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    switch (field) {
      case "client_name": patch.client_name = (editVals.client_name as string) || null; break;
      case "freee_partner_id": patch.freee_partner_id = (editVals.freee_partner_id as string) || null; break;
      case "slack_channel_id": patch.slack_channel_id = (editVals.slack_channel_id as string) || null; break;
      case "drive_folder_id": patch.drive_folder_id = (editVals.drive_folder_id as string) || null; break;
      case "report_emails": patch.report_emails = (editVals.report_emails as string) || null; break;
      case "start_ym": patch.start_ym = (editVals.start_ym as string) || null; break;
      case "end_ym": patch.end_ym = (editVals.end_ym as string) || null; break;
      case "status": patch.status = editVals.status as string; break;
      case "payment_due_day":
        patch.payment_due_day = editVals.payment_due_day && editVals.payment_due_day.trim() !== ""
          ? Number(editVals.payment_due_day) : null;
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
    const { error } = await supabase.from("projects").update(patch).eq("id", p.id);
    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, ...patch } : x));
      setHint(`${p.project_name} の ${field} を保存しました`);
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
        <table className="text-[12px] border-collapse" style={{ minWidth: "1600px" }}>
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 w-14">PJID</th>
              <th className="text-left px-3 py-2 font-medium sticky left-14 bg-muted/50 w-32 border-r border-border">PJ名</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-32">PL</th>
              <th className="text-left px-3 py-2 font-medium w-32">PM</th>
              <th className="text-left px-3 py-2 font-medium w-32">クローザー</th>
              <th className="text-left px-3 py-2 font-medium w-40">請求先</th>
              <th className="text-left px-3 py-2 font-medium w-56">関係先メールアドレス</th>
              <th className="text-left px-3 py-2 font-medium w-32">請求書送付</th>
              <th className="text-left px-3 py-2 font-medium w-20">支払期日</th>
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

                  {/* PJ名 — 表示のみ (PJ名そのものは varying でなく safe) */}
                  <td className="px-3 py-2 sticky left-14 bg-background border-r border-border font-medium max-w-[120px] truncate" title={p.project_name}>
                    {p.project_name}
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

                  {/* PL (列クリックでロール別モーダル) */}
                  <td
                    className="px-3 py-2 align-top cursor-pointer hover:bg-muted/30"
                    onClick={() => setRoleModal({ projectId: p.project_id, projectName: p.project_name, role: "pl" })}
                    title="クリックで PL を編集"
                  >
                    {p.pls.length > 0 ? (
                      <span className="text-[11px] text-blue-700 font-semibold">{p.pls.join(", ")}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* PM */}
                  <td
                    className="px-3 py-2 align-top cursor-pointer hover:bg-muted/30"
                    onClick={() => setRoleModal({ projectId: p.project_id, projectName: p.project_name, role: "pm" })}
                    title="クリックで PM を編集"
                  >
                    {p.pms.length > 0 ? (
                      <span className="text-[11px] text-emerald-700 font-semibold">{p.pms.join(", ")}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* クローザー */}
                  <td
                    className="px-3 py-2 align-top cursor-pointer hover:bg-muted/30"
                    onClick={() => setRoleModal({ projectId: p.project_id, projectName: p.project_name, role: "closer" })}
                    title="クリックでクローザーを編集"
                  >
                    {p.closers.length > 0 ? (
                      <span className="text-[11px] text-orange-700 font-semibold">{p.closers.join(", ")}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
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

                  {/* report_emails */}
                  <td className={cellCls("report_emails")} onClick={enterCell("report_emails")}>
                    {isEditingField(p, "report_emails") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.report_emails as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, report_emails: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "report_emails"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" placeholder="a@b.com, c@d.com" />
                        {cellActions("report_emails")}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-[11px] break-all max-w-[260px]">
                        {p.report_emails ? p.report_emails.split(",").map((e) => e.trim()).filter(Boolean).join(", ") : "—"}
                      </div>
                    )}
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

                  {/* payment_due_day */}
                  <td className={cellCls("payment_due_day")} onClick={enterCell("payment_due_day")}>
                    {isEditingField(p, "payment_due_day") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">翌月</span>
                          <input type="number" value={editVals.payment_due_day as string} autoFocus
                            onChange={(e) => setEditVals((v) => ({ ...v, payment_due_day: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") saveCell(p, "payment_due_day"); if (e.key === "Escape") cancelEdit(); }}
                            className="border border-border rounded px-1 py-0.5 text-[12px] w-12 bg-background"
                            min="1" max="31" placeholder="末" />
                          <span className="text-[10px] text-muted-foreground">日</span>
                        </div>
                        {cellActions("payment_due_day")}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        {p.payment_due_day ? `翌月${p.payment_due_day}日` : "—"}
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
                <td colSpan={16} className="px-3 py-4 text-center text-muted-foreground">
                  該当なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roleModal && (
        <AdminProjectRoleEditModal
          projectId={roleModal.projectId}
          projectName={roleModal.projectName}
          role={roleModal.role}
          open
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            // ロール更新後にページリロードで表示反映 (PJ × メンバー多くないので軽い)
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
