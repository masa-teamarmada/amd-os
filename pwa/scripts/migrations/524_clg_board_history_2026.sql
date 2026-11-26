-- チャレナジー（p24）会社概要「取締役会」への過去回の登録
--
-- まさの依頼（2026-11-26）: 「過去の取締役会も抜けてるのがあれば取締役会の欄に登録して」。
-- 対象: 2026-03-27〜10-28の取締役会11回（会議カードのある9回と、Driveに書面決議・議事録だけがある9/3・9/17）。
-- 出典: 共有ドライブ p24_clg/0_取締役会/ の議事録・招集通知・議案資料、Notionの書き起こし、AMD OSの会議カード。
--   決議結果は議事録・同意書・書き起こしで確認できた回だけ「可決」とし、4/22と7/29は「未確認」とした。
-- 冪等: project_id・meeting_type・meeting_date が同じ行があれば挿入しない。

BEGIN;

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-03-27', '202603', $m$当社押上オフィス$m$,
  $m$2026年3月27日取締役会（17:40〜）。同日の種類株主総会で取締役全員が改選されたことを受けて開催。代表取締役の選定、株主総会・取締役会の招集順位、役員報酬、新株予約権の無償取得を決議。$m$,
  $m$[{"type": "役員", "title": "代表取締役に清水敦史を選定", "result": "可決"}, {"type": "役員", "title": "株主総会・取締役会の招集順位（第2順位 渡邉康一、第3順位 山地正洋）", "result": "可決"}, {"type": "役員報酬", "title": "各取締役の役員報酬を第10回定時株主総会で決めた報酬総枠の範囲内で決定（山地は4月分から）", "result": "可決"}, {"type": "新株予約権", "title": "退任・退職で無償取得事由に該当した新株予約権 合計40,301個の無償取得", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "260327_取締役会議事録_Fin.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 504724, "drive_file_id": "1tgMH6JX15-VcFzPhHXtLTa3P9IQguKEt", "drive_folder_id": "1GlLtMLFzK_JKtQ-QTErliTeNE7b0iSfn", "drive_folder_name": "260327_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260327_取締役会", "url": "https://drive.google.com/file/d/1tgMH6JX15-VcFzPhHXtLTa3P9IQguKEt/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1tgMH6JX15-VcFzPhHXtLTa3P9IQguKEt/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "20260327_定款（原本証明）.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 463647, "drive_file_id": "12Fxs51jsN2YTSCBNRSQgzksz5WKp4ZPO", "drive_folder_id": "1GlLtMLFzK_JKtQ-QTErliTeNE7b0iSfn", "drive_folder_name": "260327_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260327_取締役会", "url": "https://drive.google.com/file/d/12Fxs51jsN2YTSCBNRSQgzksz5WKp4ZPO/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/12Fxs51jsN2YTSCBNRSQgzksz5WKp4ZPO/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1tgMH6JX15-VcFzPhHXtLTa3P9IQguKEt$m$,
  $m$署名押印済みの取締役会議事録に基づく。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-03-27');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board_written', DATE '2026-04-10', '202604', NULL,
  $m$会社法370条と定款31条に基づく取締役会決議の省略（書面決議）。3月27日に無償取得した自己新株予約権の消却。$m$,
  $m$[{"type": "新株予約権", "title": "2026年3月27日に取得した自己新株予約権 合計40,301個（第4回18,400個、第5回21,901個）の消却", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "取締役会議事録(書面決議)・同意書_2026年4月10日_.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 461425, "drive_file_id": "1XnjYVtHf2-aM1EEquFBbvjhHBdl-u02E", "drive_folder_id": "1EWQhLNl6C3c2joSTmYKGDQh4o0iId5TY", "drive_folder_name": "260410_取締役会_書面決議", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260410_取締役会_書面決議", "url": "https://drive.google.com/file/d/1XnjYVtHf2-aM1EEquFBbvjhHBdl-u02E/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1XnjYVtHf2-aM1EEquFBbvjhHBdl-u02E/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1XnjYVtHf2-aM1EEquFBbvjhHBdl-u02E$m$,
  $m$取締役全員の同意書と書面決議の議事録に基づく。会議は開いていない。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board_written' AND meeting_date = DATE '2026-04-10');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-04-22', '202604', $m$当社押上オフィス（テレビ会議併用）$m$,
  $m$2026年4月22日臨時取締役会（17:30〜、4月16日付招集）。報告事項は3月度予算実績差異分析と4月月次報告。決議事項は第1号議案「2026年5月度全社および開発予算執行」。$m$,
  $m$[{"type": "予算", "title": "第1号議案：2026年5月度全社および開発予算執行", "result": "未確認"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "2026年4月22日_取締役会招集通知.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 325849, "drive_file_id": "1KWdA7TJde5c78OCeHRfkqj77abUx28KF", "drive_folder_id": "10A0j--amYkh5OoDsCUkhs0k-5AFgh-fU", "drive_folder_name": "260422_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260422_取締役会", "url": "https://drive.google.com/file/d/1KWdA7TJde5c78OCeHRfkqj77abUx28KF/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1KWdA7TJde5c78OCeHRfkqj77abUx28KF/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "260422_取締役会_第1号議案資料_5月度予算執行 全社＋開発.xlsx", "storage": "google-drive", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size_bytes": 617088, "drive_file_id": "1jJ7E7-tDNlUsbNUAQA1CdprSBrTit8wY", "drive_folder_id": "10A0j--amYkh5OoDsCUkhs0k-5AFgh-fU", "drive_folder_name": "260422_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260422_取締役会", "url": "https://drive.google.com/file/d/1jJ7E7-tDNlUsbNUAQA1CdprSBrTit8wY/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1jJ7E7-tDNlUsbNUAQA1CdprSBrTit8wY/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1KWdA7TJde5c78OCeHRfkqj77abUx28KF$m$,
  $m$招集通知と議案資料に基づく。議事録はなく、Notionの記録にも内容が残っていないため、決議結果は未確認。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-04-22');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-05-27', '202605', NULL,
  $m$2026年5月27日定時取締役会。報告事項は4月度予算実績差異分析と5月月次報告。決議事項は第1号議案「2026年6月度全社および開発予算執行」。$m$,
  $m$[{"type": "予算", "title": "第1号議案：2026年6月度全社および開発予算執行（全社＋開発 7,610,860円）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "2026年5月27日_取締役会招集通知.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 326749, "drive_file_id": "1SgXDIEiA3WxxEDIWEkYNLafajZbTPjwn", "drive_folder_id": "1Lr74r7kd3SInacqIHwtyvIeoczn1kSlt", "drive_folder_name": "260527_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260527_取締役会", "url": "https://drive.google.com/file/d/1SgXDIEiA3WxxEDIWEkYNLafajZbTPjwn/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1SgXDIEiA3WxxEDIWEkYNLafajZbTPjwn/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "260527_取締役会_第1号議案資料_6月度予算執行 全社＋開発.xlsx", "storage": "google-drive", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size_bytes": 750369, "drive_file_id": "1CG0sidG5p-wFM2FUv3TvtMX58zlAcqqm", "drive_folder_id": "1Lr74r7kd3SInacqIHwtyvIeoczn1kSlt", "drive_folder_name": "260527_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260527_取締役会", "url": "https://drive.google.com/file/d/1CG0sidG5p-wFM2FUv3TvtMX58zlAcqqm/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1CG0sidG5p-wFM2FUv3TvtMX58zlAcqqm/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1SgXDIEiA3WxxEDIWEkYNLafajZbTPjwn+notion:36d97749c60880f7af29c6f8f0f79231$m$,
  $m$招集通知・議案資料とNotionの記録に基づく。議事録は未受領。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-05-27');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-06-24', '202606', NULL,
  $m$2026年6月24日定時取締役会。報告事項は5月度予算実績差異分析、6月月次報告、助成金申請状況、資金調達状況。決議事項は第1号議案「2026年7月度全社および開発予算執行」、第2号議案「福島小型実証機撤去に関する件」。$m$,
  $m$[{"type": "予算", "title": "第1号議案：2026年7月度全社および開発予算執行（約940万円。コントローラー改修費 約180万円を含む）", "result": "可決"}, {"type": "資産", "title": "第2号議案：福島県南相馬市の小型実証機の撤去と関連固定資産の除却（撤去費 約500万円）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "2026年6月24日_取締役会招集通知.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 369339, "drive_file_id": "1x5Zy1ws3vudYWAWZWw--cbnhU22x4YmH", "drive_folder_id": "1WpsLNV2mgJU-zpzZAmNcc4w7U66zZ2vH", "drive_folder_name": "260624_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260624_取締役会", "url": "https://drive.google.com/file/d/1x5Zy1ws3vudYWAWZWw--cbnhU22x4YmH/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1x5Zy1ws3vudYWAWZWw--cbnhU22x4YmH/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "第1号議案 7月予算執行 全社＋開発（補足資料）.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 637855, "drive_file_id": "1jSmBWeN2m-TcE1qnow82yM7jri3h-qU6", "drive_folder_id": "1WpsLNV2mgJU-zpzZAmNcc4w7U66zZ2vH", "drive_folder_name": "260624_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260624_取締役会", "url": "https://drive.google.com/file/d/1jSmBWeN2m-TcE1qnow82yM7jri3h-qU6/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1jSmBWeN2m-TcE1qnow82yM7jri3h-qU6/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "第2号議案_福島小型実証機撤去に関する件.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 571555, "drive_file_id": "1N7NjsDo0BxYiN6_aPYPPdqO0uRPrDWAO", "drive_folder_id": "1WpsLNV2mgJU-zpzZAmNcc4w7U66zZ2vH", "drive_folder_name": "260624_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260624_取締役会", "url": "https://drive.google.com/file/d/1N7NjsDo0BxYiN6_aPYPPdqO0uRPrDWAO/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1N7NjsDo0BxYiN6_aPYPPdqO0uRPrDWAO/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1x5Zy1ws3vudYWAWZWw--cbnhU22x4YmH+notion:38997749c608819ea13ee9af9d967377$m$,
  $m$招集通知・議案資料と、Notionの書き起こし（2議案とも挙手で承認）に基づく。議事録は未受領。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-06-24');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-07-29', '202607', NULL,
  $m$2026年7月29日定時取締役会。報告事項は6月度予算実績差異分析と7月月次報告。決議事項は第1号議案「2026年8月度全社および開発予算執行」、第2号議案「六ケ所村設置風車撤去に関する件（固定資産除却含む）」。$m$,
  $m$[{"type": "予算", "title": "第1号議案：2026年8月度全社および開発予算執行", "result": "未確認"}, {"type": "資産", "title": "第2号議案：六ケ所村設置風車6基の撤去（3基は横浜園芸博へ移設、3基は廃棄）と固定資産除却", "result": "未確認"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "260729_取締役会_第1号議案資料_8月度予算執行 全社＋開発.xlsx", "storage": "google-drive", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size_bytes": 947844, "drive_file_id": "19G2_jBiifLfDyjUlcfKc4eXUCMtYtoMW", "drive_folder_id": "1_fU-blYN5YGal1xJUIbaR9BHcJtFIa1C", "drive_folder_name": "260729_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260729_取締役会", "url": "https://drive.google.com/file/d/19G2_jBiifLfDyjUlcfKc4eXUCMtYtoMW/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/19G2_jBiifLfDyjUlcfKc4eXUCMtYtoMW/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "第2号議案_六ケ所村設置風車撤去に関する件.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 524465, "drive_file_id": "1ifKpAbKKOw0fO9EJKiCBhU_khUJLeCqV", "drive_folder_id": "1_fU-blYN5YGal1xJUIbaR9BHcJtFIa1C", "drive_folder_name": "260729_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260729_取締役会", "url": "https://drive.google.com/file/d/1ifKpAbKKOw0fO9EJKiCBhU_khUJLeCqV/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1ifKpAbKKOw0fO9EJKiCBhU_khUJLeCqV/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1ifKpAbKKOw0fO9EJKiCBhU_khUJLeCqV$m$,
  $m$議案資料に基づく。議事録とNotionの書き起こしがないため、決議結果は未確認。六ケ所村の撤去はその後実施され、11月25日の取締役会で完了が報告されている。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-07-29');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-08-26', '202608', NULL,
  $m$2026年8月26日定時取締役会。報告事項は7月度予算実績差異分析と8月月次報告。決議事項は第1号議案「2026年9月度全社および開発予算執行」。$m$,
  $m$[{"type": "予算", "title": "第1号議案：2026年9月度全社および開発予算執行", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "260826_取締役会_第1号議案資料_9月度予算執行 全社＋開発.xlsx", "storage": "google-drive", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size_bytes": 1011445, "drive_file_id": "1Qyi4ELzb2fgfO4hVSgBQsjpVVDIxSImx", "drive_folder_id": "1DH64XIwxJYo9J_XHPNbUhSRK1NbD6-mh", "drive_folder_name": "260826_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260826_取締役会", "url": "https://drive.google.com/file/d/1Qyi4ELzb2fgfO4hVSgBQsjpVVDIxSImx/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1Qyi4ELzb2fgfO4hVSgBQsjpVVDIxSImx/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1Qyi4ELzb2fgfO4hVSgBQsjpVVDIxSImx+notion:3c897749c60881a99d54cd1c538f6353$m$,
  $m$議案資料とNotionの記録に基づく。議事録は未受領。開発関連の固定費の圧縮と、保管中の小型機器の譲渡先探しも確認した。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-08-26');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board_written', DATE '2026-09-03', '202609', NULL,
  $m$会社法370条と定款31条に基づく取締役会決議の省略（書面決議、9月2日付提案）。第2回J-KISS型新株予約権の募集事項決定を取締役会へ委任する議案を臨時株主総会へ上程することと、臨時株主総会の招集。$m$,
  $m$[{"type": "資金調達", "title": "第1号議案：第2回J-KISS型新株予約権の募集事項決定を取締役会へ委任する議案の株主総会上程（上限100個、1個あたり100万円以上）", "result": "可決"}, {"type": "株主総会", "title": "第2号議案：臨時株主総会の招集（2026年9月17日14:00、押上オフィス）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "取締役会決議事項に関する提案書_20260901_fin.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 102239, "drive_file_id": "1epyoqn2YjuKFzU43EpGlRmsH6lLA-NSA", "drive_folder_id": "135xXzczhD5N8SEhvtv01CFiL-9JBkwYQ", "drive_folder_name": "260903_取締役会_書面決議", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260903_取締役会_書面決議", "url": "https://drive.google.com/file/d/1epyoqn2YjuKFzU43EpGlRmsH6lLA-NSA/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1epyoqn2YjuKFzU43EpGlRmsH6lLA-NSA/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "20260903_取締役会決議事項に関する提案に対する同意書_(株)チャレナジー.PDF", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 269205, "drive_file_id": "1l-qkeBt1vh0TrQBLslzW81rie4mNlvHo", "drive_folder_id": "135xXzczhD5N8SEhvtv01CFiL-9JBkwYQ", "drive_folder_name": "260903_取締役会_書面決議", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260903_取締役会_書面決議", "url": "https://drive.google.com/file/d/1l-qkeBt1vh0TrQBLslzW81rie4mNlvHo/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1l-qkeBt1vh0TrQBLslzW81rie4mNlvHo/view?usp=drivesdk"}, {"kind": "governance_attachment", "name": "②別紙_第２回J-KISS型新株予約権　会社法第239条第1項各号に掲げる事項_AO_fin.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 220976, "drive_file_id": "1WkC-eYIlWVtpeOSDNQSkXZRmYLeNVf7S", "drive_folder_id": "135xXzczhD5N8SEhvtv01CFiL-9JBkwYQ", "drive_folder_name": "260903_取締役会_書面決議", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260903_取締役会_書面決議", "url": "https://drive.google.com/file/d/1WkC-eYIlWVtpeOSDNQSkXZRmYLeNVf7S/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1WkC-eYIlWVtpeOSDNQSkXZRmYLeNVf7S/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1epyoqn2YjuKFzU43EpGlRmsH6lLA-NSA+drive:1l-qkeBt1vh0TrQBLslzW81rie4mNlvHo$m$,
  $m$提案書と、取締役3名の同意書・監査役の異議がない旨の確認書（いずれも9月3日付）に基づく。会議は開いていない。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board_written' AND meeting_date = DATE '2026-09-03');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-09-17', '202609', $m$センターオブガレージ2階 会議室（Web会議併用）$m$,
  $m$2026年9月17日取締役会（14:17〜14:22）。同日の臨時株主総会で承認された委任に基づき、第2回J-KISS型新株予約権の募集事項と割当を決議。$m$,
  $m$[{"type": "資金調達", "title": "第1号議案：第2回J-KISS型新株予約権の募集事項の決定（別添の発行要項のとおり）", "result": "可決"}, {"type": "資金調達", "title": "第2号議案：J-KISS型新株予約権の割当（冨士色素株式会社に5個。契約の締結は代表取締役に一任）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[{"kind": "governance_attachment", "name": "20260917_CLG取締役会議事録.pdf", "storage": "google-drive", "mime_type": "application/pdf", "size_bytes": 2621095, "drive_file_id": "1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8", "drive_folder_id": "1rTxWMxnvV4NZrnwM16JTKVDAmiZZZvGg", "drive_folder_name": "260917_取締役会", "project_drive_folder_id": "1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd", "folder_display_path": "PJフォルダ / 0_取締役会 / 260917_取締役会", "url": "https://drive.google.com/file/d/1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8/view?usp=drivesdk", "web_view_link": "https://drive.google.com/file/d/1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8/view?usp=drivesdk"}]$m$::jsonb,
  $m$drive:1WwwbzwJpxC0KxSVw7G0IQGuYoEielcd8$m$,
  $m$署名押印済みの取締役会議事録に基づく。取締役3名全員出席（山地はつくば市からWeb参加）、監査役は欠席。同じファイルに臨時株主総会の議事録と発行要項が含まれる。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-09-17');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-09-24', '202609', NULL,
  $m$2026年9月24日定時取締役会。決議事項は2026年10月度予算執行。年度末までの資金繰り、バーンレート削減、沖縄向け事業計画、エンジニア体制、オフィス移転を議論。$m$,
  $m$[{"type": "予算", "title": "2026年10月度予算執行（1,316万9,960円）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[]$m$::jsonb,
  $m$notion:3e597749c608816a9a92ea09483ca774$m$,
  $m$Notionの書き起こしと会議カードに基づく。招集通知・議事録はDrive未格納。次回までにバーンレート削減計画を月次数字で示すこと、沖縄向け事業計画を大型化と廉価版の2本柱で整理することを確認した。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-09-24');

INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json, amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-10-28', '202610', NULL,
  $m$2026年10月28日定時取締役会。決議事項は2026年11月度全社・開発予算執行と、資金調達先のDDへ提出する中期事業計画。$m$,
  $m$[{"type": "予算", "title": "2026年11月度全社・開発予算執行（1,040万円。固定費 約577万円）", "result": "可決"}, {"type": "事業計画", "title": "中期事業計画を資金調達先のDDへ提出する現時点の計画として承認（12月末に来年度計画を改訂）", "result": "可決"}]$m$::jsonb, 'none',
  $m$[]$m$::jsonb,
  $m$notion:40797749c60881cd85fee23d20cc51a7$m$,
  $m$Notionの書き起こしと会議カードに基づく。招集通知・議事録はDrive未格納。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-10-28');

COMMIT;
