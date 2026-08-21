"use client";

/**
 * 一次選別スクリーニング帯 (SPS = 産業創出価値版) の数式パネル。
 *
 * PJ コックピット「スコア詳細」タブと同じ情報量を、/seeds の シーズ詳細モーダルに置く
 * (まさ確定 2026-08-20)。数式はすべて LaTeX (Tex) で表示し、
 * 式に出てくるパラメータが「このシーズで実際にいくつか」を必ず併記する。
 *
 * 見た目 (外枠・ブロック・チップ) は数式パネル共通キット
 * @/components/formula/FormulaPanelKit に一本化している。
 *
 * 🚫 cyber HUD デザインコード (黒背景 / ネオン発光 / SVG コーナーフレーム / 英大文字見出し) は
 * 使わない。まさ確定 2026-08-21:「HUDデザインコードを混ぜないでくれればいいだけ」。
 * このパネルはシーズ詳細モーダルの中に置かれるので、モーダルの他セクション
 * (border-border / bg-card / text-muted-foreground) と同じ見た目に溶け込ませる。
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

import {
  Citation,
  DetailFormula,
  DetailNote,
  DetailStep,
  FormulaBlock,
  FormulaLine,
  FormulaPanelShell,
  MeaningChip,
  ParamRow,
} from "@/components/formula/FormulaPanelKit";
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
  up: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  down: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  widen: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  neutral: "border-border bg-muted/60 text-muted-foreground",
};

/**
 * q_main_factor は 3 通りの書き方が混在している (英語スラッグ / フル要因名 / 日本語短縮語)。
 * どれも 11 要因のどれかを指しているので、要因番号へ寄せてから表示する。
 */
const Q_MAIN_FACTOR_ID: Record<string, number> = {
  unit_economics: 1,
  "ユニットエコノミクス成立性": 1,
  "経済性": 1,
  capital_intensity: 2,
  "資本集約度": 2,
  "資本集約": 2,
  "軽資本": 2,
  scale_constraint: 3,
  "スケール律速の型": 3,
  "量産": 3,
  reproducibility: 4,
  "再現性": 4,
  "未検証": 4,
  "実測": 4,
  payer: 5,
  "誰の財布か": 5,
  "財布": 5,
  validation_cost: 6,
  "顧客の検証コスト": 6,
  "検証コスト": 6,
  regulatory_gate: 7,
  "規制・認証の関門": 7,
  "規制": 7,
  alternative_advantage: 8,
  "代替解との差の桁": 8,
  "代替差": 8,
  social_acceptance: 9,
  "社会受容性": 9,
  "受容": 9,
  micro_trend: 10,
  "マイクロトレンド適合": 10,
  "風": 10,
  patent: 11,
  "特許の状態": 11,
};

/** 11 要因のどれでもなく「状態そのもの」が主因になっている書き方。番号を付けず意味だけ出す */
const Q_MAIN_FACTOR_STATE: Record<string, string> = {
  "早期": "11 要因のどれか 1 つではなく、段階そのものの早さ (S0〜S1) が帯を一番押し下げている",
  "基礎": "基礎研究の段階にあること自体が最大の下押し",
  "情報薄": "判定材料が足りないこと自体が最大の要因。帯の幅は確信度の低さをそのまま表している",
  "停止": "活動が止まっていることが最大の下押し",
};

const Q_FACTOR_NUMERAL = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪"];

/** P^ind の判断で毎回見る 4 観点 (SEED_P_IND_JUDGMENT_2026-08-16.md §3) */
const P_VIEWPOINTS: { title: string; note: string }[] = [
  { title: "売り先の桁", note: "誰がいくら払う市場なのか。国内の一部門か、世界市場へ出ていく型か" },
  { title: "国内付加価値の発生", note: "その売上のうち、日本国内で付加価値になる分はどれくらいか。製造・部材が国内に残るか" },
  { title: "輸入代替", note: "今輸入で買っているものを置き換えるか。置き換える分はそのまま国内付加価値になる" },
  { title: "継続の桁", note: "一回売って終わりか、消耗品・保守で何年も続くか。継続年数の桁がそのまま P^ind の桁に乗る" },
];

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
  investigating: "調査中",
  discussing: "先方と協議中",
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
  const assessedAt = band.assessed_at ? band.assessed_at.slice(0, 16).replace("T", " ") : "—";
  const loStage = STAGE_STEPS.find((x) => x.code === band.stage_lower) ?? null;
  const hiStage = STAGE_STEPS.find((x) => x.code === band.stage_upper) ?? null;

  // q_main_factor は英語スラッグ / フル要因名 / 短縮語が混在する。まず要因番号へ寄せ、
  // 11 要因のどれでもない状態語 (早期・情報薄・基礎・停止) は番号を付けずに意味だけ出す。
  const mainFactorRaw = band.q_main_factor?.trim() || null;
  const mainFactorId = mainFactorRaw ? (Q_MAIN_FACTOR_ID[mainFactorRaw] ?? null) : null;
  const mainFactorSpec = mainFactorId != null ? (Q_FACTORS.find((f) => f.id === mainFactorId) ?? null) : null;
  const mainFactorState = mainFactorRaw ? (Q_MAIN_FACTOR_STATE[mainFactorRaw] ?? null) : null;
  const mainFactor = mainFactorSpec
    ? `${Q_FACTOR_NUMERAL[mainFactorSpec.id]} ${mainFactorSpec.name}`
    : mainFactorRaw;
  const mainFactorEvidence = mainFactorId != null ? (evidenceById.get(mainFactorId) ?? null) : null;

  // p_class は「P^ind判断層(出典.md)」形式と、産業クラス名を直接入れた形式の 2 通りが混在する。
  const pClass = band.p_class?.trim() || null;
  const pClassDoc = pClass ? (/\(([^)]+\.md)\)/.exec(pClass)?.[1] ?? null) : null;
  const pIndustryClass = pClass && !pClassDoc ? pClass : null;
  const pBasisDoc = band.p_basis_doc?.trim() || pClassDoc;
  const pRationale = band.p_rationale?.trim() || null;
  const pExternalDemand = band.p_external_demand?.trim() || null;


  return (
    <FormulaPanelShell
      testId="sps-formula-panel"
      title="一次選別スクリーニングの計算式"
      badge={
        <>
          {band.measure_version}
          <div className="mt-1 text-[10px]">{band.ruleset_version ?? "—"}</div>
        </>
      }
      lead={
        <>
            一次選別の SPS は、<strong className="font-semibold text-foreground">その経路が資本自立まで届く見込み q</strong> と、
            <strong className="font-semibold text-foreground">届いたときに国内へ生まれる付加価値の桁 P^ind</strong> の掛け算。
            当てにいく数字ではなく、<strong className="font-semibold text-foreground">どのシーズに先に会いに行くかを決めるための下書き</strong>。
            上限は楽観シナリオの包絡であって、評価額ではない。
        </>
      }
    >
      <FormulaBlock title="SPS の定義式" accent="primary" subtitle="産業創出価値版 / 経路の期待値の和">
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
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          q は割合、P^ind は金額。掛けると「その経路から期待できる産業創出価値」になる。
          どちらか一方が大きくても、もう一方が小さければ SPS は伸びない。
          届く見込みが薄い巨大構想と、確実だが小さい話が、同じ物差しの上に並ぶ。
        </div>
        <Citation>
          正本: <code>bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 9 (集約式は現行 SPS)・確定 14 (P を持分価値から産業創出価値へ)。
          旧 9 軸 Cobb-Douglas と旧 <code>sps-eq-v0</code> (持分価値版) は退役済み。版をまたぐ歴史比較はしない。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="帯の端点" accent="info" subtitle="このシーズの実値を代入 / 単位は億円">
        <div className="grid gap-2">
          <FormulaLine label="下限 (億円)">
            <Tex tex={lowerTex} />
          </FormulaLine>
          <FormulaLine label="上限 (億円)">
            <Tex tex={upperTex} />
          </FormulaLine>
        </div>
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          積は q についても P^ind についても単調に増えるので、<strong className="font-semibold text-foreground">全部の下端を掛けたものが厳密な最小</strong>、
          <strong className="font-semibold text-foreground">全部の上端を掛けたものが厳密な最大</strong>になる。
          中の組み合わせを別々に走らせる必要はない。数式内の億円は表示用に丸めてある。
        </div>
        <Citation>
          正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 8 (帯の最小・最大の取り方)。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="一覧の主表示 (代表値)" accent="info" subtitle="中央値 / 既定ソートキー">
        <FormulaLine label="中央値 (億円)">
          <Tex tex={medianTex} />
        </FormulaLine>
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          シーズ一覧は、この<strong className="font-semibold text-foreground">算術中点を主表示にして降順に並べる</strong>。括弧内に帯を併記する。
          算術中点は仮置き (まさ裁定 2026-08-15)。桁で効く量なので幾何中点 <Tex tex={String.raw`\sqrt{\mathrm{SPS}_{\min}\mathrm{SPS}_{\max}}`} /> を採る案もあるが、
          現行は採用していない。
        </div>
        <Citation>
          正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 11 第二裁定 (中央値主表示・中央値降順ソート)。
        </Citation>
      </FormulaBlock>

      <FormulaBlock
        title="このシーズの実値"
        accent="primary"
        subtitle="カードをクリックすると、その数字がどう出たかが開く"
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ParamRow
            symbol={<Tex tex={String.raw`q_{\min} \;\sim\; q_{\max}`} />}
            label="到達見込みの帯"
            detail={
              <>
                <DetailStep n={1} title="11 要因を同じ順番で点検する">
                  全シーズを同じ 11 個の観点で見て、それぞれに「上振れ・下押し・帯を広げる・中立」のどれかを付ける。
                  このシーズは {evidenceById.size} / 11 要因を記録済み (上振れ {directionCount.up} ・下押し {directionCount.down} ・帯を広げる {directionCount.widen} ・中立 {directionCount.neutral})。
                  1 件ずつの判断文は下の「q はどう決まるか」に並んでいる。
                </DetailStep>
                <DetailStep n={2} title="一番効いた要因を 1 つ決める">
                  {mainFactor ? (
                    <>
                      この帯を一番動かしたのは <span className="font-medium text-foreground">{mainFactor}</span>。
                      {mainFactorEvidence?.assessment ? <>その判断: 「{mainFactorEvidence.assessment}」</> : null}
                      {mainFactorState ? <>({mainFactorState})</> : null}
                    </>
                  ) : (
                    "主要因は未記録。"
                  )}
                </DetailStep>
                <DetailStep n={3} title="点数を足すのではなく、人が帯を置く">
                  <DetailFormula>
                    <Tex
                      tex={
                        qLo != null && qHi != null
                          ? String.raw`q \;\in\; [\,${qLo},\ ${qHi}\,]\ (\%) \qquad \text{ただし} \quad q \;\neq\; \sum_{i=1}^{11} w_i x_i`
                          : String.raw`q \;\in\; [\,q_{\min},\ q_{\max}\,]\ (\%) \qquad \text{ただし} \quad q \;\neq\; \sum_{i=1}^{11} w_i x_i`
                      }
                      display
                    />
                  </DetailFormula>
                  11 要因は点検表であって合成関数ではない。重み <Tex tex={String.raw`w_i`} /> を掛けて足すと、
                  根拠の無い小数第 2 位が生まれて「計算した数字」に見えてしまう。だから点検の結果を見て人が帯の端を置く。
                </DetailStep>
                <DetailNote>
                  帯の幅そのものが確信度。会いに行った証拠があるほど狭くなり、ネット情報だけなら広いままになる。
                  この幅を勝手に狭めないことが、この指標を信用できる状態に保つ条件。
                </DetailNote>
              </>
            }
          >
            {qLo != null || qHi != null ? `${qLo ?? "—"}% 〜 ${qHi ?? "—"}%` : "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`P^{\mathrm{ind}}_{\min} \;\sim\; P^{\mathrm{ind}}_{\max}`} />}
            label="産業創出価値の帯"
            detail={
              <>
                <DetailStep n={1} title="何を測っている数字か">
                  会社の値段ではなく、この技術が立ち上がったときに日本国内に生まれる付加価値の累計 (現在価値) を測る。
                  <DetailFormula>
                    <Tex
                      tex={String.raw`P^{\mathrm{ind}} \;=\; \sum_{t \ge 0} \frac{VA_t}{(1+r)^t}`}
                      display
                    />
                  </DetailFormula>
                  <span className="mt-1 block">
                    <Tex tex={String.raw`VA_t`} /> = t 年目に国内で生まれる付加価値、
                    <Tex tex={String.raw`r`} /> = 割引率。持分価値や時価総額とは別物。
                  </span>
                </DetailStep>
                <DetailStep n={2} title="この式を直接計算はしない (判断層方式)">
                  <Tex tex={String.raw`VA_t`} /> を年次で積み上げられるのは事業計画がある段階から。
                  シーズの段階では材料が無いので、閉じた式を置かずに、タイトルと要約と常識から
                  <span className="font-medium text-foreground">桁の帯を直接置く</span>。
                  精度の低さは式を複雑にして隠すのではなく、帯の広さと根拠 Lv で表に出す。
                </DetailStep>
                <DetailStep n={3} title="桁を置くときに毎回見る 4 つの観点">
                  <div className="mt-1 space-y-1">
                    {P_VIEWPOINTS.map((v, i) => (
                      <div key={v.title}>
                        <span className="font-medium text-foreground">
                          {i + 1}. {v.title}
                        </span>
                        {" — "}
                        {v.note}
                      </div>
                    ))}
                  </div>
                </DetailStep>
                <DetailStep n={4} title="桁を組み立てるときの粗い当たり (参考)">
                  <DetailFormula>
                    <Tex
                      tex={String.raw`P^{\mathrm{ind}} \;\approx\; \underbrace{VA_{\text{年}}}_{\text{年あたり付加価値の桁}} \times \underbrace{T}_{\text{続く年数の桁}}`}
                      display
                    />
                  </DetailFormula>
                  例えば年 10 億円が 10 年続く型なら 100 億円級、年 100 億円が 5 年なら 500 億円級。
                  桁を合わせるための当たりであって、この掛け算の答えをそのまま採ってはいない。
                </DetailStep>
                <DetailStep n={5} title="このシーズで実際に置いた桁とその理由">
                  <div className="mt-1 space-y-1">
                    <div>
                      置いた帯:{" "}
                      <span className="font-medium text-foreground">
                        {pLo != null || pHi != null ? `${pLo ?? "—"} 〜 ${pHi ?? "—"} 億円` : "—"}
                      </span>
                    </div>
                    {pIndustryClass ? (
                      <div>
                        産業クラス: <span className="font-medium text-foreground">{pIndustryClass}</span>
                      </div>
                    ) : null}
                    {pExternalDemand ? (
                      <div>
                        外需 (国外へ出ていく度合い):{" "}
                        <span className="font-medium text-foreground">{pExternalDemand}</span>
                      </div>
                    ) : null}
                    {pRationale ? (
                      <div className="mt-1.5 rounded border border-border bg-background/70 px-2.5 py-2 text-foreground">
                        {pRationale}
                      </div>
                    ) : null}
                  </div>
                </DetailStep>
                {pRationale ? null : (
                  <DetailNote tone="caution">
                    この行には、桁をここに置いた一行の理由が記録されていない。
                    凍結済みの評価に後から作文を足すと根拠が偽装されるので、空のまま残している。
                    理由を残すのは再評価 (追記) のとき。
                  </DetailNote>
                )}
                <DetailNote>
                  桁を置くときの規律: 実績だけを根拠にする (宣言・計画は数えない) / SaaS・デジタルだから大きいという寄せ方をしない /
                  分野で足切りしない (被害を防ぐ・手間を減らす型も、対価を通じて付加価値として数える)。
                  {pBasisDoc ? <> 判断の記録は <span className="font-medium text-foreground">{pBasisDoc}</span>。</> : null}
                </DetailNote>
              </>
            }
          >
            {pLo != null || pHi != null ? `${pLo ?? "—"} 〜 ${pHi ?? "—"} 億円` : "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\mathrm{SPS}_{\min} \;\sim\; \mathrm{SPS}_{\max}`} />}
            label="帯の端点"
            detail={
              <>
                <DetailStep n={1} title="下端は下端どうし、上端は上端どうしを掛ける">
                  <Tex tex={String.raw`q`} /> も <Tex tex={String.raw`P^{\mathrm{ind}}`} /> も 0 以上なので、
                  積は両方が小さいときに最小、両方が大きいときに最大になる。だから端点は素直に掛けるだけで出る。
                  <DetailFormula>
                    <Tex tex={lowerTex} display />
                  </DetailFormula>
                  <DetailFormula>
                    <Tex tex={upperTex} display />
                  </DetailFormula>
                </DetailStep>
                <DetailStep n={2} title="単位">
                  <Tex tex={String.raw`q`} /> は % なので 100 で割って割合に戻す。金額は億円表示 (
                  <Tex tex={String.raw`1\ \text{億円} = 10^{8}\ \text{円}`} />
                  )。DB には円で入っている。
                </DetailStep>
                <DetailNote>
                  この幅は「当たるかどうか」の幅であって、事業計画の上下ぶれではない。
                  幅が 1 桁以上あるのが普通で、狭い帯は根拠が積み上がった証拠。
                </DetailNote>
              </>
            }
          >
            {sLo != null || sHi != null ? `${sLo ?? "—"} 〜 ${sHi ?? "—"} 億円` : "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\widetilde{\mathrm{SPS}}`} />}
            label="中央値 (一覧の主表示)"
            detail={
              <>
                <DetailStep n={1} title="端点の真ん中を取る">
                  <DetailFormula>
                    <Tex tex={medianTex} display />
                  </DetailFormula>
                  一覧を並べ替えるには 1 つの数字が要る。そのための代表値で、帯そのものより情報は少ない。
                </DetailStep>
                <DetailStep n={2} title="算術平均を使っている理由と、その弱点">
                  桁で置いた帯なら本来は幾何平均 (
                  <Tex tex={String.raw`\sqrt{\mathrm{SPS}_{\min}\mathrm{SPS}_{\max}}`} />
                  ) の方が素直だが、端が 0 のときに全部 0 になってしまうため、今の版は算術平均で置いている。
                  上端に引っぱられやすいので、順位を見るときは必ず帯の幅も一緒に見る。
                </DetailStep>
                <DetailNote>
                  中央値だけを比較して「A のほうが上」と言い切らない。帯が重なっていれば差は付いていない。
                </DetailNote>
              </>
            }
          >
            {sMid != null ? `${sMid} 億円` : "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`[\,s_{\min},\ s_{\max}\,]`} />}
            label="段階仮説"
            detail={
              <>
                <DetailStep n={1} title="今どこにいそうかを幅で置く">
                  S0 (基礎) から S5 (量産) までの 6 段のうち、今いそうな範囲を幅で置く。
                  {loStage ? (
                    <>
                      {" "}
                      下端 <span className="font-medium text-foreground">{loStage.code} {loStage.name}</span> = {loStage.note}。
                    </>
                  ) : null}
                  {hiStage && hiStage.code !== loStage?.code ? (
                    <>
                      {" "}
                      上端 <span className="font-medium text-foreground">{hiStage.code} {hiStage.name}</span> = {hiStage.note}。
                    </>
                  ) : null}
                </DetailStep>
                <DetailStep n={2} title="幅の決め方">
                  法人化済み・製品出荷済みなど段階が外から見える材料があれば幅 1 段。
                  論文とプレスリリースしか無い場合は幅 2〜3 段のまま残す。ここで幅を詰めると、根拠が無いのに進んで見える。
                </DetailStep>
                <DetailStep n={3} title="この行の根拠">
                  {stageTag ? (
                    <>
                      <span className="font-medium text-foreground">{stageTag}</span> を根拠に置いている。
                    </>
                  ) : (
                    "外形的な根拠タグは付いていない (公開情報からの推定のみ)。"
                  )}
                </DetailStep>
                <DetailNote>
                  段階は <Tex tex={String.raw`\mathrm{SPS}`} /> の計算式には直接入らない。
                  <Tex tex={String.raw`q`} /> を置くときの前提として使い、記録として残している。
                </DetailNote>
              </>
            }
          >
            {band.stage_lower || band.stage_upper ? `${band.stage_lower ?? "—"} 〜 ${band.stage_upper ?? "—"}` : "—"}
            {stageTag ? <span className="ml-2 text-[11px] text-muted-foreground">根拠: {stageTag}</span> : null}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`i^{\ast}`} />}
            label="q を一番動かした要因"
            detail={
              <>
                <DetailStep n={1} title="11 要因のうち、帯を一番動かした 1 つ">
                  <DetailFormula>
                    <Tex
                      tex={String.raw`i^{\ast} \;=\; \operatorname*{arg\,max}_{i \in \{1,\dots,11\}} \bigl|\,\Delta q_i\,\bigr|`}
                      display
                    />
                  </DetailFormula>
                  実際に差分 <Tex tex={String.raw`\Delta q_i`} /> を数値で持っているわけではない。
                  点検した 11 件を見比べて、帯の置き場所を最も左右した 1 件を人が選び、記録している。
                </DetailStep>
                <DetailStep n={2} title="このシーズの主要因">
                  {mainFactorSpec ? (
                    <>
                      <span className="font-medium text-foreground">
                        {Q_FACTOR_NUMERAL[mainFactorSpec.id]} {mainFactorSpec.name}
                      </span>
                      {" — "}
                      {mainFactorSpec.note}
                    </>
                  ) : mainFactorState ? (
                    <>
                      <span className="font-medium text-foreground">{mainFactorRaw}</span>
                      {" — "}
                      {mainFactorState}
                    </>
                  ) : mainFactorRaw ? (
                    <>
                      <span className="font-medium text-foreground">{mainFactorRaw}</span>
                      {" ("}11 要因のどれを指すかが記録から一意に決まらない表記{")"}
                    </>
                  ) : (
                    "未記録。"
                  )}
                </DetailStep>
                {mainFactorEvidence?.assessment ? (
                  <DetailStep n={3} title="その要因に対して書かれた判断">
                    「{mainFactorEvidence.assessment}」
                  </DetailStep>
                ) : null}
                <DetailNote>
                  ここが「なぜこの帯なのか」の一番短い答えになる。反論するなら、まずこの 1 要因を崩しに行くのが早い。
                </DetailNote>
              </>
            }
          >
            {mainFactor ?? "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\mathrm{class}\bigl(P^{\mathrm{ind}}\bigr)`} />}
            label="P の判断層"
            detail={
              <>
                <DetailStep n={1} title="どの土俵で桁を置いたか">
                  {pIndustryClass ? (
                    <>
                      産業クラス <span className="font-medium text-foreground">{pIndustryClass}</span> として桁を置いた。
                      同じクラスのシーズは同じ相場感で並ぶので、クラス内での大小は比較しやすい。
                    </>
                  ) : (
                    <>
                      個別に桁を置いた判断層。閉じた式ではなく、判断の記録として md に残している。
                    </>
                  )}
                </DetailStep>
                <DetailStep n={2} title="判断層方式にしている理由">
                  シーズ段階では市場規模の推計値を持ってきても、出典の前提がばらばらで比較にならない。
                  それより「同じ人が同じ観点で全件に桁を置く」ほうが順位が安定する。
                  間違いは個別に直すのではなく、版を上げて全件を引き直す。
                </DetailStep>
                {pBasisDoc ? (
                  <DetailStep n={3} title="判断の記録">
                    <span className="font-medium text-foreground">{pBasisDoc}</span> に、この行の桁を置いた経緯が残っている。
                  </DetailStep>
                ) : null}
                <DetailNote>
                  クラスが同じでも帯は 1 桁以上ばらつく。クラスは相場の出発点であって、答えではない。
                </DetailNote>
              </>
            }
          >
            {pClass ?? "—"}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\mathrm{Lv}`} />}
            label="根拠の成熟度"
            detail={
              <>
                <DetailStep n={1} title="人が付ける点数ではない">
                  どんな材料を持っているかで機械的に決まる。評価者が「よく調べたから Lv2」と自己申告することはできない。
                </DetailStep>
                <DetailStep n={2} title="このシーズの現在地">
                  <span className="font-medium text-foreground">
                    {SEED_EVIDENCE_LEVEL_DESCRIPTION[band.evidence_level]}
                  </span>
                </DetailStep>
                <DetailStep n={3} title="上げるには">
                  <div className="mt-1 space-y-1">
                    {EVIDENCE_LEVELS.map((lv) => (
                      <div key={lv} className={lv === band.evidence_level ? "text-foreground" : undefined}>
                        {lv === band.evidence_level ? "▸ " : "　"}
                        {SEED_EVIDENCE_LEVEL_DESCRIPTION[lv]}
                      </div>
                    ))}
                  </div>
                </DetailStep>
                <DetailNote>
                  Lv が低いこと自体は問題ではない。低い Lv の帯を狭く置くのが問題。
                  Lv0 のまま帯が狭いなら、それは根拠ではなく思い込み。
                </DetailNote>
              </>
            }
          >
            {SEED_EVIDENCE_LEVEL_DESCRIPTION[band.evidence_level]}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\bigl(\,\mathrm{evaluator},\ t_{\mathrm{eval}}\,\bigr)`} />}
            label="評価者と評価日時"
            detail={
              <>
                <DetailStep n={1} title="誰がいつ置いた帯か">
                  <span className="font-medium text-foreground">{band.evaluator}</span> が{" "}
                  <span className="font-medium text-foreground">{assessedAt}</span> に記録した。
                  この時点で見えていた情報だけで判断している。
                </DetailStep>
                <DetailStep n={2} title="以後の新情報は入っていない">
                  資金調達・提携・製品出荷などが後から起きても、この行は書き換わらない。
                  新しい材料が出たら、この行を直すのではなく、新しい評価を 1 行足して最新を差し替える。
                </DetailStep>
                <DetailNote>
                  評価日時が古いのに帯が動いていないシーズは、追いかけていないというサイン。順位より先にそこを見る。
                </DetailNote>
              </>
            }
          >
            {band.evaluator} / {assessedAt}
          </ParamRow>

          <ParamRow
            symbol={<Tex tex={String.raw`\bigl(\,v_{\mathrm{measure}},\ v_{\mathrm{ruleset}}\,\bigr)`} />}
            label="版"
            detail={
              <>
                <DetailStep n={1} title="測っているもの / 測り方の版">
                  <span className="font-medium text-foreground">{band.measure_version}</span> が「何を測るか」(産業創出価値)、
                  <span className="font-medium text-foreground"> {band.ruleset_version ?? "—"}</span> が「どう測るか」(要因ルーブリックと桁の置き方)。
                  この 2 つが同じ行どうしだけを並べて比較する。
                </DetailStep>
                <DetailStep n={2} title="凍結の意味">
                  {band.frozen
                    ? "この行は凍結済み。評価値は書き換えできず、直したいときは新しい評価を 1 行足す (追記のみ)。順位が後からこっそり変わらないようにするための仕組みで、DB 側でも書き換えを拒否している。"
                    : "この行はまだ凍結されていない。凍結すると評価値は書き換えできなくなり、修正は追記でのみ行う。"}
                </DetailStep>
                <DetailNote>
                  版が違う数字を混ぜて順位を作らない。測り方を変えたら、全件を新しい版で置き直してから比較する。
                </DetailNote>
              </>
            }
          >
            {band.measure_version} / {band.ruleset_version ?? "—"}
            {band.frozen ? <span className="ml-2 text-[11px] text-amber-700 dark:text-amber-300">凍結済み (追記のみ)</span> : null}
          </ParamRow>
        </div>
      </FormulaBlock>

      <FormulaBlock title="q はどう決まるか" accent="caution" subtitle="11 要因ルーブリック / 閉じた式を作らない">
        <FormulaLine label="やらないこと">
          <Tex tex={String.raw`q \;\neq\; \sum_{i=1}^{11} w_i x_i, \qquad w \in \mathbb{R}^{11}`} />
        </FormulaLine>
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          11 要因は<strong className="font-semibold text-foreground">同じ観点で全件を見たことを担保するための点検表</strong>であって、
          点数を合成して q を吐く関数ではない。要因から帯への機械的な変換式は作らない (係数を発明しない)。
          q はあくまで人の判断で <Tex tex={String.raw`[q_{\min}, q_{\max}]`} /> という幅として置き、その根拠を要因ごとに書き残す。
          だから q には閉じた式が存在しない — これは手抜きではなく、意図した設計。
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className={`rounded border px-2 py-1 ${Q_DIRECTION_TONE.up}`}>上振れ {directionCount.up}</span>
          <span className={`rounded border px-2 py-1 ${Q_DIRECTION_TONE.down}`}>下押し {directionCount.down}</span>
          <span className={`rounded border px-2 py-1 ${Q_DIRECTION_TONE.widen}`}>帯を広げる {directionCount.widen}</span>
          <span className={`rounded border px-2 py-1 ${Q_DIRECTION_TONE.neutral}`}>中立 {directionCount.neutral}</span>
          <span className="rounded border border-border bg-muted/60 px-2 py-1 text-muted-foreground">
            評価済み {evidenceById.size} / {Q_FACTORS.length}
          </span>
        </div>
        <div className="grid gap-1">
          {Q_FACTORS.map((factor) => {
            const hit = evidenceById.get(factor.id);
            const tone = hit ? (Q_DIRECTION_TONE[hit.direction] ?? Q_DIRECTION_TONE.neutral) : "border-border bg-muted/30 text-muted-foreground";
            const label = hit ? (Q_DIRECTION_LABEL[hit.direction] ?? hit.direction) : "未評価";
            return (
              <div
                key={factor.id}
                className="grid gap-1 rounded border border-border bg-muted/20 px-3 py-2 md:grid-cols-[26px_1fr_92px] md:items-center"
              >
                <div className="font-mono text-[12px] font-semibold text-muted-foreground">{factor.id}</div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-foreground">{factor.name}</div>
                  <div className="text-[11px] leading-relaxed text-muted-foreground">{factor.note}</div>
                </div>
                <div className={`justify-self-start rounded border px-2 py-1 text-center text-[11px] font-medium md:justify-self-end ${tone}`}>
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

      <FormulaBlock title="段階仮説" accent="info" subtitle="S0〜S5 / 幅で置く">
        <div className="grid gap-1">
          {STAGE_STEPS.map((step, idx) => {
            const inRange = loIdx >= 0 && hiIdx >= 0 && idx >= Math.min(loIdx, hiIdx) && idx <= Math.max(loIdx, hiIdx);
            return (
              <div
                key={step.code}
                className={`grid gap-1 rounded border px-3 py-2 md:grid-cols-[44px_1fr] md:items-center ${
                    inRange
                      ? "border-sky-500/45 bg-sky-500/10 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground"
                  }`}
              >
                <div className="font-mono text-[13px] font-semibold">{step.code}</div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold">{step.name}</div>
                  <div className="text-[11px] leading-relaxed opacity-80">{step.note}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          段階は 1 点に決めず幅で置く。根拠が強ければ幅 1、弱ければ幅 2、材料がゼロなら S0〜S2 まで広げる。
          {stageTag ? <> このシーズの根拠は <strong className="font-semibold text-foreground">{stageTag}</strong>。</> : null}
        </div>
        <Citation>
          正本: <code>bzm/SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md</code> §1 (6 段の定義)・§2 (根拠タグ)。
        </Citation>
      </FormulaBlock>

      <FormulaBlock title="根拠の成熟度" accent="caution" subtitle="Lv0〜Lv3 / DB から機械導出">
        <div className="grid gap-1">
          {EVIDENCE_LEVELS.map((lv) => {
            const active = lv === band.evidence_level;
            return (
              <div
                key={lv}
                className={`rounded border px-3 py-2 text-[12px] ${
                    active
                      ? "border-rose-500/45 bg-rose-500/10 font-semibold text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground"
                  }`}
              >
                {SEED_EVIDENCE_LEVEL_DESCRIPTION[lv]}
              </div>
            );
          })}
        </div>
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          根拠 Lv は人が付けるラベルではなく、OS に何が溜まっているかから機械的に決まる。
          Lv が上がるほど帯の幅は本来狭くなるべきで、狭まっていない帯は「まだ見に行っていない」という信号として読む。
        </div>
        <Citation>
          正本: <code>BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md</code> §6 確定 13 (根拠 Lv の 4 段)。
        </Citation>
      </FormulaBlock>
    </FormulaPanelShell>
  );
}
