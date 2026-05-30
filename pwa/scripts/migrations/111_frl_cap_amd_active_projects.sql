-- 111_frl_cap_amd_active_projects.sql
-- FRL_cap_amd first pass (2026-05-31).
--
-- Scope:
--   Small verified update for active/current AMD Score rows only:
--   CTB(p06), LST(p07), CX(p20), SX(p21).
--
-- Formula:
--   frl_cap_amd = F_cap(all active management core) - F_cap(AMD removed)
--
-- Status/category live DB fact before this migration:
--   project_founding_members.status values observed:
--     active / tentative / invalid / left
--   category='amd' rows were all tentative/invalid, with no active AMD row
--   in the 9PJ F_cap retrofit set.
--
-- Why not all 9PJ here:
--   Ended / historical projects need timeline-specific rows because "active"
--   in project_founding_members is a current member-state gate, while AMD value
--   for ended projects is historical. This migration intentionally avoids
--   backfilling those rows in bulk.

WITH amd_rows(project_id, person_name, affiliation, role, role_label_jp, responsibility, contribution, notes) AS (
  VALUES
    ('p06', 'まさ', 'AMD', 'amd_support', 'COO/AMED事務対応',
      '設立後COOとして会社体制構築・資金調達に参画し、現在はAMED事務対応を中心に軽く継続支援',
      '創薬経験の制約から現在はAMED事務対応中心だが、公的資金管理・株主/AMED対応の実務補完としてF_capを+1押し上げ',
      '[2026-05-31 frl_cap_amd] knowledge/ctb.md: まさCOO参画→資金調達トライ→AMED採択後は事務対応業務で継続支援。'),
    ('p07', 'まさ', 'AMD', 'amd_support', 'COO/体制構築',
      '設立前からCOOとして参画し、CEO据付・組織体制構築・ラボ開設・AMD業務委託化を推進',
      'UMI打診から星野CEO体制を作り、約2年弱の体制構築を通じて経営実行力を補完',
      '[2026-05-31 frl_cap_amd] knowledge/LST.md: Before 0、まさCOO、CEO据付＋体制構築＋ラボ開設。'),
    ('p20', 'あき', 'AMD', 'amd_support', '技術/市場調査',
      '技術調査、現場訪問、資金調達シミュレーション、Kiutra等の競合調査',
      '量子コンピュータ・冷却市場の専門性で技術/市場DDを補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。CX特化メンバーとして現場訪問・競合調査。'),
    ('p20', 'きよ', 'AMD', 'amd_support', 'PM/契約・見積',
      'プロジェクトマネジメント、契約書作成、見積書作成、定例会運営',
      'NIMS契約・仕様書・見積・定例運営で事業化実務を補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。契約/見積/PM実務。'),
    ('p20', 'まさ', 'AMD', 'amd_support', 'closer/戦略担当',
      '事業戦略、資金調達戦略、エクイティストーリー、VC折衝、神谷氏との意思決定支援',
      '20社経営関与・33億円超調達経験を、VC/CEO候補/資本政策の実意思決定に投入',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。knowledge/members.md + knowledge/cx.md根拠。'),
    ('p20', 'りり', 'AMD', 'amd_support', 'NIMS連携/事業化支援',
      'NIMSスタートアップ支援室・事業化支援、定例会参加、進捗管理サポート',
      'NIMS内外の事業化接続で実務補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。'),
    ('p21', 'かる', 'AMD', 'amd_support', '事業計画/DD',
      '事業計画、ピッチデック、POC候補探索、DD対応',
      '戦略コンサル/スタートアップ参画経験により、VC DDに耐える事業計画を補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。knowledge/sx.md + members.md根拠。'),
    ('p21', 'きよ', 'AMD', 'amd_support', '納品/事務サポート',
      'ピッチデック・月次試算表・調査資料の納品、愛媛大学との事務対応',
      'PSI/愛媛大学向け納品・事務運営を補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。'),
    ('p21', 'ちこ', 'AMD', 'amd_support', '技術DD/知財調査',
      '知財調査、登記事項準備、技術DD、コスト試算',
      '製薬/バイオPM経験と技術DDで、研究者チームの事業化実務を補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。knowledge/sx.md + members.md根拠。'),
    ('p21', 'まさ', 'AMD', 'amd_support', 'PM/VC戦略',
      '全体統括、VC対応、市場調査、登記事項、知財戦略、愛媛大学イノベーションマネージャー',
      'VC戦略・登記事項・知財戦略・国策/顧客探索で、CEO未定の経営実行力を補完',
      '[2026-05-31 frl_cap_amd] live PFM tentative rowをactive化。knowledge/sx.md + members.md根拠。')
)
INSERT INTO project_founding_members (
  project_id,
  person_name,
  affiliation,
  role,
  role_label_jp,
  category,
  responsibility,
  contribution,
  notes,
  status,
  extracted_by,
  source_documents,
  first_observed_at,
  last_observed_at,
  updated_at
)
SELECT
  project_id,
  person_name,
  affiliation,
  role,
  role_label_jp,
  'amd',
  responsibility,
  contribution,
  notes,
  'active',
  'manual',
  '[{"type":"frl_cap_amd_review","id":"migration_111","ymOrDate":"2026-05-31"}]'::jsonb,
  DATE '2026-05-31',
  DATE '2026-05-31',
  now()
FROM amd_rows
ON CONFLICT (project_id, person_name) DO UPDATE
   SET affiliation = EXCLUDED.affiliation,
       role = EXCLUDED.role,
       role_label_jp = EXCLUDED.role_label_jp,
       category = 'amd',
       responsibility = EXCLUDED.responsibility,
       contribution = EXCLUDED.contribution,
       notes = CASE
         WHEN project_founding_members.notes IS NULL OR project_founding_members.notes = ''
         THEN EXCLUDED.notes
         WHEN project_founding_members.notes LIKE '%[2026-05-31 frl_cap_amd]%'
         THEN project_founding_members.notes
         ELSE project_founding_members.notes || ' / ' || EXCLUDED.notes
       END,
       status = 'active',
       extracted_by = 'manual',
       source_documents = CASE
         WHEN jsonb_typeof(project_founding_members.source_documents) = 'array'
          AND jsonb_typeof(EXCLUDED.source_documents) = 'array'
         THEN project_founding_members.source_documents || EXCLUDED.source_documents
         ELSE COALESCE(project_founding_members.source_documents, EXCLUDED.source_documents, '[]'::jsonb)
       END,
       last_observed_at = DATE '2026-05-31',
       updated_at = now();

UPDATE amd_score_inputs
   SET frl_cap = 4,
       frl_cap_amd = 1,
       frl_cap_notes = '[2026-05-31 frl_cap_amd] F_cap(全員)=4 / AMD抜き=3 / AMD寄与=1。丸島=医師・研究者CEOで創薬/AMED実務を回す基礎力はLv3。AMD(まさ)は過去COOとして会社体制構築・資金調達に参画し、現在はAMED事務対応を中心に公的資金/報告実務を補完。ただし創薬経営専任ではないため+1に抑制。根拠: knowledge/ctb.md + live project_founding_members。',
       frl_ces_a = COALESCE(frl_ces_a, 0.6),
       frl_ces_rho = COALESCE(frl_ces_rho, -2),
       updated_at = now()
 WHERE id = '0f785a63-4229-4da5-90e3-b4d85a59d242';

UPDATE amd_score_inputs
   SET frl_cap = 6,
       frl_cap_amd = 1,
       frl_cap_notes = '[2026-05-31 frl_cap_amd] F_cap(全員)=6 / AMD抜き=5 / AMD寄与=1。星野CEO側にシード調達・事業運営の実行力がありAMD抜きでもLv5。AMD(まさCOO)は設立前からCEO据付・体制構築・ラボ開設・業務委託化を約2年弱支援し、経営実行力を+1押し上げ。根拠: knowledge/LST.md。',
       frl_ces_a = COALESCE(frl_ces_a, 0.6),
       frl_ces_rho = COALESCE(frl_ces_rho, -2),
       updated_at = now()
 WHERE id = 'b20ab0fe-a4ed-4d21-bb4e-4cd0e1926566';

UPDATE amd_score_inputs
   SET frl_cap = 5,
       frl_cap_amd = 2,
       frl_cap_notes = '[2026-05-31 frl_cap_amd] F_cap(全員)=5 / AMD抜き=3 / AMD寄与=2。神谷PI・鮫島氏/CEO候補接点でAMD抜きでも同業界/事業化の入口はLv3。AMD(まさ/あき/きよ/りり)がVC折衝・資本政策・エクイティストーリー・NIMS契約/見積・競合DDを実意思決定レベルで補完しLv5へ押し上げ。根拠: knowledge/cx.md + live project_founding_members。',
       frl_ces_a = COALESCE(frl_ces_a, 0.6),
       frl_ces_rho = COALESCE(frl_ces_rho, -2),
       updated_at = now()
 WHERE id = 'c5f071f1-d1e3-43c6-bbab-36493f227bfa';

UPDATE amd_score_inputs
   SET frl_cap = 4,
       frl_cap_amd = 1,
       frl_cap_notes = '[2026-05-31 frl_cap_amd] F_cap(全員)=4 / AMD抜き=3 / AMD寄与=1。杉浦PI・愛媛大側は研究/産学連携の基礎力があるがCEO/経営専任は未確定でAMD抜きLv3。AMD(まさ/かる/ちこ/きよ)がVC戦略・事業計画・知財/技術DD・納品/事務を担い、設立準備チームとしてLv4へ押し上げ。根拠: knowledge/sx.md + live project_founding_members。',
       frl_ces_a = COALESCE(frl_ces_a, 0.6),
       frl_ces_rho = COALESCE(frl_ces_rho, -2),
       updated_at = now()
 WHERE id = '27e32917-170a-4fbd-80ad-86ef9dc00692';
