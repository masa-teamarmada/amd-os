/**
 * Scholar (μ_A 学術根拠) 一覧ページ。
 *
 * Crossref ingest cron (`/api/cron/scholar-ingest`、毎日 18:20 UTC = 03:20 JST) で
 * 投入された論文・grant・award を一覧表示する。AMD Score の μ_A 行 fallback で
 * 引用される実データの確認用。
 */

import { createClient } from "@/lib/supabase/server";
import ScholarList from "@/components/scholar/ScholarList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface ScholarRow {
  id: string;
  title: string;
  authors: string[] | null;
  journal: string | null;
  doi: string | null;
  published_at: string | null;
  lane: string | null;
  source_type: string;
  source_url: string | null;
  status: string;
  ingested_by: string;
  submitted_at: string;
}

export default async function ScholarPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholar")
    .select(
      "id, title, authors, journal, doi, published_at, lane, source_type, source_url, status, ingested_by, submitted_at"
    )
    .neq("status", "rejected")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);

  const rows = (data ?? []) as ScholarRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Scholar</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          μ_A (学術) の根拠データ。Crossref から自動収集 (毎日 03:20 JST、5 lane × 直近 1 年最新 20 件)。
          AmdScoreView の μ_A 行 fallback で引用される。
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">読み込みエラー: {error.message}</p>
        )}
      </header>
      <ScholarList rows={rows} />
    </div>
  );
}
