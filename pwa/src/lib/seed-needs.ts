export type NeedDataset = 'working' | 'example';
export type EvidenceStatus = 'hypothesis' | 'signal' | 'confirmed';
export type MatchStatus = 'hypothesis' | 'hearing' | 'research' | 'poc' | 'hold';
export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = { hypothesis: '仮説', signal: '手がかりあり', confirmed: 'ヒアリング確認済' };
export const MATCH_LABEL: Record<MatchStatus, string> = { hypothesis: '組み合わせ仮説', hearing: 'ヒアリング', research: '追加研究', poc: 'PoC', hold: '保留' };

export type NeedBase = { id: string; dataset: NeedDataset; updated_at: string; created_at: string };
export type NeedEvidence = { evidence_status: EvidenceStatus; evidence_note: string; source_url: string; observed_on: string | null };
export type MarketNeed = NeedBase & NeedEvidence & {
  title: string; target_user: string; problem: string; current_solution: string; desired_outcome: string;
};
export type CompanyNeed = NeedBase & NeedEvidence & {
  market_need_id: string | null; title: string; company_name: string; business_area: string;
  strengths: string; strategic_intent: string; missing_capability: string; constraints: string;
};
export type SeedNeedMatch = NeedBase & {
  company_need_id: string; seed_id: string; rationale: string; research_question: string;
  experiment: string; success_criteria: string; funding_note: string; next_action: string;
  owner_name: string; due_on: string | null; status: MatchStatus;
};
export type NeedSeed = { id: string; title: string; org_name: string | null; researcher_name: string | null; institution_id: string | null; seed_no: number | null };
export type ResearchKind = 'application' | 'combination' | 'new_seed';
export const RESEARCH_LABEL: Record<ResearchKind, string> = { application: '既存技術の応用', combination: 'シーズの組み合わせ', new_seed: '新しいシーズの創出' };
export type NeedResearch = NeedBase & {
  title: string; kind: ResearchKind; gap: string; hypothesis: string; experiment: string;
  success_criteria: string; next_action: string;
  market_ids: string[]; company_ids: string[]; seed_ids: string[];
};
export type ExplorationSelection = { market_ids: string[]; company_ids: string[]; seed_ids: string[] };
export type SeedNeedsData = { markets: MarketNeed[]; companies: CompanyNeed[]; matches: SeedNeedMatch[]; seeds: NeedSeed[]; research?: NeedResearch[] };
export type NeedRow = { key: string; market?: MarketNeed; company?: CompanyNeed; match?: SeedNeedMatch; seed?: NeedSeed };
export type NeedKind = 'market' | 'company' | 'match';
export const NEED_TABLE = { market: 'market_needs', company: 'company_needs', match: 'seed_need_matches' } as const;

/** 左結合。未接続の市場・企業ニーズも残し、同じシーズの別用途を潰さない。 */
export function joinSeedNeeds(data: SeedNeedsData, dataset: NeedDataset): NeedRow[] {
  const markets = data.markets.filter(x => x.dataset === dataset);
  const companies = data.companies.filter(x => x.dataset === dataset);
  const marketsById = new Map(markets.map(x => [x.id, x]));
  const seedsById = new Map(data.seeds.map(x => [x.id, x]));
  const matchesByCompany = new Map<string, SeedNeedMatch[]>();
  for (const match of data.matches.filter(x => x.dataset === dataset)) {
    matchesByCompany.set(match.company_need_id, [...(matchesByCompany.get(match.company_need_id) ?? []), match]);
  }
  const rows: NeedRow[] = [];
  for (const company of companies) {
    const market = marketsById.get(company.market_need_id ?? '');
    const matches = matchesByCompany.get(company.id) ?? [];
    if (!matches.length) rows.push({ key: `company-${company.id}`, market, company });
    for (const match of matches) rows.push({ key: match.id, market, company, match, seed: seedsById.get(match.seed_id) });
  }
  const linkedMarkets = new Set(companies.map(x => x.market_need_id));
  for (const market of markets) if (!linkedMarkets.has(market.id)) rows.push({ key: `market-${market.id}`, market });
  return rows.sort((a,b) => (a.market?.title ?? '未接続').localeCompare(b.market?.title ?? '未接続', 'ja') || (a.company?.company_name ?? '').localeCompare(b.company?.company_name ?? '', 'ja') || a.key.localeCompare(b.key));
}

export function filterNeedRows(rows: NeedRow[], query: string, unlinked: boolean, institution: string): NeedRow[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (unlinked && row.match) return false;
    if (institution && row.seed?.institution_id !== institution) return false;
    const text = [row.market, row.company, row.match, row.seed].flatMap(x => x ? Object.values(x) : []).join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}
