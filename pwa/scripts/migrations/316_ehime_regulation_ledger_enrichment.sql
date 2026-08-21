-- 316_ehime_regulation_ledger_enrichment.sql
-- 2026-08-21に愛媛大学から共有された既存制度チェックとJST回答を、
-- 愛媛大学コックピットのSU関連規程台帳へ反映する。
-- 学内規程とJSTの外部制度ルールを同じ種類へ混ぜず、外部制度は独立種別で管理する。

insert into institution_regulation_types
  (regulation_type_id, group_key, label, short_label, description, sort_order, is_active)
values
  (
    'external_program_support',
    'supporting',
    '外部助成・起業後支援ルール',
    '外部支援',
    'JST等の外部助成制度における起業、起業後支援、支援終了条件等。大学の学内規程とは分けて管理する。',
    204,
    true
  )
on conflict (regulation_type_id) do update set
  group_key = excluded.group_key,
  label = excluded.label,
  short_label = excluded.short_label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into institution_regulations
  (regulation_id, institution_id, title, stage, lifecycle_state, current_state_note, next_gate, next_gate_timing, updated_by)
values
  (
    'reg_ehime_recognition',
    'inst_ehime',
    '国立大学法人愛媛大学における大学発ベンチャーの認定に関する規程',
    4,
    'effective',
    '公式現行規程を確認済み。法人登記とは別手続きで、SolvioraXの認定要件・申請時期・審議経路は個別確認が必要。',
    '認定要件・必要書類・審議経路を学内確認',
    '設立準備時',
    'migration:316'
  ),
  (
    'reg_ehime_side_job',
    'inst_ehime',
    '愛媛大学の兼業・労働時間内兼業・クロスアポイントメント制度',
    4,
    'effective',
    '兼業規程、研究成果活用企業の役員兼業、労働時間内兼業、クロスアポイントメントの既存制度を確認済み。',
    'SolvioraXで採る関与形態と申請順序を学内確認',
    '役員・業務開始の1か月以上前を目安',
    'migration:316'
  ),
  (
    'reg_ehime_coi',
    'inst_ehime',
    '国立大学法人愛媛大学利益相反管理規程',
    4,
    'effective',
    '公式現行規程を確認済み。兼業、株式・SO、役員報酬、共同研究、設備利用等は個別の利益相反管理が必要。',
    '大学側意思決定から除外する範囲を事前整理',
    '設立・契約準備時',
    'migration:316'
  ),
  (
    'reg_ehime_ip',
    'inst_ehime',
    '国立大学法人愛媛大学知的財産権規程・技術移転／実施許諾',
    4,
    'effective',
    '知的財産権規程と基本方針を確認済み。SolvioraX向けの独占性、分野・地域、サブライセンス、改良発明等は契約協議が必要。',
    'Background IP棚卸しとライセンス条件の協議',
    '設立・資金調達準備時',
    'migration:316'
  ),
  (
    'reg_ehime_joint_research',
    'inst_ehime',
    '国立大学法人愛媛大学共同研究等取扱規則・関連契約制度',
    4,
    'effective',
    '共同研究、受託研究、秘密保持契約、学術指導、産学協働講座・部門の既存制度を確認済み。設立後の愛媛大学×SolvioraX共同研究は石原先生から出た提案段階で、実施は未合意。',
    '共同研究を行うかを含め、大学側とSolvioraX側で別途協議',
    '実施方針の合意後',
    'migration:316'
  ),
  (
    'reg_ehime_venture_support',
    'inst_ehime',
    '大学発ベンチャー認定に伴う支援（施設・所在地登記・研究設備利用）',
    1,
    'review',
    '公式支援制度を確認済み。事務室・研究室、所在地登記、研究設備利用の個別条件、料金、安全、責任分界は未確認。',
    '利用規程・料金表・申請様式を学内確認',
    '認定・設立準備時',
    'migration:316'
  ),
  (
    'reg_ehime_jst_post_startup_support',
    'inst_ehime',
    'JST大学発新産業創出基金事業 起業後支援の手引き',
    4,
    'effective',
    'PSI事務局回答では研究開発期間中の起業は可能。起業のみなら事前申請不要だが起業日前日でGAPファンド支援終了。起業後の大学側継続支援またはSU直接支援はPF審査・JST確認等が必要。12/18設立は目安で、審査日程に合わせて後ろ倒し可能。',
    'PF審査の開催可能時期・必要書類と、VC出資要件充足を含む支援終了条件を確認',
    '設立予定日の原則3か月前まで',
    'migration:316'
  )
on conflict (regulation_id) do update set
  title = excluded.title,
  stage = excluded.stage,
  lifecycle_state = excluded.lifecycle_state,
  current_state_note = excluded.current_state_note,
  next_gate = excluded.next_gate,
  next_gate_timing = excluded.next_gate_timing,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into institution_regulation_cells
  (institution_id, regulation_type_id, regulation_id, state, confirmed_at, updated_by)
values
  ('inst_ehime', 'recognition', 'reg_ehime_recognition', 'effective', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'conflict_of_interest', 'reg_ehime_coi', 'effective', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'side_job', 'reg_ehime_side_job', 'effective', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'ip_license', 'reg_ehime_ip', 'effective', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'joint_research', 'reg_ehime_joint_research', 'effective', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'shared_equipment', 'reg_ehime_venture_support', 'review', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'support_rules', 'reg_ehime_venture_support', 'review', '2026-08-21', 'migration:316'),
  ('inst_ehime', 'external_program_support', 'reg_ehime_jst_post_startup_support', 'effective', '2026-08-21', 'migration:316')
on conflict (institution_id, regulation_type_id) do update set
  regulation_id = excluded.regulation_id,
  state = excluded.state,
  confirmed_at = excluded.confirmed_at,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into institution_regulation_versions
  (version_id, regulation_id, label, file_name, version_state, external_url, version_date, is_current, created_by)
values
  (
    'regver_ehime_side_job_current',
    'reg_ehime_side_job',
    '現行兼業規程',
    '国立大学法人愛媛大学兼業規程.pdf',
    'effective',
    'https://kiteisv.office.ehime-u.ac.jp/%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E8%A6%8F%E5%89%87%E9%9B%86%2F%E7%AC%AC%EF%BC%90%EF%BC%97%E7%B7%A8%E3%80%80%E5%B0%B1%E6%A5%AD%E8%A6%8F%E5%89%87%2F18%E2%97%8E%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E5%85%BC%E6%A5%AD%E8%A6%8F%E7%A8%8B.PDF',
    null,
    true,
    'migration:316'
  ),
  (
    'regver_ehime_side_job_officer',
    'reg_ehime_side_job',
    '研究成果活用企業の役員兼業案内',
    null,
    'reference',
    'https://www.ehime-u.ac.jp/recruit/sideline/',
    null,
    false,
    'migration:316'
  ),
  (
    'regver_ehime_side_job_workhours',
    'reg_ehime_side_job',
    '労働時間内兼業細則',
    '国立大学法人愛媛大学教員の労働時間内兼業に関する細則.pdf',
    'effective',
    'https://kiteisv.office.ehime-u.ac.jp/%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E8%A6%8F%E5%89%87%E9%9B%86/%E7%AC%AC%EF%BC%90%EF%BC%96%E7%B7%A8%E3%80%80%E5%A4%A7%E5%AD%A6%E9%81%8B%E5%96%B6/%E7%AC%AC%EF%BC%90%EF%BC%93%E7%AB%A0%E3%80%80%E4%BA%BA%E4%BA%8B%EF%BC%88%E8%81%B7%E5%93%A1%EF%BC%89/20%E2%97%8E%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E6%95%99%E5%93%A1%E3%81%AE%E5%8A%B4%E5%83%8D%E6%99%82%E9%96%93%E5%86%85%E5%85%BC%E6%A5%AD%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E7%B4%B0%E5%89%87.PDF',
    null,
    false,
    'migration:316'
  ),
  (
    'regver_ehime_side_job_cross_appointment',
    'reg_ehime_side_job',
    'クロスアポイントメント規程',
    '国立大学法人愛媛大学教員等のクロスアポイントメントに関する規程.pdf',
    'effective',
    'https://kiteisv.office.ehime-u.ac.jp/%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E8%A6%8F%E5%89%87%E9%9B%86%2F%E7%AC%AC%EF%BC%90%EF%BC%97%E7%B7%A8%E3%80%80%E5%B0%B1%E6%A5%AD%E8%A6%8F%E5%89%87%2F23%E2%97%8E%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E6%95%99%E5%93%A1%E7%AD%89%E3%81%AE%E3%82%AF%E3%83%AD%E3%82%B9%E3%82%A2%E3%83%9D%E3%82%A4%E3%83%B3%E3%83%88%E3%83%A1%E3%83%B3%E3%83%88%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E8%A6%8F%E7%A8%8B.pdf',
    null,
    false,
    'migration:316'
  ),
  (
    'regver_ehime_coi_current',
    'reg_ehime_coi',
    '現行規程',
    '国立大学法人愛媛大学利益相反管理規程.pdf',
    'effective',
    'https://ccr.ehime-u.ac.jp/crp/wp/wp-content/uploads/2021/10/%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E5%88%A9%E7%9B%8A%E7%9B%B8%E5%8F%8D%E7%AE%A1%E7%90%86%E8%A6%8F%E7%A8%8B.pdf',
    null,
    true,
    'migration:316'
  ),
  (
    'regver_ehime_ip_current',
    'reg_ehime_ip',
    '現行知的財産権規程',
    '国立大学法人愛媛大学知的財産権規程.pdf',
    'effective',
    'https://kiteisv.office.ehime-u.ac.jp/%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E8%A6%8F%E5%89%87%E9%9B%86/%E7%AC%AC%EF%BC%90%EF%BC%94%E7%B7%A8%E3%80%80%E7%A4%BE%E4%BC%9A%E9%80%A3%E6%90%BA/%E7%AC%AC%EF%BC%90%EF%BC%92%E7%AB%A0%E3%80%80%E7%9F%A5%E7%9A%84%E8%B2%A1%E7%94%A3/02%E2%97%8E%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E7%9F%A5%E7%9A%84%E8%B2%A1%E7%94%A3%E6%A8%A9%E8%A6%8F%E7%A8%8B.pdf',
    null,
    true,
    'migration:316'
  ),
  (
    'regver_ehime_ip_policy',
    'reg_ehime_ip',
    '知的財産基本方針',
    '国立大学法人愛媛大学知的財産に関する基本方針.pdf',
    'reference',
    'https://kiteisv.office.ehime-u.ac.jp/%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E8%A6%8F%E5%89%87%E9%9B%86/%E7%AC%AC%EF%BC%90%EF%BC%94%E7%B7%A8%E3%80%80%E7%A4%BE%E4%BC%9A%E9%80%A3%E6%90%BA/%E7%AC%AC%EF%BC%90%EF%BC%92%E7%AB%A0%E3%80%80%E7%9F%A5%E7%9A%84%E8%B2%A1%E7%94%A3/01%E2%97%8E%E5%9B%BD%E7%AB%8B%E5%A4%A7%E5%AD%A6%E6%B3%95%E4%BA%BA%E6%84%9B%E5%AA%9B%E5%A4%A7%E5%AD%A6%E7%9F%A5%E7%9A%84%E8%B2%A1%E7%94%A3%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E5%9F%BA%E6%9C%AC%E6%96%B9%E9%87%9D.PDF',
    null,
    false,
    'migration:316'
  ),
  (
    'regver_ehime_joint_research_current',
    'reg_ehime_joint_research',
    '現行共同研究等取扱規則',
    '国立大学法人愛媛大学共同研究等取扱規則.pdf',
    'effective',
    'https://ccr.ehime-u.ac.jp/ccr/wp/wp-content/uploads/2023/03/EU_kyodo_kisoku_202104-1.pdf',
    null,
    true,
    'migration:316'
  ),
  (
    'regver_ehime_joint_research_related_systems',
    'reg_ehime_joint_research',
    '受託研究・NDA・学術指導・産学協働講座等',
    null,
    'reference',
    'https://ccr.ehime-u.ac.jp/ccr/various-systems/',
    null,
    false,
    'migration:316'
  ),
  (
    'regver_ehime_venture_support_current',
    'reg_ehime_venture_support',
    '大学発ベンチャー支援制度',
    null,
    'reference',
    'https://ccr.ehime-u.ac.jp/startup/program/',
    null,
    true,
    'migration:316'
  ),
  (
    'regver_ehime_jst_post_startup_support_202606',
    'reg_ehime_jst_post_startup_support',
    '起業後支援の手引き 2026年6月',
    '起業後支援の手引き.pdf',
    'effective',
    null,
    '2026-06-01',
    true,
    'migration:316'
  )
on conflict (version_id) do update set
  label = excluded.label,
  file_name = excluded.file_name,
  version_state = excluded.version_state,
  external_url = excluded.external_url,
  version_date = excluded.version_date,
  is_current = excluded.is_current,
  created_by = excluded.created_by,
  updated_at = now();
