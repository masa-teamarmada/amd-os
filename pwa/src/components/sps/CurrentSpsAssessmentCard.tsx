/**
 * PJ に紐づく現行 SPS (産業創出価値, sps-ind-v1) の要約カード。
 *
 * 帯の中身 (定義式・パラメータの実値・算出過程・総合判断・q 要因) は
 * SpsScreeningBandSection が唯一の正本。ここには PJ 固有のヘッダ
 * (評価済みバッジ / SPS 帯 / 根拠レベル / 評価日 / 対応シーズ / 版と評価 ID) だけを置き、
 * 説明そのものを二重に書かない。
 *
 * 経緯: コックピットの「スコア詳細」タブと /seeds のシーズ詳細で、同じ sps-ind-v1 の帯なのに
 * 表示が食い違っていた (まさ指摘 2026-08-21)。中身を共通セクションへ寄せて統一した。
 *
 * 🚫 cyber HUD デザインコード (黒背景 / ネオン発光 / SVG コーナーフレーム / 英大文字見出し) は使わない。
 *    配色は shadcn トークンで書く (旧実装の緑系ハードコードはダークモードで破綻していた)。
 */

import { SpsScreeningBandSection } from "@/components/sps/SpsScreeningBandSection";

import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import type { SeedScreeningBandDetail } from "@/types/seeds";

function formatOkuYen(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const oku = value / 100_000_000;
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: oku < 10 ? 1 : 0 }).format(oku)}億円`;
}

function formatDate(value: string | null) {
  if (!value) return "未評価";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function HeadCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export function CurrentSpsAssessmentCard({
  assessment,
  band = null,
  compact = false,
}: {
  assessment: CurrentSpsProjectAssessment;
  /** 対応シーズの帯。渡すと定義式・算出過程・総合判断・q 要因まで展開する (compact 時は非表示)。 */
  band?: SeedScreeningBandDetail | null;
  compact?: boolean;
}) {
  const assessed = assessment.status === "assessed";
  const showRationale = !compact && band != null;

  return (
    <section
      data-testid="current-sps-assessment"
      data-assessment-id={assessment.assessment_id ?? "unassessed"}
      className="rounded-md border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md border-b border-border bg-muted/50 px-3 py-2">
        <div>
          <h2 className="text-[12px] font-semibold text-foreground">現行SPS｜産業創出価値</h2>
          <p className="text-[10px] text-muted-foreground">{assessment.model.formula}</p>
        </div>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
            assessed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300"
          }`}
        >
          {assessed ? "評価済み" : "最新版未評価"}
        </span>
      </div>

      <div className={`grid gap-px bg-border ${compact ? "grid-cols-2" : "sm:grid-cols-4"}`}>
        <HeadCell label="SPS帯">
          <span className="text-[15px] font-semibold tabular-nums text-foreground">
            {assessed ? `${formatOkuYen(assessment.sps_lower_yen)}〜${formatOkuYen(assessment.sps_upper_yen)}` : "—"}
          </span>
        </HeadCell>
        <HeadCell label="根拠レベル">
          <span className="text-[13px] font-semibold text-foreground">Lv{assessment.evidence_level}</span>
        </HeadCell>
        {!compact ? (
          <>
            <HeadCell label="評価日">
              <span className="text-[11px] font-semibold text-foreground">{formatDate(assessment.assessed_at)}</span>
            </HeadCell>
            <HeadCell label="対応シーズ">
              <span className="line-clamp-2 text-[10px] font-semibold text-foreground">
                {assessment.seed_title ?? "未接続"}
              </span>
            </HeadCell>
          </>
        ) : null}
      </div>

      {showRationale ? (
        <div className="border-t border-border px-3 py-3">
          <SpsScreeningBandSection band={band!} />
        </div>
      ) : null}

      {!compact ? (
        <details className="border-t border-border">
          <summary className="cursor-pointer list-none px-3 py-1.5 text-[10px] font-semibold text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            版と評価ID
          </summary>
          <div className="border-t border-border px-3 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
            <div>
              {assessment.model.measureVersion} / {assessment.model.qModelVersion} /{" "}
              {assessment.model.qRulesetVersion} / {assessment.model.pModelVersion}
            </div>
            <div>assessment: {assessment.assessment_id ?? "none"}</div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
