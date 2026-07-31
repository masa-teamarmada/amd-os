// KUTE (PJ cockpit) 向け公開面の純粋ロジック — I/O (Supabase client) を持たないため
// node --experimental-strip-types から直接 import してテストできる。
// data-access 層 (seeds-data.ts) はこのファイルを re-export する。

import type { SeedPublicView } from "../types/seeds.ts";
import { isCurrentProjectStatus } from "./institution-projects.ts";

/** AMDシーズPJの表示優先度: 稼働中=0、履歴=1、PJなし=2。シーズ自体のstatusとは独立。 */
export function seedProjectPriority(seed: SeedPublicView): 0 | 1 | 2 {
  const links = seed.project_links ?? [];
  if (links.some((link) => isCurrentProjectStatus(link.project_status))) return 0;
  if (links.length > 0) return 1;
  return 2;
}

// 旧 100点ルーブリック (kute_score_* 8列 + computeKuteSeedScore) は
// migration 187 で全国共通の seed_sps_assessments (SPS = M・P・R・S) に置き換えた。
// スコア計算は pwa/src/lib/seed-sps.ts の calculateSeedSpsScore に一本化。

export const SEED_COMMERCIALIZATION_TYPE_LABEL: Record<string, string> = {
  large_startup: "大型スタートアップ",
  small_business_1b_yen: "10億円級スモールビジネス",
  license: "ライセンス",
  jv_ma: "JV/M&A",
  joint_research_poc: "共同研究/PoC",
};

export const SEED_COMMERCIALIZATION_TYPE_ORDER: string[] = [
  "large_startup",
  "small_business_1b_yen",
  "license",
  "jv_ma",
  "joint_research_poc",
];

export const SEED_KUTE_MARKET_CONFIDENCE_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

// 比較テーブルの列ソート・研究者グルーピングも、UI (CockpitKuteSeeds.tsx) から
// 切り離した純粋関数としてここに置く。研究者名でのグルーピングは特定の研究者名を
// ハードコードせず、任意の researcher_name の一致でグルーピングする汎用ロジック。

export type SeedComparisonSortKey = "sps" | "m" | "p" | "r" | "s";

/** 比較テーブルの列ソート値を取り出す。SPS未計算行は null (常に末尾扱い) */
export function seedComparisonSortValue(seed: SeedPublicView, key: SeedComparisonSortKey): number | null {
  const sps = seed.latest_sps;
  if (!sps || sps.status !== "ready") return null;
  if (key === "sps") return sps.score;
  if (!sps.components) return null;
  if (key === "m") return sps.components.macro;
  if (key === "p") return sps.components.potential;
  if (key === "r") return sps.components.reach;
  return sps.components.survival;
}

/** null は常に末尾扱い (dir に関わらず)。dir=1 は昇順、dir=-1 は降順 */
export function compareSeedSortValues(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

export interface SeedResearcherGroup {
  /** 同一機関 + 正規化した researcher_name ごとの一意キー。研究者未登録行はシーズIDで一意化する */
  key: string;
  researcherName: string | null;
  researcherTitle: string | null;
  seeds: SeedPublicView[];
}

function normalizeResearcherIdentity(value: string | null): string | null {
  const normalized = value?.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return normalized || null;
}

/**
 * 同一 org_name + 正規化した researcher_name でシーズをグルーピングする。
 * Unicode 表記を NFKC に揃え、連続する空白を1個へ畳むことで、入力時の軽微な表記差を吸収する。
 * researcher_name が null/空文字の行は、他の未登録行と決して同一グループにまとめず、
 * シーズ単位でそれぞれ独立したグループにする。特定の研究者名のハードコードは行わない。
 */
export function groupSeedsByResearcher(seeds: SeedPublicView[]): SeedResearcherGroup[] {
  const groups = new Map<string, SeedResearcherGroup>();
  const order: string[] = [];
  for (const seed of seeds) {
    const name = normalizeResearcherIdentity(seed.researcher_name);
    const orgName = normalizeResearcherIdentity(seed.org_name);
    const key = name ? `researcher:${JSON.stringify([orgName, name])}` : `seed:${seed.id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        researcherName: name,
        researcherTitle: name ? normalizeResearcherIdentity(seed.researcher_title) : null,
        seeds: [],
      };
      groups.set(key, group);
      order.push(key);
    } else if (!group.researcherTitle && seed.researcher_title) {
      group.researcherTitle = normalizeResearcherIdentity(seed.researcher_title);
    }
    group.seeds.push(seed);
  }
  return order.map((k) => groups.get(k) as SeedResearcherGroup);
}

/**
 * 研究者グループを維持したまま列ソートを適用する。各グループ内の行を sortValue/dir で
 * 並べ替えた上で、グループ自体もグループ内先頭行の値を代表値としてソートするため、
 * 列ソートが研究者グループを分断することはない。
 */
export function sortSeedGroups(
  groups: SeedResearcherGroup[],
  sortValue: (seed: SeedPublicView) => number | null,
  dir: 1 | -1
): SeedResearcherGroup[] {
  const sorted = groups.map((group) => ({
    ...group,
    seeds: [...group.seeds].sort((a, b) => compareSeedSortValues(sortValue(a), sortValue(b), dir)),
  }));
  sorted.sort((a, b) => {
    const av = a.seeds.length > 0 ? sortValue(a.seeds[0]) : null;
    const bv = b.seeds.length > 0 ? sortValue(b.seeds[0]) : null;
    return compareSeedSortValues(av, bv, dir);
  });
  return sorted;
}

/** 同一機関 + researcher_name で重複を除いた、登録済み研究者数を数える */
export function countDistinctResearchers(seeds: SeedPublicView[]): number {
  const people = new Set<string>();
  for (const seed of seeds) {
    const name = normalizeResearcherIdentity(seed.researcher_name);
    const orgName = normalizeResearcherIdentity(seed.org_name);
    if (name) people.add(JSON.stringify([orgName, name]));
  }
  return people.size;
}

export interface SeedInstitutionGroup {
  /** org_name をキーにした機関単位のグループ */
  key: string;
  orgName: string;
  seeds: SeedPublicView[];
  researcherGroups: SeedResearcherGroup[];
}

/**
 * 全機関横断の /seeds 比較表向け: org_name で機関グループを作り、各機関の中では
 * 既存の groupSeedsByResearcher で研究者グループを作る。特定の機関名のハードコードは行わない。
 */
export function groupSeedsByInstitution(seeds: SeedPublicView[]): SeedInstitutionGroup[] {
  const byOrg = new Map<string, SeedPublicView[]>();
  const order: string[] = [];
  for (const seed of seeds) {
    const orgName = seed.org_name || "機関未登録";
    if (!byOrg.has(orgName)) {
      byOrg.set(orgName, []);
      order.push(orgName);
    }
    byOrg.get(orgName)!.push(seed);
  }
  return order.map((orgName) => {
    const orgSeeds = byOrg.get(orgName)!;
    return {
      key: orgName,
      orgName,
      seeds: orgSeeds,
      researcherGroups: groupSeedsByResearcher(orgSeeds),
    };
  });
}

/** 登録済みの一意な機関数 (org_name ベース) */
export function countDistinctInstitutions(seeds: SeedPublicView[]): number {
  return new Set(seeds.map((s) => s.org_name).filter((v): v is string => !!v)).size;
}
