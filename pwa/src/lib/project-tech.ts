/**
 * 技術台帳 (project_tech_*) の共通型とラベル。
 *
 * PJコックピット「技術」タブの置き場所。PJごとにフォーマットは違うが、形は4種類しかない:
 *   condition = 成立条件 / article = 解説 / matrix = 星取り表 / record = 到達実績
 * PJごとに違うのは並べるトピックと項目名だけなので、PJ専用コンポーネントは作らない。
 *
 * migration: scripts/migrations/339_project_tech_ledger.sql
 * API: /api/project-tech / UI: src/components/cockpit/CockpitTechnology.tsx
 * 仕様: pwa/spec/3-20-project-technology-current-spec.md
 */

export type TechBlockKind = "condition" | "article" | "matrix" | "record";
export type TechConfidentiality = "public" | "internal" | "confidential";
export type TechSourceKind =
  | "manual"
  | "l2_extraction"
  | "meeting"
  | "literature"
  | "vendor_spec"
  | "measurement"
  | "estimate";
export type TechRating = "excellent" | "good" | "fair" | "poor" | "na" | "unknown";
export type TechConfidence = "high" | "medium" | "low" | "unverified";

export type TechTopic = {
  tech_topic_id: string;
  project_id: string;
  block_kind: TechBlockKind;
  title: string;
  summary: string | null;
  body_md: string | null;
  tech_domain: string | null;
  sort_order: number;
  status: string;
  confidentiality: TechConfidentiality;
  source_kind: TechSourceKind;
  source_ref: string | null;
  source_url: string | null;
  /** 要確認。資料間で値が食い違う / 実測が無い / 根拠が弱い。 */
  needs_check: boolean;
  check_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TechEntry = {
  tech_entry_id: string;
  tech_topic_id: string;
  project_id: string;
  row_label: string;
  col_label: string | null;
  value_min: number | null;
  value_max: number | null;
  value_text: string | null;
  unit: string | null;
  rating: TechRating | null;
  condition_text: string | null;
  observed_on: string | null;
  confidence: TechConfidence;
  source_kind: TechSourceKind;
  source_ref: string | null;
  source_url: string | null;
  note: string | null;
  /** 要確認。資料間で値が食い違う / 実測が無い / 根拠が弱い。 */
  needs_check: boolean;
  check_reason: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** 技術タブの下段に出す、まだ構造化していない技術の断片 (project_knowledge 由来)。 */
export type TechKnowledgeFragment = {
  id: string;
  category: string;
  entity_name: string;
  fact_text: string | null;
  confidence: string | null;
  source: string | null;
  updated_at: string;
};

export const BLOCK_KIND_LABEL: Record<TechBlockKind, string> = {
  condition: "成立条件",
  article: "解説",
  matrix: "星取り表",
  record: "到達実績",
};

/** 一覧に出す、その形式が何を書く場所かの説明 (空状態と追加フォームで使う)。 */
export const BLOCK_KIND_HINT: Record<TechBlockKind, string> = {
  condition: "使える範囲。項目・下限・上限・単位・条件・出典を1行ずつ",
  article: "原理や用語の説明文。図と数式も置ける",
  matrix: "比較軸 × 相手。◎○△× と実数値、根拠を1マスずつ",
  record: "今どこまで行っているか。同じ項目を並べると推移になる",
};

export const CONFIDENTIALITY_LABEL: Record<TechConfidentiality, string> = {
  public: "公開可",
  internal: "社内限定",
  confidential: "要秘匿",
};

export const SOURCE_KIND_LABEL: Record<TechSourceKind, string> = {
  manual: "手入力",
  l2_extraction: "自動抽出",
  meeting: "議事録",
  literature: "文献",
  vendor_spec: "他社公表値",
  measurement: "実測",
  estimate: "暫定値",
};

export const RATING_LABEL: Record<TechRating, string> = {
  excellent: "◎",
  good: "○",
  fair: "△",
  poor: "×",
  na: "—",
  unknown: "?",
};

export const RATING_FULL_LABEL: Record<TechRating, string> = {
  excellent: "◎ 明確に優位",
  good: "○ 満たす",
  fair: "△ 条件つき",
  poor: "× 満たさない",
  na: "— 対象外",
  unknown: "? 未確認",
};

export const CONFIDENCE_LABEL: Record<TechConfidence, string> = {
  high: "確度高",
  medium: "確度中",
  low: "確度低",
  unverified: "未確認",
};

/** 数値の範囲・単数・文字列を1つの読み方に潰す。表とモーダルで同じ表示にするため唯一の実装にする。 */
export function formatTechValue(entry: Pick<TechEntry, "value_min" | "value_max" | "value_text" | "unit">): string {
  const unit = entry.unit ? entry.unit : "";
  const min = entry.value_min;
  const max = entry.value_max;
  const num = (v: number) => (Number.isInteger(v) ? String(v) : String(v));
  let numeric = "";
  if (min !== null && max !== null) {
    numeric = min === max ? `${num(min)}${unit}` : `${num(min)}〜${num(max)}${unit}`;
  } else if (min !== null) {
    numeric = `${num(min)}${unit} 以上`;
  } else if (max !== null) {
    numeric = `${num(max)}${unit} 以下`;
  }
  if (numeric && entry.value_text) return `${numeric} (${entry.value_text})`;
  if (numeric) return numeric;
  if (entry.value_text) return entry.value_text;
  return "未記入";
}

/** 星取り表の列順。トピック内で最初に出てきた順を保つ (自社を左に置きたいので並べ替えない)。 */
export function matrixColumns(entries: TechEntry[]): string[] {
  const cols: string[] = [];
  for (const e of entries) {
    const c = e.col_label;
    if (c && !cols.includes(c)) cols.push(c);
  }
  return cols;
}

/** 星取り表の行順。sort_order → 登場順。 */
export function matrixRows(entries: TechEntry[]): string[] {
  const rows: string[] = [];
  for (const e of [...entries].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!rows.includes(e.row_label)) rows.push(e.row_label);
  }
  return rows;
}

/** 要確認の行数。トピック見出しと画面上部の集計に出す。 */
export function countNeedsCheck(entries: TechEntry[]): number {
  return entries.filter((e) => e.needs_check).length;
}
