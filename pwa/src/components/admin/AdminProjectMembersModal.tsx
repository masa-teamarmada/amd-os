"use client";

/**
 * admin/projects から「メンバー」列クリックで開くモーダル。
 *
 * - PL / PM / クローザー チェックボックス + 役割ラベル + join/leave ym
 * - 1 PJ × 複数メンバー (project_members 行)
 * - 「全削除→挿入」方式 (saveProjectMembers と同じ)
 *
 * config ページ側のメンバーセクションは廃止 (#14 まさ要望、2026-05-07)。
 * メンバー編集は admin/projects のここに集約。
 */

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  fetchProjectConfig,
  saveProjectMembers,
  type ProjectConfigData,
  type ProjectConfigMember,
  type MemberInput,
} from "@/lib/project-config-data";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface MemberRow {
  rowKey: string;
  memberId: string;
  codeName: string;
  isPM: boolean;
  isCloser: boolean;
  isPL: boolean;
  roleLabel: string;
  joinYm: string;
  leaveYm: string;
  isActive: boolean;
}

function rowFromExisting(m: ProjectConfigMember): MemberRow {
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

export function AdminProjectMembersModal({ projectId, open, onClose, onSaved }: Props) {
  const [data, setData] = useState<ProjectConfigData | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchProjectConfig(projectId);
      if (!d) throw new Error("PJ 情報の取得に失敗");
      setData(d);
      setMembers(d.members.map(rowFromExisting));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function update<K extends keyof MemberRow>(rowKey: string, key: K, value: MemberRow[K]) {
    setMembers((prev) => prev.map((m) => {
      if (m.rowKey !== rowKey) return m;
      const next = { ...m, [key]: value };
      if (key === "memberId" && typeof value === "string") {
        const master = data?.memberMaster.find((mm) => mm.memberId === value);
        if (master) next.codeName = master.codeName || master.memberName;
      }
      return next;
    }));
  }

  function addRow() {
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
  }

  function deleteRow(rowKey: string) {
    setMembers((prev) => prev.filter((m) => m.rowKey !== rowKey));
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const inputs: MemberInput[] = members.map((m) => ({
        memberId: m.memberId,
        isPM: m.isPM,
        isCloser: m.isCloser,
        isPL: m.isPL,
        roleLabel: m.roleLabel,
        joinYm: m.joinYm,
        leaveYm: m.leaveYm,
        isActive: m.isActive,
      }));
      const res = await saveProjectMembers(data.project.projectId, inputs);
      if (!res.ok) throw new Error(res.message || "保存失敗");
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-3xl sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.project.projectName ?? projectId} — メンバー編集</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>}
        {error && <p className="text-sm text-destructive py-2">{error}</p>}

        {!loading && data && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="text-[12px] w-full">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground text-left">
                    <th className="px-2 py-1.5 font-medium">メンバー</th>
                    <th className="px-1 py-1.5 font-medium text-center w-10">PL</th>
                    <th className="px-1 py-1.5 font-medium text-center w-10">PM</th>
                    <th className="px-1 py-1.5 font-medium text-center w-12">クローザー</th>
                    <th className="px-2 py-1.5 font-medium">役割ラベル</th>
                    <th className="px-2 py-1.5 font-medium w-20">参画ym</th>
                    <th className="px-2 py-1.5 font-medium w-20">離脱ym</th>
                    <th className="px-1 py-1.5 font-medium w-10 text-center">active</th>
                    <th className="px-1 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.rowKey} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <select
                          value={m.memberId}
                          onChange={(e) => update(m.rowKey, "memberId", e.target.value)}
                          className="border border-border rounded px-1.5 py-0.5 bg-background w-full"
                        >
                          <option value="">— 選択 —</option>
                          {data.memberMaster.map((mm) => (
                            <option key={mm.memberId} value={mm.memberId}>
                              {mm.codeName || mm.memberName} ({mm.memberId})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input type="checkbox" checked={m.isPL} onChange={(e) => update(m.rowKey, "isPL", e.target.checked)} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input type="checkbox" checked={m.isPM} onChange={(e) => update(m.rowKey, "isPM", e.target.checked)} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input type="checkbox" checked={m.isCloser} onChange={(e) => update(m.rowKey, "isCloser", e.target.checked)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={m.roleLabel}
                          onChange={(e) => update(m.rowKey, "roleLabel", e.target.value)}
                          placeholder="例: 設計担当"
                          className="border border-border rounded px-1.5 py-0.5 bg-background w-full" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={m.joinYm}
                          onChange={(e) => update(m.rowKey, "joinYm", e.target.value)}
                          placeholder="202401"
                          className="border border-border rounded px-1.5 py-0.5 bg-background w-full" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={m.leaveYm}
                          onChange={(e) => update(m.rowKey, "leaveYm", e.target.value)}
                          placeholder=""
                          className="border border-border rounded px-1.5 py-0.5 bg-background w-full" />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input type="checkbox" checked={m.isActive} onChange={(e) => update(m.rowKey, "isActive", e.target.checked)} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => deleteRow(m.rowKey)} className="text-destructive hover:underline text-[11px]">
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground text-[11px]">
                        メンバー未登録
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addRow}>+ メンバー行を追加</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
