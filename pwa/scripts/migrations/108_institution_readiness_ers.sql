-- 108_institution_readiness_ers.sql
-- ERS (Ecosystem Readiness Score / 機関エコシステム整備度スコア)
-- 設計正本: pwa/design/institution_readiness.md
--
-- 苗床/土壌レイヤー: 研究機関 (大学・研究所) が「ベンチャーを生み育てる装置」として
-- どれだけ整備されているかを 8 軸 × サブ軸 × Lv1-5 の加重和 (充足率 0-100%) で測る。
-- AMD Score (個体レイヤー) とは別ロジック。二重計上しない (σ_SU 経由でのみ概念連動)。

-- ============================================================
-- 1. 機関マスタ
-- ============================================================
create table if not exists institutions (
  institution_id  text primary key,                 -- 'inst_kagawa' / 'inst_nims' 等
  name            text not null,
  short_name      text,
  type            text not null default 'university', -- 'university' | 'research_institute' | 'other'
  description     text,                              -- 機関の特徴・概要
  region          text,
  contract_status text not null default 'active',    -- 'active' | 'prospect' | 'past'
  sort_order      int  not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 2. capability 軸定義 (8 軸) — マスタ
-- ============================================================
create table if not exists institution_capability_axes (
  axis_id          text primary key,                 -- 'axis1'..'axis8'
  axis_no          int  not null,
  name             text not null,
  corresponds_xrl  text,                             -- 概念マップ (計算連動ではない)
  weight           numeric not null default 0.125,   -- 軸重み (Σ=1, 当面等加重)
  sort_order       int  not null default 0
);

-- ============================================================
-- 3. サブ軸定義 (rubric 保持) — マスタ
-- ============================================================
create table if not exists institution_capability_criteria (
  criterion_id  text primary key,                    -- '1-a'..'8-c'
  axis_id       text not null references institution_capability_axes(axis_id) on delete cascade,
  code          text not null,
  name          text not null,
  rubric        jsonb not null default '{}'::jsonb,   -- {"1":..,"2":..,"3":..,"4":..,"5":..}
  sort_order    int  not null default 0
);

-- ============================================================
-- 4. 機関 × サブ軸 の評価 (Lv + 根拠)
-- ============================================================
create table if not exists institution_assessments (
  assessment_id  uuid primary key default gen_random_uuid(),
  institution_id text not null references institutions(institution_id) on delete cascade,
  criterion_id   text not null references institution_capability_criteria(criterion_id) on delete cascade,
  level          int  check (level between 1 and 5),
  na             boolean not null default false,      -- 機関タイプで該当しない (軸平均から除外)
  note           text,                                -- 評価根拠
  evaluated_at   date not null default current_date,
  evaluator      text default 'まさ',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(institution_id, criterion_id, evaluated_at)
);

create index if not exists idx_inst_assess_inst on institution_assessments(institution_id);
create index if not exists idx_inst_assess_crit on institution_assessments(criterion_id);
create index if not exists idx_inst_crit_axis   on institution_capability_criteria(axis_id);

-- ============================================================
-- 5. RLS (amd_score 系と同じパターン: anon read / admin all / service_role)
-- ============================================================
alter table institutions                     enable row level security;
alter table institution_capability_axes      enable row level security;
alter table institution_capability_criteria  enable row level security;
alter table institution_assessments          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['institutions','institution_capability_axes','institution_capability_criteria','institution_assessments']
  loop
    execute format('drop policy if exists %I on %I', t||'_anon_read', t);
    execute format('drop policy if exists %I on %I', t||'_admin_all', t);
    execute format('drop policy if exists %I on %I', t||'_service_role', t);
    execute format('create policy %I on %I for select using (true)', t||'_anon_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t||'_admin_all', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t||'_service_role', t);
  end loop;
end $$;

-- ============================================================
-- 6. seed: 8 軸
-- ============================================================
insert into institution_capability_axes (axis_id, axis_no, name, corresponds_xrl, weight, sort_order) values
  ('axis1', 1, 'シーズ発掘・技術評価体制',       'TRL',           0.125, 1),
  ('axis2', 2, '知財・TLO 機能',                 'TRL→権利化',    0.125, 2),
  ('axis3', 3, 'インキュベーション・起業支援',   'BRL',           0.125, 3),
  ('axis4', 4, '産学連携・事業会社接続窓口',     'σ_SU(産業 μ_I)', 0.125, 4),
  ('axis5', 5, '資金・ファンド接続',             'FRL',           0.125, 5),
  ('axis6', 6, '経営人材(EIR/CXO)供給',          'HRL',           0.125, 6),
  ('axis7', 7, '規程・ガバナンス整備',           '制度基盤',      0.125, 7),
  ('axis8', 8, '政府・自治体・政策連携',         'σ_SU(政府 μ_G)/GRL', 0.125, 8)
on conflict (axis_id) do update set
  axis_no = excluded.axis_no, name = excluded.name,
  corresponds_xrl = excluded.corresponds_xrl, weight = excluded.weight, sort_order = excluded.sort_order;

-- ============================================================
-- 7. seed: 28 サブ軸 + rubric (Lv1/Lv3/Lv5 は確定, Lv2/Lv4 は中間補間)
-- ============================================================
insert into institution_capability_criteria (criterion_id, axis_id, code, name, rubric, sort_order) values
-- 軸1
('1-a','axis1','1-a','シーズの棚卸し・DB化',
 '{"1":"誰がどんなシーズを持つか把握されていない","2":"（Lv1とLv3の中間）","3":"部局単位で主要シーズが台帳化されている","4":"（Lv3とLv5の中間）","5":"全学シーズDBが更新され、事業化候補が継続抽出される"}'::jsonb, 1),
('1-b','axis1','1-b','URA/リサーチアドミニストレーター配置',
 '{"1":"専任なし、教員任せ","2":"（Lv1とLv3の中間）","3":"URAは居るが研究支援(申請事務)中心","4":"（Lv3とLv5の中間）","5":"事業化目利き機能を持つURAが常設・運用"}'::jsonb, 2),
('1-c','axis1','1-c','事業化視点の技術評価',
 '{"1":"評価プロセスなし","2":"（Lv1とLv3の中間）","3":"市場性・知財性を都度ヒアリングで確認","4":"（Lv3とLv5の中間）","5":"市場/知財/競合スクリーニングが定型化されGO/NO判定に乗る"}'::jsonb, 3),
-- 軸2
('2-a','axis2','2-a','TLO/知財部門の有無・専門性',
 '{"1":"知財担当が事実上いない","2":"（Lv1とLv3の中間）","3":"知財部はあるが出願管理が中心","4":"（Lv3とLv5の中間）","5":"技術移転の専門人材を擁し戦略的に動くTLO"}'::jsonb, 1),
('2-b','axis2','2-b','出願〜権利化プロセス',
 '{"1":"出願は個別対応で属人的","2":"（Lv1とLv3の中間）","3":"出願フローが整備されている","4":"（Lv3とLv5の中間）","5":"海外出願・ポートフォリオ管理まで戦略的に運用"}'::jsonb, 2),
('2-c','axis2','2-c','ライセンス・技術移転の実績/導線',
 '{"1":"移転実績ほぼなし","2":"（Lv1とLv3の中間）","3":"単発のライセンス実績あり","4":"（Lv3とLv5の中間）","5":"継続的なライセンス収入・SUへのIP移転導線が定常化"}'::jsonb, 3),
('2-d','axis2','2-d','知財帰属・持分ルール',
 '{"1":"発明者/大学/SU間の帰属が不明瞭","2":"（Lv1とLv3の中間）","3":"標準的な帰属規程あり","4":"（Lv3とLv5の中間）","5":"SU設立を想定した柔軟な持分・実施許諾スキームが整備"}'::jsonb, 4),
-- 軸3
('3-a','axis3','3-a','物理インフラ(ラボ/施設)',
 '{"1":"起業用スペースなし","2":"（Lv1とLv3の中間）","3":"インキュベーション施設はあるが空き依存","4":"（Lv3とLv5の中間）","5":"ウェットラボ含む充実施設＋外部開放"}'::jsonb, 1),
('3-b','axis3','3-b','起業/アントレ教育',
 '{"1":"起業教育なし","2":"（Lv1とLv3の中間）","3":"単発の起業講座がある","4":"（Lv3とLv5の中間）","5":"体系的アントレ教育＋実践プログラムが常設"}'::jsonb, 2),
('3-c','axis3','3-c','伴走メンタリング/アクセラ',
 '{"1":"伴走支援なし","2":"（Lv1とLv3の中間）","3":"希望者にメンター紹介","4":"（Lv3とLv5の中間）","5":"アクセラレーションプログラムが定常運用され実績あり"}'::jsonb, 3),
-- 軸4
('4-a','axis4','4-a','産学連携窓口の専任体制',
 '{"1":"窓口なし、教員のコネ頼み","2":"（Lv1とLv3の中間）","3":"産学連携本部はあるが受け身","4":"（Lv3とLv5の中間）","5":"能動的にマッチングを仕掛ける専任体制"}'::jsonb, 1),
('4-b','axis4','4-b','共同研究の契約処理スピード',
 '{"1":"契約に数ヶ月、定型なし","2":"（Lv1とLv3の中間）","3":"標準契約雛形があり数週間","4":"（Lv3とLv5の中間）","5":"迅速・柔軟(秘密保持/知財条項も整備済)"}'::jsonb, 2),
('4-c','axis4','4-c','事業会社ネットワーク',
 '{"1":"接点ほぼなし","2":"（Lv1とLv3の中間）","3":"個別の大企業連携が散発","4":"（Lv3とLv5の中間）","5":"CVC・大企業との恒常的ネットワーク＋共同事業実績"}'::jsonb, 3),
-- 軸5
('5-a','axis5','5-a','ギャップファンド(POC〜起業前)',
 '{"1":"なし","2":"（Lv1とLv3の中間）","3":"学内ギャップファンドが小規模に存在","4":"（Lv3とLv5の中間）","5":"十分な規模で複数ステージをカバー・運用実績あり"}'::jsonb, 1),
('5-b','axis5','5-b','大学VC/認定VC接続',
 '{"1":"接続なし","2":"（Lv1とLv3の中間）","3":"提携VCが数社","4":"（Lv3とLv5の中間）","5":"大学VCまたは認定VCとの強い投資導線"}'::jsonb, 2),
('5-c','axis5','5-c','公的資金(NEDO/JST/SBIR等)獲得支援',
 '{"1":"支援なし","2":"（Lv1とLv3の中間）","3":"申請サポートあり","4":"（Lv3とLv5の中間）","5":"採択実績が豊富で伴走獲得が定常化"}'::jsonb, 3),
('5-d','axis5','5-d','民間VC/エンジェル導線',
 '{"1":"導線なし","2":"（Lv1とLv3の中間）","3":"紹介ベース","4":"（Lv3とLv5の中間）","5":"ピッチ機会・投資家ネットワークが組織的"}'::jsonb, 4),
-- 軸6
('6-a','axis6','6-a','客員起業家(EIR)制度',
 '{"1":"制度なし","2":"（Lv1とLv3の中間）","3":"EIR的な人材を都度招聘","4":"（Lv3とLv5の中間）","5":"EIR制度が常設・人材が循環"}'::jsonb, 1),
('6-b','axis6','6-b','経営人材プール/マッチング',
 '{"1":"研究者が片手間で社長","2":"（Lv1とLv3の中間）","3":"一部CXO人材を紹介できる","4":"（Lv3とLv5の中間）","5":"経営人材プールからCEO/CXOを供給できる"}'::jsonb, 2),
('6-c','axis6','6-c','メンター・アドバイザー網',
 '{"1":"個人の人脈頼み","2":"（Lv1とLv3の中間）","3":"アドバイザーリストあり","4":"（Lv3とLv5の中間）","5":"分野別の厚いメンター網が稼働"}'::jsonb, 3),
-- 軸7
('7-a','axis7','7-a','大学発ベンチャー認定制度',
 '{"1":"認定制度すらない","2":"（Lv1とLv3の中間）","3":"認定制度はあるが優遇が限定的","4":"（Lv3とLv5の中間）","5":"認定＋設立支援・施設利用等の優遇がフル"}'::jsonb, 1),
('7-b','axis7','7-b','利益相反(COI)・兼業規程',
 '{"1":"規程なし、動くと毎回コンフリクト","2":"（Lv1とLv3の中間）","3":"COI/兼業規程あり","4":"（Lv3とLv5の中間）","5":"教員の経営参画まで想定した運用が定着"}'::jsonb, 2),
('7-c','axis7','7-c','大学のエクイティ保有・取得制度',
 '{"1":"制度なし。大学は株式もSOも一切保有できない","2":"認定VB制度はあるが、出資・保有の規程は未整備","3":"現金出資による株式保有は可能。ただしSO/IP対価エクイティは不可","4":"IPライセンス対価のSO取得まで可能。運用実績は限定的","5":"株式・SO保有・IP-equity・ファンド経由出資まで規程化＆運用実績あり"}'::jsonb, 3),
('7-d','axis7','7-d','知財ライセンス対価のエクイティ取得(IP-equity)',
 '{"1":"不可","2":"（Lv1とLv3の中間）","3":"検討/限定運用","4":"（Lv3とLv5の中間）","5":"SOライセンスで対価エクイティ取得が定常運用"}'::jsonb, 4),
('7-e','axis7','7-e','出資・ファンド組成規程',
 '{"1":"なし","2":"（Lv1とLv3の中間）","3":"制限付きで出資可","4":"（Lv3とLv5の中間）","5":"大学VC・指定国立大ファンド等で本格出資が可能"}'::jsonb, 5),
-- 軸8
('8-a','axis8','8-a','国の拠点プログラム参画',
 '{"1":"参画なし","2":"（Lv1とLv3の中間）","3":"スタートアップ・エコシステム拠点等に部分参画","4":"（Lv3とLv5の中間）","5":"中核機関として国プログラムを牽引"}'::jsonb, 1),
('8-b','axis8','8-b','自治体・地域金融連携',
 '{"1":"連携なし","2":"（Lv1とLv3の中間）","3":"自治体/地銀と個別連携","4":"（Lv3とLv5の中間）","5":"地域エコシステムのハブとして恒常連携"}'::jsonb, 2),
('8-c','axis8','8-c','政策・規制対応(サンドボックス等)',
 '{"1":"対応なし","2":"（Lv1とLv3の中間）","3":"必要時に個別対応","4":"（Lv3とLv5の中間）","5":"規制対応・政策提言を組織的に実施"}'::jsonb, 3)
on conflict (criterion_id) do update set
  axis_id = excluded.axis_id, code = excluded.code, name = excluded.name,
  rubric = excluded.rubric, sort_order = excluded.sort_order;

-- ============================================================
-- 8. seed: 機関 3 つ (香川大 / KUTE / NIMS)
--    ※ KUTE は正式名称・タイプ要確認 (まさが UI で補正)
-- ============================================================
insert into institutions (institution_id, name, short_name, type, description, region, contract_status, sort_order) values
  ('inst_kagawa', '香川大学', '香川大', 'university',         '2026 案件獲得。エコシステム構築業務を受託。', '香川', 'active', 1),
  ('inst_kute',   'KUTE',     'KUTE',   'university',         '※正式名称・タイプ要確認。エコシステム構築業務を受託。', null, 'active', 2),
  ('inst_nims',   '物質・材料研究機構 (NIMS)', 'NIMS', 'research_institute', 'エコシステム構築業務を受託。CryoX (p20) の起源機関。', '茨城', 'active', 3)
on conflict (institution_id) do nothing;
