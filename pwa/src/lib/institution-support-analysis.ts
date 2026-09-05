/**
 * /institutions「分析」タブの純粋関数。支援プログラム比較のセルから、
 * 列別の整備率、地域ブロック×種別の整備率、機関の支援充実度、AMDの提案余地 (ギャップ)、
 * 属性項目の型分布を計算する。画面はこの関数の結果だけを描く (集計式をJSXへ散らさない)。
 *
 * 数え方の約束 (spec 2-7「未確認を安全扱いしない」):
 * - 「確認済み」= unknown 以外。割合の分母は確認済み。未確認は必ず別に出す。
 * - 「整備済み」= established だけ。検討中・未整備は整備済みに数えない。
 *
 * このファイルは `@/` alias を使わない (scripts/check_institution_support_analysis.mts が node から直接読むため)。
 */
import type { InstitutionPolicyStatus } from "./institution-policy";
import type {
  SupportProgramCell,
  SupportProgramColumn,
  SupportProgramExtraCell,
  SupportProgramItem,
} from "../types/institution-support-programs";

export type AnalysisInstitution = {
  institutionId: string;
  name: string;
  type: string;
  region: string | null;
};

export type StatusCounts = {
  established: number;
  drafting: number;
  notStarted: number;
  unknown: number;
  total: number;
  confirmed: number;
  /** 確認済みに占める整備済みの割合 (0..1)。確認済みが 0 なら null。 */
  rate: number | null;
};

export const REGION_BLOCKS = [
  "北海道・東北",
  "関東",
  "中部",
  "近畿",
  "中国・四国",
  "九州・沖縄",
  "不明",
] as const;
export type RegionBlock = (typeof REGION_BLOCKS)[number];

const PREFECTURE_BLOCK: Array<[RegionBlock, string[]]> = [
  ["北海道・東北", ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島"]],
  ["関東", ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"]],
  ["中部", ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知"]],
  ["近畿", ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"]],
  ["中国・四国", ["鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知"]],
  ["九州・沖縄", ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"]],
];

/** 地域文字列 (「香川」「茨城県つくば市」など) を地域ブロックへ寄せる。 */
export function regionBlockOf(region: string | null | undefined): RegionBlock {
  const text = (region ?? "").normalize("NFKC");
  if (!text) return "不明";
  for (const [block, prefectures] of PREFECTURE_BLOCK) {
    if (prefectures.some((prefecture) => text.includes(prefecture))) return block;
  }
  return "不明";
}

export const INSTITUTION_TYPE_GROUP: Record<string, string> = {
  university: "大学",
  research_institute: "研究機関",
  national_lab: "研究機関",
  other: "その他",
};

export function typeGroupOf(type: string): string {
  return INSTITUTION_TYPE_GROUP[type] ?? "その他";
}

export function cellKey(institutionId: string, policyItemId: string): string {
  return `${institutionId}:${policyItemId}`;
}

export function emptyCounts(): StatusCounts {
  return { established: 0, drafting: 0, notStarted: 0, unknown: 0, total: 0, confirmed: 0, rate: null };
}

export function addStatus(counts: StatusCounts, status: InstitutionPolicyStatus | undefined): void {
  counts.total += 1;
  if (status === "established") counts.established += 1;
  else if (status === "drafting") counts.drafting += 1;
  else if (status === "not_started") counts.notStarted += 1;
  else counts.unknown += 1;
  counts.confirmed = counts.total - counts.unknown;
  counts.rate = counts.confirmed ? counts.established / counts.confirmed : null;
}

export type StatusLookup = (institutionId: string, policyItemId: string) => InstitutionPolicyStatus | undefined;

export function buildStatusLookup(
  cells: SupportProgramCell[],
  extraCells: SupportProgramExtraCell[] = [],
): StatusLookup {
  const map = new Map<string, InstitutionPolicyStatus>();
  for (const cell of cells) map.set(cellKey(cell.institutionId, cell.policyItemId), cell.status);
  for (const cell of extraCells) map.set(cellKey(cell.institutionId, cell.policyItemId), cell.status);
  return (institutionId, policyItemId) => map.get(cellKey(institutionId, policyItemId));
}

/** 列ごとの整備状況。整備率の高い順。 */
export function computeColumnRates(
  columns: SupportProgramColumn[],
  institutions: AnalysisInstitution[],
  lookup: StatusLookup,
): Array<{ column: SupportProgramColumn; counts: StatusCounts }> {
  return columns
    .map((column) => {
      const counts = emptyCounts();
      for (const institution of institutions) addStatus(counts, lookup(institution.institutionId, column.policyItemId));
      return { column, counts };
    })
    .sort((a, b) => (b.counts.rate ?? -1) - (a.counts.rate ?? -1) || b.counts.established - a.counts.established);
}

/** 地域ブロック × 列 の整備状況 (種別で絞れる)。機関が 0 のブロックは落とす。 */
export function computeRegionMatrix(
  columns: SupportProgramColumn[],
  institutions: AnalysisInstitution[],
  lookup: StatusLookup,
): Array<{ block: RegionBlock; institutions: number; counts: Record<string, StatusCounts> }> {
  const rows: Array<{ block: RegionBlock; institutions: number; counts: Record<string, StatusCounts> }> = [];
  for (const block of REGION_BLOCKS) {
    const members = institutions.filter((institution) => regionBlockOf(institution.region) === block);
    if (!members.length) continue;
    const counts: Record<string, StatusCounts> = {};
    for (const column of columns) {
      const c = emptyCounts();
      for (const institution of members) addStatus(c, lookup(institution.institutionId, column.policyItemId));
      counts[column.policyItemId] = c;
    }
    rows.push({ block, institutions: members.length, counts });
  }
  return rows;
}

export type InstitutionScore = {
  institution: AnalysisInstitution;
  counts: StatusCounts;
  /** 整備済みの列 (充実度の中身) */
  establishedColumns: SupportProgramColumn[];
  /** 根拠を見た上で未整備・検討中の列 (AMDの提案余地) */
  gapColumns: SupportProgramColumn[];
  unknownColumns: SupportProgramColumn[];
};

/** 機関ごとの支援充実度とギャップ。充実度 (整備済み列数) の高い順、同点は確認済み数の多い順。 */
export function rankInstitutions(
  columns: SupportProgramColumn[],
  institutions: AnalysisInstitution[],
  lookup: StatusLookup,
): InstitutionScore[] {
  return institutions
    .map((institution) => {
      const counts = emptyCounts();
      const establishedColumns: SupportProgramColumn[] = [];
      const gapColumns: SupportProgramColumn[] = [];
      const unknownColumns: SupportProgramColumn[] = [];
      for (const column of columns) {
        const status = lookup(institution.institutionId, column.policyItemId);
        addStatus(counts, status);
        if (status === "established") establishedColumns.push(column);
        else if (status === "drafting" || status === "not_started") gapColumns.push(column);
        else unknownColumns.push(column);
      }
      return { institution, counts, establishedColumns, gapColumns, unknownColumns };
    })
    .sort(
      (a, b) =>
        b.counts.established - a.counts.established ||
        b.counts.confirmed - a.counts.confirmed ||
        a.institution.name.localeCompare(b.institution.name, "ja"),
    );
}

/** 提案余地の多い順 (根拠を見た上で未整備・検討中の列数)。未確認は余地に数えない。 */
export function rankGaps(scores: InstitutionScore[]): InstitutionScore[] {
  return [...scores]
    .filter((score) => score.gapColumns.length > 0)
    .sort(
      (a, b) =>
        b.gapColumns.length - a.gapColumns.length ||
        b.counts.confirmed - a.counts.confirmed ||
        a.institution.name.localeCompare(b.institution.name, "ja"),
    );
}

/** 属性項目の値を先頭の語彙で束ねる。語彙に無い値は先頭12字で束ねる。 */
export function bucketAttribute(
  item: SupportProgramItem,
  institutions: AnalysisInstitution[],
  valueLookup: (institutionId: string, policyItemId: string) => { status: InstitutionPolicyStatus; value: string | null } | undefined,
  vocab: string[] = [],
): { item: SupportProgramItem; buckets: Array<{ label: string; count: number; examples: string[] }>; unknown: number; confirmed: number } {
  const buckets = new Map<string, { count: number; examples: string[] }>();
  let unknown = 0;
  let confirmed = 0;
  for (const institution of institutions) {
    const cell = valueLookup(institution.institutionId, item.policyItemId);
    if (!cell || cell.status === "unknown" || !cell.value) {
      unknown += 1;
      continue;
    }
    confirmed += 1;
    const value = cell.value.normalize("NFKC").trim();
    const word = vocab.find((candidate) => value.startsWith(candidate)) ?? value.slice(0, 12);
    const bucket = buckets.get(word) ?? { count: 0, examples: [] };
    bucket.count += 1;
    if (bucket.examples.length < 3) bucket.examples.push(institution.name);
    buckets.set(word, bucket);
  }
  return {
    item,
    buckets: [...buckets.entries()]
      .map(([label, bucket]) => ({ label, ...bucket }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja")),
    unknown,
    confirmed,
  };
}

/** 型分布を出す属性項目と、値を束ねる語彙。 */
export const ATTRIBUTE_VOCAB: Record<string, string[]> = {
  post_graduation_limit: ["1年以内", "2年以内", "3年以内", "5年以内", "期限なし", "関連性で判断", "規定なし"],
  renewal_rule: ["更新可（審査あり）", "更新可（届出のみ）", "更新不可・再申請", "期限なし", "規定なし"],
  naming: ["大学発ベンチャー", "大学発スタートアップ", "併記", "独自名称", "称号なし"],
  regulation_owner: ["大学規程", "学校法人規程", "ハイブリッド", "研究機関規程"],
  support_period: ["称号期間と同じ", "支援ごとに別に定める", "個別契約", "規定なし"],
  validity_years: ["1年", "2年", "3年", "4年", "5年", "期限なし", "規定なし"],
  recognition_decider: ["学長", "理事長", "機構長", "理事", "所長", "総長"],
  support_fee: ["無償", "有償", "実費", "一部有償", "規定なし"],
};
