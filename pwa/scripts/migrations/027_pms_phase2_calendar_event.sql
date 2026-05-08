-- 027: project_meeting_summaries Phase 2 移行
-- (番号 026 は seeds_data_round2 が先に取っていたため 027 にずらした)
--
-- Phase 1 (migration 024) では meeting_id = Notion page id だった。
-- Phase 2 では meeting_id = calendar event id に切り替える。
--
-- 理由: 1 MTG = 1 calendar event を主軸にし、Notion 議事録 + Gmail 議事録メール
--       (CircleBack 要約 / GMeet recording 通知) を結合して Gemini に投げる設計に変更。
--
-- 仕様正本: pwa/design/meeting_summaries.md (Phase 2 セクション)
--
-- 既存行の扱い: PK の値 (Notion page id) を calendar event id に置換する SQL は書けない
--                (1:1 対応をクライアント側で計算する必要があり、SQL では完結しない) ため
--                **既存 7 行を全削除し、GAS 側 nav_meeting_backfillForProject_ で再投入** する方針。
--                Phase 1 GAS が書いた中身は 7 件中大半が「議事録薄い → 空 items」で
--                どのみち再生成が必要だったので、廃棄損失は実質ない。

DELETE FROM project_meeting_summaries;

-- Notion page id を残しておく (UI で「Notion で開く」リンクに使うため)
ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

-- Gmail スレッドの取得元を記録 (デバッグ + 将来の差分検知精度向上)
ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS gmail_thread_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- どのソースから抽出したか記録 (UI バッジ + デバッグ)
-- 値: 'notion' | 'gmail' | 'notion+gmail' | 'none' (= 議事録なし)
ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS source_kinds TEXT;

-- calendar_event_id は 024 で既に存在する (TEXT NULL)。Phase 2 では
-- meeting_id = calendar_event_id だが、型整合のため両方持つ。両者は
-- 通常同じ値になる (= NOT NULL も保ちたいが既存スキーマ流用優先で NULL 可のまま)。

-- インデックスは 024 のものを流用 (project_id+meeting_date / project_id+ym)
