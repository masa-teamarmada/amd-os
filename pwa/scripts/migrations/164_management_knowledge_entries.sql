-- 164_management_knowledge_entries.sql
--
-- Admin-only management knowledge ledger.
-- This stores reusable business/management know-how that should not disappear
-- into local notes or one-off chats.

create table if not exists public.management_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(project_id) on delete set null,
  title text not null,
  category text not null default 'other'
    check (category in (
      'commercialization_route',
      'coalition_design',
      'pricing',
      'sales',
      'finance',
      'governance',
      'organization',
      'fundraising',
      'legal',
      'operations',
      'other'
    )),
  route_type text,
  maturity text not null default 'hypothesis'
    check (maturity in ('raw_note','hypothesis','field_tested','playbook')),
  tags text[] not null default '{}'::text[],
  summary text not null default '',
  body_md text not null default '',
  reusable_when text,
  next_check text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','slack','gmail','notion','drive','calendar','meeting','file','other')),
  source_ref text,
  source_excerpt text,
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  status text not null default 'active'
    check (status in ('active','needs_review','archived','deleted')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_management_knowledge_entries_project_status
  on public.management_knowledge_entries(project_id, status, updated_at desc);
create index if not exists idx_management_knowledge_entries_category
  on public.management_knowledge_entries(category, maturity, updated_at desc);
create index if not exists idx_management_knowledge_entries_tags
  on public.management_knowledge_entries using gin(tags);
create index if not exists idx_management_knowledge_entries_source_kind
  on public.management_knowledge_entries(source_kind);
create unique index if not exists idx_management_knowledge_entries_source_title
  on public.management_knowledge_entries(source_ref, title)
  where source_ref is not null;

alter table public.management_knowledge_entries enable row level security;

revoke all on public.management_knowledge_entries from anon;
grant select, insert, update, delete on public.management_knowledge_entries to authenticated;
grant select, insert, update, delete on public.management_knowledge_entries to service_role;

drop policy if exists management_knowledge_entries_service on public.management_knowledge_entries;
create policy management_knowledge_entries_service
  on public.management_knowledge_entries
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists management_knowledge_entries_admin on public.management_knowledge_entries;
create policy management_knowledge_entries_admin
  on public.management_knowledge_entries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.management_knowledge_entries is
  'Admin-only ledger for reusable AMD management know-how, playbooks, and decision patterns.';
comment on column public.management_knowledge_entries.project_id is
  'Optional project link. Null means AMD-wide reusable knowledge.';
comment on column public.management_knowledge_entries.maturity is
  'raw_note / hypothesis / field_tested / playbook. This separates early insight from reusable doctrine.';
comment on column public.management_knowledge_entries.source_excerpt is
  'Short evidence excerpt only. Do not store full emails, transcripts, or documents here.';
comment on column public.management_knowledge_entries.metadata_json is
  'Structured helper fields for future extraction or OS views. UI must not depend on unreviewed raw text here.';

insert into public.management_knowledge_entries (
  title,
  category,
  route_type,
  maturity,
  tags,
  summary,
  body_md,
  reusable_when,
  next_check,
  source_kind,
  source_ref,
  source_excerpt,
  confidence,
  status,
  metadata_json,
  created_by,
  updated_by
) values (
  'Proto-RT型: 会社化前に共同実装の場を組む事業化ルート',
  'commercialization_route',
  'Proto-RT / Roundtable',
  'hypothesis',
  array['RT','Proto-RT','事業化ルート','共同実装','藻場回復','CRL'],
  'ラウンドテーブル型は最終法人形態ではなく、会社化前に市場・関係者・資金・信用を形成する方法として扱う。中心DTSUが未定の段階ではProto-RTで始め、不可逆コミットが見えた段階でStrict RTや別の器へ落とす。',
  $md$
## 核心

RTは「何の法人にするか」の答えではなく、法人を作る前に、誰が金・現場・信用・需要・許認可・還流を持ち寄るかを設計する方法。

最初から大学発スタートアップへ押し込むより、共同実装のテーブルを作った方が自然なシーズがある。特に、価値が単一顧客の売上ではなく、地域、環境、企業開示、自治体政策、金融の信用付けに分散している場合。

## 2段階で見る

- Proto-RT: 中心DTSU未定のまま、技術・現場・資金・行政・漁協・企業スポンサーを並べる共同実装設計の場。
- Strict RT: 中心DTSUまたは中心事業体を定義し、参加者が経済的コミットと対価権利で結びつく状態。

中心事業体を早く決めすぎると、自治体・漁協・スポンサーが「特定企業の利益に乗せられる」と見て警戒しやすい。

## 向く条件

- 価値が外部性を持ち、単一顧客だけでは支払い理由が弱い。
- 許認可、現場、信用、地域調整が重要。
- 最初の売上よりも、誰が集まったか、誰がコミットしたか自体が次の参加者を呼ぶ。
- 会議体ではなく、不可逆コミットを設計できる。

## AMDの提供価値

AMDが売るべきものは会議の事務局ではなく、どの関係者に、どの順番で、どんな対価を置くと、お金と信用が流れ始めるかを設計する力。

メニュー化するなら、RT診断、RT設計スプリント、RT組成支援、RT運営/事業体化の4段階。

## 藻場回復シーズへの当てはめ

初手はStrict RTではなくProto-RT。まず決めるのは法人形態ではなく、価値の主語、最小実装単位、不可逆コミット、対価権利、将来の器。

最小実装単位は、1基ではなく、10-20基、1海域、半年から1年、500万から1,000万円程度の Blue Recovery Unit として考える。

対価は、株式や収益分配に急がず、スポンサー証明、環境価値レポート、現地視察、社員参加、教育プログラム、命名権、共同発表から設計する。

## OS上の扱い

`commercialization_route_candidate` として、SU / Small Business / Small M&A / IP License / RT / Proto-RT を並べる。

一方で、`coalition_readiness` として、関係者コミットの成熟度を見る。前者は仮説、後者は実際に点火しているかの進捗。混ぜない。

## 注意

RTは会議を開けば進むという意味ではない。看板連携で終わるならRTではない。参加者が不可逆コミットを出し、次の参加者がそれを見て動き、中心事業体または中心実装主体の価値が上がる場合だけRTと呼べる。

NFT、証券化、収益分配、投資商品に見える表現は初期に出しすぎない。独禁法、金融商品取引法、公共調達、補助金、海域利用、漁業権は法務確認が必要。
$md$,
  '地域・公共性・環境価値・企業開示・金融信用など、価値が複数者へ分散し、単独会社や単独顧客では市場が立ち上がりにくいシーズ。',
  'CRL L2相当の不可逆コミット定義、coalition_readiness のDB化、RT診断/設計スプリントの標準成果物を詰める。',
  'file',
  '/Users/masa/projects/AMD/kagawa/2026-07-03_roundtable_commercialization_type_memo.md',
  'RTは最終形態ではなく、会社化前の市場形成・関係形成・資金形成の型として捉える。',
  0.80,
  'active',
  jsonb_build_object(
    'source_project', 'kagawa',
    'case', '藻場回復シーズ',
    'candidate_fields', array['commercialization_route_candidate','coalition_readiness'],
    'created_from', '2026-07-03 roundtable commercialization memo'
  ),
  'eimi',
  'eimi'
) on conflict do nothing;
