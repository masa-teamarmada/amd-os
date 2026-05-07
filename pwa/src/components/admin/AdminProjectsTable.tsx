"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { AdminProjectMembersModal } from "./AdminProjectMembersModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [membersModalProjectId, setMembersModalProjectId] = useState<string | null>(null);

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

  const startEdit = (p: ProjectRow) => {
    setEditingId(p.id);
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

  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  const saveEdit = async (p: ProjectRow) => {
    setSaving(p.id);
    const patch = {
      client_name: (editVals.client_name as string) || null,
      freee_partner_id: (editVals.freee_partner_id as string) || null,
      slack_channel_id: (editVals.slack_channel_id as string) || null,
      drive_folder_id: (editVals.drive_folder_id as string) || null,
      report_emails: (editVals.report_emails as string) || null,
      start_ym: (editVals.start_ym as string) || null,
      end_ym: (editVals.end_ym as string) || null,
      status: editVals.status as string,
      invoice_send_manual: !!editVals.invoice_send_manual,
      invoice_to_emails: (editVals.invoice_to_emails as string) || null,
      invoice_cc_emails: (editVals.invoice_cc_emails as string) || null,
      invoice_bcc_emails: (editVals.invoice_bcc_emails as string) || null,
      payment_due_day: editVals.payment_due_day && editVals.payment_due_day.trim() !== ""
        ? Number(editVals.payment_due_day)
        : null,
      freeze_from_ym: (editVals.freeze_from_ym as string)?.trim() || null,
      restart_expected_ym: (editVals.restart_expected_ym as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", p.id);

    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, ...patch } : x));
      setHint(`${p.project_name} を保存しました`);
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
        <table className="text-[12px] border-collapse" style={{ minWidth: "1200px" }}>
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 w-14">PJID</th>
              <th className="text-left px-3 py-2 font-medium sticky left-14 bg-muted/50 w-32 border-r border-border">PJ名</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-32">停止 / 再開予定</th>
              <th className="text-left px-3 py-2 font-medium w-40">PL / PM / クローザー</th>
              <th className="text-left px-3 py-2 font-medium w-40">請求先</th>
              <th className="text-left px-3 py-2 font-medium w-48">報告メール</th>
              <th className="text-left px-3 py-2 font-medium w-32">請求書送付</th>
              <th className="text-left px-3 py-2 font-medium w-20">支払期日</th>
              <th className="text-left px-3 py-2 font-medium w-20">開始ym</th>
              <th className="text-left px-3 py-2 font-medium w-20">終了ym</th>
              <th className="text-left px-3 py-2 font-medium w-24">freee ID</th>
              <th className="text-left px-3 py-2 font-medium w-32">Slack CH</th>
              <th className="text-left px-3 py-2 font-medium w-40">Drive Folder</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isEditing = editingId === p.id;
              // セルクリックで編集開始するハンドラ (編集中はクリック無効)
              const cellClick = isEditing ? undefined : () => startEdit(p);
              const cellCls = isEditing ? "px-3 py-2" : "px-3 py-2 cursor-pointer";
              return (
                <tr
                  key={p.id}
                  id={p.project_id}
                  className={`border-t border-border target:bg-amber-50 ${isEditing ? "bg-blue-50/50" : "hover:bg-muted/20"}`}
                >
                  <td className="px-3 py-2 font-mono font-bold sticky left-0 bg-background" onClick={cellClick}>{p.project_id}</td>

                  {/* PJ名 — 編集中なら 保存/取消 ボタンを表示 */}
                  <td className="px-3 py-2 sticky left-14 bg-background border-r border-border" onClick={isEditing ? undefined : cellClick}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium max-w-[120px] truncate" title={p.project_name}>{p.project_name}</span>
                      {isEditing && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); saveEdit(p); }}
                            disabled={saving === p.id}
                            className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50"
                          >
                            {saving === p.id ? "…" : "保存"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                            className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* status */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <select value={editVals.status as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] bg-background">
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : <StatusBadge status={p.status} />}
                  </td>

                  {/* 停止 / 再開予定 (#18) */}
                  <td className={`${cellCls} align-top`} onClick={cellClick}>
                    {isEditing ? (
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

                  {/* PL / PM / クローザー (別モーダル編集なので click→edit は無効) */}
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5 text-[11px]">
                      {p.pls.length > 0 && <div><span className="text-blue-700 font-semibold">PL:</span> {p.pls.join(", ")}</div>}
                      {p.pms.length > 0 && <div><span className="text-emerald-700 font-semibold">PM:</span> {p.pms.join(", ")}</div>}
                      {p.closers.length > 0 && <div><span className="text-orange-700 font-semibold">クローザー:</span> {p.closers.join(", ")}</div>}
                      {p.pls.length === 0 && p.pms.length === 0 && p.closers.length === 0 && <div className="text-muted-foreground">—</div>}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMembersModalProjectId(p.project_id); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground border border-border px-1.5 py-0.5 rounded mt-0.5"
                      >
                        ✏️ 編集
                      </button>
                    </div>
                  </td>

                  {/* client_name (請求先) */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.client_name as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, client_name: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                    ) : <span className="text-muted-foreground">{p.client_name || "—"}</span>}
                  </td>

                  {/* report_emails */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.report_emails as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, report_emails: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" placeholder="a@b.com, c@d.com" />
                    ) : <span className="text-muted-foreground text-[11px] truncate block max-w-[180px]">{p.report_emails || "—"}</span>}
                  </td>

                  {/* 請求書送付 (mode + To/CC/BCC) */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
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
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-muted-foreground">翌月</span>
                        <input type="number" value={editVals.payment_due_day as string}
                          onChange={(e) => setEditVals((v) => ({ ...v, payment_due_day: e.target.value }))}
                          className="border border-border rounded px-1 py-0.5 text-[12px] w-12 bg-background"
                          min="1" max="31" placeholder="末" />
                        <span className="text-[10px] text-muted-foreground">日</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        {p.payment_due_day ? `翌月${p.payment_due_day}日` : "—"}
                      </span>
                    )}
                  </td>

                  {/* start_ym */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.start_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, start_ym: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202401" />
                    ) : <span className="text-muted-foreground">{p.start_ym || "—"}</span>}
                  </td>

                  {/* end_ym */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.end_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, end_ym: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202512" />
                    ) : <span className="text-muted-foreground">{p.end_ym || "—"}</span>}
                  </td>

                  {/* freee_partner_id */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.freee_partner_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, freee_partner_id: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground">{p.freee_partner_id || "—"}</span>}
                  </td>

                  {/* slack_channel_id */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.slack_channel_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, slack_channel_id: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground text-[11px]">{p.slack_channel_id || "—"}</span>}
                  </td>

                  {/* drive_folder_id */}
                  <td className={cellCls} onClick={cellClick}>
                    {isEditing ? (
                      <input type="text" value={editVals.drive_folder_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, drive_folder_id: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground text-[11px] truncate block max-w-[150px]">{p.drive_folder_id || "—"}</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-4 text-center text-muted-foreground">
                  該当なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {membersModalProjectId && (
        <AdminProjectMembersModal
          projectId={membersModalProjectId}
          open
          onClose={() => setMembersModalProjectId(null)}
          onSaved={() => {
            // 役割更新後にページリロードで表示反映 (PJ × メンバー多くないので軽い)
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
