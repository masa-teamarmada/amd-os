-- PJ単位でSlackチャンネルを使わない意図を明示する。
-- NULLは「未設定」、trueは「意図してチャンネルなし」と区別する。
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slack_channel_not_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.slack_channel_not_required IS
  'trueならこのPJはSlackチャンネルを使わない。抽出状況の設定不足には出さない。';
