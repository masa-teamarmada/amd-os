-- 375_institution_support_program_compare.sql
-- /institutions の「支援プログラム比較」タブ用に、制度比較マトリクスの項目マスタへ
-- 比較表の列定義 (compare_group / compare_sort / compare_label) を持たせる。
-- 比較表に出す項目だけ compare_sort を持ち、NULL の項目は /institutions/assess の制度整備・規程比較にだけ出る。
-- 行 (研究機関) は institutions テーブルそのものなので、SU関連規程タブと同じ母集団になる。

alter table institution_policy_items add column if not exists compare_group text;
alter table institution_policy_items add column if not exists compare_sort smallint;
alter table institution_policy_items add column if not exists compare_label text;

create index if not exists idx_inst_policy_items_compare
  on institution_policy_items(compare_sort)
  where compare_sort is not null;

-- 比較表で新たに要る項目 (施設利用・商業登記の1項目に混ざっていた本店登記と部屋貸しを分ける)
insert into institution_policy_items
  (policy_item_id, category, item_kind, key, label, description, value_type, sort_order)
values
  ('pol_head_office_registration', '支援制度', 'status', 'head_office_registration', '学内本店登記', '大学の敷地・建物の住所を会社の本店所在地として登記できるか。可否と有償無償。', 'text', 207),
  ('pol_facility_lease', '支援制度', 'status', 'facility_lease', '施設貸与（部屋）', '起業用の部屋・研究室・インキュベーション施設を貸すか。施設名、有償無償、期間。', 'text', 208),
  ('pol_name_logo_use', '認定規程', 'status', 'name_logo_use', '大学名・ロゴ使用', '称号（○○大学発ベンチャー）の使用可否と、大学ロゴ・校章の使用条件。', 'text', 107),
  ('attr_support_fee', '支援制度属性', 'attribute', 'support_fee', '支援の対価', '認定後の支援が無償か有償か（実費、施設使用料、ライセンス料など）。', 'text', 1103),
  ('attr_certified_count', '支援制度属性', 'attribute', 'certified_count', '認定実績', '認定ベンチャーの社数と一覧の公開有無。', 'text', 1104)
on conflict (policy_item_id) do update set
  category = excluded.category,
  item_kind = excluded.item_kind,
  key = excluded.key,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 比較表の列 (16列、5群)。列の並びと短い見出しはここが正本。
update institution_policy_items as items
   set compare_group = v.compare_group,
       compare_sort = v.compare_sort,
       compare_label = v.compare_label,
       updated_at = now()
  from (values
    ('pol_cert_rule',                '認定',       1,  '認定制度'),
    ('attr_eligible_scope',          '認定',       2,  '認定対象'),
    ('attr_recognition_decider',     '認定',       3,  '認定決裁・審査'),
    ('pol_cert_pre_registration',    '認定',       4,  '登記前申請'),
    ('attr_validity_years',          '認定',       5,  '有効期間・更新'),
    ('pol_head_office_registration', '場所・設備', 6,  '学内本店登記'),
    ('pol_facility_lease',           '場所・設備', 7,  '施設貸与（部屋）'),
    ('pol_shared_equipment',         '場所・設備', 8,  '共用設備・機器'),
    ('pol_name_logo_use',            '場所・設備', 9,  '大学名・ロゴ使用'),
    ('pol_ip_license',               '知財・資本', 10, '知財ライセンス優遇'),
    ('pol_equity_rule',              '知財・資本', 11, '株式・SO取得'),
    ('pol_gap_fund',                 '知財・資本', 12, 'GAP・起業資金'),
    ('pol_accelerator',              '人・伴走',   13, '伴走・アクセラ'),
    ('pol_coi_sidejob',              '人・伴走',   14, '兼業・利益相反'),
    ('attr_support_fee',             '条件・実績', 15, '支援の対価'),
    ('attr_certified_count',         '条件・実績', 16, '認定実績')
  ) as v(policy_item_id, compare_group, compare_sort, compare_label)
 where items.policy_item_id = v.policy_item_id;
