-- 311_project_ip_assets_lifecycle_columns.sql
-- 知財台帳に「権利が生きているか」「いくら払っているか」「誰が握っているか」の列を足す。
-- まさ依頼 2026-08-21:「年金の支払状況とかPCTの状況とか、他にも列として追加すべき項目あるんじゃない？」
--
-- 設計の切り分け:
--   期限そのもの (何月何日までに何をする) は project_ip_deadlines が正本。ここには複製しない。
--   このテーブルに足すのは「現況 (state)」= 一覧表に出して一目で異常が分かる値。
--
-- migration: 308_project_ip_ledger.sql の続き / 仕様: pwa/spec/3-19-project-ip-current-spec.md

alter table project_ip_assets
  -- 優先日。存続期間20年 / PCT30ヶ月 / 優先権12ヶ月の起点で、期限計算の基準になる。
  add column if not exists priority_date date,
  -- 審査請求日。NULL = 未請求。出願から3年で請求できなくなり、出願は取下げ擬制になる。
  add column if not exists examination_requested_on date,
  -- 年金 (特許料) の納付状況。lapsed = 不納で権利消滅。
  add column if not exists annuity_status text not null default 'unknown'
    check (annuity_status in ('na', 'paid', 'grace', 'lapsed', 'unknown')),
  -- 何年分まで納付済みか (= その日までは権利が生きている)。
  add column if not exists annuity_paid_through_on date,
  -- 外国出願の現況。national_phase = PCTから各国移行済み。
  add column if not exists pct_status text not null default 'unknown'
    check (pct_status in ('none', 'pct_filed', 'national_phase', 'lapsed', 'unknown')),
  add column if not exists pct_number text,
  -- 現在の特許権者。移転があると applicants (出願人) と一致しない。
  add column if not exists current_assignee text[] not null default array[]::text[],
  -- 自社事業での実施状況。not_practicing に年金を払い続けていないかの判断軸。
  add column if not exists practice_status text not null default 'unknown'
    check (practice_status in ('practicing', 'planned', 'not_practicing', 'defensive', 'unknown')),
  -- 年間維持コスト (円)。放棄 or 維持の意思決定を数字で行うため。
  add column if not exists annual_cost_yen numeric,
  -- 手続を握っている社内担当と代理人事務所。
  add column if not exists owner_member_id text,
  add column if not exists attorney_firm text,
  -- 最後に現況を確認した日。古いと画面に「要再調査」を出す。
  add column if not exists last_verified_on date,
  -- 外部API同期で埋まる客観指標。family_size = 同一発明の他国出願数、citation_count = 被引用数。
  add column if not exists family_size integer,
  add column if not exists citation_count integer;

create index if not exists idx_project_ip_assets_annuity
  on project_ip_assets(project_id, annuity_status)
  where annuity_status in ('grace', 'lapsed');

comment on column project_ip_assets.priority_date is
  '優先日。存続期間20年 / PCT国内移行30ヶ月 / 優先権主張12ヶ月の起点。';
comment on column project_ip_assets.examination_requested_on is
  '審査請求日。NULLは未請求。出願から3年を過ぎると請求できず出願が取下げ擬制になる。';
comment on column project_ip_assets.annuity_status is
  '年金 (特許料) の納付状況。na=未登録で対象外 / paid=納付済 / grace=追納期間中 / lapsed=不納で権利消滅。';
comment on column project_ip_assets.pct_status is
  'PCT・外国出願の現況。none=JPのみ / pct_filed=PCT出願済 / national_phase=各国移行済 / lapsed=期限徒過。';
comment on column project_ip_assets.current_assignee is
  '現在の特許権者。移転があると出願人 (applicants) と一致しないため別に持つ。';
comment on column project_ip_assets.practice_status is
  '自社事業での実施状況。not_practicing の権利に維持費を払い続けていないかを見る。';
comment on column project_ip_assets.last_verified_on is
  '最後に現況を確認した日。1年以上前なら一覧に「要再調査」を出す。';
