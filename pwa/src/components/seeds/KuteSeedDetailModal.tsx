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
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
} from "@/lib/seeds-data";
import type { SeedPublicView } from "@/types/seeds";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <tr>
      <th scope="row" className="w-[36%] border-b border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">
        {label}
      </th>
      <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">
        {value ?? <span className="text-slate-400">未確定</span>}
      </td>
    </tr>
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
  const sps = seed.latest_sps;

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

            <table className="w-full border-collapse text-sm">
              <tbody>
                <DetailRow label="想定用途" value={seed.envisioned_use_case} />
                <DetailRow label="最初の顧客候補" value={seed.first_customer_candidate} />
                <DetailRow
                  label="市場規模レンジ"
                  value={
                    seed.market_size_range
                      ? `${seed.market_size_range}${
                          seed.market_size_confidence
                            ? ` (確度: ${SEED_KUTE_MARKET_CONFIDENCE_LABEL[seed.market_size_confidence] ?? seed.market_size_confidence})`
                            : ""
                        }`
                      : null
                  }
                />
                <DetailRow label="知財状況" value={seed.ip_status} />
                <DetailRow label="最大のボトルネック" value={seed.biggest_bottleneck} />
                <DetailRow label="次の検証ステップ" value={seed.next_verification_step} />
              </tbody>
            </table>

            <h3 className="mb-2 mt-5 text-xs font-semibold text-slate-900">SPS (全国共通シーズスコア)</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <DetailRow
                  label="SPS"
                  value={
                    sps == null
                      ? null
                      : sps.status === "ready"
                      ? `${sps.score?.toFixed(2)} (評価日: ${sps.evaluated_at}${
                          sps.confidence ? ` / 確度: ${SEED_KUTE_MARKET_CONFIDENCE_LABEL[sps.confidence] ?? sps.confidence}` : ""
                        })`
                      : `未評価 (欠損: ${sps.missing_axes.join(", ")})`
                  }
                />
                <DetailRow
                  label="M / P / R / S"
                  value={
                    sps?.components
                      ? `${sps.components.macro.toFixed(2)} / ${sps.components.potential.toFixed(2)} / ${sps.components.reach.toFixed(2)} / ${sps.components.survival.toFixed(2)}`
                      : null
                  }
                />
                <DetailRow
                  label="TRL / BRL / GRL / SRL / HRL"
                  value={
                    sps?.axes
                      ? [sps.axes.trl, sps.axes.brl, sps.axes.grl, sps.axes.srl, sps.axes.hrl]
                          .map((v) => (v == null ? "—" : v))
                          .join(" / ")
                      : null
                  }
                />
              </tbody>
            </table>

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
