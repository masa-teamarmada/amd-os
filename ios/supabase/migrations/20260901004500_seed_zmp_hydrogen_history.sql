-- 2026-09-01 まさ依頼: 水素循環PJの経緯を初期整理する。
-- 正本MTGと資料室の記録からの要約。提出・採択・契約成立を推定しない。
-- 既存プロフィールを上書きせず、出典の参照だけを同一テーマへ追加する。
BEGIN;
DO $$
DECLARE
  profile_id uuid;
  rows jsonb := $history$[
    {"id":"19000000-2026-4000-8000-000000000501","topic":"東京理科大・堂脇先生","initial":"下水汚泥由来水素・貯蔵技術を地域実装へつなぐ。","developments":"5/26 産学連携部門へ相談。先生・他の水素/GX研究者への接続を依頼。\n6/10 返答が停滞し、再連絡する方針。","current":"今回のまさ確認でも進展なし。研究協力は未成立。","next":"再連絡の結果と、待つ期限・代替候補を確認。","asOf":"2026-09-01","sourceNote":"5/26・6/10のMTGと今回のまさ確認。","sources":[{"kind":"meeting","id":"0q5lelucq7hf5fdteo7p1b5d1i"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z"}]},
    {"id":"19000000-2026-4000-8000-000000000502","topic":"pHydrogen","initial":"水素の「つくり手」として供給・実証への参加を相談。","developments":"6/17 初回相談の準備記録。実際の合意は未確認。\n6/23 飛田CEOがZeMAを訪問。本社訪問とPoC具体化へ。","current":"まさの感触は前向き。供給量・時期・単価・稼働枠は未確定。","next":"H2購入型PoCの成功条件と、本社訪問後の進展を確認。","asOf":"2026-09-01","sourceNote":"6/23 MTG・準備資料と今回のまさ確認。契約成立ではない。","sources":[{"kind":"meeting","id":"7pubrfitd4dfb9hsn1dv7kmj9f"},{"kind":"document","id":"f1557790-9fd4-445a-a014-96aa5eeb123a"}]},
    {"id":"19000000-2026-4000-8000-000000000503","topic":"水素ステーション計画","initial":"現敷地のA2案。2階建て仕様は障壁・セットバックが制約。","developments":"1/21 隣地拡張＋水電解のB案へ。\n5/20 別の候補地も検討。\n7/8 建設費・補助条件を再整理。8/7 実証の場と組み合わせる案。","current":"設置方式・場所・採算は再検討中。着工確定は未確認。","next":"現行案・総費用・補助対象・自己負担・判断時期を揃える。","asOf":"2026-08-07","sourceNote":"1/21〜8/7の記録。以降の計画確定は未確認。","sources":[{"kind":"meeting","id":"slack-C08VBBE9KNE-1768964868_475999"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260520T000000Z"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260708T000000Z"},{"kind":"meeting","id":"4mkigsei16s2pjmhphjnu0e02o"}]},
    {"id":"19000000-2026-4000-8000-000000000504","topic":"給電車・外部給電機の補助","initial":"2台分の給電用途を補助金で整備。","developments":"5/20 2台中1台は申請済み、残り1台は準備。\n6/10 外部給電機の書類補完を確認。","current":"申請の記録あり。2台目の提出・交付・入金は未確認。","next":"制度正式名、車両/機器別の受付・交付通知を照合。","asOf":"2026-06-10","sourceNote":"給電車と外部給電機の申請が同一かも未確認。","sources":[{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260520T000000Z"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z"}]},
    {"id":"19000000-2026-4000-8000-000000000505","topic":"整備補助（NEV・東京都）","initial":"国と都の補助を使い、水素ステーションの整備負担を抑える。","developments":"2〜3月 NEVへ名義・年度内完了条件を確認。\n7/8 対象費用・上限を整理。7/15 都の後払いによる着工資金リスクを確認。","current":"制度調査の記録。国・都とも応募・採否は未確認。","next":"国・都それぞれの申請状況と、補助前の資金手当てを確認。","asOf":"2026-07-15","sourceNote":"制度の現行要件ではなく、当時のPJ検討経緯。","sources":[{"kind":"meeting","id":"slack-C08VBBE9KNE-1774195852_840389"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260708T000000Z"},{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260715T000000Z"}]},
    {"id":"19000000-2026-4000-8000-000000000506","topic":"水素サプライチェーン構築技術開発事業","initial":"水素循環の開発資金を公募で確保する。","developments":"6/10 定例で申請を進める方針。説明会・計画・書類準備を分担。","current":"申請方針まで確認。提出済みとは断定できず、採否も未確認。","next":"提出控え・受付番号・審査結果を確認。FS公募との対応も照合。","asOf":"2026-06-10","sourceNote":"MTG上の事業名。正式な公募名と申請先の照合が必要。","sources":[{"kind":"meeting","id":"bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z"}]},
    {"id":"19000000-2026-4000-8000-000000000507","topic":"課題解決型・試作品開発助成","initial":"葛飾ロードの水素作業車開発で活用を検討。","developments":"資料室に7/1版の申請書（v1.3）がある。","current":"書類作成まで確認。提出・採否は未確認。","next":"最終提出版と受付・採否通知を確認する。","asOf":"2026-07-01","sourceNote":"資料名・版の確認。申請書の存在を応募完了とみなさない。","sources":[{"kind":"document","id":"6328125c-bc07-4508-92d1-e75950d058a0"}]}
  ]$history$::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_theme_profiles WHERE project_id='p19' AND track_key='katsushika_hydrogen') THEN
    RAISE EXCEPTION 'Hydrogen profile already exists; refuse to overwrite current work';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(rows) row, jsonb_array_elements(row->'sources') source
    WHERE (source->>'kind'='meeting' AND NOT EXISTS (SELECT 1 FROM public.project_meeting_summaries m WHERE m.project_id='p19' AND m.meeting_id=source->>'id'))
       OR (source->>'kind'='document' AND NOT EXISTS (SELECT 1 FROM public.workspace_documents d WHERE d.project_id='p19' AND d.document_id::text=source->>'id' AND d.upload_status='active'))
  ) THEN RAISE EXCEPTION 'Missing or inactive source; do not seed partial history'; END IF;

  INSERT INTO public.project_theme_profiles(project_id,track_key,history_rows)
  VALUES ('p19','katsushika_hydrogen',rows) RETURNING id INTO profile_id;
  INSERT INTO public.project_theme_meetings(project_id,track_key,meeting_id)
  SELECT DISTINCT 'p19','katsushika_hydrogen',source->>'id'
  FROM jsonb_array_elements(rows) row, jsonb_array_elements(row->'sources') source
  WHERE source->>'kind'='meeting' ON CONFLICT (project_id,track_key,meeting_id) DO NOTHING;
  INSERT INTO public.project_theme_documents(project_id,track_key,document_id)
  SELECT DISTINCT 'p19','katsushika_hydrogen',(source->>'id')::uuid
  FROM jsonb_array_elements(rows) row, jsonb_array_elements(row->'sources') source
  WHERE source->>'kind'='document' ON CONFLICT (project_id,track_key,document_id) DO NOTHING;
END $$;
COMMIT;
