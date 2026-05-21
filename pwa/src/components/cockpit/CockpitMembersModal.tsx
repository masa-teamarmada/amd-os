"use client";

/**
 * 関連メンバーモーダル: HRL 評価のベース。
 *
 * member_kind:
 *   - amd_internal: AMD 社員。名前は members テーブルのコードネーム選択
 *   - su_internal:  SU 内部メンバー (PI / CTO / Engineer 等、自由テキスト)
 *   - support_org:  支援機関の人 (大学・研究機関等、自由テキスト)
 */

import { useEffect, useMemo, useState } from "react";
import {
  fetchVentureMembers,
  fetchAssignedAmdMembers,
  fetchAllAmdCodeNames,
  upsertVentureMember,
  deleteVentureMember,
  type ProjectVentureMember,
  type MemberKind,
  type AmdMemberLite,
} from "@/lib/venture-status-data";
// 2026-05-11 まさ指摘 1 番: 「創業」ボタン削除 + LLM 抽出創業メンバーを「👥 メンバー」モーダルに統合
import {
  fetchFoundingMembers,
  estimateHrlFromMembers,
  ROLE_LABEL_JP,
  CATEGORY_LABEL_JP,
  CATEGORY_COLOR,
  type FoundingMemberRow,
  type FoundingMemberCategory,
} from "@/lib/founding-members-data";

const FOUNDING_CATEGORY_ORDER: FoundingMemberCategory[] = [
  "amd",
  "startup",
  "unknown",
  // 以下は active 状態に来ない想定 (HRL 根拠外、migration 075 で invalid 化済み)。
  "university",
  "partner_company",
  "vc",
  "government",
  "individual",
];

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

interface FoundingRevisionProposal {
  summary: string;
  upserts: Array<{
    personName: string;
    affiliation?: string | null;
    role: string;
    roleLabelJp?: string | null;
    category: string;
    responsibility?: string | null;
    contribution?: string | null;
    status?: "active" | "left" | "tentative";
    reason?: string | null;
  }>;
  invalidates: Array<{ personName: string; reason?: string | null }>;
  skipped?: Array<{ personName?: string | null; reason: string }>;
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
  const [allCodeNames, setAllCodeNames] = useState<Record<string, string>>({});
  const [founding, setFounding] = useState<FoundingMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [foundingInstruction, setFoundingInstruction] = useState("");
  const [foundingProposal, setFoundingProposal] = useState<FoundingRevisionProposal | null>(null);
  const [foundingRevising, setFoundingRevising] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [m, am, names, fnd] = await Promise.all([
      fetchVentureMembers(projectId),
      fetchAssignedAmdMembers(projectId),
      fetchAllAmdCodeNames(),
      fetchFoundingMembers(projectId),
    ]);
    setMembers(m);
    setAmdMembers(am);
    setAllCodeNames(names);
    setFounding(fnd);
    setLoading(false);
  };

  const foundingGrouped = useMemo(() => {
    const out = new Map<FoundingMemberCategory, FoundingMemberRow[]>();
    for (const r of founding) {
      if (r.status !== "active") continue;
      if (!out.has(r.category)) out.set(r.category, []);
      out.get(r.category)!.push(r);
    }
    return out;
  }, [founding]);
  const foundingTotal = useMemo(() => founding.filter((r) => r.status === "active").length, [founding]);
  const hrlEst = useMemo(() => estimateHrlFromMembers(founding), [founding]);

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

  const requestFoundingRevision = async () => {
    const instruction = foundingInstruction.trim();
    if (!instruction) return;
    setFoundingRevising(true);
    setFoundingProposal(null);
    try {
      const res = await fetch("/api/founding-members/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, instruction, mode: "preview" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || "つくよみ修正案の生成に失敗");
      setFoundingProposal(json.proposal);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setFoundingRevising(false);
    }
  };

  const applyFoundingRevision = async () => {
    if (!foundingProposal) return;
    setFoundingRevising(true);
    try {
      const res = await fetch("/api/founding-members/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, instruction: foundingInstruction, mode: "apply", proposal: foundingProposal }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || "創業メンバー修正の反映に失敗");
      setFoundingProposal(null);
      setFoundingInstruction("");
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setFoundingRevising(false);
    }
  };

  const displayNameFor = (m: ProjectVentureMember): string => {
    if (m.member_kind === "amd_internal" && m.amd_member_id) {
      return allCodeNames[m.amd_member_id] || m.amd_member_id;
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
                  <span className="text-muted-foreground">
                    AMD コードネーム (この PJ にアサイン済の社員のみ)
                  </span>
                  {amdMembers.length === 0 ? (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      この PJ にアサイン済の AMD 社員がいません。先に admin/projects で project_members に追加してください。
                    </p>
                  ) : (
                    <select
                      value={draft.amd_member_id ?? ""}
                      onChange={(e) => setDraft({ ...draft, amd_member_id: e.target.value || null })}
                      className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px]"
                    >
                      <option value="">— 選択 —</option>
                      {amdMembers.map((am) => (
                        <option key={am.member_id} value={am.member_id}>
                          {am.code_name}
                        </option>
                      ))}
                    </select>
                  )}
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

          {/* 2026-05-22 まさ指摘: 旧「🧑‍🤝‍🧑 創業コア候補」セクションを「関連メンバー候補」に再定義。
              HRL根拠は「該当SU社員 + AMD伴走メンバー」だけ。大学・研究機関 / VC / 顧客 / 行政 /
              partner_company は HRL根拠外として除外。AMDメンバーは code_name で記録。 */}
          {!loading && (
            <div className="mt-5 border-t border-[#e5e5e7] pt-4">
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-slate-700">
                  🧑‍🤝‍🧑 LLM 抽出 関連メンバー候補 ({foundingTotal} 名)
                </h4>
                <span className="text-[9px] italic text-slate-500">monthly_reports + meeting_summaries から抽出 / 毎週月曜 03:30 更新</span>
              </div>

              <div className="rounded-md border border-indigo-200 bg-indigo-50/40 px-3 py-2 mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold text-indigo-800">つくよみに関連メンバー修正依頼</div>
                    <div className="text-[9px] text-indigo-700/75">例: 大学・研究機関は除外して、まさをCEO候補、Bat-ErdeneをCTO候補として残す</div>
                  </div>
                  <button
                    type="button"
                    onClick={requestFoundingRevision}
                    disabled={foundingRevising || !foundingInstruction.trim()}
                    className="shrink-0 rounded-md border border-indigo-300 bg-white px-2 py-1 text-[10px] text-indigo-700 hover:bg-indigo-50 disabled:opacity-45"
                  >
                    {foundingRevising ? "依頼中…" : "修正案"}
                  </button>
                </div>
                <textarea
                  value={foundingInstruction}
                  onChange={(e) => setFoundingInstruction(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-indigo-100 bg-white px-2 py-1 text-[11px] leading-snug outline-none focus:border-indigo-300"
                  placeholder="関連メンバーの追加・除外・役割修正をそのまま書く (AMD は code_name で)"
                />
                {foundingProposal && (
                  <div className="rounded-md border border-indigo-100 bg-white px-2 py-2 text-[11px] text-slate-700">
                    <div className="font-semibold text-indigo-800">{foundingProposal.summary}</div>
                    {foundingProposal.upserts.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-500">追加/更新:</span>{" "}
                        {foundingProposal.upserts.map((u) => `${u.personName} (${u.roleLabelJp || u.role})`).join(" / ")}
                      </div>
                    )}
                    {foundingProposal.invalidates.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-500">除外:</span>{" "}
                        {foundingProposal.invalidates.map((u) => u.personName).join(" / ")}
                      </div>
                    )}
                    {foundingProposal.skipped && foundingProposal.skipped.length > 0 && (
                      <div className="mt-1 text-[10px] text-amber-700">
                        反映しない候補: {foundingProposal.skipped.map((s) => s.personName ? `${s.personName}: ${s.reason}` : s.reason).join(" / ")}
                      </div>
                    )}
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFoundingProposal(null)}
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                      >
                        破棄
                      </button>
                      <button
                        type="button"
                        onClick={applyFoundingRevision}
                        disabled={foundingRevising}
                        className="rounded-md border border-emerald-500 px-2 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-45"
                      >
                        OK確定
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {foundingTotal === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">
                  関連メンバー候補はまだ登録されてない。上の修正依頼から追加できる。
                </div>
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50/40 px-3 py-2 mb-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-900">
                      HRL 簡易推定 (Phase 1 ルールベース)
                    </span>
                    <span className="font-mono text-base font-bold text-amber-900">
                      {hrlEst.hrl} <span className="text-[10px]">/ 9</span>
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-amber-900/80">{hrlEst.rationale}</div>
                </div>
              )}

              {foundingTotal > 0 && FOUNDING_CATEGORY_ORDER.filter((c) => foundingGrouped.has(c)).map((cat) => {
                const items = foundingGrouped.get(cat) ?? [];
                return (
                  <section key={cat} className="mb-3">
                    <div className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold mb-1.5 ${CATEGORY_COLOR[cat]}`}>
                      {CATEGORY_LABEL_JP[cat]} ({items.length})
                    </div>
                    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                      {items.map((m) => (
                        <li key={m.id} className="px-3 py-1.5 text-[11.5px]">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold">{m.person_name}</span>
                            {m.affiliation && (
                              <span className="text-[10px] text-slate-500">{m.affiliation}</span>
                            )}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-700">
                              {m.role_label_jp ?? ROLE_LABEL_JP[m.role]}
                            </span>
                            {m.last_observed_at && (
                              <span className="ml-auto text-[9px] text-slate-400">{m.last_observed_at}</span>
                            )}
                          </div>
                          {m.responsibility && (
                            <div className="mt-0.5 text-[10.5px] text-slate-700">
                              <span className="text-[9px] text-slate-500">担当:</span> {m.responsibility}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
