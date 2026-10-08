import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinSeedNeeds, filterNeedRows, type SeedNeedsData } from '../src/lib/seed-needs.ts';

const data = {
  markets: [{ id: 'market', dataset: 'working', title: '保守' }, { id: 'unlinked-market', dataset: 'working', title: '未接続市場' }, { id: 'example', dataset: 'example', title: '記入例' }],
  companies: [{ id: 'company-a', dataset: 'working', market_need_id: 'market', title: 'センサー', strengths: '通信' }, { id: 'company-b', dataset: 'working', market_need_id: 'market', title: '保全' }, { id: 'company-c', dataset: 'working', title: '市場未接続' }],
  matches: [{ id: 'a', dataset: 'working', company_need_id: 'company-a', seed_id: 'seed' }, { id: 'b', dataset: 'working', company_need_id: 'company-a', seed_id: 'seed-2' }, { id: 'c', dataset: 'working', company_need_id: 'company-b', seed_id: 'seed' }],
  seeds: [{ id: 'seed', title: '熱電', institution_id: 'one' }, { id: 'seed-2', title: '発電', institution_id: 'two' }],
} as SeedNeedsData;
const rows = joinSeedNeeds(data, 'working');
assert.equal(rows.length, 5, '未接続市場・未接続企業も保持');
assert.equal(rows.filter(x => x.seed?.id === 'seed').length, 2, '同一シーズの別企業ニーズを保持');
assert.equal(rows.filter(x => x.company?.id === 'company-a').length, 2, '一つの企業ニーズに複数シーズ');
assert.equal(rows.filter(x => x.market?.id === 'market').length, 3, '市場と企業は一対多');
assert.equal(filterNeedRows(rows, '', true, '').length, 2, '未接続絞り込み');
assert.equal(filterNeedRows(rows, '通信 熱電', false, '').length, 1, '複数語で跨列検索');
assert.equal(filterNeedRows(rows, '', false, 'two').length, 1, '機関IDで絞り込み');
assert.equal(joinSeedNeeds(data, 'example').length, 1, '実データと記入例を混ぜない');
assert.equal(joinSeedNeeds(data, 'example')[0].company, undefined);
const loader = readFileSync(new URL('../src/lib/seed-needs-data.ts', import.meta.url), 'utf8');
assert.match(loader, /order\('id'\)\.range\(offset, offset \+ 499\)/, '安定順で全ページを読む');
assert.match(loader, /\.eq\('updated_at', original.updated_at\)/, '同時編集を上書きしない');
assert.match(loader, /loadReferenceData\(`seed-needs:seeds:\$\{user.id\}/, '参照シーズキャッシュはユーザー別');
assert.doesNotMatch(loader, /SUPABASE_SERVICE_ROLE_KEY/);
console.log('seed-needs: joins, filters, dataset separation, pagination and write conflict checks passed');
