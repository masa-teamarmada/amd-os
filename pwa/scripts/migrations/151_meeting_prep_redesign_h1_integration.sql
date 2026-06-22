-- 151_meeting_prep_redesign_h1_integration.sql
-- MTG Prep Worker の H-1 統合再設計 (= migration 150 の追補)。
--
-- 背景: migration 150 で追加した prep_* 列のうち、`prep_worker_session_url` は
-- 当初「Codex Cloud REST API で動的 spawn した automation run の URL」を保存する
-- 想定だったが、まさ確定 (2026-06-22) で Codex Cloud REST API 経路は廃止し、
-- 既存 H-1 automation 内 Phase P で `codex exec` subprocess で session を spawn
-- する設計へ変更。codex desktop は SESSION_ID から直接 session を開けるため、
-- URL 列は不要になった。
--
-- また Phase P では「＋ <PJ> MTG準備: <タイトル>」というまさカレンダーの
-- prep 枠を作成・追従する仕様になったため、その Calendar event ID を
-- 保存する prep_calendar_event_id 列を追加する。
--
-- 設計正本: pwa/spec/3-3-meeting-flow-current-spec.md 末尾
--          「H-1 MTG Prep セッション自動立ち上げ」節 (= 2026-06-22 修正版)

ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS prep_calendar_event_id text;

COMMENT ON COLUMN project_meeting_summaries.prep_calendar_event_id IS
  'まさカレンダー上の prep 枠 (= 「＋ <PJ> MTG準備: <タイトル>」event) の Calendar event ID。H-1 内 Phase P が post-MTG 即時 timing で枠を作成し、まさが枠をドラッグで移動したら次の H-1 run でこの ID 経由 Calendar を read して spawn 時刻を追従する。設計正本 pwa/spec/3-3-meeting-flow-current-spec.md「H-1 MTG Prep セッション自動立ち上げ」節。';

-- prep_worker_session_url は廃止。codex desktop は SESSION_ID から直接 session を
-- 開けるため URL を保持する意味がなくなった。
ALTER TABLE project_meeting_summaries
  DROP COLUMN IF EXISTS prep_worker_session_url;
