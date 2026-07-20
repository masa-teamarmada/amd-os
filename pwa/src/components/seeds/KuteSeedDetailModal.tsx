"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeedMarkdownPreviewModal } from "@/components/seeds/SeedMarkdownPreviewModal";
import {
  computeKuteSeedScore,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
} from "@/lib/seeds-data";
import type { SeedPublicView } from "@/types/seeds";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-slate-500">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-slate-800">{value ?? <span className="text-slate-400">未確定</span>}</p>
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number | null; max: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-xs last:border-b-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono font-semibold text-slate-900">
        {value == null ? <span className="font-normal text-slate-400">未評価</span> : `${value}`}
        <span className="text-slate-400"> / {max}</span>
      </span>
    </div>
  );
}

function ScoreGroupHeading({
  label,
  score,
}: {
  label: string;
  score: { subtotal: number | null; max: number; filledCount: number; totalCount: number };
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
      <div className="text-[10px] font-semibold text-slate-600">{label}</div>
      <div className="font-mono text-[10px] font-semibold text-slate-700">
        {score.subtotal == null
          ? `未評価 ${score.filledCount}/${score.totalCount}`
          : `${score.subtotal}/${score.max}`}
      </div>
    </div>
  );
}

/**
 * KUTE 等の外部研究機関向け公開面のシーズ詳細モーダル。
 * SeedPublicView (internal_notes / source_detail を含まないホワイトリスト型) のみを受け取る。
 * SeedDetailModal (社内編集用、confidential 項目を含む) は再利用しない。
 */
export function KuteSeedDetailModal({
  open,
  seed,
  onClose,
}: {
  open: boolean;
  seed: SeedPublicView | null;
  onClose: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!seed) return null;
  const score = computeKuteSeedScore(seed);

  return (
    <>
      <Dialog
        open={open && !previewOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="grid max-h-[92vh] !w-[96vw] !max-w-[760px] grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-lg border border-slate-300 bg-white p-0 text-slate-950 shadow-2xl"
        >
          <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[15px] font-semibold leading-tight text-slate-950">{seed.title}</DialogTitle>
                <DialogDescription className="mt-1 text-[12px] text-slate-500">
                  {seed.researcher_name ?? "研究者未登録"}
                  {seed.researcher_title ? ` (${seed.researcher_title})` : ""}
                  {seed.lab_name ? ` / ${seed.lab_name}` : ""}
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="閉じる"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="min-h-0 overflow-y-auto bg-white px-5 py-5">
            {seed.summary && (
              <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                {seed.summary}
              </p>
            )}

            <div className="mb-4 flex flex-wrap gap-1.5">
              {seed.primary_commercialization_type && (
                <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
                  主: {SEED_COMMERCIALIZATION_TYPE_LABEL[seed.primary_commercialization_type] ?? seed.primary_commercialization_type}
                </span>
              )}
              {(seed.secondary_commercialization_types ?? []).map((t) => (
                <span key={t} className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                  副: {SEED_COMMERCIALIZATION_TYPE_LABEL[t] ?? t}
                </span>
              ))}
              {!seed.primary_commercialization_type && (seed.secondary_commercialization_types ?? []).length === 0 && (
                <span className="text-[11px] text-slate-400">事業化タイプ未確定</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="想定用途" value={seed.kute_envisioned_use_case} />
              <Field label="最初の顧客候補" value={seed.kute_first_customer_candidate} />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-slate-500">市場規模レンジ</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {seed.kute_market_size_range ?? <span className="text-slate-400">未確定</span>}
                  {seed.kute_market_size_confidence && (
                    <span className="ml-2 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                      確度: {SEED_KUTE_MARKET_CONFIDENCE_LABEL[seed.kute_market_size_confidence] ?? seed.kute_market_size_confidence}
                    </span>
                  )}
                </p>
              </div>
              <Field label="知財状況" value={seed.kute_ip_status} />
              <Field label="最大のボトルネック" value={seed.kute_biggest_bottleneck} />
              <Field label="次の検証ステップ" value={seed.kute_next_verification_step} />
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-slate-900">100点スコア内訳</h3>
                <span className="font-mono text-sm font-bold text-slate-950">
                  {score.total == null ? <span className="text-slate-400">未評価</span> : `${score.total}`}
                  <span className="text-xs font-normal text-slate-400"> / 100</span>
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                全8項目が評価済みになった時だけ総合点を表示する。未評価項目があれば部分点を総合点にしない。
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <ScoreGroupHeading label="将来性 60" score={score.future} />
                  <ScoreRow label="ニーズ" value={seed.kute_score_future_need} max={15} />
                  <ScoreRow label="市場" value={seed.kute_score_future_market} max={15} />
                  <ScoreRow label="技術優位" value={seed.kute_score_future_technical_advantage} max={15} />
                  <ScoreRow label="IP・参入障壁" value={seed.kute_score_future_ip_barrier} max={15} />
                </div>
                <div>
                  <ScoreGroupHeading label="現在地 30" score={score.current} />
                  <ScoreRow label="TRL" value={seed.kute_score_current_trl} max={10} />
                  <ScoreRow label="BRL" value={seed.kute_score_current_brl} max={10} />
                  <ScoreRow label="HRL" value={seed.kute_score_current_hrl} max={10} />
                </div>
                <div>
                  <ScoreGroupHeading label="KUTE支援効果 10" score={score.support} />
                  <ScoreRow label="支援効果" value={seed.kute_score_support} max={10} />
                </div>
              </div>
            </div>

            <div className="mt-4">
              {seed.deep_dive_material_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  深掘り資料を見る
                </button>
              ) : (
                <span className="inline-flex h-11 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                  資料なし
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {seed.deep_dive_material_url && previewOpen && (
        <SeedMarkdownPreviewModal
          open={previewOpen}
          seedId={seed.id}
          seedTitle={seed.title}
          driveUrl={seed.deep_dive_material_url}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
