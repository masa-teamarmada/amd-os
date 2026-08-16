"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText, X } from "lucide-react";
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
  SEED_EVIDENCE_LEVEL_LABEL,
  SEED_EVIDENCE_LEVEL_DESCRIPTION,
  formatOkuYen,
  formatSpsBandWithMedian,
} from "@/lib/seeds-data";
import type { SeedPublicView, SeedScreeningBandDetail } from "@/types/seeds";

/** 旧SPS (持分価値版・M/P/R/S) セクションの表示切替。まさ裁定 2026-08-16 でOS非表示、データ・コードは保持。
 * design/seeds.md「旧SPS表記」/ design/FEATURE_REGISTRY.md 参照。 */
const SHOW_LEGACY_SPS = false;

const STAGE_TAG_LABEL: Record<string, string> = {
  stage_document: "文書根拠",
  stage_funding: "資金情報",
  stage_inferred: "推定",
  stage_unknown: "材料なし",
};

function stageTagLabel(tag: string | null): string | null {
  if (!tag) return null;
  return tag
    .split("+")
    .map((part) => STAGE_TAG_LABEL[part] ?? part)
    .join(" + ");
}

const Q_EVIDENCE_DIRECTION_LABEL: Record<string, string> = {
  down: "下押し",
  up: "上振れ",
  widen: "帯を広げる",
  neutral: "中立",
};

const EVIDENCE_LEVEL_BADGE_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: "border-slate-300 bg-slate-50 text-slate-500",
  1: "border-sky-300 bg-sky-50 text-sky-700",
  2: "border-amber-300 bg-amber-50 text-amber-800",
  3: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

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
  const [screeningBand, setScreeningBand] = useState<SeedScreeningBandDetail | null>(null);
  const [qEvidenceOpen, setQEvidenceOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed/open 切替時に前回シーズの帯を残さないための同期リセット
    setScreeningBand(null);
    setQEvidenceOpen(false);
    if (!open || !seed) return;
    let cancelled = false;
    fetch(`/api/seeds/screening-bands?seedId=${encodeURIComponent(seed.id)}`)
      .then((res) => res.json())
      .then((json: { ok: boolean; band?: SeedScreeningBandDetail | null }) => {
        if (cancelled || !json.ok) return;
        setScreeningBand(json.band ?? null);
      })
      .catch(() => {
        // スクリーニング帯は補助表示。取得失敗してもシーズ詳細本体は表示を続ける。
      });
    return () => {
      cancelled = true;
    };
  }, [open, seed]);

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
            {(seed.project_links ?? []).length > 0 && (
              <section className="mb-4 border-l-4 border-indigo-600 bg-indigo-50 px-3 py-2.5">
                <h3 className="text-[10px] font-bold text-indigo-800">AMD シーズ事業化PJ</h3>
                <div className="mt-1 space-y-1">
                  {seed.project_links.map((project) => (
                    <p key={project.project_id} className="text-sm font-semibold text-slate-950">
                      {project.project_name}
                      <span className="ml-2 text-[10px] font-normal text-slate-500">{project.project_status}</span>
                    </p>
                  ))}
                </div>
              </section>
            )}
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

            {/* 旧SPS (持分価値版・9軸ルーブリック) はOS非表示 (まさ裁定 2026-08-16、
                bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md §8「旧バージョンはOSに出さないでOK」)。
                データ (seed_sps_assessments) と計算コードは保持し、表示だけ SHOW_LEGACY_SPS で外す。 */}
            {SHOW_LEGACY_SPS && (
              <>
                <h3 className="mb-2 mt-5 text-xs font-semibold text-slate-900" title="旧: M×P×R×Sの9軸ルーブリック。一次選別のSPS帯 (下記) とは別系統">
                  旧SPS (全国共通シーズスコア)
                </h3>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <DetailRow
                      label="旧SPS"
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
              </>
            )}

            {screeningBand && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold text-slate-900">
                  SPS帯（産業創出価値）
                  <span className="ml-2 text-[10px] font-normal text-slate-400">{screeningBand.measure_version}</span>
                </h3>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <DetailRow
                      label="段階仮説"
                      value={
                        screeningBand.stage_lower || screeningBand.stage_upper
                          ? `${screeningBand.stage_lower ?? "—"}〜${screeningBand.stage_upper ?? "—"}${
                              screeningBand.stage_tag ? ` (${stageTagLabel(screeningBand.stage_tag)})` : ""
                            }`
                          : null
                      }
                    />
                    <DetailRow
                      label="q帯 (資本自立への到達見込み)"
                      value={
                        screeningBand.q_lower_pct != null || screeningBand.q_upper_pct != null
                          ? `${screeningBand.q_lower_pct ?? "—"}%〜${screeningBand.q_upper_pct ?? "—"}%${
                              screeningBand.q_main_factor ? ` / 主要因: ${screeningBand.q_main_factor}` : ""
                            }`
                          : null
                      }
                    />
                    <DetailRow label="P^ind帯(産業創出価値・判断層)" value={screeningBand.p_class} />
                    <DetailRow
                      label="P帯 (億円)"
                      value={
                        screeningBand.p_lower_yen != null || screeningBand.p_upper_yen != null
                          ? `${formatOkuYen(screeningBand.p_lower_yen)}〜${formatOkuYen(screeningBand.p_upper_yen)}`
                          : null
                      }
                    />
                    <tr>
                      <th scope="row" className="w-[36%] border-b border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">
                        SPS (億円) / 根拠Lv
                      </th>
                      <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">
                        {screeningBand.sps_lower_yen != null || screeningBand.sps_upper_yen != null ? (
                          <span className="mr-2" title="中央値 (下限〜上限)。中央値は仮置きの算術中点 (まさ裁定 2026-08-15)">
                            {formatSpsBandWithMedian(screeningBand.sps_lower_yen, screeningBand.sps_upper_yen)}
                          </span>
                        ) : (
                          <span className="mr-2 text-slate-400">未確定</span>
                        )}
                        <span
                          title={SEED_EVIDENCE_LEVEL_DESCRIPTION[screeningBand.evidence_level]}
                          className={`inline-flex border px-1.5 py-0.5 text-[10px] font-bold ${EVIDENCE_LEVEL_BADGE_CLASS[screeningBand.evidence_level]}`}
                        >
                          {SEED_EVIDENCE_LEVEL_LABEL[screeningBand.evidence_level]}
                        </span>
                      </td>
                    </tr>
                    <DetailRow
                      label="評価者 / 評価日時"
                      value={`${screeningBand.evaluator} / ${screeningBand.assessed_at ?? "—"}`}
                    />
                    <DetailRow label="ルールセット" value={screeningBand.ruleset_version} />
                  </tbody>
                </table>

                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                  この帯は接触と調査の優先順位づけの下書き。上限は楽観シナリオの包絡であり評価額ではない。投資判断・対外表示には使わない。
                </p>

                {screeningBand.q_evidence && screeningBand.q_evidence.length > 0 && (
                  <details
                    className="mt-2 rounded-md border border-slate-200 bg-slate-50"
                    open={qEvidenceOpen}
                    onToggle={(e) => setQEvidenceOpen(e.currentTarget.open)}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-700">
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${qEvidenceOpen ? "rotate-0" : "-rotate-90"}`}
                        aria-hidden="true"
                      />
                      q帯の根拠 ({screeningBand.q_evidence.length}要因)
                    </summary>
                    <ul className="space-y-2 border-t border-slate-200 px-3 py-2">
                      {screeningBand.q_evidence.map((item) => (
                        <li key={item.id} className="text-[11px] leading-relaxed text-slate-700">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="font-semibold text-slate-900">{item.name}</span>
                            <span className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[9px] font-medium text-slate-500">
                              {Q_EVIDENCE_DIRECTION_LABEL[item.direction] ?? item.direction}
                            </span>
                          </div>
                          <div className="mt-0.5 text-slate-600">{item.evidence}</div>
                          {item.assessment && (
                            <div className="mt-0.5 text-slate-400">{item.assessment}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

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
