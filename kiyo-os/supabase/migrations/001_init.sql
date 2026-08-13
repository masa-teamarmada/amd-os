-- きよOS 初期スキーマ（案）
--
-- ⚠️ まだ本番に適用していません。
--    Supabase プロジェクトを作るかどうかは未決（月額 $10）。
--    適用はまさの承認後。適用済みの migration を再適用しないこと。
--
-- 方針:
--   - 全 table に RLS を付ける。付けない table を作らない
--   - きよ本人だけが自分の行を読み書きできる
--   - 秘密値（API キー等）はこの DB に入れない

-- ---------------------------------------------------------------
-- profiles: 利用者。今のところ きよ 1 人だが、後で増やせる形にしておく
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: 自分の行だけ読める"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: 自分の行だけ更新できる"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------
-- wishes: きよの「ほしいもの」。今は src/lib/wishlist.ts に持っているが、
--         画面から足せるようにするならこの table へ移す
-- ---------------------------------------------------------------
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null check (category in ('質問', '候補メニュー', '仕事まわり', 'きよが書いた')),
  title       text not null,
  detail      text not null default '',
  state       text not null default '聞いた'
                check (state in ('聞いた', '作ると決めた', '作った', 'やめた')),
  note        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.wishes enable row level security;

create policy "wishes: 自分の行だけ扱える"
  on public.wishes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists wishes_user_state_idx
  on public.wishes (user_id, state, sort_order);

comment on table public.wishes is
  'きよOS に入れる機能の候補。docs/INTAKE.md と対。実装が決まったものだけ DESIGN.md へ移す。';

-- ---------------------------------------------------------------
-- notes: 「今日」画面のひとことメモ。1 日 1 行
-- ---------------------------------------------------------------
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  on_date     date not null,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, on_date)
);

alter table public.notes enable row level security;

create policy "notes: 自分の行だけ扱える"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.notes is 'きよの日次メモ。1 日 1 行。';
