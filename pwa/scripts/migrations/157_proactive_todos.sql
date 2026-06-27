-- 157_proactive_todos.sql
--
-- 目的: 先手 TODO リストの正本テーブル。
--       過去開催済みMTGの next_actions と、次回外部MTG予定の準備TODOを
--       cron `/api/cron/proactive-todo-extract` が毎時 upsert する。
--       UI は /proactive (admin限定) + dashboard 上段バッジ。
--
-- 設計メモ:
--   - 旧 proactive_outbox / proactive_loops / proactive_loop_events は作らない (2026-06-27 廃止確定)。
--   - status は MVP では 4 段階のみ: open / done / blocked / dismissed。
--     - done: やった (=完了)
--     - blocked: 待ち中 (resolved_note 任意で 1 行メモ、3日後 open に自動復帰)
--     - dismissed: LLM/cron 誤検知扱い (二度と作らない)
--   - sent (相手に渡した) は MVP ではなし。必要になれば追加。
--   - LLM は cron 内では呼ばない。ball_owner は文字列ヒューリスティック。
--   - UNIQUE 制約で同じ MTG / event に対する重複upsertを冪等化。
--
-- RLS 方針:
--   経営機微 (相手側に渡す前の進行案、催促予兆) を含むため anon SELECT は付与しない。
--   service_role と admin のみ ALL。

CREATE TABLE IF NOT EXISTS public.proactive_todos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          text NOT NULL,
  trigger_kind        text NOT NULL,             -- 'meeting_next_action' | 'next_meeting_prep'
  source_meeting_id   text,                      -- project_meeting_summaries.meeting_id (開催済みMTGから)
  source_event_id     text,                      -- 次回MTG予定の calendar_event_id (= upcoming meeting_id)
  title               text NOT NULL,             -- 1行で見える要約
  detail              text,                      -- 推奨first move + 遅延リスクをまとめた文章
  ball_owner          text NOT NULL DEFAULT 'ambiguous',  -- 'amd' | 'counterpart' | 'ambiguous'
  due_at              timestamptz NOT NULL,
  priority            text NOT NULL DEFAULT 'normal',     -- 'red' | 'normal'
  status              text NOT NULL DEFAULT 'open',       -- 'open' | 'done' | 'blocked' | 'dismissed'
  resolved_note       text,                      -- 完了/ブロック時の1行メモ (任意)
  resolved_by         text,                      -- 'masa' | 'eimi' 等、誰が押したか
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  CONSTRAINT proactive_todos_trigger_check
    CHECK (trigger_kind IN ('meeting_next_action', 'next_meeting_prep')),
  CONSTRAINT proactive_todos_status_check
    CHECK (status IN ('open', 'done', 'blocked', 'dismissed')),
  CONSTRAINT proactive_todos_ball_check
    CHECK (ball_owner IN ('amd', 'counterpart', 'ambiguous')),
  CONSTRAINT proactive_todos_priority_check
    CHECK (priority IN ('red', 'normal'))
);

-- 同じ MTG の同じ next_action テキスト / 同じ next meeting の同じ trigger は upsert で 1 行にまとめる。
-- title を含めるのは、同じ meeting で next_actions が複数ある場合に行を分けるため。
CREATE UNIQUE INDEX IF NOT EXISTS proactive_todos_uniq_meeting
  ON public.proactive_todos (project_id, trigger_kind, COALESCE(source_meeting_id, ''), COALESCE(source_event_id, ''), title);

CREATE INDEX IF NOT EXISTS proactive_todos_open_due_idx
  ON public.proactive_todos (status, due_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS proactive_todos_project_idx
  ON public.proactive_todos (project_id, status);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION public.proactive_todos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proactive_todos_set_updated_at_trg ON public.proactive_todos;
CREATE TRIGGER proactive_todos_set_updated_at_trg
BEFORE UPDATE ON public.proactive_todos
FOR EACH ROW EXECUTE FUNCTION public.proactive_todos_set_updated_at();

-- RLS: admin と service_role のみ ALL
ALTER TABLE public.proactive_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proactive_todos_admin_all ON public.proactive_todos;
CREATE POLICY proactive_todos_admin_all
  ON public.proactive_todos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.email = (auth.jwt() ->> 'email')
        AND members.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.email = (auth.jwt() ->> 'email')
        AND members.is_admin = true
    )
  );

DROP POLICY IF EXISTS proactive_todos_service_role_all ON public.proactive_todos;
CREATE POLICY proactive_todos_service_role_all
  ON public.proactive_todos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.proactive_todos IS '先手 TODO リストの正本。/api/cron/proactive-todo-extract が毎時 upsert、/proactive (admin) が表示・完了UI。仕様: pwa/spec/2-4-proactive-todo-current-spec.md';
