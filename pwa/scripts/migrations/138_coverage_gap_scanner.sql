-- 138_coverage_gap_scanner.sql
--
-- 目的: 「拾うべき情報を自動で検知して候補提示する」OS Coverage Scanner の受け皿。
--        5生データ × 既存L2カバレッジ の差分 (negative space / 不在検知) で、
--        「重要そうなのにOSのどのL2にも構造化されていない」候補を貯める。
--        起点は JOYCLE 臨時株主総会 招集通知の取りこぼし事故。まさより上位の安全網。
--        設計正本: pwa/design/coverage_gap_scanner.md (2026-06-15 まさ承認)
--
-- 新規 1 テーブル:
--   l2_coverage_gaps : 不在検知 gap 候補 (どの既存L2にもマップされていない salient item)
--
-- RLS 方針 (governance と同じく機密寄りに倒す。standard OS 形の anon SELECT true は採らない):
--   - service_role ALL  : Claude routine / API / applier の書き込み経路
--   - is_admin() ALL    : 管理 UI / /notifications admin gate 配下
--   - anon / authenticated への付与なし
--
-- 適用: python -X utf8 scripts/apply_ddl.py scripts/migrations/138_coverage_gap_scanner.sql
--       適用後 python3 -X utf8 scripts/dump_schema.py で db_schema.md 再生成。

-- ============================================================
-- l2_coverage_gaps (不在検知 gap 候補)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.l2_coverage_gaps (
  gap_id            text PRIMARY KEY,                  -- cg:<source_hash 先頭>
  source            text NOT NULL,                     -- gmail/drive/calendar/slack/notion
  source_ref        text,                              -- gmail thread id / drive file id / event id / slack ts / notion page id
  source_hash       text UNIQUE,                       -- 重複排除キー (再走で confirmed/rejected を壊さない)
  title             text,
  summary           text,                              -- 要約のみ。raw 全文は保存しない
  salience_score    numeric,                           -- 0-1
  matched_patterns  jsonb,                             -- どの検知パターンに当たったか
  proposed_target_l2 text,                             -- (C)LLM提案: action_item/registry_diff/strategy_signal/shareholder_meeting/... or NULL(未確定)
  gap_class         text,                              -- extractor_miss / structural_gap / uncertain
  project_id        text REFERENCES public.projects(project_id),  -- 終了PJ含む。NULL=個人/会社/未紐付け
  scope             text DEFAULT 'unknown',            -- project/company/personal/unknown
  due_at            timestamptz,                       -- 期日があれば (期日系を最優先化)
  review_status     text DEFAULT 'candidate',          -- candidate/confirmed/rejected
  routed_to         text,                              -- confirm 時に実ルートした先 (例: action_items:ai:xxx)
  evidence_refs_json jsonb,                            -- source 参照 (snippet/hash。本文全文でない)
  created_by        text DEFAULT 'coverage_scanner',
  detected_at       timestamptz DEFAULT now(),
  reviewed_at       timestamptz,
  routed_at         timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS l2_coverage_gaps_review_idx   ON public.l2_coverage_gaps(review_status);
CREATE INDEX IF NOT EXISTS l2_coverage_gaps_due_idx      ON public.l2_coverage_gaps(due_at);
CREATE INDEX IF NOT EXISTS l2_coverage_gaps_class_idx    ON public.l2_coverage_gaps(gap_class);
CREATE INDEX IF NOT EXISTS l2_coverage_gaps_project_idx  ON public.l2_coverage_gaps(project_id);

ALTER TABLE public.l2_coverage_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "l2_coverage_gaps_service" ON public.l2_coverage_gaps;
CREATE POLICY "l2_coverage_gaps_service" ON public.l2_coverage_gaps
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "l2_coverage_gaps_admin" ON public.l2_coverage_gaps;
CREATE POLICY "l2_coverage_gaps_admin" ON public.l2_coverage_gaps
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
