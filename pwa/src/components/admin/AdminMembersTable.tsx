"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export function AdminMembersTable({ members: initialMembers }: Props) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<MemberRow>>({});
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

  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditVals({
      role: m.role ?? "",
      status: m.status,
      join_ym: m.join_ym ?? "",
      leave_ym: m.leave_ym ?? "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  const saveEdit = async (m: MemberRow) => {
    setSaving(m.id);
    const patch: Partial<MemberRow> = {
      role: (editVals.role as string) || null,
      status: editVals.status as string,
      join_ym: (editVals.join_ym as string) || null,
      leave_ym: (editVals.leave_ym as string) || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("members")
      .update(patch)
      .eq("id", m.id);

    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, ...patch } : x));
      setHint(`${m.code_name} を保存しました`);
      setEditingId(null);
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
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 w-24">codeName</th>
              <th className="text-left px-3 py-2 font-medium w-24">memberId</th>
              <th className="text-left px-3 py-2 font-medium w-40">表示名</th>
              <th className="text-left px-3 py-2 font-medium w-48">email</th>
              <th className="text-left px-3 py-2 font-medium w-28">Role（編集）</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-24">joinYm</th>
              <th className="text-left px-3 py-2 font-medium w-24">leaveYm</th>
              <th className="text-left px-3 py-2 font-medium w-16">admin</th>
              <th className="text-left px-3 py-2 font-medium w-32">Slack ID</th>
              <th className="text-left px-3 py-2 font-medium w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isEditing = editingId === m.id;
              return (
                <tr
                  key={m.id}
                  className={`border-t border-border ${isEditing ? "bg-blue-50/50" : "hover:bg-muted/20"}`}
                >
                  <td className="px-3 py-2 font-medium sticky left-0 bg-background">
                    {m.code_name}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{m.member_id}</td>
                  <td className="px-3 py-2">{m.member_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{m.email}</td>

                  {/* Role - editable */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editVals.role as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, role: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background"
                        placeholder="role"
                      />
                    ) : (
                      <span className="text-muted-foreground">{m.role || "—"}</span>
                    )}
                  </td>

                  {/* Status - editable */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select
                        value={editVals.status as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] bg-background"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <StatusBadge status={m.status} />
                    )}
                  </td>

                  {/* joinYm - editable */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editVals.join_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, join_ym: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-24 bg-background"
                        placeholder="202301"
                      />
                    ) : (
                      <span className="text-muted-foreground">{m.join_ym || "—"}</span>
                    )}
                  </td>

                  {/* leaveYm - editable */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editVals.leave_ym as string}
                        onChange={(e) => setEditVals((v) => ({ ...v, leave_ym: e.target.value }))}
                        className="border border-border rounded px-1.5 py-0.5 text-[12px] w-24 bg-background"
                        placeholder="202512"
                      />
                    ) : (
                      <span className="text-muted-foreground">{m.leave_ym || "—"}</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    {m.is_admin
                      ? <span className="text-emerald-600 font-medium">Yes</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>

                  <td className="px-3 py-2 font-mono text-muted-foreground text-[11px]">
                    {m.slack_id || "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(m)}
                          disabled={saving === m.id}
                          className="text-[11px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50"
                        >
                          {saving === m.id ? "…" : "保存"}
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
                        onClick={() => startEdit(m)}
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
