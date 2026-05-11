/**
 * ASPI Critical Technology Tracker 8 domains の型 + 定数。
 *
 * 正本: pwa/design/aspi_lanes.md
 * 形式: PJ.lanes は [{"domain": "<id>", "weight": 0-1}]、合計 = 1.0
 *
 * このモジュールは server / client の両方から import できるよう、
 * server-only な依存 (next/headers / Supabase server client) を持たない。
 */

export type AspiDomainId =
  | "advanced_ict"
  | "advanced_materials_manufacturing"
  | "ai_technologies"
  | "biotechnology"
  | "defence_space_robotics_transport"
  | "energy_environment"
  | "quantum"
  | "sensing_timing_navigation";

export const ASPI_DOMAIN_IDS: readonly AspiDomainId[] = [
  "advanced_ict",
  "advanced_materials_manufacturing",
  "ai_technologies",
  "biotechnology",
  "defence_space_robotics_transport",
  "energy_environment",
  "quantum",
  "sensing_timing_navigation",
];

export const ASPI_DOMAIN_LABEL_JP: Record<AspiDomainId, string> = {
  advanced_ict: "通信・ICT",
  advanced_materials_manufacturing: "先端材料・製造",
  ai_technologies: "AI",
  biotechnology: "バイオ・医療",
  defence_space_robotics_transport: "防衛・宇宙・ロボ",
  energy_environment: "エネルギー・環境",
  quantum: "量子",
  sensing_timing_navigation: "センシング",
};

export const ASPI_DOMAIN_SHORT_LABEL: Record<AspiDomainId, string> = {
  advanced_ict: "ICT",
  advanced_materials_manufacturing: "材料",
  ai_technologies: "AI",
  biotechnology: "バイオ",
  defence_space_robotics_transport: "防衛/宇宙/ロボ",
  energy_environment: "エネ/環境",
  quantum: "量子",
  sensing_timing_navigation: "センシング",
};

export interface LaneWeight {
  domain: AspiDomainId;
  weight: number; // 0-1、配列内合計 = 1.0
}

/**
 * 旧 5 lane (venture-map-data.ts の LegacyLaneId) → ASPI 8 domain への 1:1 mapping。
 * 正本: pwa/design/aspi_lanes.md (まさ承認 2026-05-11)。
 * gx_energy + gx_circular は共に energy_environment に統合 (ASPI に circular 独立 domain なし)。
 */
export const LEGACY_LANE_TO_ASPI: Record<string, AspiDomainId> = {
  gx_energy: "energy_environment",
  gx_circular: "energy_environment",
  materials: "advanced_materials_manufacturing",
  life: "biotechnology",
  robo: "defence_space_robotics_transport",
};

/** ASPI 8 domain → 旧 5 lane (互換層、cron が旧 lane で動いてる箇所用)。 */
export const ASPI_TO_LEGACY_LANE: Record<AspiDomainId, string> = {
  advanced_ict: "robo", // 旧分類で robo に押し込まれてた、互換のため robo に return
  advanced_materials_manufacturing: "materials",
  ai_technologies: "robo",
  biotechnology: "life",
  defence_space_robotics_transport: "robo",
  energy_environment: "gx_energy", // gx_circular とのどちらに戻すかは曖昧、default を gx_energy に
  quantum: "robo",
  sensing_timing_navigation: "robo",
};

/** lanes JSONB から weight 最大の domain を返す (旧 single lane 互換)。 */
export function dominantDomain(lanes: LaneWeight[] | null | undefined): AspiDomainId | null {
  if (!lanes || lanes.length === 0) return null;
  return lanes.reduce((a, b) => (b.weight > a.weight ? b : a)).domain;
}

/** PJ の特定 domain への寄与重み (lanes 内で当該 domain の weight、なければ 0)。 */
export function weightForDomain(lanes: LaneWeight[] | null | undefined, domain: AspiDomainId): number {
  if (!lanes) return 0;
  for (const lw of lanes) if (lw.domain === domain) return lw.weight;
  return 0;
}

/**
 * OpenAlex 検索クエリ (ASPI 8 domain × 各 domain 内の代表 tech から構成)。
 * 検索意図は「該当 domain の論文を広く拾う」。
 * 64+10 tech 全部の OR を入れると noise も多くなるので、各 domain で 4-6 個の主要 tech に絞った。
 * papers-quarterly-ingest cron (weekly) で OpenAlex 経由で fetch する。
 */
export const OPENALEX_QUERY_BY_DOMAIN: Record<AspiDomainId, string> = {
  advanced_ict:
    '"high performance computing" OR "distributed ledger" OR "optical communication" OR "radiofrequency communication" OR "cyber security" OR "cloud computing" OR "edge computing"',
  advanced_materials_manufacturing:
    '"nanomaterial" OR "advanced materials" OR "additive manufacturing" OR "smart materials" OR "novel metamaterials" OR "critical minerals" OR "wide bandgap semiconductor" OR "advanced composite"',
  ai_technologies:
    '"machine learning" OR "natural language processing" OR "deep learning" OR "computer vision" OR "generative AI" OR "neural network" OR "AI algorithm"',
  biotechnology:
    '"synthetic biology" OR "genetic engineering" OR "drug discovery" OR "gene therapy" OR "regenerative medicine" OR "vaccine" OR "genomic sequencing"',
  defence_space_robotics_transport:
    '"autonomous robot" OR "advanced robotics" OR "drone swarm" OR "aircraft engine" OR "space launch" OR "small satellite" OR "hypersonic"',
  energy_environment:
    '"hydrogen energy" OR "renewable energy" OR "solar cell" OR "next generation battery" OR "fusion energy" OR "circular economy" OR "carbon capture" OR "supercapacitor" OR "biofuel"',
  quantum:
    '"quantum computing" OR "quantum communication" OR "quantum sensor" OR "post-quantum cryptography"',
  sensing_timing_navigation:
    '"photonic sensor" OR "radar system" OR "satellite positioning" OR "atomic clock" OR "hyperspectral imaging" OR "inertial navigation"',
};

/**
 * KAKEN (科研費) 検索キーワード (日本語、ASPI 8 domain × 主要 tech)。
 * 各 domain で 3-5 個の日本語キーワードを OR 結合する。
 * kaken-ingest cron で `https://kaken.nii.ac.jp/api/v1/search?qg=` 等で叩く。
 */
export const KAKEN_KEYWORDS_BY_DOMAIN: Record<AspiDomainId, string[]> = {
  advanced_ict: ["高性能計算", "暗号", "光通信", "ブロックチェーン", "エッジコンピューティング"],
  advanced_materials_manufacturing: ["ナノ材料", "先端材料", "積層造形", "メタマテリアル", "希土類", "超電導", "断熱"],
  ai_technologies: ["機械学習", "自然言語処理", "深層学習", "コンピュータビジョン", "生成AI"],
  biotechnology: ["合成生物学", "遺伝子治療", "再生医療", "創薬", "ワクチン", "ゲノム"],
  defence_space_robotics_transport: ["自律ロボット", "ドローン", "小型衛星", "ロケット", "極超音速"],
  energy_environment: ["水素エネルギー", "再生可能エネルギー", "太陽電池", "次世代電池", "核融合", "サーキュラーエコノミー", "炭素回収"],
  quantum: ["量子計算", "量子通信", "量子センサー", "ポスト量子暗号"],
  sensing_timing_navigation: ["光センサ", "レーダ", "原子時計", "衛星測位", "ハイパースペクトル"],
};

/**
 * NEDO / JST / AMED 等の公的助成 採択検索キーワード (日本語、ASPI 8 domain × 主要 tech)。
 * grant-ingest cron で各機関の採択ページ scrape + LLM 抽出時の lane 判定キーに使う。
 */
export const GRANT_KEYWORDS_BY_DOMAIN: Record<AspiDomainId, string[]> = {
  advanced_ict: ["情報通信", "サイバーセキュリティ", "次世代計算"],
  advanced_materials_manufacturing: ["先進材料", "次世代製造", "ナノテクノロジー", "希少金属"],
  ai_technologies: ["AI", "人工知能", "機械学習"],
  biotechnology: ["バイオ", "創薬", "再生医療", "医療"],
  defence_space_robotics_transport: ["宇宙", "ロボット", "モビリティ"],
  energy_environment: ["GX", "脱炭素", "水素", "再エネ", "蓄電池", "資源循環", "環境"],
  quantum: ["量子"],
  sensing_timing_navigation: ["センシング", "計測"],
};

