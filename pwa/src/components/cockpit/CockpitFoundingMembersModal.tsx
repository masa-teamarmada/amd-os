"use client";

/**
 * Cockpit 関連メンバー モーダル — PJ の関連メンバー (HRL 評価のベース)。
 *
 * 既存「👥 メンバー」モーダル (CockpitMembersModal) は AMD 内部メンバー (project_members の share)
 * を表示。本モーダルは LLM 抽出した **関連メンバー** を表示。
 * まさ判断 (2026-05-22): HRL 根拠 = 「該当SU社員 + AMD伴走メンバー」だけ。
 *   大学・研究機関 / VC / 顧客 / 行政 / partner_company は HRL 根拠から除外。
 *
 * 仕様: pwa/scripts/migrations/040_project_founding_members.sql +
 *       075_related_members_cleanup.sql + pwa/src/lib/founding-members-data.ts
 */

import { useEffect, useMemo, useState } from "react";
import {
  fetchFoundingMembers,
  estimateHrlFromMembers,
  ROLE_LABEL_JP,
  CATEGORY_LABEL_JP,
  CATEGORY_COLOR,
  type FoundingMemberRow,
  type FoundingMemberCategory,
} from "@/lib/founding-members-data";

const CATEGORY_ORDER: FoundingMemberCategory[] = [
  "amd",
  "startup",
  "university",
  "unknown",
  // 以下は HRL 根拠外。active 状態に来ない想定。
  "partner_company",
  "vc",
  "government",
  "individual",
];

export function CockpitFoundingMembersModal({
  projectId,
  ventureName,
  onClose,
}: {
  projectId: string;
  ventureName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<FoundingMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFoundingMembers(projectId).then((r) => {
      if (cancelled) return;
      setRows(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const grouped = useMemo(() => {
    const out = new Map<FoundingMemberCategory, FoundingMemberRow[]>();
    for (const r of rows) {
      if (r.status !== "active") continue;
      if (!out.has(r.category)) out.set(r.category, []);
      out.get(r.category)!.push(r);
    }
    return out;
  }, [rows]);

  const totalActive = useMemo(() => rows.filter((r) => r.status === "active").length, [rows]);
  const hrlEstimate = useMemo(() => estimateHrlFromMembers(rows), [rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[760px] max-w-[94vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">🧑‍🤝‍🧑 {ventureName} 関連メンバー</h3>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              関連メンバー候補 {totalActive} 名 (LLM 抽出)。HRL 評価のベース。
              <span className="block">対象は該当SU社員 + AMD伴走メンバーのみ (大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは HRL根拠外)。</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <div className="text-[12px] text-muted-foreground py-6 text-center">読み込み中…</div>
          ) : totalActive === 0 ? (
            <div className="text-[12px] text-muted-foreground py-6 text-center">
              関連メンバーはまだ抽出されていません。
              <div className="mt-2 text-[10px]">
                毎週月曜 03:30 JST に LLM が monthly_reports / meeting_summaries / project_knowledge から
                自動抽出します。手動キックは{" "}
                <code className="rounded bg-slate-100 px-1">
                  /api/cron/founding-members-extract?project_id={projectId}
                </code>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* HRL 簡易推定 (メンバー数 + 役割充足度 + カテゴリ多様性 → 0-9) */}
              <div className="rounded-md border border-amber-300 bg-amber-50/40 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    HRL 簡易推定 (Phase 1 ルールベース)
                  </span>
                  <span className="font-mono text-lg font-bold text-amber-900 dark:text-amber-200">
                    {hrlEstimate.hrl} <span className="text-[10px]">/ 9</span>
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-amber-900/80 dark:text-amber-200/80">
                  {hrlEstimate.rationale}
                </div>
                <div className="mt-1 text-[9px] italic text-amber-800/70 dark:text-amber-300/70">
                  注: amd_score_inputs.hrl の人間入力値とは別。Phase 3 で BVAR Bayesian update 予定。
                </div>
              </div>

              {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => {
                const items = grouped.get(cat) ?? [];
                return (
                  <section key={cat}>
                    <div className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold mb-2 ${CATEGORY_COLOR[cat]}`}>
                      {CATEGORY_LABEL_JP[cat]} ({items.length})
                    </div>
                    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                      {items.map((m) => (
                        <li key={m.id} className="px-3 py-2 text-[12px]">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-semibold">{m.person_name}</span>
                              {m.affiliation && (
                                <span className="text-[10px] text-slate-500">{m.affiliation}</span>
                              )}
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {m.role_label_jp ?? ROLE_LABEL_JP[m.role]}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400">
                              {m.last_observed_at ? `直近観測: ${m.last_observed_at}` : ""}
                            </span>
                          </div>
                          {m.responsibility && (
                            <div className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="text-[9px] text-slate-500">担当:</span> {m.responsibility}
                            </div>
                          )}
                          {m.contribution && (
                            <div className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="text-[9px] text-slate-500">貢献:</span> {m.contribution}
                            </div>
                          )}
                          {m.notes && (
                            <div className="mt-0.5 text-[10px] italic text-slate-500">
                              出典: {m.notes}
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
