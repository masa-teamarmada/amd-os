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
assert.match(loader, /order\(["']id["']\)\s*\.range\(offset, offset \+ 499\)/, '安定順で全ページを読む');
assert.match(loader, /\.eq\(["']updated_at["'], original.updated_at\)/, '同時編集を上書きしない');
assert.match(loader, /loadReferenceData\(\s*`seed-needs:seeds:\$\{user.id\}/, '参照シーズキャッシュはユーザー別');
assert.doesNotMatch(loader, /SUPABASE_SERVICE_ROLE_KEY/);
console.log('seed-needs: joins, filters, dataset separation, pagination and write conflict checks passed');

const { buildExploration, traceExploration, researchAtPair, validateResearch } = await import('../src/lib/seed-needs-exploration.ts');
data.companies.forEach(c => { c.company_name = ''; });
const graph = buildExploration(data, 'working', ['seed-2']);
assert.equal(graph.edges.length, 5, '市場の解釈2本と企業シーズ3本');
assert.equal(graph.nodes.filter(n => n.kind === 'seed').length, 2, '同じシーズをノードとして重複表示しない');
assert(graph.nodes.some(n => n.id === 'company-c' && n.unlinked), '技術を生む入口の未接続を保持');
const fromCompany = traceExploration(data, 'working', 'company', 'company-b');
assert(fromCompany.has('market:market') && fromCompany.has('seed:seed'));
assert(!fromCompany.has('company:company-a') && !fromCompany.has('seed:seed-2'), '別企業経由の無関係な技術を適合経路に混ぜない');
const fromSeed = traceExploration(data,'working','seed','seed');
assert(fromSeed.has('company:company-a') && fromSeed.has('company:company-b'));
assert(!fromSeed.has('seed:seed-2'), 'シーズ起点はそのシーズへの接続だけ');
assert.equal(validateResearch({ market_ids:['market'],company_ids:[],seed_ids:[] },'new_seed'),null,'新規研究はシーズ未発見でも開始できる');
assert(validateResearch({ market_ids:[],company_ids:[],seed_ids:['seed'] },'application'));
assert(validateResearch({ market_ids:['market'],company_ids:[],seed_ids:['seed','seed'] },'combination'));
assert.equal(researchAtPair([{ company_ids:['company-a','company-b'],seed_ids:['seed','seed-2'] } as never],'company-b','seed-2').length,1);
assert.equal(researchAtPair([{ company_ids:['company-a'],seed_ids:['seed'] } as never],'company-c','seed').length,0);
console.log('exploration: trace isolation, graph normalization, unconnected needs, multi/zero-seed proposals passed');

const { marketNeedRows, rankMarketSizes, searchMarketRows, marketSizeFor, validateMarketAssessment } = await import('../src/lib/market-needs.ts');
const source = { id:'00000000-0000-4000-8000-000000000009', kind:'primary',title:'調査資料',publisher:'調査元',date:'2026-10-08',url:'https://example.invalid/report',note:'試験用の出典' } as const;
const size = {scope:'japan',year:2026,min_oku:100,max_oku:200,definition:'対象製品',basis:'試験用の算定',source_id:source.id} as const;
const large = { ...data, markets:Array.from({length:620},(_,i) => ({...data.markets[0],id:`m${i}`,title:`市場${String(i).padStart(3,'0')}`,sources:[source],market_sizes:i===619 ? [] : [{...size,min_oku:i,max_oku:i+20}],confidence_rank:'c',confidence_note:'仮説',updated_at:'2026-10-08T00:00:00Z'})),companies:[],matches:[],research:[],marketSeedLinks:[] } as SeedNeedsData;
let catalog=marketNeedRows(large,'working');
assert.equal(catalog.length,620);
const rank=rankMarketSizes(catalog,'japan',2026);
assert.equal(rank.get('m618'),1); assert.equal(rank.get('m0'),619); assert(!rank.has('m619'),'未評価をゼロへ変換しない');
assert.equal(rankMarketSizes(catalog,'global',2026).size,0,'国内と世界を混ぜない');
assert.equal(rankMarketSizes(catalog,'japan',2027).size,0,'異なる対象年を混ぜない');
assert.equal(searchMarketRows(catalog,'市場618 調査元').length,1,'市場と出典を横断検索');
assert.equal(marketSizeFor(catalog[0].market,'global',2026),undefined);
large.markets[1].market_sizes=[{...size,min_oku:618,max_oku:620}];
assert.equal(rankMarketSizes(marketNeedRows(large,'working'),'japan',2026).get('m1'),1,'同額は同順位');
const withLinks={...data,marketSeedLinks:[{id:'direct',dataset:'working',market_need_id:'market',seed_id:'seed',rationale:'直接リンク'}],research:[{id:'r',dataset:'working',market_ids:['market'],company_ids:['company-a'],seed_ids:['seed','seed-2'],title:'組み合わせ'}]} as SeedNeedsData;
catalog=marketNeedRows(withLinks,'working');
assert.equal(catalog.length,2,'会社・シーズが増えても市場の行を増やさない');
assert.equal(catalog.find(r=>r.market.id==='market')!.seeds.length,2,'経路が複数あってもシーズを重複させない');
assert.equal(catalog[0].seeds[0].matches.length,2,'各企業からの関係を保持');
assert.equal(catalog[0].seeds[0].research.length,1); assert(catalog[0].seeds[0].direct);
assert.equal(marketNeedRows(withLinks,'example').length,1);
assert.equal(buildExploration(withLinks,'working').edges.length,6,'直接リンクも補助図に表示');
assert(traceExploration(withLinks,'working','seed','seed').has('market:market'));
const assessed={dataset:'working',sources:[source],market_sizes:[size],confidence_rank:'a',confidence_note:'一次情報で確認'} as const;
assert.equal(validateMarketAssessment({...assessed,sources:[source],market_sizes:[size]}),'');
assert(validateMarketAssessment({...assessed,sources:[],market_sizes:[size]}),'出典なし高確度を拒否');
assert(validateMarketAssessment({...assessed,sources:[source],market_sizes:[{...size,source_id:'missing'}]}),'推計から欠損した出典を拒否');
assert(validateMarketAssessment({...assessed,sources:[source],market_sizes:[size,size]}),'地域年の重複を拒否');
assert(validateMarketAssessment({...assessed,sources:[source],market_sizes:[{...size,min_oku:NaN}]}),'未入力を0扱いしない');
assert(validateMarketAssessment({...assessed,dataset:'example',sources:[source],market_sizes:[size]}),'仮例を高確度へ昇格しない');
console.log('market list: 620 needs, single row per market, deduped references, source provenance, comparable ranking, unknowns and assessment validation passed');
