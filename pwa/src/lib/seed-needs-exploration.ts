import type {
  ExplorationSelection,
  NeedDataset,
  NeedResearch,
  SeedNeedsData,
} from "./seed-needs";
export type NodeKind = "market" | "company" | "seed";
export type ExploreNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  unlinked: boolean;
};
export type ExploreEdge = {
  id: string;
  from: string;
  to: string;
  matchId?: string;
};
export const nodeKey = (kind: NodeKind, id: string) => `${kind}:${id}`;
export const selectionField = {
  market: "market_ids",
  company: "company_ids",
  seed: "seed_ids",
} as const;
export const emptySelection = (): ExplorationSelection => ({
  market_ids: [],
  company_ids: [],
  seed_ids: [],
});
export function matchesWords(value: string, query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => value.toLowerCase().includes(word));
}
export function buildExploration(
  data: SeedNeedsData,
  dataset: NeedDataset,
  extraSeedIds: string[] = [],
) {
  const markets = data.markets.filter((x) => x.dataset === dataset);
  const companies = data.companies.filter((x) => x.dataset === dataset);
  const matches = data.matches.filter((x) => x.dataset === dataset);
  const research = (data.research ?? []).filter((x) => x.dataset === dataset);
  const seedIds = new Set([
    ...matches.map((x) => x.seed_id),
    ...research.flatMap((x) => x.seed_ids),
    ...extraSeedIds,
  ]);
  const seeds = data.seeds.filter((x) => seedIds.has(x.id));
  const nodes: ExploreNode[] = [
    ...markets.map((m) => ({
      id: m.id,
      kind: "market" as const,
      title: m.title,
      subtitle: m.target_user,
      unlinked: !companies.some((c) => c.market_need_id === m.id),
    })),
    ...companies.map((c) => ({
      id: c.id,
      kind: "company" as const,
      title: c.title,
      subtitle: c.company_name.replace("仮の企業像｜", ""),
      unlinked: !matches.some((m) => m.company_need_id === c.id),
    })),
    ...seeds.map((s) => ({
      id: s.id,
      kind: "seed" as const,
      title: s.title,
      subtitle: [s.org_name, s.researcher_name].filter(Boolean).join("・"),
      unlinked: !matches.some((m) => m.seed_id === s.id),
    })),
  ];
  const edges: ExploreEdge[] = [
    ...companies
      .filter(
        (c) =>
          c.market_need_id && markets.some((m) => m.id === c.market_need_id),
      )
      .map((c) => ({
        id: `market-${c.id}`,
        from: nodeKey("market", c.market_need_id!),
        to: nodeKey("company", c.id),
      })),
    ...matches.map((m) => ({
      id: m.id,
      from: nodeKey("company", m.company_need_id),
      to: nodeKey("seed", m.seed_id),
      matchId: m.id,
    })),
  ];
  return { markets, companies, matches, seeds, research, nodes, edges };
}
/** 選んだ要素の経路だけ。市場へ辿った後に無関係な兄弟企業へ拡張しない。 */
export function traceExploration(
  data: SeedNeedsData,
  dataset: NeedDataset,
  kind: NodeKind,
  id: string,
): Set<string> {
  const { companies, matches } = buildExploration(data, dataset);
  const companyIds = new Set(
    kind === "market"
      ? companies.filter((c) => c.market_need_id === id).map((c) => c.id)
      : kind === "company"
        ? [id]
        : matches.filter((m) => m.seed_id === id).map((m) => m.company_need_id),
  );
  const keys = new Set([nodeKey(kind, id)]);
  for (const c of companies.filter((c) => companyIds.has(c.id))) {
    keys.add(nodeKey("company", c.id));
    if (c.market_need_id) keys.add(nodeKey("market", c.market_need_id));
  }
  for (const m of matches.filter((m) => companyIds.has(m.company_need_id))) {
    if (kind !== "seed" || m.seed_id === id)
      keys.add(nodeKey("seed", m.seed_id));
  }
  return keys;
}
export function researchKeys(r: ExplorationSelection) {
  return new Set([
    ...r.market_ids.map((id) => nodeKey("market", id)),
    ...r.company_ids.map((id) => nodeKey("company", id)),
    ...r.seed_ids.map((id) => nodeKey("seed", id)),
  ]);
}
/** 共同研究の束と個別のマッチを混同しない。共通構想があっても適合度は計算しない。 */
export function researchAtPair(
  research: NeedResearch[],
  companyId: string,
  seedId: string,
) {
  return research.filter(
    (r) => r.company_ids.includes(companyId) && r.seed_ids.includes(seedId),
  );
}
export function validateResearch(
  selection: ExplorationSelection,
  kind: NeedResearch["kind"],
): string | null {
  if (!selection.market_ids.length && !selection.company_ids.length)
    return "市場または企業ニーズを1件以上選択。";
  if (kind === "application" && !selection.seed_ids.length)
    return "応用するシーズを選択。";
  if (kind === "combination" && new Set(selection.seed_ids).size < 2)
    return "組み合わせるシーズを2件以上選択。";
  return null;
}
