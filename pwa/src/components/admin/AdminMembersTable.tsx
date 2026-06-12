"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Pencil } from "lucide-react";
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
  is_officer: boolean;
  slack_id: string | null;
  join_ym: string | null;
  leave_ym: string | null;
  bank_info: string | null;
  member_address: string | null;
  contractor_name: string | null;
  invoice_registration_number: string | null;
  google_calendar_status: string;
  google_calendar_checked_at: string | null;
  google_calendar_connected_at: string | null;
  google_calendar_error: string | null;
  last_login_at: string | null;
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

function CalendarBadge({ member }: { member: MemberRow }) {
  if (!requiresCalendarAccess(member)) {
    return (
      <span
        className="inline-flex items-center rounded border border-zinc-200 bg-zinc-500/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500"
        title="System account or non-login account"
      >
        対象外
      </span>
    );
  }
  const status = member.google_calendar_status || "missing";
  const checkedAt = member.google_calendar_checked_at
    ? new Date(member.google_calendar_checked_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : null;
  if (status === "connected") {
    return (
      <span
        className="inline-flex items-center rounded border border-emerald-200 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
        title={checkedAt ? `checked: ${checkedAt}` : "Calendar connected"}
      >
        ON
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex items-center rounded border border-red-200 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-700"
        title={member.google_calendar_error || "Calendar access error"}
      >
        Error
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded border border-amber-200 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
      title="Google Calendar access is required at login"
    >
      必須
    </span>
  );
}

function requiresCalendarAccess(member: MemberRow) {
  const email = member.email?.trim().toLowerCase() || "";
  if (!email.endsWith("@team-armada.jp")) return false;
  if (["info", "つくよみ"].includes(member.code_name)) return false;
  return true;
}

function formatLastLogin(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  is_officer: boolean;
  slack_id: string;
  contractor_name: string;
  member_address: string;
  invoice_registration_number: string;
};

function defaultContractorName(member: MemberRow) {
  return member.member_name?.trim() || member.code_name || member.member_id;
}

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
          !(m.contractor_name || "").toLowerCase().includes(q) &&
          !(m.member_address || "").toLowerCase().includes(q) &&
          !(m.invoice_registration_number || "").toLowerCase().includes(q) &&
          !m.member_id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => {
      const at = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
      const bt = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      if (bt !== at) return bt - at;
      return a.code_name.localeCompare(b.code_name, "ja");
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
      is_officer: !!m.is_officer,
      slack_id: m.slack_id ?? "",
      contractor_name: m.contractor_name || defaultContractorName(m),
      member_address: m.member_address ?? "",
      invoice_registration_number: m.invoice_registration_number ?? "",
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
      case "member_name": {
        const nextName = (editVals.member_name as string).trim();
        patch.member_name = nextName || null;
        const currentContractor = (m.contractor_name || "").trim();
        if (!currentContractor || currentContractor === (m.member_name || "").trim() || currentContractor === m.code_name) {
          patch.contractor_name = nextName || m.code_name || m.member_id;
        }
        break;
      }
      case "email": patch.email = (editVals.email as string).trim() || m.email; break;
      case "role": patch.role = (editVals.role as string) || null; break;
      case "status": patch.status = editVals.status as string; break;
      case "join_ym": patch.join_ym = (editVals.join_ym as string) || null; break;
      case "leave_ym": patch.leave_ym = (editVals.leave_ym as string) || null; break;
      case "is_admin": patch.is_admin = !!editVals.is_admin; break;
      case "is_officer": patch.is_officer = !!editVals.is_officer; break;
      case "slack_id": patch.slack_id = (editVals.slack_id as string).trim() || null; break;
      case "contractor_name": patch.contractor_name = (editVals.contractor_name as string).trim() || defaultContractorName(m); break;
      case "member_address": patch.member_address = (editVals.member_address as string).trim() || null; break;
      case "invoice_registration_number": patch.invoice_registration_number = (editVals.invoice_registration_number as string).trim().toUpperCase() || null; break;
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
        <table className="text-[12px] border-collapse" style={{ minWidth: "2140px" }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium sticky left-0 z-40 bg-muted w-24 border-r border-border">codeName</th>
              <th className="text-left px-3 py-2 font-medium w-24">memberId</th>
              <th className="text-left px-3 py-2 font-medium w-40">表示名</th>
              <th className="text-left px-3 py-2 font-medium w-48">契約者名</th>
              <th className="text-left px-3 py-2 font-medium w-72">住所</th>
              <th className="text-left px-3 py-2 font-medium w-44">インボイス登録番号</th>
              <th className="text-left px-3 py-2 font-medium w-56">email</th>
              <th className="text-left px-3 py-2 font-medium w-28">Role</th>
              <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              <th className="text-left px-3 py-2 font-medium w-24">joinYm</th>
              <th className="text-left px-3 py-2 font-medium w-24">leaveYm</th>
              <th className="text-left px-3 py-2 font-medium w-24">Calendar</th>
              <th className="text-left px-3 py-2 font-medium w-28">最終ログイン</th>
              <th className="text-left px-3 py-2 font-medium w-16">admin</th>
              <th className="text-left px-3 py-2 font-medium w-16">支払対象</th>
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
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/mypage?memberId=${encodeURIComponent(m.member_id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#007aff] underline-offset-2 hover:underline"
                          title={`${m.code_name} のマイページを開く (${m.member_id})`}
                        >
                          {m.code_name}
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditCell(m, "code_name");
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`${m.code_name} の codeName を編集`}
                          title="codeNameを編集"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
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

                  {/* 契約者名 (contractor_name) */}
                  <td className={cellCls("contractor_name")} onClick={enterCell("contractor_name")}>
                    {isEditingField(m, "contractor_name") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.contractor_name as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, contractor_name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "contractor_name"); if (e.key === "Escape") cancelEdit(); }}
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background" />
                        {cellActions("contractor_name")}
                      </div>
                    ) : <span>{m.contractor_name || defaultContractorName(m)}</span>}
                  </td>

                  {/* 住所 (member_address) */}
                  <td className={cellCls("member_address")} onClick={enterCell("member_address")}>
                    {isEditingField(m, "member_address") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <textarea value={editVals.member_address as string} autoFocus rows={3}
                          onChange={(e) => setEditVals((v) => ({ ...v, member_address: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                          className="min-h-16 w-full resize-y rounded border border-border bg-background px-1.5 py-0.5 text-[12px]" />
                        {cellActions("member_address")}
                      </div>
                    ) : (
                      <span className="line-clamp-2 text-muted-foreground" title={m.member_address || ""}>
                        {m.member_address || "—"}
                      </span>
                    )}
                  </td>

                  {/* インボイス登録番号 (invoice_registration_number) */}
                  <td className={cellCls("invoice_registration_number")} onClick={enterCell("invoice_registration_number")}>
                    {isEditingField(m, "invoice_registration_number") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={editVals.invoice_registration_number as string} autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, invoice_registration_number: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCell(m, "invoice_registration_number"); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="T1234567890123"
                          className="border border-border rounded px-1.5 py-0.5 text-[12px] w-full bg-background font-mono" />
                        {cellActions("invoice_registration_number")}
                      </div>
                    ) : (
                      <span className="font-mono text-muted-foreground">{m.invoice_registration_number || "—"}</span>
                    )}
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

                  {/* Calendar access - read-only, required at login */}
                  <td className="px-3 py-2">
                    <CalendarBadge member={m} />
                  </td>

                  {/* Last OS login - read-only */}
                  <td className="px-3 py-2 text-muted-foreground" title={m.last_login_at || "未ログイン"}>
                    {formatLastLogin(m.last_login_at)}
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

                  {/* is_officer (boolean toggle) */}
                  <td className={`${cellCls("is_officer")} text-center`} onClick={enterCell("is_officer")}>
                    {isEditingField(m, "is_officer") ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center justify-center gap-1 text-[10px]">
                          <input type="checkbox" checked={!!editVals.is_officer}
                            onChange={(e) => setEditVals((v) => ({ ...v, is_officer: e.target.checked }))} />
                          役員 (=対象外)
                        </label>
                        {cellActions("is_officer")}
                      </div>
                    ) : (
                      m.is_officer
                        ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">対象外</span>
                        : <span className="text-muted-foreground">対象</span>
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
                <td colSpan={16} className="px-3 py-4 text-center text-muted-foreground">
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
