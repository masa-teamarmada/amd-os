"use client";

/**
 * 関連メンバーモーダル: HRL 評価のベース。
 *
 * member_kind:
 *   - amd_internal: AMD 社員。名前は members テーブルのコードネーム選択
 *   - su_internal:  SU 内部メンバー (PI / CTO / Engineer 等、自由テキスト)
 *   - support_org:  支援機関の人 (大学・研究機関等、自由テキスト)
 */

import { useEffect, useState } from "react";
import {
  fetchVentureMembers,
  fetchAmdMembers,
  upsertVentureMember,
  deleteVentureMember,
  type ProjectVentureMember,
  type MemberKind,
  type AmdMemberLite,
} from "@/lib/venture-status-data";

const KIND_OPTIONS: { value: MemberKind; label: string }[] = [
  { value: "amd_internal", label: "🌟 内部メンバー (AMD)" },
  { value: "su_internal", label: "👤 内部メンバー (SU 内)" },
  { value: "support_org", label: "🏛 支援機関" },
];

const ROLE_PRESETS_BY_KIND: Record<MemberKind, string[]> = {
  amd_internal: ["AMD-PM", "AMD-Sub", "AMD-Advisor", "AMD-Tech", "AMD-Sales"],
  su_internal: ["CEO", "CTO", "CFO", "COO", "Engineer", "Sales", "PI", "Advisor", "Board"],
  support_org: ["大学・研究機関", "VC", "弁護士", "弁理士", "CPA", "コンサル", "ベンチャー支援機関", "その他"],
};

interface Props {
  projectId: string;
  onClose: () => void;
}

interface Draft {
  id?: string;
  member_kind: MemberKind;
  full_name: string;
  amd_member_id: string | null;
  role: string;
  started_at: string | null;
  ended_at: string | null;
  note: string | null;
}

const emptyDraft = (): Draft => ({
  member_kind: "su_internal",
  full_name: "",
  amd_member_id: null,
  role: "Engineer",
  started_at: null,
  ended_at: null,
  note: null,
});

export function CockpitMembersModal({ projectId, onClose }: Props) {
  const [members, setMembers] = useState<ProjectVentureMember[]>([]);
  const [amdMembers, setAmdMembers] = useState<AmdMemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [m, am] = await Promise.all([fetchVentureMembers(projectId), fetchAmdMembers()]);
    setMembers(m);
    setAmdMembers(am);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startNew = () => setDraft(emptyDraft());

  const startEdit = (m: ProjectVentureMember) => {
    setDraft({
      id: m.id,
      member_kind: m.member_kind,
      full_name: m.full_name,
      amd_member_id: m.amd_member_id,
      role: m.role,
      started_at: m.started_at,
      ended_at: m.ended_at,
      note: m.note,
    });
  };

  const onSave = async () => {
    if (!draft) return;
    if (draft.member_kind === "amd_internal") {
      if (!draft.amd_member_id) return;
    } else if (!draft.full_name.trim()) {
      return;
    }
    setSaving(true);
    const fullName =
      draft.member_kind === "amd_internal"
        ? amdMembers.find((m) => m.member_id === draft.amd_member_id)?.member_id || draft.amd_member_id || ""
        : draft.full_name.trim();
    await upsertVentureMember(projectId, {
      id: draft.id,
      member_kind: draft.member_kind,
      full_name: fullName,
      amd_member_id: draft.member_kind === "amd_internal" ? draft.amd_member_id : null,
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

  const displayNameFor = (m: ProjectVentureMember): string => {
    if (m.member_kind === "amd_internal" && m.amd_member_id) {
      const am = amdMembers.find((x) => x.member_id === m.amd_member_id);
      return am ? `${am.member_id} (${am.name})` : m.amd_member_id;
    }
    return m.full_name;
  };

  const kindLabel = (k: MemberKind) =>
    KIND_OPTIONS.find((o) => o.value === k)?.label || k;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[680px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
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
                    <div className="text-[13px] font-medium flex items-center gap-2 flex-wrap">
                      <span>{displayNameFor(m)}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {m.role}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {kindLabel(m.member_kind)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {m.started_at || "?"} 〜 {m.ended_at || "現在"}
                    </div>
                    {m.note && (
                      <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">{m.note}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => startEdit(m)} className="text-[11px] text-blue-600 hover:underline">
                      編集
                    </button>
                    <button onClick={() => onDelete(m.id)} className="text-[11px] text-red-600 hover:underline">
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
                <span className="text-muted-foreground">属性</span>
                <select
                  value={draft.member_kind}
                  onChange={(e) => {
                    const k = e.target.value as MemberKind;
                    setDraft({
                      ...draft,
                      member_kind: k,
                      amd_member_id: null,
                      full_name: "",
                      role: ROLE_PRESETS_BY_KIND[k][0] ?? draft.role,
                    });
                  }}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {draft.member_kind === "amd_internal" ? (
                <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                  <span className="text-muted-foreground">AMD コードネーム</span>
                  <select
                    value={draft.amd_member_id ?? ""}
                    onChange={(e) => setDraft({ ...draft, amd_member_id: e.target.value || null })}
                    className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                  >
                    <option value="">— 選択 —</option>
                    {amdMembers.map((am) => (
                      <option key={am.member_id} value={am.member_id}>
                        {am.member_id} ({am.name})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-0.5 text-[11px] col-span-2">
                  <span className="text-muted-foreground">
                    {draft.member_kind === "support_org" ? "氏名・機関名" : "氏名"}
                  </span>
                  <input
                    value={draft.full_name}
                    onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                    className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                    autoFocus
                    placeholder={
                      draft.member_kind === "support_org" ? "例: ○○大学 ○○研究室" : "例: 山田太郎"
                    }
                  />
                </label>
              )}

              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">役割</span>
                <input
                  list={`role-presets-${draft.member_kind}`}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                />
                <datalist id={`role-presets-${draft.member_kind}`}>
                  {ROLE_PRESETS_BY_KIND[draft.member_kind].map((r) => (
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
                  disabled={
                    saving ||
                    (draft.member_kind === "amd_internal"
                      ? !draft.amd_member_id
                      : !draft.full_name.trim())
                  }
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
