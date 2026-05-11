"use client";

/**
 * 再開予定の最初の月の cockpit に、休止期間中の進捗統合サマリを表示するパネル。
 *
 * 仕様 (まさ要望 2026-05-11):
 * - 休止期間のある PJ で、currentYm >= restart_expected_ym (= 再開後の月) になったら表示
 * - freeze_period_backfills テーブルから fetch (= cron/freeze-period-backfill が事前に生成)
 * - 生成が未完了 (= row なし) なら「生成中…」表示
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface FreezeBackfillRow {
  summary: string;
  freeze_from_ym: string;
  restart_ym: string;
  source_meta: {
    reports_count?: number;
    meetings_count?: number;
    generated_at?: string;
  } | null;
  updated_at: string;
}

function formatYm(ym: string): string {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4, 6)}`;
}

export function CockpitFreezeBackfill({
  projectId,
  freezeFromYm,
  restartExpectedYm,
  currentYm,
}: {
  projectId: string;
  freezeFromYm: string | null;
  restartExpectedYm: string | null;
  currentYm: string;
}) {
  const [row, setRow] = useState<FreezeBackfillRow | null>(null);
  const [loading, setLoading] = useState(true);

  // 表示条件: 休止期間 + 再開予定が両方セットで、currentYm が再開予定月以降
  const eligible =
    !!freezeFromYm && !!restartExpectedYm && currentYm >= (restartExpectedYm ?? "");

  useEffect(() => {
    if (!eligible || !freezeFromYm || !restartExpectedYm) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("freeze_period_backfills")
      .select("summary, freeze_from_ym, restart_ym, source_meta, updated_at")
      .eq("project_id", projectId)
      .eq("freeze_from_ym", freezeFromYm)
      .eq("restart_ym", restartExpectedYm)
      .maybeSingle()
      .then((r) => {
        setRow((r.data as FreezeBackfillRow | null) ?? null);
        setLoading(false);
      });
  }, [projectId, freezeFromYm, restartExpectedYm, eligible]);

  if (!eligible) return null;

  return (
    <div className="border border-blue-300 bg-blue-50/40 rounded-xl p-3 mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-blue-900">
          📦 休止期間 ({formatYm(freezeFromYm!)} 〜 {formatYm(prevYm(restartExpectedYm!))}) の進捗まとめ
        </span>
        {row?.source_meta && (
          <span className="text-[9px] text-blue-700/70">
            (reports {row.source_meta.reports_count ?? 0} / mtg {row.source_meta.meetings_count ?? 0})
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-[11px] text-slate-500">読み込み中…</div>
      ) : row ? (
        <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
          {row.summary}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500 italic">
          休止期間サマリは次回 cron 起動時に生成されます (= /api/cron/freeze-period-backfill)。
        </p>
      )}
    </div>
  );
}

function prevYm(ym: string): string {
  if (!ym || ym.length < 6) return ym;
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  if (m === 1) return `${y - 1}12`;
  return `${y}${String(m - 1).padStart(2, "0")}`;
}
