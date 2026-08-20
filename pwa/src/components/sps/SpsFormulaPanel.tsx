"use client";

/**
 * 一次選別スクリーニング帯 (SPS = 産業創出価値版) の数式パネル。
 *
 * PJ コックピットの「スコア詳細」タブ (AmdScoreFormulaPanel) と同じ情報量を、
 * /seeds の シーズ詳細モーダルに置く。数式はすべて LaTeX (Tex) で表示し、
 * 式に出てくるパラメータが「このシーズで実際にいくつか」を必ず併記する。
 *
 * 数式は現行 SPS = 産業創出価値版 (measure_version = sps-ind-v1) のみを書く。
 * 旧 9 軸 Cobb-Douglas と旧 sps-eq-v0 (持分価値版) は OS から退役済みのため持ち込まない。
 *
 * 正本:
 * - bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定 8 / 9 / 11 / 13 / 14
 * - bzm/SEED_Q_RUBRIC_2026-08-15.md (q の 11 要因と運用規律)
 * - bzm/SEED_P_IND_JUDGMENT_2026-08-16.md (P^ind の判断層)
 * - bzm/SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md (段階仮説 S0〜S5)
 */

import type { ReactNode } from "react";
import { Tex } from "@/components/venture-map/Tex";
import { SEED_EVIDENCE_LEVEL_DESCRIPTION, seedScreeningBandMedianYen } from "@/lib/seeds-data";
import type { SeedScreeningBandDetail } from "@/types/seeds";

/** q ルーブリックの 11 要因 (SEED_Q_RUBRIC_2026-08-15.md §1-2 の並び順そのまま) */
const Q_FACTORS: { id: number; name: string; note: string }[] = [
  { id: 1, name: "ユニットエコノミクス成立性", note: "単位あたりで粗利が出る構造になるか。既存設備が使えるか、特殊インフラ依存か" },
  { id: 2, name: "資本集約度", note: "資本自立までに要る累積資金の桁。桁が増えるほど資金の崖の回数が増え、掛け算で削られる" },
  { id: 3, name: "スケール律速の型", note: "プロセス型 (連続運転・歩留まりが壁) か組立型 (既存部品と製造網に乗る) か" },
  { id: 4, name: "再現性", note: "実験・実証が再現するか。根拠データの追加探索はしない (軽量規律)" },
  { id: 5, name: "誰の財布か", note: "既に支払者がいる予算の置き換えか、新しい財布を作る必要があるか" },
  { id: 6, name: "顧客の検証コスト", note: "顧客が試すのに要る金と期間" },
  { id: 7, name: "規制・認証の関門", note: "承認プロセスの有無と年数" },
  { id: 8, name: "代替解との差の桁", note: "既存手段の 10 倍か 10% か" },
  { id: 9, name: "社会受容性", note: "前提インフラと社会の受け入れ。土台が無い所では立ち上がらない" },
  { id: 10, name: "マイクロトレンド適合", note: "その分野にいま風が吹いているか。Atlas・マクロトレンドを判定資料に使ってよい" },
  { id: 11, name: "特許の状態", note: "権利化の状況、独占可能性" },
];

const Q_DIRECTION_LABEL: Record<string, string> = {
  up: "上振れ",
  down: "下押し",
  widen: "帯を広げる",
  neutral: "中立",
};

const Q_DIRECTION_TONE: Record<string, string> = {
  up: "border-emerald-300/48 bg-emerald-400/12 text-emerald-100",
  down: "border-rose-300/48 bg-rose-400/12 text-rose-100",
  widen: "border-amber-300/48 bg-amber-400/12 text-amber-100",
  neutral: "border-cyan-300/34 bg-cyan-400/8 text-cyan-100",
};

/** q_main_factor は日本語短縮語と英語スラッグが混在するため、スラッグだけ要因名へ寄せる */
const Q_MAIN_FACTOR_LABEL: Record<string, string> = {
  unit_economics: "① ユニットエコノミクス成立性",
  capital_intensity: "② 資本集約度",
  scale_constraint: "③ スケール律速の型",
  reproducibility: "④ 再現性",
  payer: "⑤ 誰の財布か",
  validation_cost: "⑥ 顧客の検証コスト",
  regulatory_gate: "⑦ 規制・認証の関門",
  alternative_advantage: "⑧ 代替解との差の桁",
  social_acceptance: "⑨ 社会受容性",
  micro_trend: "⑩ マイクロトレンド適合",
  patent: "⑪ 特許の状態",
};

/** 段階仮説の 6 段 (SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md §1) */
const STAGE_STEPS: { code: string; name: string; note: string }[] = [
  { code: "S0", name: "構想・原理提示", note: "論文・提案のみ。科研費 (基盤・挑戦的)" },
  { code: "S1", name: "ラボ実証", note: "再現データの実績。JST A-STEP、GAP ファンド初期" },
  { code: "S2", name: "プロトタイプ・オフサイト実証", note: "試作機・ベンチ機。GAP ステップ 2、NEDO 実用化初期" },
  { code: "S3", name: "オンサイト実証", note: "実環境・顧客先での試験実績" },
  { code: "S4", name: "有償実証・初期顧客", note: "対価を伴う検証の実績" },
  { code: "S5", name: "事業化準備", note: "量産設計・調達活動・法人化準備" },
];

/** 段階の根拠タグ。stage_* は §2 の 4 種、それ以外は BZM 2.2 台帳 retrofit 由来の組織状態 */
const STAGE_TAG_LABEL: Record<string, string> = {
  stage_document: "文書根拠",
  stage_funding: "資金情報",
  stage_inferred: "推定",
  stage_unknown: "材料なし",
  pre_incorporation: "法人化前",
  operating_company: "事業会社が稼働",
  under_consideration: "事業化検討中",
};

const EVIDENCE_LEVELS: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

/** 円 → 億円。数式に入れるので formatOkuYen (小数第1位) より細かく残す */
function okuNum(yen: number | null): string | null {
  if (yen == null) return null;
  const oku = yen / 100_000_000;
  if (oku === 0) return "0";
  const abs = Math.abs(oku);
  if (abs >= 100) return String(Math.round(oku));
  if (abs >= 1) return String(Math.round(oku * 10) / 10);
  if (abs >= 0.01) return String(Math.round(oku * 100) / 100);
  return String(Number(oku.toPrecision(2)));
}

function stageTagLabel(tag: string | null): string | null {
  if (!tag) return null;
  return tag
    .split("+")
    .map((part) => STAGE_TAG_LABEL[part.trim()] ?? part.trim())
    .join(" + ");
}

function stageIndex(code: string | null): number {
  if (!code) return -1;
  return STAGE_STEPS.findIndex((s) => s.code === code.trim().toUpperCase());
}

export function SpsFormulaPanel({ band }: { band: SeedScreeningBandDetail }) {
  const qLo = band.q_lower_pct;
  const qHi = band.q_upper_pct;
  const pLo = okuNum(band.p_lower_yen);
  const pHi = okuNum(band.p_upper_yen);
  const sLo = okuNum(band.sps_lower_yen);
  const sHi = okuNum(band.sps_upper_yen);
  const medianYen = seedScreeningBandMedianYen(band.sps_lower_yen, band.sps_upper_yen);
  const sMid = okuNum(medianYen);

  const lowerTex =
    qLo != null && pLo != null && sLo != null
      ? String.raw`\mathrm{SPS}_{\min} \;=\; \frac{q_{\min}}{100}\,P^{\mathrm{ind}}_{\min} \;=\; \frac{${qLo}}{100}\times ${pLo} \;=\; ${sLo}`
      : String.raw`\mathrm{SPS}_{\min} \;=\; \frac{q_{\min}}{100}\,P^{\mathrm{ind}}_{\min}`;
  const upperTex =
    qHi != null && pHi != null && sHi != null
      ? String.raw`\mathrm{SPS}_{\max} \;=\; \frac{q_{\max}}{100}\,P^{\mathrm{ind}}_{\max} \;=\; \frac{${qHi}}{100}\times ${pHi} \;=\; ${sHi}`
      : String.raw`\mathrm{SPS}_{\max} \;=\; \frac{q_{\max}}{100}\,P^{\mathrm{ind}}_{\max}`;
  const medianTex =
    sLo != null && sHi != null && sMid != null
      ? String.raw`\widetilde{\mathrm{SPS}} \;=\; \frac{\mathrm{SPS}_{\min}+\mathrm{SPS}_{\max}}{2} \;=\; \frac{${sLo}+${sHi}}{2} \;=\; ${sMid}`
      : String.raw`\widetilde{\mathrm{SPS}} \;=\; \frac{\mathrm{SPS}_{\min}+\mathrm{SPS}_{\max}}{2}`;

  const evidenceById = new Map<number, { direction: string; assessment?: string }>();
  for (const item of band.q_evidence ?? []) {
    const id = typeof item.id === "number" ? item.id : Number.parseInt(String(item.id), 10);
    if (Number.isFinite(id)) evidenceById.set(id, { direction: item.direction, assessment: item.assessment });
  }
  const directionCount = { up: 0, down: 0, widen: 0, neutral: 0, other: 0 };
  for (const v of evidenceById.values()) {
    if (v.direction === "up") directionCount.up += 1;
    else if (v.direction === "down") directionCount.down += 1;
    else if (v.direction === "widen") directionCount.widen += 1;
    else if (v.direction === "neutral") directionCount.neutral += 1;
    else directionCount.other += 1;
  }

  const loIdx = stageIndex(band.stage_lower);
  const hiIdx = stageIndex(band.stage_upper);
  const stageTag = stageTagLabel(band.stage_tag);
  const mainFactor = band.q_main_factor ? (Q_MAIN_FACTOR_LABEL[band.q_main_factor] ?? band.q_main_factor) : null;
  const assessedAt = band.assessed_at ? band.assessed_at.slice(0, 16).replace("T", " ") : "—";

  return (
    <div
      data-testid="sps-formula-panel"
      className="sps-formula-panel relative overflow-hidden border border-cyan-300/34 bg-slate-950/90 px-4 py-4 text-[13px] leading-relaxed text-cyan-50 shadow-[0_0_46px_rgba(34,211,238,.18),inset_0_0_52px_rgba(14,165,233,.10)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(103,232,249,.16)_1px,transparent_1.8px)] bg-[size:15px_15px]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(103,232,249,.07)_1px,transparent_1px),linear-gradient(180deg,rgba(103,232,249,.05)_1px,transparent_1px)] bg-[size:88px_100%,100%_34px]" />
      </div>

      <style jsx global>{`
        .sps-formula-panel .katex {
          color: #e6fdff;
          font-size: 1.06em;
          text-shadow: 0 0 14px rgba(103, 232, 249, 0.58);
        }
        .sps-formula-panel .katex-display {
          margin: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.15rem 0;
        }
        .sps-formula-panel .katex-display > .katex {
          font-size: 1.22em;
        }
      `}</style>

      <div className="relative mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-cyan-300/24 pb-3">
        <div>
          <div className="text-[15px] font-black uppercase tracking-[0.18em] text-cyan-100 drop-shadow-[0_0_14px_rgba(103,232,249,.72)]">
            PRIMARY SCREENING FORMULA
          </div>
          <div className="mt-2 max-w-3xl text-[12px] font-semibold text-cyan-100/78">
            一次選別の SPS は、<strong className="text-cyan-200">その経路が資本自立まで届く見込み q</strong> と、
            <strong className="text-emerald-200">届いたときに国内へ生まれる付加価値の桁 P^ind</strong> の掛け算。
            当てにいく数字ではなく、<strong className="text-amber-200">どのシーズに先に会いに行くかを決めるための下書き</strong>。
            上限は楽観シナリオの包絡であって、評価額ではない。
          </div>
        </div>
        <div className="border border-pink-300/42 bg-pink-500/8 px-3 py-2 text-right font-mono text-[11px] font-black uppercase tracking-[0.12em] text-pink-200 shadow-[0_0_20px_rgba(244,114,182,.18)]">
          {band.measure_version}
          <div className="mt-1 text-[10px] tracking-[0.08em] text-pink-100/72">{band.ruleset_version ?? "—"}</div>
        </div>
      </div>

      <div className="relative flex flex-col gap-3">
        <FormulaBlock title="SPS — 定義式" accent="cyan" subtitle="産業創出価値版 / 経路の期待値の和">
          <div className="grid gap-2">
            <FormulaLine label="一般形 (複数経路)">
              <Tex tex={String.raw`\mathrm{SPS} \;=\; \sum_{o \in \mathcal{O}} q_{o}\, P^{\mathrm{ind}}_{o}`} />
            </FormulaLine>
            <FormulaLine label="現行データ (単一経路)">
              <Tex tex={String.raw`\mathrm{SPS} \;=\; \frac{q}{100}\, P^{\mathrm{ind}} \qquad (|\mathcal{O}| = 1)`} />
            </FormulaLine>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <MeaningChip
              label="q"
              title="到達見込み"
              body="その経路が資本自立 (外の資金が止まっても回る状態) まで届く見込み。単位は %。11 要因を見た人の判断で帯として置く。"
            />
            <MeaningChip
              label="P^ind"
              title="産業創出価値"
              body="その経路が成立したとき、国内に生まれる付加価値の割引現在価値の桁。単位は円。会社の持分価値ではない。"
            />
            <MeaningChip
              label="o"
              title="経路"
              body="同じ技術から分岐する事業の道筋。現行データは主経路 1 本だけを置いているので、和は 1 項に縮退する。"
            />
          </div>
          <div className="rounded border border-cyan-300/24 bg-cyan-300/7 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            q は割合、P^ind は金額。掛けると「その経路から期待できる産業創出価値」になる。
            どちらか一方が大きくても、もう一方が小さければ SPS は伸びない。
            届く見込みが薄い巨大構想と、確実だが小さい話が、同じ物差しの上に並ぶ。
          </div>
          <Citation>
            正本: <code>bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 9 (集約式は現行 SPS)・確定 14 (P を持分価値から産業創出価値へ)。
            旧 9 軸 Cobb-Douglas と旧 <code>sps-eq-v0</code> (持分価値版) は退役済み。版をまたぐ歴史比較はしない。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="BAND ENDPOINTS — 帯の端点" accent="sky" subtitle="このシーズの実値を代入 / 単位は億円">
          <div className="grid gap-2">
            <FormulaLine label="下限 (億円)">
              <Tex tex={lowerTex} />
            </FormulaLine>
            <FormulaLine label="上限 (億円)">
              <Tex tex={upperTex} />
            </FormulaLine>
          </div>
          <div className="rounded border border-sky-300/24 bg-sky-300/7 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            積は q についても P^ind についても単調に増えるので、<strong className="text-sky-200">全部の下端を掛けたものが厳密な最小</strong>、
            <strong className="text-sky-200">全部の上端を掛けたものが厳密な最大</strong>になる。
            中の組み合わせを別々に走らせる必要はない。数式内の億円は表示用に丸めてある。
          </div>
          <Citation>
            正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 8 (帯の最小・最大の取り方)。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="REPRESENTATIVE VALUE — 一覧の主表示" accent="sky" subtitle="中央値 / 既定ソートキー">
          <FormulaLine label="中央値 (億円)">
            <Tex tex={medianTex} />
          </FormulaLine>
          <div className="rounded border border-sky-300/24 bg-sky-300/7 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            シーズ一覧は、この<strong className="text-sky-200">算術中点を主表示にして降順に並べる</strong>。括弧内に帯を併記する。
            算術中点は仮置き (まさ裁定 2026-08-15)。桁で効く量なので幾何中点 <Tex tex={String.raw`\sqrt{\mathrm{SPS}_{\min}\mathrm{SPS}_{\max}}`} /> を採る案もあるが、
            現行は採用していない。
          </div>
          <Citation>
            正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 11 第二裁定 (中央値主表示・中央値降順ソート)。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="PARAMETER VECTOR — このシーズの実値" accent="cyan" subtitle="式に出てくる記号がそれぞれ何番か">
          <div className="grid gap-2 md:grid-cols-2">
            <ParamRow symbol="q_min 〜 q_max" label="到達見込みの帯">
              {qLo != null || qHi != null ? `${qLo ?? "—"}% 〜 ${qHi ?? "—"}%` : "—"}
            </ParamRow>
            <ParamRow symbol="P^ind_min 〜 P^ind_max" label="産業創出価値の帯">
              {pLo != null || pHi != null ? `${pLo ?? "—"} 〜 ${pHi ?? "—"} 億円` : "—"}
            </ParamRow>
            <ParamRow symbol="SPS_min 〜 SPS_max" label="帯の端点">
              {sLo != null || sHi != null ? `${sLo ?? "—"} 〜 ${sHi ?? "—"} 億円` : "—"}
            </ParamRow>
            <ParamRow symbol="SPS~" label="中央値 (一覧の主表示)">
              {sMid != null ? `${sMid} 億円` : "—"}
            </ParamRow>
            <ParamRow symbol="stage" label="段階仮説">
              {band.stage_lower || band.stage_upper ? `${band.stage_lower ?? "—"} 〜 ${band.stage_upper ?? "—"}` : "—"}
              {stageTag ? <span className="ml-2 text-[11px] text-cyan-100/58">根拠: {stageTag}</span> : null}
            </ParamRow>
            <ParamRow symbol="q main factor" label="q を一番動かした要因">
              {mainFactor ?? "—"}
            </ParamRow>
            <ParamRow symbol="P^ind class" label="P の判断層">
              {band.p_class ?? "—"}
            </ParamRow>
            <ParamRow symbol="evidence level" label="根拠の成熟度">
              {SEED_EVIDENCE_LEVEL_DESCRIPTION[band.evidence_level]}
            </ParamRow>
            <ParamRow symbol="evaluator / assessed_at" label="評価者と評価日時">
              {band.evaluator} / {assessedAt}
            </ParamRow>
            <ParamRow symbol="measure / ruleset" label="版">
              {band.measure_version} / {band.ruleset_version ?? "—"}
              {band.frozen ? <span className="ml-2 text-[11px] text-amber-200">凍結済み (追記のみ)</span> : null}
            </ParamRow>
          </div>
        </FormulaBlock>

        <FormulaBlock title="Q JUDGMENT LAYER — q はどう決まるか" accent="rose" subtitle="11 要因ルーブリック / 閉じた式を作らない">
          <FormulaLine label="やらないこと">
            <Tex tex={String.raw`q \;\neq\; \sum_{i=1}^{11} w_i x_i, \qquad w \in \mathbb{R}^{11}`} />
          </FormulaLine>
          <div className="rounded border border-rose-300/28 bg-rose-400/8 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            11 要因は<strong className="text-rose-200">同じ観点で全件を見たことを担保するための点検表</strong>であって、
            点数を合成して q を吐く関数ではない。要因から帯への機械的な変換式は作らない (係数を発明しない)。
            q はあくまで人の判断で <Tex tex={String.raw`[q_{\min}, q_{\max}]`} /> という幅として置き、その根拠を要因ごとに書き残す。
            だから q には閉じた式が存在しない — これは手抜きではなく、意図した設計。
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-black">
            <span className="border border-emerald-300/48 bg-emerald-400/12 px-2 py-1 text-emerald-100">上振れ {directionCount.up}</span>
            <span className="border border-rose-300/48 bg-rose-400/12 px-2 py-1 text-rose-100">下押し {directionCount.down}</span>
            <span className="border border-amber-300/48 bg-amber-400/12 px-2 py-1 text-amber-100">帯を広げる {directionCount.widen}</span>
            <span className="border border-cyan-300/34 bg-cyan-400/8 px-2 py-1 text-cyan-100">中立 {directionCount.neutral}</span>
            <span className="border border-slate-400/34 bg-slate-400/8 px-2 py-1 text-slate-200">
              評価済み {evidenceById.size} / {Q_FACTORS.length}
            </span>
          </div>
          <div className="grid gap-1">
            {Q_FACTORS.map((factor) => {
              const hit = evidenceById.get(factor.id);
              const tone = hit ? (Q_DIRECTION_TONE[hit.direction] ?? Q_DIRECTION_TONE.neutral) : "border-slate-500/28 bg-slate-800/24 text-slate-400";
              const label = hit ? (Q_DIRECTION_LABEL[hit.direction] ?? hit.direction) : "未評価";
              return (
                <div
                  key={factor.id}
                  className="grid gap-1 border border-cyan-300/14 bg-cyan-300/4 px-3 py-2 md:grid-cols-[26px_1fr_92px] md:items-center"
                >
                  <div className="font-mono text-[12px] font-black text-cyan-100/64">{factor.id}</div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-cyan-50">{factor.name}</div>
                    <div className="text-[11px] leading-relaxed text-cyan-100/54">{factor.note}</div>
                  </div>
                  <div className={`justify-self-start border px-2 py-1 text-center text-[11px] font-black md:justify-self-end ${tone}`}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
          <Citation>
            正本: <code>bzm/SEED_Q_RUBRIC_2026-08-15.md</code> §1-2 (11 要因)・§3 (研究者の事業化シグナルは帯に効かせない)・
            §4 運用規律 1 (要因 → 帯の機械的変換式は作らない)。要因ごとの引用と判断は、下の「q 帯の根拠」に全文を残している。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="STAGE HYPOTHESIS — 段階仮説" accent="sky" subtitle="S0〜S5 / 幅で置く">
          <div className="grid gap-1">
            {STAGE_STEPS.map((step, idx) => {
              const inRange = loIdx >= 0 && hiIdx >= 0 && idx >= Math.min(loIdx, hiIdx) && idx <= Math.max(loIdx, hiIdx);
              return (
                <div
                  key={step.code}
                  className={`grid gap-1 border px-3 py-2 md:grid-cols-[44px_1fr] md:items-center ${
                    inRange ? "border-sky-300/54 bg-sky-400/12 text-cyan-50" : "border-cyan-300/12 bg-slate-950/40 text-cyan-100/40"
                  }`}
                >
                  <div className="font-mono text-[13px] font-black">{step.code}</div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold">{step.name}</div>
                    <div className="text-[11px] leading-relaxed opacity-72">{step.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded border border-sky-300/24 bg-sky-300/7 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            段階は 1 点に決めず幅で置く。根拠が強ければ幅 1、弱ければ幅 2、材料がゼロなら S0〜S2 まで広げる。
            {stageTag ? <> このシーズの根拠は <strong className="text-sky-200">{stageTag}</strong>。</> : null}
          </div>
          <Citation>
            正本: <code>bzm/SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md</code> §1 (6 段の定義)・§2 (根拠タグ)。
          </Citation>
        </FormulaBlock>

        <FormulaBlock title="EVIDENCE LEVEL — 根拠の成熟度" accent="rose" subtitle="Lv0〜Lv3 / DB から機械導出">
          <div className="grid gap-1">
            {EVIDENCE_LEVELS.map((lv) => {
              const active = lv === band.evidence_level;
              return (
                <div
                  key={lv}
                  className={`border px-3 py-2 text-[12px] ${
                    active ? "border-rose-300/54 bg-rose-400/12 font-bold text-cyan-50" : "border-cyan-300/12 bg-slate-950/40 text-cyan-100/40"
                  }`}
                >
                  {SEED_EVIDENCE_LEVEL_DESCRIPTION[lv]}
                </div>
              );
            })}
          </div>
          <div className="rounded border border-rose-300/28 bg-rose-400/8 px-3 py-2 text-[12px] leading-relaxed text-cyan-50/82">
            根拠 Lv は人が付けるラベルではなく、OS に何が溜まっているかから機械的に決まる。
            Lv が上がるほど帯の幅は本来狭くなるべきで、狭まっていない帯は「まだ見に行っていない」という信号として読む。
          </div>
          <Citation>
            正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 13 (根拠 Lv の 4 段)。
          </Citation>
        </FormulaBlock>
      </div>
    </div>
  );
}

function FormulaBlock({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "cyan" | "sky" | "rose";
  children: ReactNode;
}) {
  const color =
    accent === "rose"
      ? "border-rose-300/38 text-rose-200"
      : accent === "sky"
        ? "border-sky-300/38 text-sky-200"
        : "border-cyan-300/38 text-cyan-200";
  const rail =
    accent === "rose" ? "bg-rose-300 shadow-rose-300/80" : accent === "sky" ? "bg-sky-300 shadow-sky-300/80" : "bg-cyan-300 shadow-cyan-300/80";

  return (
    <section className={`relative overflow-hidden border bg-slate-950/72 px-3 py-3 shadow-[inset_0_0_24px_rgba(2,8,23,.92)] ${color}`}>
      <div className={`absolute left-0 top-0 h-full w-[3px] ${rail} shadow-[0_0_15px_currentColor]`} />
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-cyan-300/16 pb-2">
        <div className="font-mono text-[12px] font-black uppercase tracking-[0.16em]">{title}</div>
        <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-100/54">{subtitle}</div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MeaningChip({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded border border-cyan-300/22 bg-slate-950/62 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[17px] font-black text-cyan-100">{label}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200/78">{title}</span>
      </div>
      <div className="mt-1 text-[11px] font-semibold leading-relaxed text-cyan-50/72">{body}</div>
    </div>
  );
}

function FormulaLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border border-cyan-300/16 bg-cyan-300/5 px-3 py-2 md:grid-cols-[168px_1fr] md:items-center">
      <div className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-cyan-100/64">{label}</div>
      <div className="min-w-0 overflow-x-auto text-[13px]">{children}</div>
    </div>
  );
}

function ParamRow({ symbol, label, children }: { symbol: string; label: string; children: ReactNode }) {
  return (
    <div className="border border-cyan-300/16 bg-cyan-300/5 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[11px] font-black tracking-[0.06em] text-cyan-200/86">{symbol}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-100/48">{label}</span>
      </div>
      <div className="mt-1 text-[13px] font-bold text-cyan-50">{children}</div>
    </div>
  );
}

function Citation({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-[11px] font-semibold leading-relaxed text-cyan-100/54">{children}</div>;
}
