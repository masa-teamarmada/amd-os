-- 260_attention_review_gate.sql
--
-- 自動抽出物をそのまま「まさの注意」に昇格させないための意味審査ゲート。
-- collector は候補を pending で保存し、Codex automation が審査した行だけを
-- approved にする。PWA / iOS / macOS は approved 以外を注意面へ出さない。

ALTER TABLE public.proactive_todos
  ADD COLUMN IF NOT EXISTS due_basis text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS attention_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attention_type text,
  ADD COLUMN IF NOT EXISTS attention_owner text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS requires_masa_decision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason text,
  ADD COLUMN IF NOT EXISTS attention_action text,
  ADD COLUMN IF NOT EXISTS attention_effect text,
  ADD COLUMN IF NOT EXISTS attention_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS attention_source_hash text,
  ADD COLUMN IF NOT EXISTS attention_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attention_reviewed_by text;

ALTER TABLE public.proactive_todos
  DROP CONSTRAINT IF EXISTS proactive_todos_due_basis_check,
  ADD CONSTRAINT proactive_todos_due_basis_check
    CHECK (due_basis IN ('explicit', 'synthetic', 'unknown')),
  DROP CONSTRAINT IF EXISTS proactive_todos_attention_state_check,
  ADD CONSTRAINT proactive_todos_attention_state_check
    CHECK (attention_state IN ('pending', 'approved', 'suppressed', 'needs_source')),
  DROP CONSTRAINT IF EXISTS proactive_todos_attention_type_check,
  ADD CONSTRAINT proactive_todos_attention_type_check
    CHECK (attention_type IS NULL OR attention_type IN (
      'decision', 'masa_action', 'team_action', 'recovery',
      'information', 'waiting', 'suppressed', 'needs_source'
    )),
  DROP CONSTRAINT IF EXISTS proactive_todos_attention_owner_check,
  ADD CONSTRAINT proactive_todos_attention_owner_check
    CHECK (attention_owner IN ('none', 'masa', 'team', 'system')),
  DROP CONSTRAINT IF EXISTS proactive_todos_attention_confidence_check,
  ADD CONSTRAINT proactive_todos_attention_confidence_check
    CHECK (attention_confidence IS NULL OR (attention_confidence >= 0 AND attention_confidence <= 1));

ALTER TABLE public.l2_notifications
  ADD COLUMN IF NOT EXISTS attention_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attention_type text,
  ADD COLUMN IF NOT EXISTS attention_owner text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS requires_masa_decision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason text,
  ADD COLUMN IF NOT EXISTS attention_action text,
  ADD COLUMN IF NOT EXISTS attention_effect text,
  ADD COLUMN IF NOT EXISTS attention_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS attention_source_hash text,
  ADD COLUMN IF NOT EXISTS attention_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attention_reviewed_by text;

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS attention_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attention_type text,
  ADD COLUMN IF NOT EXISTS attention_owner text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS requires_masa_decision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason text,
  ADD COLUMN IF NOT EXISTS attention_action text,
  ADD COLUMN IF NOT EXISTS attention_effect text,
  ADD COLUMN IF NOT EXISTS attention_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS attention_source_hash text,
  ADD COLUMN IF NOT EXISTS attention_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attention_reviewed_by text;

ALTER TABLE public.l2_notifications
  DROP CONSTRAINT IF EXISTS l2_notifications_attention_state_check,
  ADD CONSTRAINT l2_notifications_attention_state_check
    CHECK (attention_state IN ('pending', 'approved', 'suppressed', 'needs_source')),
  DROP CONSTRAINT IF EXISTS l2_notifications_attention_type_check,
  ADD CONSTRAINT l2_notifications_attention_type_check
    CHECK (attention_type IS NULL OR attention_type IN (
      'decision', 'masa_action', 'team_action', 'recovery',
      'information', 'waiting', 'suppressed', 'needs_source'
    )),
  DROP CONSTRAINT IF EXISTS l2_notifications_attention_owner_check,
  ADD CONSTRAINT l2_notifications_attention_owner_check
    CHECK (attention_owner IN ('none', 'masa', 'team', 'system')),
  DROP CONSTRAINT IF EXISTS l2_notifications_attention_confidence_check,
  ADD CONSTRAINT l2_notifications_attention_confidence_check
    CHECK (attention_confidence IS NULL OR (attention_confidence >= 0 AND attention_confidence <= 1));

ALTER TABLE public.app_notifications
  DROP CONSTRAINT IF EXISTS app_notifications_attention_state_check,
  ADD CONSTRAINT app_notifications_attention_state_check
    CHECK (attention_state IN ('pending', 'approved', 'suppressed', 'needs_source')),
  DROP CONSTRAINT IF EXISTS app_notifications_attention_type_check,
  ADD CONSTRAINT app_notifications_attention_type_check
    CHECK (attention_type IS NULL OR attention_type IN (
      'decision', 'masa_action', 'team_action', 'recovery',
      'information', 'waiting', 'suppressed', 'needs_source'
    )),
  DROP CONSTRAINT IF EXISTS app_notifications_attention_owner_check,
  ADD CONSTRAINT app_notifications_attention_owner_check
    CHECK (attention_owner IN ('none', 'masa', 'team', 'system')),
  DROP CONSTRAINT IF EXISTS app_notifications_attention_confidence_check,
  ADD CONSTRAINT app_notifications_attention_confidence_check
    CHECK (attention_confidence IS NULL OR (attention_confidence >= 0 AND attention_confidence <= 1));

CREATE INDEX IF NOT EXISTS proactive_todos_attention_open_idx
  ON public.proactive_todos (attention_state, attention_type, due_at)
  WHERE status IN ('open', 'blocked');

CREATE INDEX IF NOT EXISTS l2_notifications_attention_queue_idx
  ON public.l2_notifications (attention_state, requires_masa_decision, created_at DESC);

CREATE INDEX IF NOT EXISTS app_notifications_attention_queue_idx
  ON public.app_notifications (attention_state, created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE OR REPLACE FUNCTION public.reset_proactive_todo_attention_on_semantic_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.trigger_kind IS DISTINCT FROM OLD.trigger_kind
     OR NEW.source_meeting_id IS DISTINCT FROM OLD.source_meeting_id
     OR NEW.source_event_id IS DISTINCT FROM OLD.source_event_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.detail IS DISTINCT FROM OLD.detail
     OR NEW.ball_owner IS DISTINCT FROM OLD.ball_owner
     OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.due_basis IS DISTINCT FROM OLD.due_basis THEN
    NEW.attention_state := 'pending';
    NEW.attention_type := NULL;
    NEW.attention_owner := 'none';
    NEW.requires_masa_decision := false;
    NEW.attention_reason := NULL;
    NEW.attention_action := NULL;
    NEW.attention_effect := NULL;
    NEW.attention_confidence := NULL;
    NEW.attention_source_hash := NULL;
    NEW.attention_reviewed_at := NULL;
    NEW.attention_reviewed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proactive_todos_attention_reset_trg ON public.proactive_todos;
CREATE TRIGGER proactive_todos_attention_reset_trg
BEFORE UPDATE ON public.proactive_todos
FOR EACH ROW EXECUTE FUNCTION public.reset_proactive_todo_attention_on_semantic_change();

CREATE OR REPLACE FUNCTION public.reset_l2_attention_on_semantic_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.l2_kind IS DISTINCT FROM OLD.l2_kind
     OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.scope_key IS DISTINCT FROM OLD.scope_key
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.saved_count IS DISTINCT FROM OLD.saved_count
     OR NEW.total_count IS DISTINCT FROM OLD.total_count
     OR NEW.metadata_json IS DISTINCT FROM OLD.metadata_json THEN
    NEW.attention_state := 'pending';
    NEW.attention_type := NULL;
    NEW.attention_owner := 'none';
    NEW.requires_masa_decision := false;
    NEW.attention_reason := NULL;
    NEW.attention_action := NULL;
    NEW.attention_effect := NULL;
    NEW.attention_confidence := NULL;
    NEW.attention_source_hash := NULL;
    NEW.attention_reviewed_at := NULL;
    NEW.attention_reviewed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS l2_notifications_attention_reset_trg ON public.l2_notifications;
CREATE TRIGGER l2_notifications_attention_reset_trg
BEFORE UPDATE ON public.l2_notifications
FOR EACH ROW EXECUTE FUNCTION public.reset_l2_attention_on_semantic_change();

CREATE OR REPLACE FUNCTION public.reset_app_notification_attention_on_semantic_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.meta IS DISTINCT FROM OLD.meta
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    NEW.attention_state := 'pending';
    NEW.attention_type := NULL;
    NEW.attention_owner := 'none';
    NEW.requires_masa_decision := false;
    NEW.attention_reason := NULL;
    NEW.attention_action := NULL;
    NEW.attention_effect := NULL;
    NEW.attention_confidence := NULL;
    NEW.attention_source_hash := NULL;
    NEW.attention_reviewed_at := NULL;
    NEW.attention_reviewed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_notifications_attention_reset_trg ON public.app_notifications;
CREATE TRIGGER app_notifications_attention_reset_trg
BEFORE UPDATE ON public.app_notifications
FOR EACH ROW EXECUTE FUNCTION public.reset_app_notification_attention_on_semantic_change();

COMMENT ON COLUMN public.proactive_todos.attention_state IS
  'Codex意味審査。pendingは候補のみ、approvedだけがまさの注意面へ出る。';
COMMENT ON COLUMN public.proactive_todos.due_basis IS
  'explicit=素材内の明示期限、synthetic=collectorの仮期限、unknown=未判定。synthetic/unknownは期限超過扱い禁止。';
COMMENT ON COLUMN public.l2_notifications.attention_state IS
  'Codex意味審査。approvedかつrequires_masa_decision=trueだけを通知・判断キューへ出す。';
COMMENT ON COLUMN public.app_notifications.attention_state IS
  'Codex意味審査。直接の再認証URLがあるconnector_authを除き、approvedだけが通知面へ出る。';
