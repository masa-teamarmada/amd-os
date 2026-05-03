"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchNextPlanCycle,
  fetchPlanCycleById,
  fetchMilestonesForPlanCycle,
  fetchResponsibilitiesForPlanCycle,
  fetchProjectMembers,
  upsertNextPlanCycle,
  upsertNextMilestones,
  upsertMilestoneResponsibilities,
  type NextMilestoneInput,
} from "@/lib/supabase-data";

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

/** YM文字列にNか月加算 (例: "202603" + 3 → "202606") */
function addMonths(ym: string, n: number): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const date = new Date(y, m - 1 + n, 1);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  return `${ny}${nm}`;
}

/** 現在のPeriodEndYmの3か月前になったら表示すべきか判定 */
function shouldShowSetup(currentYm: string, periodEndYm: string): boolean {
  const threshold = addMonths(currentYm, 3);
  return threshold >= periodEndYm;
}

interface PlanCycle {
  planCycleId: string;
  periodStartYm: string;
  periodEndYm: string;
  budgetYen: number;
  totalPoints: number;
  status: string;
}

interface ProjectMember {
  memberId: string;
  codeName: string;
}

// MS別 × メンバー別のコミット割合 (0-100の整数%)
type CommitMap = Record<string, Record<string, number>>; // msIndex → memberId → percent

// MS別 × メンバー別の役割・業務内容
type RoleEntry = { role: string; taskDescription: string };
type RoleMap = Record<string, Record<string, RoleEntry>>; // msIndex → memberId → RoleEntry

const ROLE_OPTIONS = ["担当", "統括", "レビュー", "サポート"] as const;

interface Props {
  projectId: string;
  currentYm: string;
  currentPlanCycle: PlanCycle;
  /** 指定するとそのPlanCycleを直接編集するモード */
  directCycleId?: string;
  /** trueにするとモーダルを即座に開く（外部トリガー用） */
  autoOpen?: boolean;
  /** モーダルを閉じたときに呼ばれるコールバック */
  onModalClose?: () => void;
}

const DEFAULT_MS: NextMilestoneInput = {
  title: "",
  points: 0,
  tag: "normal",
  goalLevel: "Must",
  successCriteria: "",
  sortOrder: 1,
};

export function CockpitNextPeriodSetup({ projectId, currentYm, currentPlanCycle, directCycleId, autoOpen, onModalClose }: Props) {
  // directCycleId（直接編集）モードは常に表示。通常は3か月前から。
  const show = directCycleId ? true : shouldShowSetup(currentYm, currentPlanCycle.periodEndYm);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [nextCycle, setNextCycle] = useState<PlanCycle | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  // フォーム値
  const nextStartYm = addMonths(currentPlanCycle.periodEndYm, 1);
  const nextEndYm = addMonths(nextStartYm, 11);
  const [periodStartYm, setPeriodStartYm] = useState(nextStartYm);
  const [periodEndYm, setPeriodEndYm] = useState(nextEndYm);
  const [budgetYen, setBudgetYen] = useState(currentPlanCycle.budgetYen);
  const [totalPoints, setTotalPoints] = useState(currentPlanCycle.totalPoints);
  const [milestones, setMilestones] = useState<NextMilestoneInput[]>([
    { ...DEFAULT_MS, sortOrder: 1 },
  ]);
  // コミット割合: msのindex(string) → memberId → percent(0-100)
  const [commitMap, setCommitMap] = useState<CommitMap>({});
  // 役割・業務内容: msのindex(string) → memberId → { role, taskDescription }
  const [roleMap, setRoleMap] = useState<RoleMap>({});

  const loadNextCycle = useCallback(async () => {
    setLoading(true);

    // メンバー一覧を取得
    const members = await fetchProjectMembers(projectId);
    setProjectMembers(members);

    // directCycleId があれば直接そのサイクルを読む、なければ次の期間を探す
    const next = directCycleId
      ? await fetchPlanCycleById(directCycleId)
      : await fetchNextPlanCycle(projectId, currentPlanCycle.periodEndYm);

    if (next) {
      setNextCycle(next);
      setPeriodStartYm(next.periodStartYm);
      setPeriodEndYm(next.periodEndYm);
      setBudgetYen(next.budgetYen);
      setTotalPoints(next.totalPoints);

      const [existingMs, existingResps] = await Promise.all([
        fetchMilestonesForPlanCycle(next.planCycleId),
        fetchResponsibilitiesForPlanCycle(next.planCycleId),
      ]);

      if (existingMs.length > 0) {
        setMilestones(
          existingMs.map((ms) => ({
            title: ms.title,
            points: ms.points,
            tag: ms.tag as "normal" | "routine" | "buffer",
            goalLevel: ms.goalLevel,
            successCriteria: ms.successCriteria,
            sortOrder: ms.sortOrder,
          }))
        );

        // responsibilityをcommitMap/roleMapに変換
        const newMap: CommitMap = {};
        const newRoleMap: RoleMap = {};
        existingMs.forEach((ms, idx) => {
          const key = String(idx);
          newMap[key] = {};
          newRoleMap[key] = {};
          existingResps
            .filter((r) => r.milestoneId === ms.milestoneId)
            .forEach((r) => {
              // DBは0〜1の小数 → UIは0〜100の整数%
              newMap[key][r.memberId] = Math.round(r.share * 100);
              newRoleMap[key][r.memberId] = {
                role: r.role || "担当",
                taskDescription: r.taskDescription || "",
              };
            });
        });
        setCommitMap(newMap);
        setRoleMap(newRoleMap);
      }
    }
    setLoading(false);
  }, [projectId, currentPlanCycle.periodEndYm, directCycleId]);

  // autoOpenが真になったらモーダルを開く
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (open) loadNextCycle();
  }, [open, loadNextCycle]);

  const addMs = () => {
    setMilestones((prev) => [
      ...prev,
      { ...DEFAULT_MS, sortOrder: prev.length + 1 },
    ]);
  };

  const removeMs = (idx: number) => {
    setMilestones((prev) =>
      prev.filter((_, i) => i !== idx).map((ms, i) => ({ ...ms, sortOrder: i + 1 }))
    );
    // commitMapのインデックスも再構築
    setCommitMap((prev) => {
      const newMap: CommitMap = {};
      let newIdx = 0;
      for (let i = 0; i < milestones.length; i++) {
        if (i === idx) continue;
        newMap[String(newIdx)] = prev[String(i)] || {};
        newIdx++;
      }
      return newMap;
    });
  };

  const updateMs = (idx: number, field: keyof NextMilestoneInput, value: string | number) => {
    setMilestones((prev) =>
      prev.map((ms, i) => (i === idx ? { ...ms, [field]: value } : ms))
    );
  };

  const updateCommit = (msIdx: number, memberId: string, pct: number) => {
    setCommitMap((prev) => ({
      ...prev,
      [String(msIdx)]: {
        ...(prev[String(msIdx)] || {}),
        [memberId]: pct,
      },
    }));
  };

  const updateRole = (msIdx: number, memberId: string, field: keyof RoleEntry, value: string) => {
    setRoleMap((prev) => {
      const existing = prev[String(msIdx)]?.[memberId] || { role: "担当", taskDescription: "" };
      return {
        ...prev,
        [String(msIdx)]: {
          ...(prev[String(msIdx)] || {}),
          [memberId]: { ...existing, [field]: value },
        },
      };
    });
  };

  const closeModal = () => { setOpen(false); onModalClose?.(); };

  const handleSave = async (saveStatus: "draft" | "active" = "draft") => {
    setSaving(true);
    const planCycleId = await upsertNextPlanCycle(
      { projectId, periodStartYm, periodEndYm, budgetYen, totalPoints },
      nextCycle?.planCycleId,
      saveStatus
    );
    if (!planCycleId) {
      setSaving(false);
      alert("PlanCycleの保存に失敗しました");
      return;
    }
    const validMs = milestones.filter((ms) => ms.title.trim());
    const ok = await upsertNextMilestones(planCycleId, validMs);
    if (!ok) {
      setSaving(false);
      alert("MSの保存に失敗しました");
      return;
    }

    // コミット割合 + 役割・業務内容を保存
    const respRows: { milestoneId: string; memberId: string; share: number; role?: string; taskDescription?: string }[] = [];
    let validIdx = 0;
    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].title.trim()) continue;
      const msId = `MS-${planCycleId}-${validIdx + 1}`;
      const msCommits = commitMap[String(i)] || {};
      const msRoles = roleMap[String(i)] || {};
      for (const [memberId, pct] of Object.entries(msCommits)) {
        if (pct > 0) {
          const re = msRoles[memberId];
          respRows.push({
            milestoneId: msId,
            memberId,
            share: pct / 100,
            role: re?.role || "担当",
            taskDescription: re?.taskDescription || "",
          });
        }
      }
      validIdx++;
    }
    await upsertMilestoneResponsibilities(planCycleId, respRows);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    closeModal();
    if (directCycleId) {
      // 直接編集モード: ページをリロードして最新状態を反映
      window.location.reload();
    } else {
      const updated = await fetchNextPlanCycle(projectId, currentPlanCycle.periodEndYm);
      setNextCycle(updated);
    }
  };

  if (!show) return null;

  return (
    <>
      {/* バナー */}
      <div
        className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
        onClick={() => setOpen(true)}
      >
        <span className="text-amber-600 text-xl shrink-0">📋</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-amber-900">
            {directCycleId
              ? `MS下書き（${formatYm(nextCycle?.periodStartYm ?? "")} 〜 ${formatYm(nextCycle?.periodEndYm ?? "")}）— クリックして編集`
              : nextCycle
                ? `次の期間のMS設定済み（${formatYm(nextCycle.periodStartYm)} 〜 ${formatYm(nextCycle.periodEndYm)}）`
                : "次の期間のMSを設定しましょう"}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            {directCycleId
              ? "下書きステータス — 確定後は active に変更してください"
              : `現在の期間は ${formatYm(currentPlanCycle.periodEndYm)} に終了します${nextCycle ? " — クリックして編集" : " — クリックして設定開始"}`}
          </p>
        </div>
        {saved && (
          <span className="text-[12px] text-emerald-600 font-medium shrink-0">保存済み ✓</span>
        )}
      </div>

      {/* モーダル */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-[#e5e5e7]">
              <h2 className="text-[15px] font-semibold flex-1">次の期間のMS設定</h2>
              <button
                onClick={closeModal}
                className="text-[#86868b] hover:text-black text-xl leading-none"
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-[13px] text-[#86868b]">
                読み込み中...
              </div>
            ) : (
              <div className="overflow-y-auto px-6 py-4 flex flex-col gap-4">
                {/* 期間設定 */}
                <section>
                  <h3 className="text-[12px] font-medium text-[#86868b] mb-2 uppercase tracking-wide">期間・予算</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-[#3c3c43]">開始年月</span>
                      <input
                        type="text"
                        placeholder="202704"
                        value={periodStartYm}
                        onChange={(e) => setPeriodStartYm(e.target.value)}
                        className="border border-[#d1d5db] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#007aff]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-[#3c3c43]">終了年月</span>
                      <input
                        type="text"
                        placeholder="202803"
                        value={periodEndYm}
                        onChange={(e) => setPeriodEndYm(e.target.value)}
                        className="border border-[#d1d5db] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#007aff]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-[#3c3c43]">月額予算（円）</span>
                      <input
                        type="number"
                        value={budgetYen}
                        onChange={(e) => setBudgetYen(Number(e.target.value))}
                        className="border border-[#d1d5db] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#007aff]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-[#3c3c43]">総ポイント</span>
                      <input
                        type="number"
                        value={totalPoints}
                        onChange={(e) => setTotalPoints(Number(e.target.value))}
                        className="border border-[#d1d5db] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#007aff]"
                      />
                    </label>
                  </div>
                </section>

                {/* MS一覧 */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide flex-1">
                      マイルストーン（{milestones.length}件）
                    </h3>
                    <span className="text-[12px] text-[#86868b]">
                      合計: {milestones.reduce((s, m) => s + (m.points || 0), 0)}pt / {totalPoints}pt
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {milestones.map((ms, idx) => {
                      const msCommits = commitMap[String(idx)] || {};
                      const totalPct = Object.values(msCommits).reduce((s, v) => s + (v || 0), 0);

                      return (
                        <div
                          key={idx}
                          className="border border-[#e5e5e7] rounded-lg p-3 flex flex-col gap-2 bg-[#fafafa]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#86868b] w-5 shrink-0">{idx + 1}.</span>
                            <input
                              type="text"
                              placeholder="MS名を入力"
                              value={ms.title}
                              onChange={(e) => updateMs(idx, "title", e.target.value)}
                              className="flex-1 border border-[#d1d5db] rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#007aff] bg-white"
                            />
                            <button
                              onClick={() => removeMs(idx)}
                              className="text-[#86868b] hover:text-red-500 text-[18px] leading-none shrink-0"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex gap-2 ml-7">
                            <label className="flex items-center gap-1">
                              <span className="text-[11px] text-[#86868b]">pt</span>
                              <input
                                type="number"
                                value={ms.points}
                                onChange={(e) => updateMs(idx, "points", Number(e.target.value))}
                                className="w-16 border border-[#d1d5db] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-[#007aff] bg-white"
                              />
                            </label>
                            <select
                              value={ms.tag}
                              onChange={(e) => updateMs(idx, "tag", e.target.value)}
                              className="border border-[#d1d5db] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-[#007aff] bg-white"
                            >
                              <option value="normal">🎯 年間目標</option>
                              <option value="routine">🔄 定常業務</option>
                              <option value="buffer">🛡 バッファ</option>
                            </select>
                            <select
                              value={ms.goalLevel}
                              onChange={(e) => updateMs(idx, "goalLevel", e.target.value)}
                              className="border border-[#d1d5db] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-[#007aff] bg-white"
                            >
                              <option value="Must">Must</option>
                              <option value="Want">Want</option>
                              <option value="">—</option>
                            </select>
                          </div>
                          <div className="ml-7">
                            <input
                              type="text"
                              placeholder="成功基準（任意）"
                              value={ms.successCriteria}
                              onChange={(e) => updateMs(idx, "successCriteria", e.target.value)}
                              className="w-full border border-[#d1d5db] rounded-md px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#007aff] bg-white text-[#3c3c43]"
                            />
                          </div>

                          {/* コミット割合 + 役割・業務内容 */}
                          {projectMembers.length > 0 && (
                            <div className="ml-7 mt-1 flex flex-col gap-2">
                              {/* コミット割合行 */}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] text-[#86868b]">コミット割合</span>
                                  <span className={`text-[10px] ${totalPct === 100 ? "text-emerald-600" : totalPct > 100 ? "text-red-500" : "text-[#86868b]"}`}>
                                    合計 {totalPct}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {projectMembers.map((pm) => (
                                    <label key={pm.memberId} className="flex items-center gap-1">
                                      <span className="text-[11px] text-[#3c3c43] min-w-[40px]">{pm.codeName}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={msCommits[pm.memberId] || 0}
                                        onChange={(e) => updateCommit(idx, pm.memberId, Number(e.target.value))}
                                        className="w-14 border border-[#d1d5db] rounded-md px-1.5 py-0.5 text-[11px] text-right focus:outline-none focus:border-[#007aff] bg-white"
                                      />
                                      <span className="text-[10px] text-[#86868b]">%</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* 役割・業務内容（コミット > 0 のメンバーのみ） */}
                              {projectMembers.some((pm) => (msCommits[pm.memberId] || 0) > 0) && (
                                <div>
                                  <span className="text-[11px] text-[#86868b] block mb-1">役割・業務内容</span>
                                  <div className="flex flex-col gap-1">
                                    {projectMembers
                                      .filter((pm) => (msCommits[pm.memberId] || 0) > 0)
                                      .map((pm) => {
                                        const re = roleMap[String(idx)]?.[pm.memberId] || { role: "担当", taskDescription: "" };
                                        return (
                                          <div key={pm.memberId} className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-[#3c3c43] min-w-[40px]">{pm.codeName}</span>
                                            <select
                                              value={re.role}
                                              onChange={(e) => updateRole(idx, pm.memberId, "role", e.target.value)}
                                              className="border border-[#d1d5db] rounded-md px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-[#007aff] bg-white"
                                            >
                                              {ROLE_OPTIONS.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                              ))}
                                            </select>
                                            <input
                                              type="text"
                                              placeholder="業務内容（例: IPマッピング作成）"
                                              value={re.taskDescription}
                                              onChange={(e) => updateRole(idx, pm.memberId, "taskDescription", e.target.value)}
                                              className="flex-1 border border-[#d1d5db] rounded-md px-2 py-0.5 text-[11px] focus:outline-none focus:border-[#007aff] bg-white"
                                            />
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={addMs}
                    className="mt-2 w-full border border-dashed border-[#d1d5db] rounded-lg py-2 text-[13px] text-[#86868b] hover:border-[#007aff] hover:text-[#007aff] transition-colors"
                  >
                    + MSを追加
                  </button>
                </section>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-[#e5e5e7]">
              <button
                onClick={closeModal}
                className="shrink-0 border border-[#d1d5db] rounded-xl px-4 py-2.5 text-[13px] text-[#3c3c43] hover:bg-[#f5f5f7] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSave("draft")}
                disabled={saving || loading}
                className="flex-1 border border-[#007aff] text-[#007aff] rounded-xl py-2.5 text-[13px] font-medium hover:bg-[#007aff]/5 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "下書き保存"}
              </button>
              <button
                onClick={() => handleSave("active")}
                disabled={saving || loading}
                className="flex-1 bg-[#007aff] text-white rounded-xl py-2.5 text-[13px] font-medium hover:bg-[#0062cc] disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "確定する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
