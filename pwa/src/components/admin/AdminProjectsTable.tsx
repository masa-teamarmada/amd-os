"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

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
};

export function AdminProjectsTable({ projects: initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<EditVals>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [hint, setHint] = useState("");

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
              <th className="text-left px-3 py-2 font-medium sticky left-14 bg-muted/50 w-28 border-r border-border">PJ名</th>
              <th className="text-left px-3 py-2 font-medium w-40">請求先（編集）</th>
              <th className="text-left px-3 py-2 font-medium w-24">freee ID</th>
              <th className="text-left px-3 py-2 font-medium w-32">Slack CH（編集）</th>
              <th className="text-left px-3 py-2 font-medium w-40">Drive Folder（編集）</th>
              <th className="text-left px-3 py-2 font-medium w-48">報告メール（編集）</th>
              <th className="text-left px-3 py-2 font-medium w-20">開始ym</th>
              <th className="text-left px-3 py-2 font-medium w-20">終了ym</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr
                  key={p.id}
                  className={`border-t border-border ${isEditing ? "bg-blue-50/50" : "hover:bg-muted/20"}`}
                >
                  <td className="px-3 py-2 font-mono font-bold sticky left-0 bg-background">{p.project_id}</td>
                  <td className="px-3 py-2 font-medium sticky left-14 bg-background border-r border-border max-w-[112px] truncate" title={p.project_name}>
                    {p.project_name}
                  </td>

                  {/* client_name */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.client_name as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, client_name: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                    ) : <span className="text-muted-foreground">{p.client_name || "—"}</span>}
                  </td>

                  {/* freee_partner_id */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.freee_partner_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, freee_partner_id: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground">{p.freee_partner_id || "—"}</span>}
                  </td>

                  {/* slack_channel_id */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.slack_channel_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, slack_channel_id: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground text-[11px]">{p.slack_channel_id || "—"}</span>}
                  </td>

                  {/* drive_folder_id */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.drive_folder_id as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, drive_folder_id: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                    ) : <span className="font-mono text-muted-foreground text-[11px] truncate block max-w-[150px]">{p.drive_folder_id || "—"}</span>}
                  </td>

                  {/* report_emails */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.report_emails as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, report_emails: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" placeholder="a@b.com, c@d.com" />
                    ) : <span className="text-muted-foreground text-[11px] truncate block max-w-[180px]">{p.report_emails || "—"}</span>}
                  </td>

                  {/* start_ym */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.start_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, start_ym: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202401" />
                    ) : <span className="text-muted-foreground">{p.start_ym || "—"}</span>}
                  </td>

                  {/* end_ym */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={editVals.end_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, end_ym: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-20 bg-background" placeholder="202512" />
                    ) : <span className="text-muted-foreground">{p.end_ym || "—"}</span>}
                  </td>

                  {/* status */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select value={editVals.status as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] bg-background">
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : <StatusBadge status={p.status} />}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(p)}
                          disabled={saving === p.id}
                          className="text-[11px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50"
                        >
                          {saving === p.id ? "…" : "保存"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(p)}
                        className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-muted-foreground">
                  該当なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
