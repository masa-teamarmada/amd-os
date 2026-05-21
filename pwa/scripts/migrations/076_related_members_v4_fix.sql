-- 076_related_members_v4_fix.sql
--
-- まさ判断 (2026-05-22 v4 fix):
--  1) AMD bot ("つくよみ" / "info") は関連メンバーとして抽出しない (= cron v4 で alias map から除外済)。
--     既に保存されているこれらの行を invalid 化する。
--  2) LLM が誤抽出した typo / 苗字単体 / 存在しない人物 を invalid 化する (= 「小屋」「赤津」)。
--  3) 大学・研究機関 (`category='university'`) のキーパーソンは HRL 根拠から外さない方針へ転換。
--     migration 075 で一律 invalid 化したものを `status='tentative'` に戻し、cron v4 + 通知承認で
--     最終的な active 化はまさが判断できるようにする。
--
-- 関連: cron PROMPT_REV='v4_2026-05-22_related_members_keep_su_keypersons'

-- (1) AMD bot を関連メンバーから除外
UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22 v4] AMD bot ("つくよみ"/"info") は関連メンバーから除外',
       updated_at=now()
 WHERE status IN ('active','tentative')
   AND person_name IN ('つくよみ','info');

-- (2) LLM 誤抽出を invalid
UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22 v4] 実在しない名前 (LLM 誤抽出) として invalid',
       updated_at=now()
 WHERE status IN ('active','tentative')
   AND person_name IN ('小屋','赤津');

-- (3) university の HRL 根拠化: migration 075 で invalid 化された大学キーパーソンを tentative へ戻す
--     通知の「はい」承認で active へ昇格する設計に揃える。
UPDATE project_founding_members
   SET status='tentative',
       notes=COALESCE(notes, '') || ' / [2026-05-22 v4] 大学キーパーソンを HRL 根拠候補として復帰 (tentative)',
       updated_at=now()
 WHERE status='invalid'
   AND category='university'
   AND notes LIKE '%HRL根拠外カテゴリのため invalid%';
