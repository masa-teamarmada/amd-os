"use client";

/**
 * PJ コックピットの「スコア詳細」タブ。
 *
 * まさ 2026-08-27「古いモデルの試算結果は、混乱の元になるのですべて削除してほしい」。
 * 旧SPS（sps-ind-v1 の帯）と BZM 2.2 暫定パイロットの表示をここから外し、
 * **現行の BZM 3.0（産業創出価値 V）だけ**を出す。シーズ詳細と同じパネルを使うので、
 * 同じ PJ を PJ 側から見ても シーズ側から見ても同じ数字・同じ根拠が出る。
 *
 * 仕様は pwa/spec の「4-8 BZM 3.0 スコアパネル」。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bzm30ScorePanel } from "@/components/bzm30/Bzm30ScorePanel";
import { fetchSeedDetail } from "@/lib/seeds-data";
import { createClient } from "@/lib/supabase/client";
import type { SeedDetail } from "@/types/seeds";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; detail: SeedDetail }
  | { status: "no-seed" }
  | { status: "error"; message: string };

export function CockpitAmdScoreDetailTab({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("seed_projects")
        .select("seed_id")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setState({ status: "error", message: "シーズとの紐付けを読めなかった" });
        return;
      }
      const seedId = (data as { seed_id: string } | null)?.seed_id;
      if (!seedId) {
        setState({ status: "no-seed" });
        return;
      }
      const detail = await fetchSeedDetail(seedId).catch(() => null);
      if (cancelled) return;
      if (!detail) {
        setState({ status: "error", message: "シーズの詳細を読めなかった" });
        return;
      }
      setState({ status: "ready", detail });
    })();

    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-24 place-items-center border border-slate-200 bg-white text-[10px] text-slate-500">
        スコアを読み込み中…
      </div>
    );
  }
  if (state.status === "error") {
    return <div className="border border-red-200 bg-red-50 px-3 py-3 text-[10px] text-red-800">{state.message}</div>;
  }
  if (state.status === "no-seed") {
    return (
      <div className="border border-slate-200 bg-white px-3 py-3 text-[11px] leading-relaxed text-slate-600">
        この PJ にシーズが紐づいていないので、産業創出価値を算出できない。
        <Link href="/seeds" className="ml-1 text-indigo-600 underline hover:opacity-80">
          シーズ一覧
        </Link>
        から紐付けたうえで、案件ごとの入力（用途ごとの天井・工程の型・評価日の証拠水準）を入れる。
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3" data-density="compact-score-page">
      <Bzm30ScorePanel seed={state.detail.seed} detail={state.detail} band={null} />
    </div>
  );
}
