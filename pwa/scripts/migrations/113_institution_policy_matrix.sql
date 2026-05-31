-- 113_institution_policy_matrix.sql
-- ERS raw evidence: institution policy / regulation comparison matrix.
-- 設計正本: pwa/design/institution_readiness.md

create table if not exists institution_policy_items (
  policy_item_id text primary key,
  category       text not null,
  item_kind      text not null check (item_kind in ('status', 'attribute')),
  key            text not null unique,
  label          text not null,
  description    text,
  value_type     text not null default 'text' check (value_type in ('text', 'number', 'date', 'url', 'json')),
  sort_order     int not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists institution_policy_assessments (
  policy_assessment_id uuid primary key default gen_random_uuid(),
  institution_id       text not null references institutions(institution_id) on delete cascade,
  policy_item_id       text not null references institution_policy_items(policy_item_id) on delete cascade,
  status               text not null default 'unknown' check (status in ('unknown', 'not_started', 'drafting', 'established')),
  attribute_value      text,
  evidence_note        text,
  source_type          text not null default 'unknown' check (source_type in ('unknown', 'official', 'internal_doc', 'hearing', 'db', 'inferred')),
  source_url           text,
  source_path          text,
  confirmed_at         date,
  evaluator            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(institution_id, policy_item_id)
);

create index if not exists idx_inst_policy_items_category on institution_policy_items(category, sort_order);
create index if not exists idx_inst_policy_assess_inst on institution_policy_assessments(institution_id);
create index if not exists idx_inst_policy_assess_item on institution_policy_assessments(policy_item_id);
create index if not exists idx_inst_policy_assess_status on institution_policy_assessments(status);

alter table institution_policy_items enable row level security;
alter table institution_policy_assessments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['institution_policy_items','institution_policy_assessments']
  loop
    execute format('drop policy if exists %I on %I', t||'_anon_read', t);
    execute format('drop policy if exists %I on %I', t||'_admin_all', t);
    execute format('drop policy if exists %I on %I', t||'_service_role', t);
    execute format('create policy %I on %I for select using (true)', t||'_anon_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t||'_admin_all', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t||'_service_role', t);
  end loop;
end $$;

insert into institution_policy_items
  (policy_item_id, category, item_kind, key, label, description, value_type, sort_order)
values
  -- 制度整備ステータス
  ('pol_cert_rule', '認定規程', 'status', 'certification_rule', '大学発ベンチャー認定規程', '認定制度・称号付与制度が整備されているか。', 'text', 101),
  ('pol_cert_pre_registration', '認定規程', 'status', 'pre_registration_application', '登記前申請・認定予定通知', '設立前申請、認定予定通知、条件付認定を扱えるか。', 'text', 102),
  ('pol_cert_update', '認定規程', 'status', 'certification_update', '有効期間・更新審査', '認定期間、更新可否、更新審査、要件再確認が定められているか。', 'text', 103),
  ('pol_title_restriction', '認定規程', 'status', 'title_use_restriction', '称号使用制限・保証誤認防止', '品質保証・投資推奨・経営状態保証と誤認させない条項があるか。', 'text', 104),
  ('pol_cancellation', '認定規程', 'status', 'cancellation_process', '解除・取消・取消後処理', '取消事由、称号返付、表示削除、営業利用停止を定めているか。', 'text', 105),
  ('pol_report_change', '認定規程', 'status', 'report_change_notice', '年次報告・変更届', '年次報告、決算未了時代替、代表者・所在地・資本構成変更届を扱うか。', 'text', 106),
  ('pol_support_request', '支援制度', 'status', 'support_request_process', '支援申請・個別審査', '認定とは別に施設/登記/機器/広報/紹介の個別申請・審査を持つか。', 'text', 201),
  ('pol_facility_registration', '支援制度', 'status', 'facility_registration', '施設利用・商業登記', '起業用施設、商業登記、研究室/インキュベーション施設の利用制度があるか。', 'text', 202),
  ('pol_shared_equipment', '支援制度', 'status', 'shared_equipment', '共有機器・研究設備利用', '認定SUが共有機器・研究設備を利用できる制度があるか。', 'text', 203),
  ('pol_gap_fund', '支援制度', 'status', 'gap_fund', 'GAP/POC資金', 'POC、GAPファンド、起業前資金への導線があるか。', 'text', 204),
  ('pol_accelerator', '支援制度', 'status', 'accelerator_mentoring', 'アクセラ・伴走メンタリング', 'アクセラレーション、伴走メンタリング、相談導線が制度化されているか。', 'text', 205),
  ('pol_vc_connection', '支援制度', 'status', 'vc_finance_connection', 'VC・金融機関接続', 'VC、金融機関、自治体、外部支援機関への接続導線があるか。', 'text', 206),
  ('pol_eir', '人材', 'status', 'eir_program', 'EIR制度', '客員起業家/EIRを制度として招聘・循環できるか。', 'text', 301),
  ('pol_cxo_pool', '人材', 'status', 'cxo_pool', '外部CEO/CXO人材プール', '大学発ベンチャーへCEO/CXO候補を紹介・マッチングできるか。', 'text', 302),
  ('pol_coi_sidejob', '関係規程', 'status', 'coi_sidejob_rules', 'COI・兼業規程接続', '教職員の経営参画、兼業、利益相反マネジメントに接続しているか。', 'text', 401),
  ('pol_ip_license', '関係規程', 'status', 'ip_license_rules', '知財ライセンス規程接続', '認定と知財ライセンス契約・譲渡契約・優遇措置を切り分けているか。', 'text', 402),
  ('pol_equity_rule', 'エクイティ', 'status', 'equity_so_rule', '株式/SO取得規程', '大学・学校法人による株式/SO取得、管理、処分の規程があるか。', 'text', 501),
  ('pol_ip_equity', 'エクイティ', 'status', 'ip_equity_operation', 'IPライセンス対価の株式/SO', '知財ライセンス対価として株式/SOを受けられるか。', 'text', 502),
  ('pol_fund_investment', 'エクイティ', 'status', 'fund_investment_rule', '出資・ファンド組成規程', '大学VC、LP出資、指定ファンド、関連法人経由投資の規程があるか。', 'text', 503),

  -- 属性マトリクス
  ('attr_regulation_owner', '認定規程属性', 'attribute', 'regulation_owner', '規程主体', '学校法人規程 / 大学規程 / ハイブリッド。', 'text', 1001),
  ('attr_recognition_decider', '認定規程属性', 'attribute', 'recognition_decider', '認定決裁者', '認定を誰が決定するか。', 'text', 1002),
  ('attr_review_body', '認定規程属性', 'attribute', 'review_body', '審査主体', '認定委員会、審査会、担当部署など。', 'text', 1003),
  ('attr_equity_decider', '認定規程属性', 'attribute', 'equity_decider', '株式/SO取得決裁者', '株式/SO取得・処分を誰が決裁するか。', 'text', 1004),
  ('attr_amendment_decider', '認定規程属性', 'attribute', 'amendment_decider', '改廃決裁者', '規程改廃の決定主体。', 'text', 1005),
  ('attr_eligible_scope', '認定規程属性', 'attribute', 'eligible_scope', '認定対象範囲', '研究成果型、知財型、教職員/学生、卒業生/退職者、第三者代表会社など。', 'text', 1006),
  ('attr_post_grad_limit', '認定規程属性', 'attribute', 'post_graduation_limit', '退職・卒業後期限', '1年、3年、期限なし、実質的関連性など。', 'text', 1007),
  ('attr_validity_years', '認定規程属性', 'attribute', 'validity_years', '認定有効期間', '称号使用期間・認定期間。', 'text', 1008),
  ('attr_renewal_rule', '認定規程属性', 'attribute', 'renewal_rule', '更新ルール', '再申請、更新審査、要件再確認。', 'text', 1009),
  ('attr_naming', '認定規程属性', 'attribute', 'naming', '呼称', '大学発ベンチャー / スタートアップ / 併記。', 'text', 1010),
  ('attr_support_period', '支援制度属性', 'attribute', 'support_period', '支援期間', '称号期間と支援期間を分けているか。', 'text', 1101),
  ('attr_support_contents', '支援制度属性', 'attribute', 'support_contents', '支援内容', '施設、登記、共有機器、知財、広報、紹介、相談、資金等。', 'text', 1102),
  ('attr_source_docs', '根拠資料', 'attribute', 'source_documents', '主要根拠資料', '公式URL、規程PDF、ヒアリングログ、OS内資料への参照。', 'text', 1201)
on conflict (policy_item_id) do update set
  category = excluded.category,
  item_kind = excluded.item_kind,
  key = excluded.key,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  sort_order = excluded.sort_order,
  updated_at = now();
