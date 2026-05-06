"use client";

/**
 * 関連メンバーモーダル: PJ に関わる人 (AMD 社員 + SU 内メンバー両方) と
 * その役割・参画期間を記入する。HRL 評価の元データ。
 *
 * - リスト表示
 * - 行クリックで編集
 * - 「+ 追加」で新規行
 * - 削除 / 更新時に narrative も invalidate (lib 側でやる)
 */

import { useEffect, useState } from "react";
import {
  fetchVentureMembers,
  upsertVentureMember,
  deleteVentureMember,
  type ProjectVentureMember,
} from "@/lib/venture-status-data";

const ROLE_PRESETS = ["CEO", "CTO", "CFO", "COO", "PI", "Engineer", "Sales", "Advisor", "Board", "AMD-PM", "AMD-Sub"];

interface Props {
  projectId: string;
  onClose: () => void;
}

interface DraftMember {
  id?: string;
  full_name: string;
  role: string;
  started_at: string | null;
  ended_at: string | null;
  note: string | null;
}

export function CockpitMembersModal({ projectId, onClose }: Props) {
  const [members, setMembers] = useState<ProjectVentureMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftMember | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const m = await fetchVentureMembers(projectId);
    setMembers(m);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startNew = () => {
    setDraft({ full_name: "", role: "Engineer", started_at: null, ended_at: null, note: null });
  };

  const startEdit = (m: ProjectVentureMember) => {
    setDraft({
      id: m.id,
      full_name: m.full_name,
      role: m.role,
      started_at: m.started_at,
      ended_at: m.ended_at,
      note: m.note,
    });
  };

  const onSave = async () => {
    if (!draft) return;
    if (!draft.full_name.trim()) return;
    setSaving(true);
    await upsertVentureMember(projectId, {
      id: draft.id,
      full_name: draft.full_name.trim(),
      role: draft.role.trim() || "Engineer",
      started_at: draft.started_at,
      ended_at: draft.ended_at,
      note: draft.note?.trim() || null,
    });
    setSaving(false);
    setDraft(null);
    await reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("このメンバーを削除しますか?")) return;
    setSaving(true);
    await deleteVentureMember(projectId, id);
    setSaving(false);
    await reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">関連メンバー (HRL 評価のベース)</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">読み込み中…</p>
          ) : members.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">まだ登録なし。下の「+ 追加」から。</p>
          ) : (
            <ul className="divide-y divide-[#f1f5f9]">
              {members.map((m) => (
                <li key={m.id} className="py-2 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">
                      {m.full_name}
                      <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {m.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {m.started_at || "?"} 〜 {m.ended_at || "現在"}
                    </div>
                    {m.note && <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">{m.note}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => onDelete(m.id)}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {draft && (
            <div className="mt-3 border border-blue-100 bg-blue-50/40 rounded-md p-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                <span className="text-muted-foreground">氏名</span>
                <input
                  value={draft.full_name}
                  onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">役割</span>
                <input
                  list="role-presets"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                />
                <datalist id="role-presets">
                  {ROLE_PRESETS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </label>
              <div />
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">参画開始</span>
                <input
                  type="date"
                  value={draft.started_at?.slice(0, 10) ?? ""}
                  onChange={(e) => setDraft({ ...draft, started_at: e.target.value || null })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">離脱 (空 = 現在も参画)</span>
                <input
                  type="date"
                  value={draft.ended_at?.slice(0, 10) ?? ""}
                  onChange={(e) => setDraft({ ...draft, ended_at: e.target.value || null })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                <span className="text-muted-foreground">メモ</span>
                <textarea
                  value={draft.note ?? ""}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  rows={2}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[12px]"
                />
              </label>
              <div className="col-span-2 flex justify-end gap-2 mt-1">
                <button
                  onClick={() => setDraft(null)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#e5e5e7] hover:bg-white"
                >
                  キャンセル
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || !draft.full_name.trim()}
                  className="text-[11px] px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          )}

          {!draft && (
            <button
              onClick={startNew}
              className="mt-3 text-[12px] px-3 py-1.5 rounded-md border border-dashed border-[#cbd5e1] text-blue-700 hover:bg-blue-50 w-full"
            >
              + 追加
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
