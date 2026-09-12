-- 2026-09-12 まさ確定。本番へは MCP の apply_migration で反映済み。記録として残す。
--
-- (1)「EWIR」を「SIER」へ改称する。
--     単語として独立しているものだけ。境目はASCIIの英数字とアンダースコアで判定し、
--     日本語がすぐ隣に来る「EWIR組成」も対象にする。これで
--       - DriveのファイルID 1TeEWIRn8_3X67dQ1KzuDn4UYYL0o_h1r（偶然の並び）
--       - 添付の実ファイル名 260714_SolvioraX_EWIR_action_deck.pdf
--     は対象外になる。素朴な一括置換だと契約書のリンクが切れる。
--
--     一次資料と履歴は触らない（議事録本文、取り込んだ原文、添付から抽出した原文、
--     月次報告の編集履歴、更新履歴、提出済みの月次報告）。
--     改称前の88行は ewir_rename_backup_20260912 と Drive へ退避済み。
--
-- (2)「決めること」を廃止する。既存43行を論点へ寄せる。
--     CHECK制約からは外さない（過去の行と履歴を読めるようにするため）。
--     寄せる前の43行も Drive へ退避済み。

-- (1) の対象列と実行は ewir_rename_targets_20260912 / ewir_rename_backup_20260912 を参照。

update project_questions
set question_kind = 'open'
where question_kind = 'decision' and deleted_at is null;
