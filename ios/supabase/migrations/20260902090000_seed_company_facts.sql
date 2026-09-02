-- seed_company_facts — シーズの背後にある会社・技術について、会議や資料で分かった
-- 断片的な事実を1行ずつ貯める台帳。
--
-- なぜ既存の3つでは足りないか:
--   seed_funding      採択という出来事しか入らない
--   seed_news         公表済みの記事・論文・プレスが前提で、出典URLを要求する
--   seed_contact_log  AMDが誰といつ接触したかの記録で、聞いた中身は構造化されない
-- 「ベンチプラントが川崎にある」のような、会議で聞いた設備・体制・顧客の事実は
-- どれにも収まらず、これまで internal_notes の自由記述に埋もれていた。
--
-- この台帳は SPS 初回評価が読む source facts の6系統目になる
-- (同じ migration で sps_initial_assessment_source_snapshot を拡張する)。

create table if not exists public.seed_company_facts (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  category text not null,
  fact text not null,
  detail text,
  observed_on date not null,
  heard_at text,
  source_kind text not null,
  confidence text not null,
  sps_relevance text[] not null default '{}'::text[],
  source_url text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_company_facts_category_check check (category in (
    'facility','scale_up','customer','partner','capital','team','ip',
    'regulation','competition','market','other')),
  constraint seed_company_facts_source_kind_check check (source_kind in (
    'meeting','document','public','hearsay')),
  constraint seed_company_facts_confidence_check check (confidence in (
    'confirmed','reported','unconfirmed')),
  constraint seed_company_facts_relevance_check check (
    sps_relevance <@ array['stage','q','p','bzm30']::text[]),
  constraint seed_company_facts_fact_len_check check (char_length(fact) between 1 and 240)
);

create index if not exists seed_company_facts_seed_idx
  on public.seed_company_facts (seed_id, observed_on desc);

comment on table public.seed_company_facts is
  'シーズの背後にある会社・技術についての断片的な確認事実。1行1事実。SPS初回評価のsource factsの6系統目。';
comment on column public.seed_company_facts.category is
  '何についての事実か。facility=設備・拠点 / scale_up=量産・規模拡大 / customer=顧客・引き合い / partner=提携・出資 / capital=資金 / team=人・体制 / ip=知財 / regulation=規制・許認可 / competition=競合 / market=市場・価格 / other=その他';
comment on column public.seed_company_facts.observed_on is
  'いつ時点の事実か。SPSの情報締切より後の行は評価の素材に入らない。';
comment on column public.seed_company_facts.heard_at is
  'どこで知ったか (例: LST経営会議)。SPSのsource factsには渡さない。';
comment on column public.seed_company_facts.source_kind is
  'meeting=会議・面談で聞いた / document=資料で読んだ / public=公開情報 / hearsay=伝聞';
comment on column public.seed_company_facts.confidence is
  'confirmed=一次資料または当事者で確認済 / reported=会議や人から聞いた話。裏取り前 / unconfirmed=未確認';
comment on column public.seed_company_facts.sps_relevance is
  'SPSのどこに効く事実か。stage=段階仮説 / q=到達見込み / p=産業創出価値の帯 / bzm30=BZM 3.0 の入力。空でもよい。';

alter table public.seed_company_facts enable row level security;

drop policy if exists authenticated_read on public.seed_company_facts;
drop policy if exists authenticated_insert on public.seed_company_facts;
drop policy if exists authenticated_update on public.seed_company_facts;
drop policy if exists authenticated_delete on public.seed_company_facts;
drop policy if exists service_role_bypass on public.seed_company_facts;

create policy authenticated_read on public.seed_company_facts
  for select to authenticated using (public.amd_os_is_member());
create policy authenticated_insert on public.seed_company_facts
  for insert to authenticated with check (public.amd_os_is_member());
create policy authenticated_update on public.seed_company_facts
  for update to authenticated using (public.amd_os_is_member()) with check (public.amd_os_is_member());
create policy authenticated_delete on public.seed_company_facts
  for delete to authenticated using (public.amd_os_is_member());
create policy service_role_bypass on public.seed_company_facts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 同じシーズのsource変更と初回SPS候補の作成を直列化する。他のsource系統と同じ扱い。
drop trigger if exists sps_initial_source_lock on public.seed_company_facts;
create trigger sps_initial_source_lock
  before insert or update or delete on public.seed_company_facts
  for each row execute function public.lock_sps_initial_source_seed();

-- 初回SPS評価が読むsource factsへ company_facts を6系統目として足す。
-- 既存5系統 (seed / funding / news / contacts / projects) の扱いをそのまま踏襲する:
--   ・情報締切より後に更新された行があれば prepare をやり直させる
--   ・本文は safe_text でURL・連絡先・認証情報を落としてから渡す
--   ・fingerprint の材料 (v_state) にも入れ、素材が動いたら候補が stale になるようにする
-- heard_at と source_url は渡さない。どこで聞いたかは評価の材料ではなく、
-- 確からしさは confidence と source_kind が担う。
CREATE OR REPLACE FUNCTION public.sps_initial_assessment_source_snapshot(p_seed_id uuid, p_cutoff timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_facts jsonb; v_state jsonb; v_hash text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.seeds s WHERE s.id=p_seed_id AND s.updated_at>p_cutoff)
     OR EXISTS (SELECT 1 FROM public.seed_funding x WHERE x.seed_id=p_seed_id AND x.updated_at>p_cutoff)
     OR EXISTS (SELECT 1 FROM public.seed_news x WHERE x.seed_id=p_seed_id AND x.updated_at>p_cutoff)
     OR EXISTS (SELECT 1 FROM public.seed_contact_log x WHERE x.seed_id=p_seed_id AND x.updated_at>p_cutoff)
     OR EXISTS (SELECT 1 FROM public.seed_projects x WHERE x.seed_id=p_seed_id AND x.updated_at>p_cutoff)
     OR EXISTS (SELECT 1 FROM public.seed_company_facts x WHERE x.seed_id=p_seed_id AND x.updated_at>p_cutoff)
  THEN RAISE EXCEPTION 'source state changed after information cutoff; prepare again'; END IF;
  SELECT jsonb_build_object(
    'seed', jsonb_build_object('title', public.sps_initial_assessment_safe_text(s.title,240), 'summary', public.sps_initial_assessment_safe_text(s.summary,1000), 'org_name', public.sps_initial_assessment_safe_text(s.org_name,160), 'domain_lane', public.sps_initial_assessment_safe_text(s.domain_lane,80), 'industry_target', coalesce((SELECT jsonb_agg(public.sps_initial_assessment_safe_text(x.value,80) ORDER BY x.ordinality) FROM unnest(s.industry_target) WITH ORDINALITY x(value,ordinality)),'[]'::jsonb), 'keywords', coalesce((SELECT jsonb_agg(public.sps_initial_assessment_safe_text(x.value,80) ORDER BY x.ordinality) FROM unnest(s.keywords) WITH ORDINALITY x(value,ordinality)),'[]'::jsonb), 'trl', s.trl, 'brl', s.brl, 'hrl', s.hrl, 'status', public.sps_initial_assessment_safe_text(s.status,40)),
    'funding', coalesce((SELECT jsonb_agg(jsonb_build_object('source_row_id',f.id,'program',public.sps_initial_assessment_safe_text(f.program,160),'fiscal_year',f.fiscal_year,'status',public.sps_initial_assessment_safe_text(f.status,40),'amount_jpy',f.amount_jpy) ORDER BY f.id) FROM public.seed_funding f WHERE f.seed_id=s.id AND f.updated_at<=p_cutoff AND f.status IN ('awarded','ongoing','completed') AND (f.fiscal_year IS NULL OR f.fiscal_year<=extract(year FROM p_cutoff)::integer)),'[]'::jsonb),
    'news', coalesce((SELECT jsonb_agg(jsonb_build_object('source_row_id',n.id,'kind',public.sps_initial_assessment_safe_text(n.kind,40),'occurred_on',n.occurred_on,'title',public.sps_initial_assessment_safe_text(n.title,180),'body_summary',public.sps_initial_assessment_safe_text(n.body,300)) ORDER BY n.id) FROM public.seed_news n WHERE n.seed_id=s.id AND n.updated_at<=p_cutoff AND n.verified=true AND n.dismissed=false AND coalesce(n.occurred_on::timestamptz,n.created_at) <= p_cutoff),'[]'::jsonb),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('source_row_id',c.id,'contacted_on',c.contacted_on,'method',public.sps_initial_assessment_safe_text(c.method,60)) ORDER BY c.id) FROM public.seed_contact_log c WHERE c.seed_id=s.id AND c.updated_at<=p_cutoff AND c.contacted_on::timestamptz<=p_cutoff),'[]'::jsonb),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id',sp.project_id,'commercialization_stage',public.sps_initial_assessment_safe_text(sp.commercialization_stage,80),'commercialization_route',public.sps_initial_assessment_safe_text(sp.commercialization_route,120),'venture_name',public.sps_initial_assessment_safe_text(sp.venture_name,160),'target_market',public.sps_initial_assessment_safe_text(sp.target_market,200)) ORDER BY sp.project_id) FROM public.seed_projects sp WHERE sp.seed_id=s.id AND sp.updated_at<=p_cutoff),'[]'::jsonb),
    'company_facts', coalesce((SELECT jsonb_agg(jsonb_build_object('source_row_id',cf.id,'category',public.sps_initial_assessment_safe_text(cf.category,40),'fact',public.sps_initial_assessment_safe_text(cf.fact,240),'detail',public.sps_initial_assessment_safe_text(cf.detail,400),'observed_on',cf.observed_on,'source_kind',public.sps_initial_assessment_safe_text(cf.source_kind,40),'confidence',public.sps_initial_assessment_safe_text(cf.confidence,40),'sps_relevance',coalesce((SELECT jsonb_agg(public.sps_initial_assessment_safe_text(x.value,20) ORDER BY x.ordinality) FROM unnest(cf.sps_relevance) WITH ORDINALITY x(value,ordinality)),'[]'::jsonb)) ORDER BY cf.id) FROM public.seed_company_facts cf WHERE cf.seed_id=s.id AND cf.updated_at<=p_cutoff AND cf.observed_on::timestamptz<=p_cutoff),'[]'::jsonb)
  ) INTO v_facts FROM public.seeds s WHERE s.id=p_seed_id;
  IF v_facts IS NULL THEN RAISE EXCEPTION 'seed not found'; END IF;
  SELECT jsonb_build_object('seed_updated_at',s.updated_at,'funding',coalesce((SELECT jsonb_agg(jsonb_build_array(f.id,f.updated_at) ORDER BY f.id) FROM public.seed_funding f WHERE f.seed_id=s.id),'[]'::jsonb),'news',coalesce((SELECT jsonb_agg(jsonb_build_array(n.id,n.updated_at) ORDER BY n.id) FROM public.seed_news n WHERE n.seed_id=s.id),'[]'::jsonb),'contacts',coalesce((SELECT jsonb_agg(jsonb_build_array(c.id,c.updated_at) ORDER BY c.id) FROM public.seed_contact_log c WHERE c.seed_id=s.id),'[]'::jsonb),'projects',coalesce((SELECT jsonb_agg(jsonb_build_array(sp.project_id,sp.updated_at) ORDER BY sp.project_id) FROM public.seed_projects sp WHERE sp.seed_id=s.id),'[]'::jsonb),'company_facts',coalesce((SELECT jsonb_agg(jsonb_build_array(cf.id,cf.updated_at) ORDER BY cf.id) FROM public.seed_company_facts cf WHERE cf.seed_id=s.id),'[]'::jsonb)) INTO v_state FROM public.seeds s WHERE s.id=p_seed_id;
  v_hash := encode(digest(convert_to(v_state::text,'UTF8'),'sha256'),'hex');
  RETURN jsonb_build_object('facts',v_facts,'fingerprint',v_hash);
END; $function$;
