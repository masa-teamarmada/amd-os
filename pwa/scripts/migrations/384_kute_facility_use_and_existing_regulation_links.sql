-- 384_kute_facility_use_and_existing_regulation_links.sql
-- 目的:
--   1. SU関連規程の区分に「施設利用」を追加する。工学院大学の第1号案件で先行して整備する2規程のうち、
--      施設側を置く枠が台帳になかった。
--   2. 2026-09-01 に工学院大学から受領した既存規程（Drive `ARMADA/p25_kute/260901_眞鍋さんからもらった規程類`）を
--      根拠資料としてリンク付きで登録する。施設側8本は施設利用の参照版、機器側1本は共有機器の参照版に置く。
--   3. 共有機器の上位に「工学院大学研究機器管理運営委員会規程」があり、共有機器の学内外への利用促進と
--      管理運営を審議事項に持つことを、台帳から辿れるようにする。
-- 出典: 2026-09-01 KUTE定例会（施設は賃料相当を無償・教育費相当を有償、共有機器は一般の学外利用ルールを先に整備）。

insert into institution_regulation_types
  (regulation_type_id, group_key, label, short_label, description, sort_order)
values
  ('facility_use', 'core', '大学発SUの施設利用規程', '施設利用',
   'インキュベーション施設等の貸与。対象者、貸与場所の限定、教育費（維持管理費相当）の負担、貸与期間、取消等。', 108)
on conflict (regulation_type_id) do update set
  group_key = excluded.group_key,
  label = excluded.label,
  short_label = excluded.short_label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into institution_regulations
  (regulation_id, institution_id, title, stage, lifecycle_state, current_state_note, next_gate, next_gate_timing, updated_by)
values
  ('reg_kute_facility', 'inst_kute', '大学発SUの施設利用規程', 2, 'drafting',
   '産学共同研究センター運営規程の改正で対応中。賃料相当は無償、教育費（維持管理費相当）は有償。貸与場所はインキュベーション施設に限定する方向。',
   '上位運営規程の修正範囲を確定し、下位の利用申請取扱内規を改正するか新規規程を作るかを決める', '9/9 定例', 'migration:384')
on conflict (regulation_id) do update set
  title = excluded.title,
  stage = excluded.stage,
  lifecycle_state = excluded.lifecycle_state,
  current_state_note = excluded.current_state_note,
  next_gate = excluded.next_gate,
  next_gate_timing = excluded.next_gate_timing,
  updated_at = now(),
  updated_by = excluded.updated_by;

update institution_regulations set
  stage = 1,
  current_state_note = '骨子案あり。共同研究契約・技術指導契約によらない学外第三者の利用ルールが未整備。上位に研究機器管理運営委員会規程があり、共有機器の学内外への利用促進と管理運営を審議事項に持つ。',
  next_gate = '委員会の位置づけ、責任分界、料金と減免の決定主体を条文へ落とす',
  next_gate_timing = '9月中 仮案',
  updated_at = now(),
  updated_by = 'migration:384'
where regulation_id = 'reg_kute_equipment';

insert into institution_regulation_cells
  (institution_id, regulation_type_id, regulation_id, state, confirmed_at, updated_by)
values
  ('inst_kute', 'facility_use', 'reg_kute_facility', 'drafting', '2026-09-09', 'migration:384')
on conflict (institution_id, regulation_type_id) do update set
  regulation_id = excluded.regulation_id,
  state = excluded.state,
  confirmed_at = excluded.confirmed_at,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into institution_regulation_versions
  (version_id, regulation_id, label, file_name, version_state, external_url, version_date, is_current, created_by)
values
  ('regver_kute_facility_20260907', 'reg_kute_facility', '修正案 09/07',
   '[修正案20260907] 産学共同研究センター運営規程.docx', 'draft',
   'https://docs.google.com/document/d/16_-pO6MOCy2wv3mdY9pc8CVbI77ihsZf/edit?usp=drivesdk', '2026-09-07', true, 'migration:384'),
  ('regver_kute_facility_center_naiki', 'reg_kute_facility', '参考 産学共同研究センター利用申請取扱内規',
   '産学共同研究センター利用申請取扱内規_例規全文.pdf', 'reference',
   'https://drive.google.com/file/d/1m3FfnecHia3md5G6Ttym5i5mjY4sGLwU/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_external_kitei', 'reg_kute_facility', '参考 施設等学外使用に関する規程（平成25年）',
   '学校法人工学院大学施設等学外使用に関する規程_例規全文.pdf', 'reference',
   'https://drive.google.com/file/d/1854BOTjrX5lYKOX99T-hPOp_dsIY-rx0/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_external_kiyaku', 'reg_kute_facility', '参考 施設等学外使用に関する規約',
   '学校法人工学院大学施設等学外使用に関する規約.pdf', 'reference',
   'https://drive.google.com/file/d/1hSLB9fbyRLklbhbmRsX5ehCNydm0Ks6d/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_external_gengaku', 'reg_kute_facility', '参考 施設等学外使用に関する減額規約',
   '学校法人工学院大学施設等学外使用に関する減額規約.pdf', 'reference',
   'https://drive.google.com/file/d/1P8kKvUD-eP5JGpbJR5P5uGUh4RYPLsus/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_shinjuku_saisoku', 'reg_kute_facility', '参考 新宿校舎施設等使用取扱細則',
   '新宿校舎施設等使用取扱細則.pdf', 'reference',
   'https://drive.google.com/file/d/13UYDiZDn21rcJ8RHe4myj6ig0tI1URQ3/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_hachioji_saisoku', 'reg_kute_facility', '参考 八王子校舎施設等使用取扱細則',
   '八王子校舎施設等使用取扱細則.pdf', 'reference',
   'https://drive.google.com/file/d/142cMxV_L9OuXO4719Idu8dzGxDBmOHxq/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_yuko_riyo', 'reg_kute_facility', '参考 施設の有効利用に関する規程（平成26年）',
   '学校法人工学院大学施設の有効利用に関する規程_例規全文.pdf', 'reference',
   'https://drive.google.com/file/d/124YPUnEEcZo9WV60tb8GNmbD5S4u-7wv/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_facility_shinsangyo', 'reg_kute_facility', '参考 新産業創出センター関連',
   '新産業創出センター関連.pdf', 'reference',
   'https://drive.google.com/file/d/1uayhih_wmyC7DSeTZ74dFpgybvF_qSHy/view?usp=drivesdk', null, false, 'migration:384'),
  ('regver_kute_equipment_20260907', 'reg_kute_equipment', '骨子案 09/07',
   '（案）工学院大学研究設備・機器の共用その他外部利用に関する規程.docx', 'draft',
   'https://docs.google.com/document/d/1qyGlT4IrhPGX6E5-w6gJfiE1GsWCUzla/edit?usp=drivesdk', '2026-09-07', true, 'migration:384'),
  ('regver_kute_equipment_committee', 'reg_kute_equipment', '上位 研究機器管理運営委員会規程（令和6年4月1日）',
   '工学院大学研究機器管理運営委員会規程_例規全文.pdf', 'reference',
   'https://drive.google.com/file/d/10AXWgFLKgeRWP1q1bgwJa93tuLgtQFwK/view?usp=drivesdk', null, false, 'migration:384')
on conflict (version_id) do update set
  label = excluded.label,
  file_name = excluded.file_name,
  version_state = excluded.version_state,
  external_url = excluded.external_url,
  version_date = excluded.version_date,
  is_current = excluded.is_current,
  updated_at = now();
