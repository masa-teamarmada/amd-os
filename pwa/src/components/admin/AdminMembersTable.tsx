"use client";

import { useState, useMemo } from "react";
import { createClient as createBrowserAuthClient } from "@/lib/supabase/client";

// auth (browser) client。anon RLS で write が弾かれるため、ログイン中ユーザーで書き込む
// (PJ リストと同様に 2026-05-08 で auth client 化)
const supabase = createBrowserAuthClient();

export interface MemberRow {
  id: string;
  member_id: string;
  code_name: string;
  member_name: string | null;
  email: string;
  role: string | null;
  status: string;
  is_admin: boolean;
  slack_id: string | null;
  join_ym: string | null;
  leave_ym: string | null;
  bank_info: string | null;
  member_address: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  members: MemberRow[];
}

const STATUS_OPTIONS = ["active", "inactive"];

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
    : "bg-zinc-500/10 text-zinc-500 border-zinc-200";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border font-medium ${cls}`}>
      {status}
    </span>
  );
}

type EditVals = {
  code_name: string;
  member_name: string;
  email: string;
  role: string;
  status: string;
  join_ym: string;
  leave_ym: string;
  is_admin: boolean;
  slack_id: string;
};

export function AdminMembersTable({ members: initialMembers }: Props) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");
  // editingCell = `${rowId}:${field}` 形式 (PJ リストと同じパターン)
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<EditVals>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterQ) {
        const q = filterQ.toLowerCase();
        if (
          !m.code_name.toLowerCase().includes(q) &&
          !m.email.toLowerCase().includes(q) &&
          !(m.member_name || "").toLowerCase().includes(q) &&
          !m.member_id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [members, filterStatus, filterQ]);

  const startEditCell = (m: MemberRow, field: string) => {
    setEditingCell(`${m.id}:${field}`);
    setEditVals({
      code_name: m.code_name ?? "",
      member_name: m.member_name ?? "",
      email: m.email ?? "",
      role: m.role ?? "",
      status: m.status,
      join_ym: m.join_ym ?? "",
      leave_ym: m.leave_ym ?? "",
      is_admin: !!m.is_admin,
      slack_id: m.slack_id ?? "",
    });
  };

  const isEditingField = (m: MemberRow, field: string) => editingCell === `${m.id}:${field}`;
  const isEditingRow = (m: MemberRow) => editingCell?.startsWith(`${m.id}:`) ?? false;
  const cancelEdit = () => { setEditingCell(null); setEditVals({}); };

  const saveCell = async (m: MemberRow, field: string) => {
    setSaving(m.id);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    switch (field) {
      case "code_name": patch.code_name = (editVals.code_name as string).trim() || m.code_name; break;
      case "member_name": patch.member_name = (editVals.member_name as string) || null; break;
      case "email": patch.email = (editVals.email as string).trim() || m.email; break;
      case "role": patch.role = (editVals.role as string) || null; break;
      case "status": patch.status = editVals.status as string; break;
      case "join_ym": patch.join_ym = (editVals.join_ym as string) || null; break;
      case "leave_ym": patch.leave_ym = (editVals.leave_ym as string) || null; break;
      case "is_admin": patch.is_admin = !!editVals.is_admin; break;
      case "slack_id": patch.slack_id = (editVals.slack_id as string).trim() || null; break;
    }
    const { error } = await supabase.from("members").update(patch).eq("id", m.id);
    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, ...patch } as MemberRow : x));
      setHint(`${m.code_name} の ${field} を保存しました`);
      setEditingCell(null);
    }
    setSaving(null);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">状態</span>
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
            placeholder="codeName / email / ID"
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
        <table className="text-[12px] border-collapse" style={{ minWidth: "1300px" }}>
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 w-24 border-r border-border">codeName</th>
              <th className="text-left px-3 py-2 font-medium w-24">memberId</th>
              <th className="text-left px-3 py-2 font-medium w-40">表示名</th>
              <th className="text-left px-3 py-2 font-medium w-56">email</th>
              <th className="text-left px-3 py-2 font-medium w-28">Role</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-24">joinYm</th>
              <th className="text-left px-3 py-2 font-medium w-24">leaveYm</th>
              <th className="text-left px-3 py-2 font-medium w-16">admin</th>
              <th className="text-left px-3 py-2 font-medium w-32">Slack ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const rowEditing = isEditingRow(m);
              const cellActions = (field: string) => (
                <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => saveCell(m, field)} disabled={saving === m.id}
                    className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50">
                    {saving === m.id ? "…" : "保存"}
                  </button>
                  <button onClick={cancelEdit}
                    className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded">
                    取消
                  </button>
                </div>
              );
              const enterCell = (field: string) => () => {
                if (rowEditing && !isEditingField(m, field)) return; // 他セル編集中は無視
                if (!isEditingField(m, field)) startEditCell(m, field);
              };
              const cellCls = (field: string) => isEditingField(m, field)
                ? "px-3 py-2"
                : "px-3 py-2 cursor-pointer hover:bg-muted/30";
              return (
                <tr
                  key={m.id}
                  className={`border-t border-border ${rowEditing ? "bg-blue-50/30" : "hover:bg-muted/20"}`}
                >
                  {/* codeName - editable, sticky */}
                  <td
                    className={`${cellCls("code_name")} font-medium sticky left-0 bg-background border-r border-border`}
                    onClick={enterCell("code_name")}
                  >
                    {isEditingField(m, "code_name") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.code_name as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, code_name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "code_name"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("code_name")}
                      </div>
                    ) : m.code_name}
                  </td>

                  {/* memberId - read-only (主キー的役割、FK 参照されているため編集不可) */}
                  <td className="px-3 py-2 font-mono text-muted-foreground">{m.member_id}</td>

                  {/* 表示名 (member_name) */}
                  <td className={cellCls("member_name")} onClick={enterCell("member_name")}>
                    {isEditingField(m, "member_name") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.member_name as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, member_name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "member_name"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("member_name")}
                      </div>
                    ) : <span>{m.member_name || "—"}</span>}
                  </td>

                  {/* email */}
                  <td className={cellCls("email")} onClick={enterCell("email")}>
                    {isEditingField(m, "email") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="email" value={editVals.email as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, email: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "email"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("email")}
                      </div>
                    ) : <span className="text-muted-foreground truncate block max-w-[220px]" title={m.email}>{m.email}</span>}
                  </td>

                  {/* role */}
                  <td className={cellCls("role")} onClick={enterCell("role")}>
                    {isEditingField(m, "role") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.role as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, role: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "role"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="role"
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("role")}
                      </div>
                    ) : <span className="text-muted-foreground">{m.role || "—"}</span>}
                  </td>

                  {/* status */}
                  <td className={cellCls("status")} onClick={enterCell("status")}>
                    {isEditingField(m, "status") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <select value={editVals.status as string}
                          onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] bg-background">
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {cellActions("status")}
                      </div>
                    ) : <StatusBadge status={m.status} />}
                  </td>

                  {/* join_ym */}
                  <td className={cellCls("join_ym")} onClick={enterCell("join_ym")}>
                    {isEditingField(m, "join_ym") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.join_ym as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, join_ym: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "join_ym"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="202301"
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-24 bg-background font-mono" />
                        {cellActions("join_ym")}
                      </div>
                    ) : <span className="text-muted-foreground">{m.join_ym || "—"}</span>}
                  </td>

                  {/* leave_ym */}
                  <td className={cellCls("leave_ym")} onClick={enterCell("leave_ym")}>
                    {isEditingField(m, "leave_ym") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.leave_ym as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, leave_ym: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "leave_ym"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="202512"
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-24 bg-background font-mono" />
                        {cellActions("leave_ym")}
                      </div>
                    ) : <span className="text-muted-foreground">{m.leave_ym || "—"}</span>}
                  </td>

                  {/* is_admin (boolean toggle) */}
                  <td className={`${cellCls("is_admin")} text-center`} onClick={enterCell("is_admin")}>
                    {isEditingField(m, "is_admin") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!editVals.is_admin}
                          onChange={(e) => setEditVals((v) => ({ ...v, is_admin: e.target.checked }))} />
                        {cellActions("is_admin")}
                      </div>
                    ) : (
                      m.is_admin
                        ? <span className="text-emerald-600 font-medium">Yes</span>
                        : <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* slack_id */}
                  <td className={cellCls("slack_id")} onClick={enterCell("slack_id")}>
                    {isEditingField(m, "slack_id") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.slack_id as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, slack_id: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "slack_id"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="U0123ABC"
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                        {cellActions("slack_id")}
                      </div>
                    ) : <span className="font-mono text-muted-foreground text-[11px]">{m.slack_id || "—"}</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">
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
