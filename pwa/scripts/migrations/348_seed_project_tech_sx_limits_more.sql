-- 348_seed_project_tech_sx_limits_more.sql
-- 「使えなくなる条件」の追加。文字起こしを全件当たった結果。
--
-- まさの記憶「油があるとダメ」に一致する直接発言は、source_cache の全ソースを
-- 「油/あぶら/脂/オイル/油膜/油脂/グリース/乳化/浮上/スカム/懸濁」ほかで当たっても見つからなかった。
-- 最も近いのは杉浦先生の「(界面活性剤らしき物質) が大量に入っていると多分ダメ」(2026-03-19)。
-- 記憶を消さず、確認事項として残す。

begin;

update project_tech_entries
set value_text = '菌への影響は記録に無い (油水分離後の液を評価対象にしている)',
    note = '運用として分離後の液を受け取る方針。文字起こしを全件当たったが、油そのものが菌に影響するという発言は見つからなかった',
    needs_check = true,
    check_reason = 'まさの記憶では「油があるとダメ」。該当する発言が記録に無いので、杉浦先生へ直接確認する。近い発言として「界面活性剤らしき物質が大量に入っているとダメ」がある (下の行)',
    updated_at = now()
where tech_entry_id = 'pte_sx_l06';

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, needs_check, check_reason, sort_order, created_by, updated_by)
values
('pte_sx_l11', 'ptt_sx_limits', 'p21', '界面活性剤', null, null, null, '大量に入っているとダメ', null,
 null, '濃度が高い場合', '2026-03-19', 'medium', 'meeting', '2026-03-19 SX定例MTG (杉浦先生の回顧発言)',
 '企業から「これが入っていても大丈夫か」と聞かれ、先生が「大量に入っていると多分ダメ」と答えた、という証言。文字起こしの表記が不明瞭で物質名の特定に幅がある',
 true, '物質名と、どの濃度からダメなのかを杉浦先生へ確認する。まさの記憶にある「油がダメ」と同じ話の可能性がある', 65, 'amie', 'amie'),
('pte_sx_l12', 'ptt_sx_limits', 'p21', '紫外線だけの光源', null, null, null, '使えない', null,
 null, '光源の選定', '2026-03-19', 'high', 'meeting', '2026-03-19 SX定例MTG (杉浦先生)',
 '「UVだけではダメです」。可視光であれば蛍光灯でもLEDでもよい',
 false, null, 35, 'amie', 'amie'),
('pte_sx_l13', 'ptt_sx_limits', 'p21', '硝酸・亜硝酸', null, null, null, '使えないという発言あり (文脈が不明瞭)', null,
 null, null, '2026-01-16', 'low', 'meeting', '杉浦先生ヒアリング (2026-01-16)',
 '文字起こしが途中で切れており、何の代替として使えないのかが読み取れない',
 true, '窒素源として使えないという意味なのかを確認する。培地の設計に効く', 45, 'amie', 'amie');

commit;
