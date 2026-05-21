-- 077_project_ventures_master_md.sql
--
-- まさ指摘 (2026-05-22): 関連メンバー抽出が、SU の基本情報 md (= knowledge/<id>.md)
-- を読まずに「群馬大学 起源PI」のような source 表面記述だけで分類していた。
-- 結果、JC の CEO (小柳裕太郎) を「大学側」と誤分類した。
--
-- 対策:
--   - project_ventures.master_md_text TEXT 列を追加 (= 各 SU の knowledge/<id>.md 本文)
--   - sync script (pwa/scripts/sync_knowledge_su_md.cjs) で knowledge/<id>.md を読み込み upsert
--   - cron founding-members-extract が prompt に「# SU 基本情報」として注入
--
-- 既知 cleanup (jc.md 由来):
--   p09 (JC) 「小柳裕太郎」 = JOYCLE CEO・設立者 (大学 PI 兼任) → category='startup', role='ceo_candidate'
--   p09 (JC) 「野田先生」 / 「野田」 = 流動層熱分解の共同創業者級・技術リード → category='startup', role='tech_lead'

ALTER TABLE project_ventures
  ADD COLUMN IF NOT EXISTS master_md_text TEXT,
  ADD COLUMN IF NOT EXISTS master_md_slug TEXT,
  ADD COLUMN IF NOT EXISTS master_md_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN project_ventures.master_md_text IS
  'SU の基本情報 md (knowledge/<slug>.md) の本文。cron founding-members-extract が prompt に注入する。手動同期は pwa/scripts/sync_knowledge_su_md.cjs。';
COMMENT ON COLUMN project_ventures.master_md_slug IS
  'knowledge/<slug>.md のファイル名 (拡張子なし)。例: p09 → ''jc'', p20 → ''cx''';

-- 既知マッピング seed
UPDATE project_ventures SET master_md_slug='jc'   WHERE project_id='p09';
UPDATE project_ventures SET master_md_slug='cx'   WHERE project_id='p20';
UPDATE project_ventures SET master_md_slug='sx'   WHERE project_id='p21';
UPDATE project_ventures SET master_md_slug='bwe'  WHERE project_id='p11';
UPDATE project_ventures SET master_md_slug='clg'  WHERE project_id='p07';
UPDATE project_ventures SET master_md_slug='ctb'  WHERE project_id='p17';
UPDATE project_ventures SET master_md_slug='yd'   WHERE project_id='p18';

-- p09 JC: 小柳裕太郎 / 野田先生 / 野田 を SU 創業コアとして直接 active 化 (jc.md 由来)
UPDATE project_founding_members
   SET category='startup',
       affiliation='JC / 群馬大学',
       role='ceo_candidate',
       role_label_jp='CEO / 設立者',
       responsibility='JOYCLE 設立者 (2023-03)、事業全体の経営判断',
       contribution='2023-03 に JC を設立。元 IRS 熱分解 SaaS モデルから AMD 関与で deeptech 化に転換 (jc.md 由来)。',
       status='active',
       notes=COALESCE(notes, '') || ' / [2026-05-22 jc.md cleanup] 小柳裕太郎 = JOYCLE の CEO・設立者として startup に再分類',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name='小柳裕太郎';

UPDATE project_founding_members
   SET category='startup',
       affiliation='JC / 三岳・群馬大学',
       role='tech_lead',
       role_label_jp='共同創業者級 / 技術リード (流動層熱分解)',
       responsibility='流動層熱分解の専門家として 2024 年合流、技術コアを支える',
       contribution='流動層熱分解の特許・専門知見を JC に提供し deeptech 化を実現 (jc.md 由来)。',
       status='active',
       notes=COALESCE(notes, '') || ' / [2026-05-22 jc.md cleanup] 野田先生 = JC 技術共同創業者として startup に再分類',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name IN ('野田先生','野田');
