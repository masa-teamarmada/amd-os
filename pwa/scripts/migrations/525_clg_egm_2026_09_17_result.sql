-- チャレナジー（p24）2026年9月17日 臨時株主総会の決議結果を「可決」に更新
--
-- まさの依頼（2026-11-26）: 9/17臨時株主総会の結果を可決に直す（「可決に直して」）。
-- 出典: 共有ドライブ p24_clg/0_取締役会/260917_取締役会/20260917_CLG取締役会議事録.pdf。
--   同じファイルの3〜4ページ目が臨時株主総会議事録（2026-09-17 14:07〜14:10、出席株主12名・議決権2,345,510個）。
--   議案「J-KISS型新株予約権募集事項決定委任の件」は出席株主の全員の賛成で原案どおり承認可決。
-- 冪等: 結果が scheduled の場合だけ更新し、議事録の添付は同じファイルIDがなければ追加する。

BEGIN;

UPDATE project_shareholder_meetings
SET resolutions_json = jsonb_set(resolutions_json, '{0,result}', '"可決"'),
    notes = replace(notes, '決議結果は未確認。', '決議結果は2026-09-17の臨時株主総会議事録で確認（出席株主の全員の賛成で原案どおり可決）。'),
    source_ref = source_ref || '+drive:1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8',
    updated_at = NOW()
WHERE id = '2b1160b4-9733-43d9-a0ff-3d247a9feaea'::uuid AND project_id = 'p24' AND resolutions_json->0->>'result' = 'scheduled';

UPDATE project_shareholder_meetings
SET attachments_json = attachments_json || jsonb_build_array(jsonb_build_object(
      'kind', 'governance_attachment', 'name', '20260917_CLG取締役会議事録.pdf', 'storage', 'google-drive', 'mime_type', 'application/pdf', 'size_bytes', 2621095,
      'drive_file_id', '1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8', 'drive_folder_id', '1rTxWMxnvV4NZrnwM16JTKVDAmiZZZvGg', 'drive_folder_name', '260917_取締役会',
      'project_drive_folder_id', '1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd', 'folder_display_path', 'PJフォルダ / 0_取締役会 / 260917_取締役会',
      'url', 'https://drive.google.com/file/d/1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8/view?usp=drivesdk',
      'web_view_link', 'https://drive.google.com/file/d/1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8/view?usp=drivesdk')),
    updated_at = NOW()
WHERE id = '2b1160b4-9733-43d9-a0ff-3d247a9feaea'::uuid AND project_id = 'p24'
  AND NOT attachments_json @> '[{"drive_file_id": "1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8"}]'::jsonb;

COMMIT;
