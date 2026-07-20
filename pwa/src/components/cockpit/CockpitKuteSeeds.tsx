"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { KuteSeedDetailModal } from "@/components/seeds/KuteSeedDetailModal";
import {
  computeKuteSeedScore,
  fetchResearchInstitutionSeedsForProject,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
} from "@/lib/seeds-data";
import type { SeedPublicView } from "@/types/seeds";

/**
 * PJ cockpit (KUTE / p25) の進捗タブ向け: 対象研究機関シーズを
 * カード形式で一覧表示する。global Seeds テーブルが唯一の source of truth。
 * internal_notes / source_detail 等は fetchResearchInstitutionSeedsForProject 側で
 * select から除外済み (ホワイトリスト取得)。
 */
export function CockpitKuteSeeds({ projectId }: { projectId: string }) {
  const [seeds, setSeeds] = useState<SeedPublicView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SeedPublicView | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchResearchInstitutionSeedsForProject(projectId)
      .then((data) => {
        if (!cancelled) setSeeds(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "シーズ一覧を読み込めなかった");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, requestKey]);

  const materialCount = seeds?.filter((seed) => seed.deep_dive_material_url).length ?? 0;
  const scoredCount = seeds?.filter((seed) => computeKuteSeedScore(seed).total != null).length ?? 0;

  return (
    <section className="rounded-xl border border-[#d6d6da] bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-slate-500">KUTE seeds</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">連携シーズ一覧</h2>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
            Global Seedsを正本に、工学院大学の事業化仮説を比較する。未評価は空欄を数字で埋めず、そのまま表示する。
          </p>
        </div>
        {seeds && (
          <div className="grid shrink-0 grid-cols-3 gap-2" aria-label="シーズ集計">
            <Metric label="対象" value={`${seeds.length}件`} />
            <Metric label="資料あり" value={`${materialCount}件`} />
            <Metric label="採点完了" value={`${scoredCount}件`} />
          </div>
        )}
      </div>

      <div className="mt-4">
        {error ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setSeeds(null);
                setError(null);
                setRequestKey((value) => value + 1);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 font-semibold hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              再読み込み
            </button>
          </div>
        ) : seeds === null ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            読み込み中
          </div>
        ) : seeds.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            対象のシーズがまだ登録されていない
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {seeds.map((seed) => (
              <SeedCard key={seed.id} seed={seed} onOpen={() => setSelected(seed)} />
            ))}
          </div>
        )}
      </div>

      <KuteSeedDetailModal open={selected != null} seed={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[72px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function CompactField({ label, value, span = false }: { label: string; value: string | null; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <div className="text-[10px] font-semibold text-slate-500">{label}</div>
      <p className={`mt-0.5 text-xs leading-relaxed ${value ? "line-clamp-2 text-slate-700" : "text-slate-400"}`}>
        {value ?? "未確定"}
      </p>
    </div>
  );
}

function ScoreState({
  label,
  subtotal,
  max,
  filled,
  total,
}: {
  label: string;
  subtotal: number | null;
  max: number;
  filled: number;
  total: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-800">
        {subtotal == null ? `未評価 ${filled}/${total}` : `${subtotal}/${max}`}
      </div>
    </div>
  );
}

function SeedCard({ seed, onOpen }: { seed: SeedPublicView; onOpen: () => void }) {
  const score = computeKuteSeedScore(seed);
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-slate-950">{seed.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {seed.researcher_name ?? "研究者未登録"}
            {seed.researcher_title ? ` (${seed.researcher_title})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {seed.primary_commercialization_type && (
            <span className="rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
              {SEED_COMMERCIALIZATION_TYPE_LABEL[seed.primary_commercialization_type] ?? seed.primary_commercialization_type}
            </span>
          )}
          {(seed.secondary_commercialization_types ?? []).map((t) => (
            <span key={t} className="rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
              {SEED_COMMERCIALIZATION_TYPE_LABEL[t] ?? t}
            </span>
          ))}
          {!seed.primary_commercialization_type && (seed.secondary_commercialization_types ?? []).length === 0 && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
              事業化タイプ未確定
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2">
          <CompactField label="想定用途" value={seed.kute_envisioned_use_case} />
          <CompactField label="最初の顧客" value={seed.kute_first_customer_candidate} />
          <CompactField
            label="市場規模レンジ / 確からしさ"
            value={seed.kute_market_size_range
              ? `${seed.kute_market_size_range} / ${seed.kute_market_size_confidence ? SEED_KUTE_MARKET_CONFIDENCE_LABEL[seed.kute_market_size_confidence] : "未評価"}`
              : null}
          />
          <CompactField label="知財状況" value={seed.kute_ip_status} />
          <CompactField label="最大の事業化ネック" value={seed.kute_biggest_bottleneck} span />
          <CompactField label="次の検証" value={seed.kute_next_verification_step} span />
        </div>

        <div className="grid grid-cols-3 gap-2" aria-label="100点スコアの評価状態">
          <ScoreState label="将来性 60" subtotal={score.future.subtotal} max={60} filled={score.future.filledCount} total={score.future.totalCount} />
          <ScoreState label="現在地 30" subtotal={score.current.subtotal} max={30} filled={score.current.filledCount} total={score.current.totalCount} />
          <ScoreState label="支援効果 10" subtotal={score.support.subtotal} max={10} filled={score.support.filledCount} total={score.support.totalCount} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono font-semibold text-slate-800">
            総合 {score.total == null ? <span className="text-slate-400">未評価</span> : score.total}
            <span className="text-slate-400"> / 100</span>
          </span>
          {seed.deep_dive_material_url ? (
            <span className="inline-flex items-center gap-1 font-medium text-sky-700">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              深掘り資料あり
            </span>
          ) : (
            <span className="text-slate-400">資料なし</span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
        >
          詳細を見る
        </button>
      </div>
    </article>
  );
}
