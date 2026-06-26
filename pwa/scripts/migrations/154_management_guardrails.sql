-- 154_management_guardrails.sql
--
-- 目的: まさの頭の中にある「先に気づくべき経営ノウハウ」を OS 上の
--       経営ガードレールとして保存し、PJ / アクションのタグと照合して通知する。
--
-- 設計メモ:
--   - AMD Protocol は「実際に起きた判断・結果」の事例記録。
--   - guardrail_cards は「次に同じ事故を起こさないための予防ルール」。
--   - guardrail_matches は、カードがどのPJ/アクションで発火したかの履歴。
--
-- RLS 方針:
--   経営・法務・商談上の機微を含むため anon SELECT は付与しない。
--   service_role と admin のみ ALL。

-- ============================================================
-- guardrail_tag_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guardrail_tag_definitions (
  tag_id        text PRIMARY KEY,                 -- axis:tag
  axis          text NOT NULL,
  tag           text NOT NULL,
  label         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'active',
  display_order int NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardrail_tag_definitions_axis_tag_unique UNIQUE (axis, tag),
  CONSTRAINT guardrail_tag_definitions_status_check CHECK (status IN ('active', 'archived'))
);
CREATE INDEX IF NOT EXISTS guardrail_tag_definitions_axis_idx ON public.guardrail_tag_definitions(axis, display_order);
CREATE INDEX IF NOT EXISTS guardrail_tag_definitions_status_idx ON public.guardrail_tag_definitions(status);

-- ============================================================
-- guardrail_cards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guardrail_cards (
  card_id             text PRIMARY KEY,             -- gr:<slug>
  title               text NOT NULL,
  summary             text NOT NULL,
  rationale           text,
  severity            text NOT NULL DEFAULT 'medium',
  trigger_tags        jsonb NOT NULL DEFAULT '{}'::jsonb,
  negative_tags       jsonb NOT NULL DEFAULT '{}'::jsonb,
  check_items         jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_template     text,
  source_protocol_ids text[] NOT NULL DEFAULT '{}'::text[],
  source_refs_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'active',
  created_by          text NOT NULL DEFAULT 'masa',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardrail_cards_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT guardrail_cards_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT guardrail_cards_trigger_tags_object CHECK (jsonb_typeof(trigger_tags) = 'object'),
  CONSTRAINT guardrail_cards_negative_tags_object CHECK (jsonb_typeof(negative_tags) = 'object'),
  CONSTRAINT guardrail_cards_check_items_array CHECK (jsonb_typeof(check_items) = 'array'),
  CONSTRAINT guardrail_cards_recommended_actions_array CHECK (jsonb_typeof(recommended_actions) = 'array')
);
CREATE INDEX IF NOT EXISTS guardrail_cards_status_idx ON public.guardrail_cards(status);
CREATE INDEX IF NOT EXISTS guardrail_cards_severity_idx ON public.guardrail_cards(severity);
CREATE INDEX IF NOT EXISTS guardrail_cards_trigger_tags_idx ON public.guardrail_cards USING gin(trigger_tags);

-- ============================================================
-- guardrail_matches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guardrail_matches (
  match_id           text PRIMARY KEY,              -- gm:<sha>
  card_id            text NOT NULL REFERENCES public.guardrail_cards(card_id),
  project_id         text REFERENCES public.projects(project_id),
  target_type        text NOT NULL,                 -- meeting/action/project/contract/incorporation/...
  target_id          text NOT NULL,
  target_title       text,
  target_date        timestamptz,
  project_tags       jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_tags        jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_tags       jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_score        numeric NOT NULL DEFAULT 1,
  severity           text NOT NULL,
  status             text NOT NULL DEFAULT 'open',
  due_at             timestamptz,
  source_hash        text NOT NULL UNIQUE,
  notification_id    uuid REFERENCES public.l2_notifications(notification_id) ON DELETE SET NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by         text NOT NULL DEFAULT 'guardrail_evaluator',
  detected_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardrail_matches_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT guardrail_matches_status_check CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed', 'snoozed')),
  CONSTRAINT guardrail_matches_project_tags_object CHECK (jsonb_typeof(project_tags) = 'object'),
  CONSTRAINT guardrail_matches_action_tags_object CHECK (jsonb_typeof(action_tags) = 'object'),
  CONSTRAINT guardrail_matches_matched_tags_object CHECK (jsonb_typeof(matched_tags) = 'object'),
  CONSTRAINT guardrail_matches_evidence_refs_array CHECK (jsonb_typeof(evidence_refs_json) = 'array')
);
CREATE INDEX IF NOT EXISTS guardrail_matches_card_idx ON public.guardrail_matches(card_id);
CREATE INDEX IF NOT EXISTS guardrail_matches_project_idx ON public.guardrail_matches(project_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS guardrail_matches_status_idx ON public.guardrail_matches(status, severity);
CREATE INDEX IF NOT EXISTS guardrail_matches_target_idx ON public.guardrail_matches(target_type, target_id);
CREATE INDEX IF NOT EXISTS guardrail_matches_project_tags_idx ON public.guardrail_matches USING gin(project_tags);
CREATE INDEX IF NOT EXISTS guardrail_matches_action_tags_idx ON public.guardrail_matches USING gin(action_tags);

-- ============================================================
-- guardrail_feedbacks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guardrail_feedbacks (
  feedback_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      text REFERENCES public.guardrail_matches(match_id) ON DELETE CASCADE,
  card_id       text REFERENCES public.guardrail_cards(card_id),
  action        text NOT NULL,                       -- acknowledge/resolve/dismiss/comment/edit_request
  feedback_text text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guardrail_feedbacks_match_idx ON public.guardrail_feedbacks(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guardrail_feedbacks_card_idx ON public.guardrail_feedbacks(card_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.guardrail_tag_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guardrail_tag_definitions_service" ON public.guardrail_tag_definitions;
CREATE POLICY "guardrail_tag_definitions_service" ON public.guardrail_tag_definitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "guardrail_tag_definitions_admin" ON public.guardrail_tag_definitions;
CREATE POLICY "guardrail_tag_definitions_admin" ON public.guardrail_tag_definitions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.guardrail_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guardrail_cards_service" ON public.guardrail_cards;
CREATE POLICY "guardrail_cards_service" ON public.guardrail_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "guardrail_cards_admin" ON public.guardrail_cards;
CREATE POLICY "guardrail_cards_admin" ON public.guardrail_cards
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.guardrail_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guardrail_matches_service" ON public.guardrail_matches;
CREATE POLICY "guardrail_matches_service" ON public.guardrail_matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "guardrail_matches_admin" ON public.guardrail_matches;
CREATE POLICY "guardrail_matches_admin" ON public.guardrail_matches
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.guardrail_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guardrail_feedbacks_service" ON public.guardrail_feedbacks;
CREATE POLICY "guardrail_feedbacks_service" ON public.guardrail_feedbacks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "guardrail_feedbacks_admin" ON public.guardrail_feedbacks;
CREATE POLICY "guardrail_feedbacks_admin" ON public.guardrail_feedbacks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- Initial tag vocabulary
-- ============================================================
INSERT INTO public.guardrail_tag_definitions (tag_id, axis, tag, label, description, display_order) VALUES
  ('phase:pre_incorporation', 'phase', 'pre_incorporation', '設立前', '法人設立前の準備・合意形成フェーズ', 10),
  ('phase:founder_alignment', 'phase', 'founder_alignment', '創業者合意', '創業者間の役割・持分・責任を固める局面', 20),
  ('phase:enterprise_first_contact', 'phase', 'enterprise_first_contact', '大企業初回接点', '大企業との初回接点や初回MTG前後', 30),
  ('phase:sales_entry', 'phase', 'sales_entry', '営業入口', '顧客・提携候補への入口設計', 40),
  ('phase:partner_development', 'phase', 'partner_development', '提携開拓', '共同開発・事業提携の探索', 50),
  ('phase:confidential_disclosure', 'phase', 'confidential_disclosure', '秘密情報開示', '非公開情報・技術情報を外部へ渡す前後', 60),
  ('phase:poc_planning', 'phase', 'poc_planning', 'PoC計画', 'PoC設計・データ取得・現場検証前後', 70),
  ('phase:joint_development', 'phase', 'joint_development', '共同開発', '共同研究・共同開発・独占交渉前後', 80),
  ('phase:shared_meeting', 'phase', 'shared_meeting', '複数者MTG', '社内外の複数者が参加する会議', 90),
  ('phase:university_collaboration', 'phase', 'university_collaboration', '大学連携', '大学・研究機関との連携、教員関与、兼業/COI', 100),
  ('phase:fundraising', 'phase', 'fundraising', '資金調達', '投資家接点、条件交渉、資本政策', 110),
  ('phase:external_publication', 'phase', 'external_publication', '外部公表', 'PR・採択・導入事例・Web掲載', 120),
  ('phase:research_sample_handling', 'phase', 'research_sample_handling', '試料取扱', '研究試料・現物・測定データの授受', 130),
  ('action_type:incorporation', 'action_type', 'incorporation', '法人設立', '法人設立や登記の準備', 10),
  ('action_type:equity_allocation', 'action_type', 'equity_allocation', '持分配分', '株式・持分・オプション配分', 20),
  ('action_type:founder_agreement', 'action_type', 'founder_agreement', '創業者合意', '創業者間契約・株主間契約・役割合意', 30),
  ('action_type:external_meeting', 'action_type', 'external_meeting', '外部MTG', '外部相手とのMTG', 40),
  ('action_type:intro', 'action_type', 'intro', '紹介', '紹介・接続・展示会フォロー', 50),
  ('action_type:exhibition_followup', 'action_type', 'exhibition_followup', '展示会フォロー', '展示会やイベントでの接点後のフォロー', 60),
  ('action_type:nda', 'action_type', 'nda', 'NDA', '秘密保持契約の締結・確認', 70),
  ('action_type:document_sharing', 'action_type', 'document_sharing', '資料共有', '提案書・技術資料・未公開情報の共有', 80),
  ('action_type:data_request', 'action_type', 'data_request', 'データ依頼', '顧客・現場・研究データの取得依頼', 90),
  ('action_type:poc', 'action_type', 'poc', 'PoC', 'PoCや実証の設計・実施', 100),
  ('action_type:joint_development_contract', 'action_type', 'joint_development_contract', '共同開発契約', '共同開発・共同研究・独占条件の契約', 110),
  ('action_type:strategic_pivot', 'action_type', 'strategic_pivot', '方針転換', '会議中の戦略転換・提案方針変更', 120),
  ('action_type:operating_company_setup', 'action_type', 'operating_company_setup', '事業会社化', 'SU/事業会社の設立・経営参画', 130),
  ('action_type:pr_release', 'action_type', 'pr_release', 'PR', 'プレスリリースや外部発信', 140),
  ('action_type:public_announcement', 'action_type', 'public_announcement', '外部発表', '採択・提携・出資などの公表', 150),
  ('domain:governance', 'domain', 'governance', 'ガバナンス', '株主・取締役・意思決定・統治', 10),
  ('domain:legal', 'domain', 'legal', '法務', '契約・規約・権利義務', 20),
  ('domain:startup_formation', 'domain', 'startup_formation', 'SU組成', 'スタートアップ設立・創業者設計', 30),
  ('domain:sales', 'domain', 'sales', '営業', '顧客開拓・商談・導入', 40),
  ('domain:alliance', 'domain', 'alliance', '提携', 'アライアンス・共同開発・連携', 50),
  ('domain:new_business', 'domain', 'new_business', '新規事業', '新規事業部門・事業開発', 60),
  ('domain:intellectual_property', 'domain', 'intellectual_property', '知財', '特許・ノウハウ・成果物帰属', 70),
  ('domain:data_governance', 'domain', 'data_governance', 'データ管理', 'データ利用許諾・個人情報・研究データ', 80),
  ('domain:research_operations', 'domain', 'research_operations', '研究運用', '試料・測定・研究現場運用', 90),
  ('domain:university', 'domain', 'university', '大学', '大学・研究機関との制度対応', 100),
  ('domain:funding', 'domain', 'funding', '資金調達', '投資・資本政策・調達広報', 110),
  ('domain:communications', 'domain', 'communications', '広報', '外部発信・PR・メディア', 120),
  ('domain:compliance', 'domain', 'compliance', 'コンプラ', '規程・利益相反・承諾・監査', 130),
  ('counterparty_role:engineer', 'counterparty_role', 'engineer', '技術者', '現場技術者・研究者・実装担当', 10),
  ('counterparty_role:technical_contact', 'counterparty_role', 'technical_contact', '技術窓口', '技術側の一次窓口', 20),
  ('counterparty_role:corporate_planning', 'counterparty_role', 'corporate_planning', '経営企画', '経営企画・企画部門', 30),
  ('counterparty_role:new_business', 'counterparty_role', 'new_business', '新規事業', '新規事業・事業開発部門', 40),
  ('counterparty_role:university_faculty', 'counterparty_role', 'university_faculty', '大学教員', '大学教員・研究代表者', 50),
  ('counterparty_role:university_admin', 'counterparty_role', 'university_admin', '大学事務', '産学連携・URA・事務局', 60),
  ('counterparty_role:investor', 'counterparty_role', 'investor', '投資家', 'VC・CVC・エンジェル投資家', 70),
  ('counterparty_role:media', 'counterparty_role', 'media', 'メディア', '記者・媒体・広報代理店', 80),
  ('risk:equity_deadlock', 'risk', 'equity_deadlock', '持分デッドロック', '持分や議決権が後から詰まるリスク', 10),
  ('risk:founder_conflict', 'risk', 'founder_conflict', '創業者対立', '創業者間の離脱・対立・責任不明確化', 20),
  ('risk:wrong_entry_route', 'risk', 'wrong_entry_route', '入口ミス', '相手組織への入口が弱く、社内で動かないリスク', 30),
  ('risk:relationship_contamination', 'risk', 'relationship_contamination', '関係性汚染', '最初の接点で相手企業内の見え方が悪くなるリスク', 40),
  ('risk:confidential_leak', 'risk', 'confidential_leak', '秘密漏えい', '秘密情報・技術情報が守られないリスク', 50),
  ('risk:unauthorized_data_use', 'risk', 'unauthorized_data_use', '無許諾データ利用', '権限のないデータ利用・共有', 60),
  ('risk:ip_contamination', 'risk', 'ip_contamination', '知財混線', '成果物・バックグラウンドIP・改良発明の帰属混線', 70),
  ('risk:exclusive_lock_in', 'risk', 'exclusive_lock_in', '独占ロックイン', '独占・優先交渉で将来選択肢が狭まるリスク', 80),
  ('risk:team_alignment_break', 'risk', 'team_alignment_break', 'チーム認識ズレ', '会議中にチーム内合意のない方針変更を出すリスク', 90),
  ('risk:coi_violation', 'risk', 'coi_violation', '利益相反違反', '大学・研究機関の利益相反、兼業、職務発明規程違反', 100),
  ('risk:side_job_rule', 'risk', 'side_job_rule', '兼業規程', '教員・研究者の兼業/役員就任規程に触れるリスク', 110),
  ('risk:premature_commitment', 'risk', 'premature_commitment', '早すぎる確約', '出資・提携・公表などを条件未確定で約束するリスク', 120),
  ('risk:public_misstatement', 'risk', 'public_misstatement', '外部発信ミス', '未承諾・誇大・守秘違反の公表リスク', 130),
  ('risk:chain_of_custody_loss', 'risk', 'chain_of_custody_loss', '試料管理欠落', '試料・測定データの授受履歴が残らないリスク', 140),
  ('risk:consent_gap', 'risk', 'consent_gap', '承諾漏れ', '相手方・大学・投資家・共同研究先の承諾漏れ', 150),
  ('artifact:sha', 'artifact', 'sha', '創業者間SHA', '創業者間株主間契約・創業者合意書', 10),
  ('artifact:nda', 'artifact', 'nda', 'NDA', '秘密保持契約', 20),
  ('artifact:contract', 'artifact', 'contract', '契約書', '契約書・覚書・条件書', 30),
  ('artifact:data', 'artifact', 'data', 'データ', 'データセット・測定データ・顧客データ', 40),
  ('artifact:sample', 'artifact', 'sample', '試料', '現物試料・サンプル・評価品', 50),
  ('artifact:press_release', 'artifact', 'press_release', 'プレスリリース', 'PR文・ニュース・Web掲載', 60),
  ('artifact:cap_table', 'artifact', 'cap_table', '資本政策表', '株主構成・持分・資本政策表', 70)
ON CONFLICT (tag_id) DO UPDATE SET
  axis = EXCLUDED.axis,
  tag = EXCLUDED.tag,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  status = 'active',
  updated_at = now();

-- ============================================================
-- Initial guardrail cards
-- ============================================================
INSERT INTO public.guardrail_cards (
  card_id,
  title,
  summary,
  rationale,
  severity,
  trigger_tags,
  check_items,
  recommended_actions,
  output_template,
  source_refs_json,
  created_by
) VALUES
  (
    'gr:founder-sha-before-incorporation',
    '設立前に創業者間SHAを締結する',
    '法人設立や持分配分を進める前に、創業者間SHA / 創業者合意で役割、持分、退職時の扱い、重要決議、IP帰属を固める。',
    '設立後に創業者の離脱、持分、拒否権、IP帰属が揉めると、資金調達・提携・事業化のすべてが重くなる。',
    'critical',
    '{"phase":["pre_incorporation","founder_alignment"],"action_type":["incorporation","equity_allocation","founder_agreement"],"domain":["governance","legal","startup_formation"]}'::jsonb,
    '["創業者候補と持分比率は確定しているか","退職・離脱時の株式買取 / vesting / good leaver / bad leaver は決めたか","IP譲渡・職務発明・競業避止の整理は済んでいるか","重要決議・deadlock・代表者権限は決めたか"]'::jsonb,
    '["設立作業を進める前に創業者合意ドラフトを作る","弁護士レビューまたは最低限の条項チェックを入れる","未合意のまま登記・株式発行・対外説明を進めない"]'::jsonb,
    '設立前ガードレール: 創業者間SHA / 創業者合意が未確認。登記・持分配分・外部説明の前に、役割/持分/離脱/IP/重要決議を確認して。',
    '[{"kind":"user_conversation","date":"2026-06-26","summary":"設立前に創業者間SHAを締結しておかないと後で大変、というまさの経営ノウハウ"}]'::jsonb,
    'masa'
  ),
  (
    'gr:enterprise-entry-route',
    '大企業への入口は経営企画・新規事業へ寄せる',
    '大企業との初回接点や展示会フォローでは、現場技術者だけで進めず、経営企画・新規事業・事業部意思決定者へ入口を設計する。',
    '技術者レベルで興味を持たれても、相手社内で動かず、最初の見え方が固定されると関係性が微妙になる。',
    'high',
    '{"phase":["enterprise_first_contact","sales_entry","partner_development"],"action_type":["external_meeting","intro","exhibition_followup"],"counterparty_role":["engineer","technical_contact"],"domain":["sales","alliance","new_business"]}'::jsonb,
    '["相手は意思決定・予算・新規事業テーマを持つ部署か","現場技術者だけが窓口になっていないか","紹介者に経営企画/新規事業/事業部長級への接続を頼めるか","初回説明の位置づけが技術相談でなく事業テーマになっているか"]'::jsonb,
    '["MTG前に相手社内の入口部署を再確認する","技術者接点の場合は、次回に経営企画・新規事業担当同席を依頼する","SX/AMD紹介資料を相手企業の事業テーマ文脈へ寄せる"]'::jsonb,
    '入口ガードレール: 技術窓口だけで進めると相手社内で動かない可能性が高い。経営企画・新規事業・事業部意思決定者への入口を確認して。',
    '[{"kind":"user_conversation","date":"2026-06-26","summary":"SX×三浦工業MTGで、技術者入口だけでは動かないことが発覚"}]'::jsonb,
    'masa'
  ),
  (
    'gr:nda-before-confidential-disclosure',
    '秘密情報を出す前にNDAと開示範囲を決める',
    '未公開技術、顧客情報、事業計画、研究データを外部へ渡す前に、NDAの有無、開示範囲、二次共有禁止、資料の透かし/版管理を確認する。',
    '深い技術・事業情報を先に出すと、提携交渉や知財帰属で不利になりやすい。',
    'high',
    '{"phase":["confidential_disclosure"],"action_type":["nda","document_sharing"],"domain":["legal","intellectual_property"],"artifact":["nda"]}'::jsonb,
    '["NDA締結済みか","資料に confidential / 共有範囲 / 日付 / 版が入っているか","相手側の再共有先を把握しているか","開示しない情報を先に決めているか"]'::jsonb,
    '["NDA未締結なら概要資料に留める","資料共有前に相手方・目的・再共有可否を明文化する","深い情報は段階開示にする"]'::jsonb,
    '秘密情報ガードレール: NDAまたは開示範囲が未確認。資料共有前に、何を誰へどこまで出すか確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"一般的な深い技術情報・事業情報の開示事故防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:poc-data-permission',
    'PoCデータは利用許諾と責任分界を先に取る',
    'PoCや現場検証で顧客・大学・研究現場のデータを扱う前に、利用目的、保存場所、個人情報/営業秘密、成果物への利用可否を確認する。',
    'PoCが進んだ後にデータ利用権限が曖昧だと、成果物を営業・資金調達・論文化に使えなくなる。',
    'high',
    '{"phase":["poc_planning"],"action_type":["data_request","poc"],"domain":["data_governance","legal"],"artifact":["data"]}'::jsonb,
    '["データ提供者と権限者は一致しているか","利用目的・保存先・閲覧者・削除条件は明確か","成果物や学習データへの転用可否は確認済みか","個人情報・営業秘密・研究倫理に触れないか"]'::jsonb,
    '["PoC開始前にデータ利用メモか契約条項を作る","個人情報/営業秘密がある場合は最小化・匿名化・保存期限を決める","成果物利用の可否を必ず明記する"]'::jsonb,
    'PoCデータガードレール: データ利用許諾が未確認。PoC開始前に、利用目的・保存先・成果物利用可否を確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"PoCデータの利用許諾・責任分界の事故防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:joint-development-exclusivity-ip',
    '共同開発は独占・知財・成果物帰属を先に分ける',
    '共同開発や共同研究では、バックグラウンドIP、フォアグラウンドIP、改良発明、独占/優先交渉、成果物利用範囲を先に切り分ける。',
    '条件を曖昧にしたまま進むと、将来の資金調達・別顧客展開・特許出願が止まる。',
    'high',
    '{"phase":["joint_development"],"action_type":["joint_development_contract"],"domain":["alliance","intellectual_property","legal"],"risk":["ip_contamination","exclusive_lock_in"]}'::jsonb,
    '["既存IPと共同開発成果を分けているか","独占/優先交渉/競業制限の期間と範囲は限定されているか","改良発明の出願権・利用権を決めたか","相手方成果の営業利用・資金調達資料利用可否は明確か"]'::jsonb,
    '["共同開発前にIP整理表を作る","独占条項は対象・期間・解除条件を狭くする","成果物の二次利用可否を契約前に確認する"]'::jsonb,
    '共同開発ガードレール: IP/独占条件が未確認。共同開発前に、既存IP・成果物・改良発明・展開権を分けて確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"共同開発の独占・知財・成果物帰属事故防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:unbriefed-pivot-in-shared-meeting',
    '複数者MTGで未合意の方針転換を出さない',
    '社内外の複数者がいるMTGでは、事前にチーム内で合意していない大きな方針転換・条件提示・立場変更をその場で出さない。',
    '参加者間で認識が割れると、相手に混乱や不信を与え、以後の交渉コストが上がる。',
    'medium',
    '{"phase":["shared_meeting"],"action_type":["strategic_pivot"],"domain":["governance","communications"],"risk":["team_alignment_break"]}'::jsonb,
    '["事前に出してよい論点・出さない論点を決めたか","条件変更や方針転換は関係者に共有済みか","その場で決めず持ち帰るラインを決めたか"]'::jsonb,
    '["大きな方針転換はMTG前にチーム内で合意する","未合意なら「持ち帰り確認」にする","議事録には決定/未決を明確に分ける"]'::jsonb,
    'MTG方針ガードレール: チーム内未合意の方針転換っぽい。外部MTG前に、出してよい条件と持ち帰る条件を確認して。',
    '[{"kind":"memory_feedback","date":"2026-06-26","summary":"shared meeting で一方的な pivot を避ける"}]'::jsonb,
    'masa'
  ),
  (
    'gr:university-coi-side-job',
    '大学連携はCOI・兼業・職務発明を先に確認する',
    '大学教員や研究者がSU設立・役員就任・株式保有・共同研究に関わる場合、利益相反、兼業、職務発明、大学承認の要否を先に確認する。',
    '制度確認なしで事業会社化や株式設計を進めると、大学承認・契約・知財で後戻りが大きい。',
    'critical',
    '{"phase":["university_collaboration"],"action_type":["operating_company_setup","incorporation"],"counterparty_role":["university_faculty","university_admin"],"domain":["university","compliance","legal"],"risk":["coi_violation","side_job_rule"]}'::jsonb,
    '["教員の兼業・役員就任・株式保有ルールを確認したか","大学の利益相反委員会/産学連携窓口への相談が必要か","職務発明・共同研究成果・大学帰属IPを整理したか","学生/研究員の関与条件は明確か"]'::jsonb,
    '["大学の産学連携/URA/知財部門へ早めに確認する","COI・兼業・職務発明のチェックリストを作る","株式/役職/報酬は制度確認後に確定する"]'::jsonb,
    '大学COIガードレール: 教員関与や事業会社化の前に、COI・兼業・職務発明・大学承認を確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"大学発SU/共同研究のCOI・兼業・職務発明事故防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:fundraising-cap-table-public-commitment',
    '資本政策や出資条件を早く外に確約しない',
    '資金調達・CVC・投資家接点では、資本政策、評価額、優先権、出資枠、既存株主合意を整理する前に外部へ確約しない。',
    '早い段階の口約束が後の投資条件や既存株主説明を縛り、ラウンド設計を歪める。',
    'high',
    '{"phase":["fundraising"],"action_type":["public_announcement","intro"],"counterparty_role":["investor"],"domain":["funding","governance","legal"],"artifact":["cap_table"]}'::jsonb,
    '["現在のcap tableと将来ラウンド設計を確認したか","既存株主・創業者間の承認が必要か","CVC/事業会社に優先権や独占を匂わせていないか","公表前提の条件か非公開の探索かを分けたか"]'::jsonb,
    '["投資家接点前に資本政策メモを作る","条件は non-binding と明示する","公表や優先交渉は既存関係者確認後にする"]'::jsonb,
    '資本政策ガードレール: 出資条件やcap tableまわりを外部へ確約しそう。既存株主・創業者合意・将来ラウンドを確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"資本政策・出資条件の早すぎる外部確約防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:sample-chain-of-custody',
    '研究試料・サンプルは授受履歴を残す',
    '研究試料、評価品、測定対象物を受け渡すときは、所有者、保管場所、利用目的、返却/廃棄条件、測定データ帰属を記録する。',
    '試料や測定データの由来が曖昧だと、成果の信用、契約、研究倫理、後続検証が崩れる。',
    'high',
    '{"phase":["research_sample_handling"],"action_type":["poc","data_request"],"domain":["research_operations","data_governance","compliance"],"artifact":["sample","data"],"risk":["chain_of_custody_loss"]}'::jsonb,
    '["誰から誰へ、何を、いつ渡したか記録したか","保管場所・返却/廃棄条件を決めたか","測定データの帰属・共有範囲を確認したか","第三者試料や規制対象物ではないか"]'::jsonb,
    '["試料授受メモを作る","写真・ラベル・管理番号を残す","返却/廃棄/データ共有条件を明文化する"]'::jsonb,
    '試料管理ガードレール: 試料・測定データの授受履歴が未確認。所有者・保管・返却/廃棄・データ帰属を記録して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"研究試料・測定データの chain of custody 防止"}]'::jsonb,
    'masa'
  ),
  (
    'gr:pr-consent-before-publication',
    '外部公表は相手方承諾と表現確認を取る',
    'PR、採択、提携、導入事例、大学/企業名の外部公表では、相手方承諾、表現、未公開情報、肩書き、ロゴ利用、タイミングを確認する。',
    '公表内容のズレは相手方との信頼を損ない、守秘義務やレピュテーション事故につながる。',
    'high',
    '{"phase":["external_publication"],"action_type":["pr_release","public_announcement"],"domain":["communications","legal","compliance"],"artifact":["press_release"],"risk":["public_misstatement","consent_gap"]}'::jsonb,
    '["相手方の公表承諾を取ったか","企業名/大学名/ロゴ/肩書きの表記確認は済んだか","未公開情報や契約条件が含まれていないか","公表タイミングと解禁条件は一致しているか"]'::jsonb,
    '["公表前チェックリストを通す","相手方確認済みの文面だけを使う","守秘・契約条件・未確定表現を削る"]'::jsonb,
    'PRガードレール: 外部公表前の承諾・表現確認が未確認。相手方確認、ロゴ/肩書き、守秘、解禁タイミングを確認して。',
    '[{"kind":"guardrail_seed","date":"2026-06-26","summary":"外部公表・PRの承諾漏れ防止"}]'::jsonb,
    'masa'
  )
ON CONFLICT (card_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  rationale = EXCLUDED.rationale,
  severity = EXCLUDED.severity,
  trigger_tags = EXCLUDED.trigger_tags,
  check_items = EXCLUDED.check_items,
  recommended_actions = EXCLUDED.recommended_actions,
  output_template = EXCLUDED.output_template,
  source_refs_json = EXCLUDED.source_refs_json,
  status = 'active',
  updated_at = now();
