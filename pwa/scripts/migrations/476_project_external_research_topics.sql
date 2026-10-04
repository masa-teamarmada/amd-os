-- 476: つくよみの外部リサーチの対象を、自動処理の指示書に書いたPJの表から、PJごとの設定に移す。
--
-- 2026-10-04 まさ「どれか特定のPJだけの処理は実装しないで。使える機能なら全PJに適用して。」
-- 外部リサーチ（pwa/scheduled-tasks/amd-os-external-research/SKILL.md）は、指示書の表に書いた7PJだけを
-- 調べていた。projects.external_research_topics（毎朝探すテーマ）が入っているPJを対象にする形にする。
-- 中身は指示書の表をそのまま移すので、調べるPJとテーマは変わらない。ほかのPJも管理画面の
-- 「PJ一覧」でテーマを書けば対象になる（PJの状態では除外しない。テーマが入っていれば調べる）。

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS external_research_topics text;

COMMENT ON COLUMN public.projects.external_research_topics IS
  'つくよみの外部リサーチ（平日09:00）で、このPJについて探すテーマ。空のPJは対象外。PJの状態では除外しない。2026-10-04 migration 476 で、指示書の表から移した。';

UPDATE public.projects AS p
   SET external_research_topics = v.topics
  FROM (VALUES
    ('p00', 'ディープテック支援、大学発事業化、GAPファンド、START/NEDO/SBIR'),
    ('p10', 'マイクロ波ワイヤレス給電、インフラ防災・自立型センシング'),
    ('p11', '濃度差発電、塩分濃度差発電、関係組織の動き'),
    ('p06', '虚血性脳卒中、ラジカル捕捉、創薬公募・関係組織'),
    ('p19', '水素特殊車両・水素ステーション、道路保守DX、東京都/葛飾区GX'),
    ('p20', '磁気冷凍、データセンター冷却、量子・極低温冷却、NIMS関連'),
    ('p21', 'シアノバクテリア、重金属/染色排水処理、愛媛大学関連')
  ) AS v(project_id, topics)
 WHERE p.project_id = v.project_id
   AND p.external_research_topics IS NULL;

COMMIT;
