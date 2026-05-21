-- 078_jc_keypersons_correction.sql
--
-- まさ訂正 (2026-05-22): migration 077 で JC の関連メンバー分類を誤った。
--
-- 1) 小柳裕太郎 = JC の CEO だが、**大学 PI ではなく理系素養なしの起業家**。
--    「群馬大学」を冠に付けない (= JC が「群馬大発」というのは後付のマーケティング冠)。
--    「先生」称号も付けない。
--
-- 2) 野田先生 / 野田 = **群馬大学側の研究者で JC 社員ではない**。
--    AMD 関与時に共同研究先として合流したが、技術活用は道半ばで AMD 関与終結。
--    category='university' に戻す (= JC の社員ではなく大学キーパーソン)。
--
-- migration 077 で startup に昇格させた誤りを訂正する。

-- (1) 小柳裕太郎: affiliation を JC のみに、CEO 役割は維持。説明を訂正。
UPDATE project_founding_members
   SET affiliation='JC',
       role='ceo_candidate',
       role_label_jp='CEO / 設立者',
       responsibility='JOYCLE 設立者 (2023-03)、事業全体の経営判断',
       contribution='2023-03 に JC を独自に設立 (理系素養なしの起業家、大学 PI ではない)。AMD 関与で deeptech 化を試みた。',
       notes=COALESCE(notes, '') || ' / [2026-05-22 まさ訂正] 大学 PI ではなく起業家。「群馬大発」は後付の冠なので affiliation から外す',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name='小柳裕太郎';

-- (2) 野田先生 / 野田: category='university' に戻し、JC 社員ではないことを明記。
UPDATE project_founding_members
   SET category='university',
       affiliation='群馬大学',
       role='researcher',
       role_label_jp='共同研究先研究者 (流動層熱分解)',
       responsibility='JC の deeptech 化検討時に共同研究先として合流。流動層熱分解の専門家。',
       contribution='AMD 関与時に共同研究先として合流。技術活用は道半ばで JC への AMD 関与終結。',
       notes=COALESCE(notes, '') || ' / [2026-05-22 まさ訂正] JC 社員ではなく群馬大学側の共同研究先。技術活用は道半ばで終結',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name IN ('野田先生','野田');
