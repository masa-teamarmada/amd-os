/**
 * Scholar — Triple Helix 観測量 N (論文流出率) の ASPI 8 domain × quarter 学術トレンド可視化。
 *
 * AMD Score の M カードで使われる μ_A の主観測量 N の trend を一覧で見せる。
 * 個別論文を蓄積するのではなく、**マクロ学術活動の数量指標**として量を追う。
 *
 * データソース: papers_log (OpenAlex 経由、weekly cron で更新)
 * 仕様: pwa/design/amd_score.md「Triple Helix 観測モデル」
 */

import { createClient } from "@/lib/supabase/server";
import { ScholarTrendView } from "@/components/scholar/ScholarTrendView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface ScholarPaperRow {
  lane: string;
  observed_at: string; // YYYY-MM-DD (quarter 開始日)
  paper_count: number;
  source: string;
}

export default async function ScholarPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("papers_log")
    .select("lane, observed_at, paper_count, source")
    .order("observed_at", { ascending: true })
    .limit(2000);

  const rows = (data ?? []) as ScholarPaperRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Scholar — 学術トレンド (μ_A 観測量 N)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          OpenAlex から ASPI 8 domain × 直近 16 quarter の論文出版件数を週次取得。AMD Score の μ_A 計算で
          観測モデル C 行列の loading c_{`{N→μ_A}`} = 0.90 の入力として使われる。
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
          正本: <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">theory/data_specification.md §N</code>
          {" / "}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">theory/state_space_model.md §4.1</code>
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">読み込みエラー: {error.message}</p>
        )}
      </header>
      <ScholarTrendView rows={rows} />
    </div>
  );
}
