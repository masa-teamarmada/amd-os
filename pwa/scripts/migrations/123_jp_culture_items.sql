-- 123_jp_culture_items.sql
--
-- 🇯🇵 日本文化マップ (Japanese Culture Map)
--
-- OS トップナビ「🇯🇵」ページのデータ正本。
-- 同じコンテンツを 2 軸で見る:
--   - ジャンル軸 (category_path): マインドマップで 大分類→中分類→小分類 と展開
--   - 地理軸 (prefecture / city): 日本地図で 都道府県→市区町村 とドリルダウン
--
-- 1 コンテンツ = 1 行。例「松山の俳句文化」は
--   category_path = ['文学','俳句']  / prefecture = '愛媛県' / city = '松山市'
-- のように両軸を同時に持つ。
--
-- 投入は当面 admin / service_role 経由 (手で or つくよみに足させて育てるカタログ)。
-- 読み取りは atlas 同様 anon read-only (OS ログインユーザー全員が閲覧可)。

create table if not exists public.jp_culture_items (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,

  -- ジャンル階層 (大分類→中分類→小分類)。例: ['文学','俳句']
  category_path text[] not null default '{}'::text[],

  -- 地理軸。市区町村が未確定なら city は null (= 都道府県レベルのコンテンツ)
  prefecture text,
  city text,

  -- 任意メタ
  links jsonb not null default '[]'::jsonb,   -- [{label, url}] 形式を想定
  image_url text,
  metadata jsonb not null default '{}'::jsonb,

  -- 並び順制御 (大きいほど優先表示)。0 で未設定
  sort_weight integer not null default 0,

  source_kind text not null default 'manual'
    check (source_kind in ('manual','tsukuyomi','codex','import','other')),

  status text not null default 'active'
    check (status in ('active','draft','archived')),

  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jp_culture_items_category
  on public.jp_culture_items using gin(category_path);
create index if not exists idx_jp_culture_items_prefecture
  on public.jp_culture_items(prefecture, city);
create index if not exists idx_jp_culture_items_status
  on public.jp_culture_items(status, sort_weight desc);

alter table public.jp_culture_items enable row level security;

-- read-only クライアント (anon) は active のみ閲覧可
revoke all on public.jp_culture_items from anon;
grant select on public.jp_culture_items to anon;
grant select, insert, update, delete on public.jp_culture_items to authenticated;
grant select, insert, update, delete on public.jp_culture_items to service_role;

drop policy if exists jp_culture_items_anon_read on public.jp_culture_items;
create policy jp_culture_items_anon_read
  on public.jp_culture_items
  for select
  to anon
  using (status = 'active');

drop policy if exists jp_culture_items_auth_read on public.jp_culture_items;
create policy jp_culture_items_auth_read
  on public.jp_culture_items
  for select
  to authenticated
  using (true);

-- 書き込みは admin のみ (amd_os_current_user_is_admin() は 121 migration で定義済み)
drop policy if exists jp_culture_items_admin_write on public.jp_culture_items;
create policy jp_culture_items_admin_write
  on public.jp_culture_items
  for all
  to authenticated
  using (public.amd_os_current_user_is_admin())
  with check (public.amd_os_current_user_is_admin());

-- ---------------------------------------------------------------------------
-- サンプルデータ (= 最初に画面が動くことを確認するための種)
-- ---------------------------------------------------------------------------
insert into public.jp_culture_items (title, description, category_path, prefecture, city, sort_weight, source_kind)
values
  -- 文学 → 俳句 (松山は俳句の聖地)
  ('正岡子規と俳句のまち松山', '近代俳句の祖・正岡子規を生んだ松山。道後温泉や子規記念博物館を中心に俳句文化が息づく。', array['文学','俳句'], '愛媛県', '松山市', 90, 'manual'),
  ('松山・俳句ポスト', '市内各所に設置された俳句投函ポスト。誰でも一句詠んで投函できる、松山ならではの文化装置。', array['文学','俳句'], '愛媛県', '松山市', 70, 'manual'),
  ('夏目漱石「坊っちゃん」の舞台', '漱石が松山中学に赴任した経験から生まれた小説。道後温泉本館は作中「住田の温泉」のモデル。', array['文学','小説'], '愛媛県', '松山市', 60, 'manual'),

  -- 伝統工芸 → 陶磁器 / 染織
  ('砥部焼', '愛媛県砥部町を中心に焼かれる磁器。厚手でぽってりとした白磁に呉須の染付が特徴。', array['伝統工芸','陶磁器'], '愛媛県', '砥部町', 80, 'manual'),
  ('西陣織', '京都・西陣で生産される先染めの紋織物。多品種少量生産の高級織物として知られる。', array['伝統工芸','染織'], '京都府', '京都市', 85, 'manual'),

  -- 食文化
  ('松山鮓 (もぶり鮓)', '瀬戸内の小魚でとった出汁を効かせた松山の郷土ばら寿司。ハレの日のごちそう。', array['食文化','郷土料理'], '愛媛県', '松山市', 50, 'manual'),

  -- 芸能 → 伝統芸能
  ('歌舞伎', '江戸時代に成立した日本を代表する古典演劇。重要無形文化財・ユネスコ無形文化遺産。', array['芸能','伝統演劇'], '東京都', '中央区', 75, 'manual')
on conflict do nothing;
