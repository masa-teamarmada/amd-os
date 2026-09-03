-- 議事録の欠損台帳。
--
-- H-1 は「終了60-180分後」の2時間の窓でしか開催済み議事録を作らない。この窓の中で
-- run が走らなかった会議 (runが落ちた / 保存先が壊れていた / 認証が切れていた) は、
-- これまで二度と対象にならなかった。救済レーンも「直近24時間」かつ「既存行があるもの」
-- しか見ないため、行が1行も作られなかった会議は救済対象に入らなかった。
--
-- この台帳は、窓の外に出た会議を期限なく保持する。毎runのgateが
--   予定はあるのに確定版が無い -> pending として記録
--   確定版ができた             -> recovered
--   何度やっても取れない        -> abandoned (まさの画面に出す)
-- を観測事実から書き直す。writerの自己申告ではなくDBの実状態から判定するので、
-- 「保存できなかったと報告したのに次のrunへ渡らない」という今回の穴を塞ぐ。

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_minutes_backfill_ledger (
  calendar_event_id   text PRIMARY KEY,
  project_id          text,
  title               text NOT NULL,
  meeting_start_at    timestamptz NOT NULL,
  meeting_end_at      timestamptz,
  -- pending      = 確定版が無い。再試行の対象
  -- recovered    = 確定版ができた
  -- no_material  = 元データが存在せず、議事録を作れないと確認済み
  -- abandoned    = 上限まで試して取れなかった。まさの画面に出す
  -- ignored      = まさが対象外と判断した (懇親会、視察など)
  status              text NOT NULL DEFAULT 'pending',
  attempt_count       integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 5,
  first_detected_at   timestamptz NOT NULL DEFAULT now(),
  last_emitted_at     timestamptz,
  last_attempt_at     timestamptz,
  last_outcome        text,
  last_error          text,
  detected_by         text NOT NULL DEFAULT 'h1_candidate_gate',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_minutes_backfill_ledger_status_check
    CHECK (status IN ('pending', 'recovered', 'no_material', 'abandoned', 'ignored'))
);

COMMENT ON TABLE public.meeting_minutes_backfill_ledger IS
  '議事録が作られなかった会議の台帳。H-1の抽出窓を外した会議を期限なく保持し、毎runの再試行の入力にする。正本仕様は pwa/spec/3-3-meeting-flow-current-spec.md';
COMMENT ON COLUMN public.meeting_minutes_backfill_ledger.attempt_count IS
  '再試行した回数。gateが「候補として出したのに次のrunでも確定版が無い」ことを観測したときに1増える。writerの自己申告では増やさない';
COMMENT ON COLUMN public.meeting_minutes_backfill_ledger.last_emitted_at IS
  '候補として出した時刻。次のrunでこれと last_attempt_at を比べ、試行が消化されたかを判定する';

CREATE INDEX IF NOT EXISTS meeting_minutes_backfill_ledger_status_idx
  ON public.meeting_minutes_backfill_ledger (status, meeting_start_at DESC);
CREATE INDEX IF NOT EXISTS meeting_minutes_backfill_ledger_project_idx
  ON public.meeting_minutes_backfill_ledger (project_id, meeting_start_at DESC);

-- 重複したCalendar event id (同じ会議が別idで複数の予定カードを持つ) を畳むための索引。
CREATE INDEX IF NOT EXISTS meeting_minutes_backfill_ledger_dedup_idx
  ON public.meeting_minutes_backfill_ledger (project_id, meeting_start_at);

CREATE OR REPLACE FUNCTION public.touch_meeting_minutes_backfill_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meeting_minutes_backfill_ledger_touch ON public.meeting_minutes_backfill_ledger;
CREATE TRIGGER meeting_minutes_backfill_ledger_touch
  BEFORE UPDATE ON public.meeting_minutes_backfill_ledger
  FOR EACH ROW EXECUTE FUNCTION public.touch_meeting_minutes_backfill_ledger();

ALTER TABLE public.meeting_minutes_backfill_ledger ENABLE ROW LEVEL SECURITY;

COMMIT;
