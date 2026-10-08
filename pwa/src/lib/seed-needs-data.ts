import { createClient } from '@/lib/supabase/client';
import { loadReferenceData, invalidateReferenceData } from '@/lib/reference-data-cache';
import { NEED_TABLE, type CompanyNeed, type MarketNeed, type NeedKind, type NeedSeed, type SeedNeedMatch, type SeedNeedsData } from './seed-needs';
import type { NeedResearch } from './seed-needs';

/** 直接RLSを通す。参照シーズは認証ユーザー単位の5分キャッシュ、編集中のニーズは都度読取。 */
async function allRows<T>(table: string, columns = '*'): Promise<T[]> {
  const result: T[] = [];
  const client = createClient();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select(columns).order('id').range(offset, offset + 499);
    if (error) throw new Error(`${table} の取得に失敗: ${error.message}`);
    result.push(...(data as unknown as T[]));
    if (data.length < 500) return result;
  }
}

export async function fetchSeedNeeds(forceSeeds = false): Promise<SeedNeedsData> {
  const { data: { user }, error } = await createClient().auth.getUser();
  if (error || !user) throw new Error('ログインを確認できないため、再ログイン後に更新。');
  const [markets, companies, matches, seeds, researchRaw] = await Promise.all([
    allRows<MarketNeed>('market_needs'), allRows<CompanyNeed>('company_needs'), allRows<SeedNeedMatch>('seed_need_matches'),
    loadReferenceData(`seed-needs:seeds:${user.id}`, () => allRows<NeedSeed>('seeds', 'id,title,org_name,researcher_name,institution_id,seed_no'), { force: forceSeeds }),
    allRows<NeedResearch & { markets: { market_need_id: string }[]; companies: { company_need_id: string }[]; seeds: { seed_id: string }[] }>('seed_need_research', '*,markets:seed_need_research_markets(market_need_id),companies:seed_need_research_companies(company_need_id),seeds:seed_need_research_seeds(seed_id)'),
  ]);
  const research = researchRaw.map(({ markets, companies, seeds, ...r }) => ({ ...r, market_ids: markets.map(x => x.market_need_id), company_ids: companies.map(x => x.company_need_id), seed_ids: seeds.map(x => x.seed_id) }));
  return { markets, companies, matches, seeds, research };
}

export async function saveNeedResearch(record: Omit<NeedResearch, 'created_at' | 'updated_at'>, original?: NeedResearch): Promise<NeedResearch> {
  const { market_ids, company_ids, seed_ids, ...fields } = record;
  const { data, error } = await createClient().rpc('save_seed_need_research', {
    p_record: fields, p_market_ids: market_ids, p_company_ids: company_ids, p_seed_ids: seed_ids,
    p_expected_updated_at: original?.updated_at ?? null,
  });
  if (error) throw new Error(`保存できない: ${error.message}`);
  if (!data?.id || !data?.updated_at) throw new Error('保存結果を確認できない。更新して確認。');
  return data as NeedResearch;
}

export async function saveNeedRecord(kind: NeedKind, payload: Record<string, unknown>, original?: { id: string; updated_at: string }) {
  const client = createClient();
  const query = original
    ? client.from(NEED_TABLE[kind]).update(payload).eq('id', original.id).eq('updated_at', original.updated_at)
    : client.from(NEED_TABLE[kind]).insert(payload);
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new Error(error.code === '23505' ? 'この企業ニーズとシーズは登録済み。既存の行を編集。' : `保存できない: ${error.message}`);
  if (!data) throw new Error('ほかの編集が先に保存されたか、編集権限がない。一覧を更新して確認。');
  invalidateReferenceData('seed-needs:');
  return data as MarketNeed | CompanyNeed | SeedNeedMatch;
}
