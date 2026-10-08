-- 2026-10-08 杉浦先生の一次報告を技術台帳・DDの既存参照へ反映。
-- 試験実施日は未記載。observed_onは報告日。定量値・株・再現性は未確認。
-- NDA/PoCの合意、採算前提、機密区分、DD公開状態・権限は変更しない。
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM project_tech_entries WHERE project_id='p21' AND
      ((tech_entry_id='pte_sx_e07' AND updated_at='2026-10-03T00:57:37.8961+00:00') OR
       (tech_entry_id='pte_sx_ss14' AND updated_at='2026-10-03T00:57:37.8961+00:00') OR
       (tech_entry_id='pte_sx_ss15' AND updated_at='2026-10-03T00:57:37.8961+00:00'))) <> 3 THEN
    RAISE EXCEPTION 'Technical source rows changed; read current records before applying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM dd_package_items WHERE id='40ccc345-1a9c-49c1-94fe-85e64268bcd0'
      AND updated_at='2026-09-30T07:31:13.786153+00:00') THEN
    RAISE EXCEPTION 'DD source item changed; read current record before applying';
  END IF;
END $$;

INSERT INTO project_tech_entries
  (tech_entry_id,tech_topic_id,project_id,row_label,value_text,condition_text,observed_on,
   confidence,source_kind,source_ref,source_url,note,sort_order,needs_check,check_reason,created_by,updated_by)
VALUES
  ('pte_sol_mate_nd_20261008','ptt_sx_record','p21','メイトの廃液原液（Nd）の試験',
   '30分後に液中のNdがほぼゼロ（杉浦先生の報告）',
   '岡山のメイト訪問時に受領した廃液原液。初期・処理後濃度、検出限界、菌株・菌体量、温度、pH、液量・前処理は投稿に記載なし。',
   '2026-10-08','medium','measurement','杉浦先生／SolvioraX Slack #01_定例／2026-10-08 13:42 JST',
   'https://solviorax.slack.com/archives/C0APH4XMEJ3/p1791434562940339',
   '日付は報告日で、試験実施日は未記載。顧客から受領した廃液原液での試験結果として記録。定量除去率、菌体から取り出したNdの回収率・純度、連続処理性能は未確認。2026-10-01の既存口頭報告との試料・試験の同一性と反復回数も未確認。',
   190,true,'杉浦先生に原データ、初期・処理後濃度と検出限界、試験条件、反復回数を確認する。濃度低下と金属回収量を分けて評価する。',
   'amie-mate-nd-20261008','amie-mate-nd-20261008');

UPDATE project_tech_entries SET
  value_text='○ Dy・Ndの取り込みを確認。メイトから受領した廃液原液（Nd廃液）で、30分後に液中Ndがほぼゼロとの杉浦先生報告（2026-10-08）。',
  condition_text='水溶液でのDy・Nd取り込みは2026-07-10の速報。最新のNd試験は顧客の廃液原液。初期・処理後濃度、検出限界、菌株・菌体量、温度、pH、液量・前処理は未記載。',
  observed_on='2026-10-08',confidence='medium',source_kind='measurement',
  source_ref='2026-10-08 杉浦先生／SolvioraX Slack #01_定例（pte_sol_mate_nd_20261008）／Dyは2026-07-10の速報',
  source_url='https://solviorax.slack.com/archives/C0APH4XMEJ3/p1791434562940339',
  note='評価対象として色素脱色より優先する方針（2026-08-18）。原液受領・試験結果は2026-10-08の投稿で確認。以前の試料ではイソプロパノールによる分析妨害の記録があるが、最新試験の分析法と妨害対策は未記載。細胞からの金属回収方法は検討中。日付は報告日。',
  needs_check=true,check_reason='杉浦先生からNd試験の原データ・定量値・条件・再現性を受け取る。Dyの廃液原液試験と、菌体からの回収量・純度は別途確認する。',
  updated_at=now(),updated_by='amie-mate-nd-20261008'
WHERE project_id='p21' AND tech_entry_id='pte_sx_e07';

UPDATE project_tech_entries SET
  value_text='銅 / 鉄 / ニッケル / 鉛 / クロム / 亜鉛 / カドミウム / アルミ / ストロンチウム / 反応性窒素 / 色素 / レアアース（Dy・Nd。メイトの廃液原液で30分後に液中Ndがほぼゼロとの報告）',
  condition_text=condition_text || '。Ndの最新報告は2026-10-08。定量値・試験条件・再現性は未確認（pte_sx_e07／pte_sol_mate_nd_20261008）。',
  observed_on='2026-10-08',
  source_ref=source_ref || '／2026-10-08 杉浦先生 Slack報告（Nd。pte_sx_e07／pte_sol_mate_nd_20261008）',
  source_url='https://solviorax.slack.com/archives/C0APH4XMEJ3/p1791434562940339',
  updated_at=now(),updated_by='amie-mate-nd-20261008'
WHERE project_id='p21' AND tech_entry_id='pte_sx_ss14';

UPDATE project_tech_entries SET
  value_text='Nd廃液原液の定量評価・再現性 / Dyの廃液原液試験 / コバルト / ヒ素 / モリブデン / 1,4-ジオキサン',
  condition_text='Ndはメイトの廃液原液で30分後にほぼゼロとの報告あり（2026-10-08）。原データ・条件・再現性の確認段階。他の物質は元素別の正本を参照。',
  observed_on='2026-10-08',
  source_ref='技術タブ「対象にできる物質」（pte_sx_e05〜e14）／メイトNd試験報告（pte_sol_mate_nd_20261008）',
  source_url='https://solviorax.slack.com/archives/C0APH4XMEJ3/p1791434562940339',
  check_reason='Ndは杉浦先生から定量値・検出限界・試験条件・反復回数を確認する。Dyを含む元素別の到達段階は「対象にできる物質」を参照。',
  updated_at=now(),updated_by='amie-mate-nd-20261008'
WHERE project_id='p21' AND tech_entry_id='pte_sx_ss15';

UPDATE dd_package_items SET
  summary='装置と試験の到達実績。2026-10-08に杉浦先生が、メイトの廃液原液で30分後にNdがほぼゼロと報告。出典・条件の未確認点は技術台帳に記載。',
  unverified_notes='["メイトNd試験：日付は2026-10-08の報告日。試験実施日、初期・処理後濃度、検出限界、菌株・菌体量、温度・pH・液量・前処理、反復回数は未確認。", "液中Nd濃度の低下の報告であり、菌体からの金属回収率・純度や連続処理性能は未確認。オンサイトPoCは研究者の希望段階で、実施合意・NDA締結完了は確認待ち。"]'::jsonb,
  updated_at=now(),updated_by_member_id='ID001'
WHERE id='40ccc345-1a9c-49c1-94fe-85e64268bcd0' AND project_id='p21';

COMMIT;

-- Supplemental sample-source readback: apply after the transaction above.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM project_tech_entries WHERE tech_entry_id='pte_sx_ef04'
    AND project_id='p21' AND updated_at='2026-09-04T08:35:01.653203+00:00') THEN
    RAISE EXCEPTION 'Effluent source row changed; read current record before applying';
  END IF;
END $$;
UPDATE project_tech_entries SET
  value_text='訪問時にNd廃液原液を受領。30分後に液中Ndがほぼゼロとの試験結果報告（2026-10-08 杉浦先生）。',
  condition_text='メイトから受領した廃液原液（Nd廃液）。採取工程・初期組成・濃度・前処理は投稿に記載なし。',
  observed_on='2026-10-08',confidence='medium',source_kind='measurement',
  source_ref='2026-10-08 杉浦先生／SolvioraX Slack #01_定例（pte_sol_mate_nd_20261008）',
  source_url='https://solviorax.slack.com/archives/C0APH4XMEJ3/p1791434562940339',
  note='以前の受領分は1次・2次処理後の液（2026-09-02資料）。最新の投稿で廃液原液の受領とNd試験結果を確認。液の採取位置と性状は技術台帳、訪問・NDA・PoC調整は関係先タブが正本。',
  needs_check=true,check_reason='杉浦先生から採取工程、液の成分・Nd濃度、前処理、試験条件・原データを受け取る。原液という呼称のみで高濃度と断定しない。',
  updated_at=now(),updated_by='amie-mate-nd-20261008'
WHERE tech_entry_id='pte_sx_ef04' AND project_id='p21';
COMMIT;
