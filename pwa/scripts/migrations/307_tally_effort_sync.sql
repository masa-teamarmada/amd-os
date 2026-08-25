-- Tally はローカルの作業足跡とカレンダーから推定した工数を送る。
-- 手入力・既存カレンダー由来の project_weekly_effort_entries とは混同しない。

CREATE TABLE IF NOT EXISTS public.tally_project_syncs (
  project_id text NOT NULL REFERENCES public.projects(project_id),
  member_id text NOT NULL REFERENCES public.members(member_id),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
  meeting_search_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id),
  CHECK (jsonb_typeof(meeting_search_terms) = 'array')
);

CREATE TABLE IF NOT EXISTS public.tally_weekly_effort_entries (
  project_id text NOT NULL REFERENCES public.projects(project_id),
  member_id text NOT NULL REFERENCES public.members(member_id),
  week_start date NOT NULL,
  development_hours numeric(6,2) NOT NULL CHECK (development_hours >= 0 AND development_hours <= 168),
  meeting_hours numeric(6,2) NOT NULL CHECK (meeting_hours >= 0 AND meeting_hours <= 168),
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id, week_start)
);

CREATE INDEX IF NOT EXISTS tally_weekly_effort_project_week_idx
  ON public.tally_weekly_effort_entries (project_id, week_start DESC);

ALTER TABLE public.tally_project_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_weekly_effort_entries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tally_project_syncs IS
  'TallyローカルPJとAMD OS正規PJの同期設定。フォルダ絶対パス・認証情報は保存しない。';
COMMENT ON TABLE public.tally_weekly_effort_entries IS
  'Tally推定の週次作業時間とGoogle Calendar由来MTG時間。既存の週次工数台帳と混在させない。';
