-- 085_project_name_and_related_member_notification_labels.sql
-- p20/CryoX の「仮称」表示を消し、旧 founding_members 通知文言を関連メンバーへ寄せる。

BEGIN;

UPDATE project_ventures
SET
  display_name = 'CryoX',
  master_md_text = replace(
    replace(
      replace(
        replace(master_md_text, 'CryoX（仮称）', 'CryoX'),
        'CryoX (仮称)',
        'CryoX'
      ),
      '株式会社CryoX（仮称、未設立）',
      '株式会社CryoX（未設立）'
    ),
    '仮称、',
    ''
  ),
  updated_at = now()
WHERE project_id = 'p20';

UPDATE l2_notifications
SET
  title = replace(replace(replace(title, '創業メンバー更新', '関連メンバー更新'), 'CryoX（仮称）', 'CryoX'), 'CryoX (仮称)', 'CryoX'),
  updated_at = now()
WHERE l2_kind = 'founding_members'
  AND (
    title LIKE '%創業メンバー更新%'
    OR title LIKE '%CryoX（仮称）%'
    OR title LIKE '%CryoX (仮称)%'
  );

COMMIT;
