import type {
  CompanyNeed,
  MarketNeed,
  MarketSeedLink,
  MarketSize,
  NeedDataset,
  NeedResearch,
  NeedSeed,
  NeedSource,
  SeedNeedMatch,
  SeedNeedsData,
} from "./seed-needs";

export type MarketSeedCandidate = {
  seed: NeedSeed;
  direct?: MarketSeedLink;
  matches: SeedNeedMatch[];
  research: NeedResearch[];
};
export type MarketNeedRow = {
  market: MarketNeed;
  companies: CompanyNeed[];
  seeds: MarketSeedCandidate[];
  research: NeedResearch[];
};

/** 一行は市場一件。直接/企業経由/構想内の参照を重複排除し、由来を保持する。 */
export function marketNeedRows(
  data: SeedNeedsData,
  dataset: NeedDataset,
): MarketNeedRow[] {
  const rows = data.markets
    .filter((m) => m.dataset === dataset)
    .map((market) => ({
      market,
      companies: [] as CompanyNeed[],
      seeds: [] as MarketSeedCandidate[],
      research: [] as NeedResearch[],
    }));
  const byMarket = new Map(rows.map((r) => [r.market.id, r]));
  const byCompany = new Map<string, MarketNeedRow>();
  const seeds = new Map(data.seeds.map((s) => [s.id, s]));
  const candidates = new Map(
    rows.map((r) => [r.market.id, new Map<string, MarketSeedCandidate>()]),
  );
  const candidate = (row: MarketNeedRow, seedId: string) => {
    const seed = seeds.get(seedId);
    if (!seed) return;
    const items = candidates.get(row.market.id)!;
    if (!items.has(seedId)) {
      const item = { seed, matches: [], research: [] };
      items.set(seedId, item);
      row.seeds.push(item);
    }
    return items.get(seedId)!;
  };
  for (const company of data.companies) {
    const row = byMarket.get(company.market_need_id ?? "");
    if (row && company.dataset === dataset) {
      row.companies.push(company);
      byCompany.set(company.id, row);
    }
  }
  for (const match of data.matches) {
    const row = byCompany.get(match.company_need_id);
    if (row && match.dataset === dataset)
      candidate(row, match.seed_id)?.matches.push(match);
  }
  for (const link of data.marketSeedLinks ?? []) {
    const row = byMarket.get(link.market_need_id);
    if (row && link.dataset === dataset) {
      const item = candidate(row, link.seed_id);
      if (item) item.direct = link;
    }
  }
  for (const research of data.research ?? []) {
    if (research.dataset !== dataset) continue;
    const ids = new Set([
      ...research.market_ids,
      ...research.company_ids.flatMap((id) =>
        byCompany.has(id) ? [byCompany.get(id)!.market.id] : [],
      ),
    ]);
    for (const id of ids) {
      const row = byMarket.get(id);
      if (!row) continue;
      row.research.push(research);
      for (const seedId of research.seed_ids)
        candidate(row, seedId)?.research.push(research);
    }
  }
  return rows;
}

export function marketSizeFor(
  market: MarketNeed,
  scope: MarketSize["scope"],
  year: number,
) {
  return market.market_sizes?.find((s) => s.scope === scope && s.year === year);
}

/** 地域と年を揃え、範囲推計の下限で順位づけ。同額は同順位。未評価をゼロに変換しない。 */
export function rankMarketSizes(
  rows: MarketNeedRow[],
  scope: MarketSize["scope"],
  year: number,
) {
  const values = rows
    .flatMap((r) => {
      const size = marketSizeFor(r.market, scope, year);
      return size ? [{ id: r.market.id, value: size.min_oku }] : [];
    })
    .sort((a, b) => b.value - a.value);
  const ranks = new Map<string, number>();
  let rank = 0;
  values.forEach((x, i) => {
    if (i === 0 || x.value !== values[i - 1].value) rank = i + 1;
    ranks.set(x.id, rank);
  });
  return ranks;
}

export function marketSizeText(size: MarketSize) {
  const number = (n: number) =>
    n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  return `${number(size.min_oku)}${size.max_oku === size.min_oku ? "" : `〜${number(size.max_oku)}`} 億円/年`;
}

export function searchMarketRows(rows: MarketNeedRow[], query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const text = [
      row.market.title,
      row.market.target_user,
      row.market.problem,
      row.market.evidence_note,
      ...(row.market.sources ?? []).flatMap((s) => [
        s.title,
        s.publisher,
        s.note,
      ]),
      ...row.companies.flatMap((c) => [
        c.title,
        c.company_name,
        c.business_area,
        c.strengths,
      ]),
      ...row.seeds.flatMap((s) => [
        s.seed.title,
        s.seed.org_name,
        s.seed.researcher_name,
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function validateNeedSources(sources: NeedSource[]) {
  if (sources.length > 50) return "出典は50件以内で記録。";
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source.title.trim() || !source.note.trim())
      return `出典${i + 1}の資料名と「何を裏付けるか」を記入。`;
    if (source.url && !/^https?:\/\/\S+$/.test(source.url))
      return `出典${i + 1}のURLは http または https で記入。`;
  }
  return "";
}

export function validateMarketAssessment(
  market: Pick<
    MarketNeed,
    | "sources"
    | "market_sizes"
    | "confidence_rank"
    | "confidence_note"
    | "dataset"
  >,
) {
  const sources = market.sources ?? [];
  const sizes = market.market_sizes ?? [];
  const sourceError = validateNeedSources(sources);
  if (sourceError) return sourceError;
  const confidence = market.confidence_rank ?? "unassessed";
  if (confidence !== "unassessed" && !market.confidence_note?.trim())
    return "情報の確度を評価する理由を記入。";
  if (["a", "b"].includes(confidence) && !sources.length)
    return "確度A・Bには出典を登録。";
  if (market.dataset === "example" && ["a", "b"].includes(confidence))
    return "議論用の記入例は「仮説中心」または「未評価」で保存。";
  const keys = new Set<string>();
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const key = `${size.scope}:${size.year}`;
    if (!Number.isInteger(size.year) || size.year < 2000 || size.year > 2100)
      return `市場規模${i + 1}の対象年を2000〜2100年で記入。`;
    if (
      !Number.isFinite(size.min_oku) ||
      !Number.isFinite(size.max_oku) ||
      size.min_oku < 0 ||
      size.max_oku < size.min_oku ||
      size.max_oku > 100000000
    )
      return `市場規模${i + 1}の金額は0以上、上限は下限以上で記入。`;
    if (!size.definition.trim() || !size.basis.trim())
      return `市場規模${i + 1}の対象範囲と算定根拠を記入。`;
    if (!sources.some((s) => s.id === size.source_id))
      return `市場規模${i + 1}の出典を選択。出典を外す場合は関連する推計も見直す。`;
    if (keys.has(key))
      return "同じ地域・年の推計は1件にまとめ、異なる推計は幅と根拠に記録。";
    keys.add(key);
  }
  return "";
}
