"use client";

/**
 * 共通の PJ メンバー編集 UI。
 * admin/projects の「メンバー」列モーダル と project/[id]/config の両方から使う。
 *
 * 役割:
 * - 既存 project_members 行を rows 編集
 * - メンバー追加 (memberMaster から選ぶ) / 行の論理削除 (is_active=false) / 役割フラグ・ラベル・参画月・離脱月編集
 * - 「保存」で POST /api/admin/project-members/bulk を 1 回叩く
 *
 * 物理削除はしない: 過去の業務記録 (monthly_reports / reimbursements 等) が
 * project_members 行を参照する可能性があるため、is_active=false で残す (まさ要望 2026-05-13)。
 */

import { useEffect, useState } from "react";
import {
  fetchProjectConfig,
  type ProjectConfigMember,
  type MemberMasterRow,
} from "@/lib/project-config-data";

interface Props {
  projectId: string;
  /** 保存成功時のコールバック (最新メンバーを反映する用) */
  onSaved?: (members: ProjectConfigMember[]) => void;
  /** 親が members / memberMaster を持っていれば渡せる (= 二重 fetch を避ける) */
  initialMembers?: ProjectConfigMember[];
  initialMemberMaster?: MemberMasterRow[];
}

interface Row extends ProjectConfigMember {
  rowKey: string;
}

function toRow(m: ProjectConfigMember): Row {
  return { ...m, rowKey: m.id };
}

function isYmValid(s: string) {
  return s === "" || /^\d{6}$/.test(s);
}

export function ProjectMembersEditor({ projectId, onSaved, initialMembers, initialMemberMaster }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [master, setMaster] = useState<MemberMasterRow[]>(initialMemberMaster ?? []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 初期ロード — initialMembers が渡されればそれを使い、なければ fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (initialMembers && initialMemberMaster) {
          if (cancelled) return;
          setRows(initialMembers.map(toRow));
          setMaster(initialMemberMaster);
        } else {
          const data = await fetchProjectConfig(projectId);
          if (cancelled) return;
          if (!data) {
            setError(`PJ が見つからない: ${projectId}`);
            return;
          }
          setRows(data.members.map(toRow));
          setMaster(data.memberMaster);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, initialMembers, initialMemberMaster]);

  const [dirty, setDirty] = useState(false);

  const update = <K extends keyof Row>(rowKey: string, key: K, value: Row[K]) => {
    setRows((prev) => (prev ? prev.map((r) => {
      if (r.rowKey !== rowKey) return r;
      const next = { ...r, [key]: value };
      if (key === "memberId" && typeof value === "string") {
        const mm = master.find((x) => x.memberId === value);
        if (mm) {
          next.codeName = mm.codeName || mm.memberName;
          next.memberName = mm.memberName;
        }
      }
      return next;
    }) : prev));
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [
      ...(prev ?? []),
      {
        rowKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id: "",
        memberId: "",
        memberName: "",
        codeName: "",
        email: null,
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

  /** 論理削除: 行を「削除済み (is_active=false)」にトグル。物理削除はしない */
  const deactivate = (rowKey: string) => {
    setRows((prev) => (prev ? prev.map((r) => r.rowKey === rowKey ? { ...r, isActive: false } : r) : prev));
    setDirty(true);
  };
  const reactivate = (rowKey: string) => {
    setRows((prev) => (prev ? prev.map((r) => r.rowKey === rowKey ? { ...r, isActive: true } : r) : prev));
    setDirty(true);
  };
  /** 未保存の新規行のみ即時 splice。既存行は deactivate() に流す */
  const removeNewRow = (rowKey: string) => {
    setRows((prev) => (prev ? prev.filter((r) => r.rowKey !== rowKey) : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!rows) return;
    // バリデーション
    for (const r of rows) {
      if (!r.memberId.trim()) {
        setError("メンバーを選択していない行があります");
        return;
      }
      if (!isYmValid(r.joinYm) || !isYmValid(r.leaveYm)) {
        setError("参画月 / 離脱月は yyyymm 形式 (空欄も可)");
        return;
      }
    }
    const seen = new Set<string>();
    for (const r of rows) {
      const id = r.memberId.trim();
      if (seen.has(id)) {
        setError(`同じメンバーが複数行に登録されています: ${id}`);
        return;
      }
      seen.add(id);
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/project-members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          members: rows.map((r) => ({
            memberId: r.memberId.trim(),
            isPM: r.isPM,
            isCloser: r.isCloser,
            isPL: r.isPL,
            roleLabel: r.roleLabel,
            joinYm: r.joinYm,
            leaveYm: r.leaveYm,
            isActive: r.isActive,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }
      // 再取得して整える
      const data = await fetchProjectConfig(projectId);
      if (data) {
        setRows(data.members.map(toRow));
        setMaster(data.memberMaster);
        onSaved?.(data.members);
      }
      setDirty(false);
      setToast(`保存完了 (更新 ${json.updated} / 追加 ${json.inserted} / 論理削除 ${json.deactivated})`);
      window.setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>;
  if (error && !rows) return <p className="text-sm text-destructive py-6 text-center">{error}</p>;
  if (!rows) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <th className="text-left p-1.5 w-[180px]">メンバー</th>
              <th className="text-left p-1.5 w-[100px]">役割ラベル</th>
              <th className="text-center p-1.5 w-[40px]">PL</th>
              <th className="text-center p-1.5 w-[40px]">PM</th>
              <th className="text-center p-1.5 w-[60px]">クローザー</th>
              <th className="text-left p-1.5 w-[80px]">参画月</th>
              <th className="text-left p-1.5 w-[80px]">離脱月</th>
              <th className="text-center p-1.5 w-[60px]">Active</th>
              <th className="p-1.5 w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-4 text-[11px]">
                  メンバーが登録されていない
                </td>
              </tr>
            )}
            {rows.map((m) => {
              const inactive = !m.isActive;
              const isNew = !m.id; // 既存行は id がある、新規行は空
              return (
                <tr
                  key={m.rowKey}
                  className={`border-b border-border/40 ${inactive ? "bg-zinc-50 text-muted-foreground" : ""}`}
                >
                  <td className="p-1.5">
                    <select
                      value={m.memberId}
                      onChange={(e) => update(m.rowKey, "memberId", e.target.value)}
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[12px] bg-background"
                    >
                      <option value="">選択...</option>
                      {master.map((mm) => (
                        <option key={mm.memberId} value={mm.memberId}>
                          {mm.codeName ? `${mm.codeName} (${mm.memberName})` : mm.memberName}
                        </option>
                      ))}
                      {m.memberId && !master.some((mm) => mm.memberId === m.memberId) && (
                        <option value={m.memberId}>
                          {m.codeName || m.memberId} (inactive)
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={m.roleLabel}
                      onChange={(e) => update(m.rowKey, "roleLabel", e.target.value)}
                      placeholder="—"
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[12px] bg-background"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.isPL}
                      onChange={(e) => update(m.rowKey, "isPL", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.isPM}
                      onChange={(e) => update(m.rowKey, "isPM", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.isCloser}
                      onChange={(e) => update(m.rowKey, "isCloser", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={m.joinYm}
                      onChange={(e) => update(m.rowKey, "joinYm", e.target.value)}
                      placeholder="yyyymm"
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[12px] bg-background font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={m.leaveYm}
                      onChange={(e) => update(m.rowKey, "leaveYm", e.target.value)}
                      placeholder="yyyymm"
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[12px] bg-background font-mono"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={m.isActive}
                      onChange={(e) => update(m.rowKey, "isActive", e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                      title="チェックを外すと「論理削除」(過去業務との紐付けは残る)"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    {isNew ? (
                      <button
                        onClick={() => removeNewRow(m.rowKey)}
                        className="text-[10px] text-red-600 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50"
                        title="未保存行を削除"
                      >
                        ✕
                      </button>
                    ) : inactive ? (
                      <button
                        onClick={() => reactivate(m.rowKey)}
                        className="text-[10px] text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-50"
                        title="復活"
                      >
                        ↺
                      </button>
                    ) : (
                      <button
                        onClick={() => deactivate(m.rowKey)}
                        className="text-[10px] text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-50"
                        title="論理削除 (is_active=false) — 過去の業務記録は残る"
                      >
                        除外
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={addRow}
          className="text-[11px] border border-border rounded px-2.5 py-1 hover:bg-muted"
        >
          ＋ メンバー追加
        </button>

        <div className="flex items-center gap-2">
          {error && <span className="text-[11px] text-destructive">{error}</span>}
          {toast && <span className="text-[11px] text-emerald-700">{toast}</span>}
          {dirty && !error && !toast && (
            <span className="text-[11px] text-amber-700">未保存の変更あり</span>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="text-[12px] px-3 py-1 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        ※ 「除外」は論理削除 (is_active=false)。過去の業務記録は残ります。完全削除は不可。
      </p>
    </div>
  );
}
