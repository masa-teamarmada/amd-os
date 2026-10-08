import { createClient } from '@/lib/supabase/client';
import { loadReferenceData, invalidateReferenceData } from '@/lib/reference-data-cache';
import { NEED_TABLE, type CompanyNeed, type MarketNeed, type NeedKind, type NeedSeed, type SeedNeedMatch, type SeedNeedsData } from './seed-needs';

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
  const [markets, companies, matches, seeds] = await Promise.all([
    allRows<MarketNeed>('market_needs'), allRows<CompanyNeed>('company_needs'), allRows<SeedNeedMatch>('seed_need_matches'),
    loadReferenceData(`seed-needs:seeds:${user.id}`, () => allRows<NeedSeed>('seeds', 'id,title,org_name,researcher_name,institution_id,seed_no'), { force: forceSeeds }),
  ]);
  return { markets, companies, matches, seeds };
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
