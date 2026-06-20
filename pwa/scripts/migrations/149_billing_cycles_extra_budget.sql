-- 149_billing_cycles_extra_budget.sql
-- 別財布 (cap_extra プール) の月次支払上限。
--
-- 背景: ZMP (p19) の OkuDoor 開発 (税抜200万) は本契約 (定額30万/月) とは別財布で、
-- MS を `tag='cap_extra'` として本契約の pt 単価分母から分離している。しかし報酬エンジンの
-- cap_extra プールには「月次 cap」が無く (`deriveMonthlyRewardCaps` が extraCapYen=0 を返し、
-- `applyRewardCapsForMonth` が需要全額にフォールバックする)、開発期間中の各月に需要全額が
-- 即支払われてしまう。これが Σ月cap を押し上げ「原資≠Σcap」「役員stock非収束」を起こす。
--
-- まさ確定 (2026-06-20): OkuDoor は「全完了時に一括支払」。これを月次 cap 繰越エンジンで
-- 表現するため、開発期間中の各月は extra_budget_yen=0 (= 支払0・全額stock繰越)、完了月
-- (202610) だけ extra_budget_yen=売上原資 (130万) を置く。エンジンはこの列を cap_extra プールの
-- 月次 cap として読む。
--
-- セマンティクス (本契約 budget_yen と同じ NULL/0 規約):
--   NULL  = cap 未設定 (= 従来挙動。cap_extra 需要全額を即支払)。後方互換。
--   0     = この業務月は別財布支払 cap が 0 円 (= 全額を stock として翌月へ繰越)。
--   N>0   = この業務月の別財布支払上限は N 円。
--
-- 影響範囲: 現状 cap_extra MS を持つのは ZMP の OkuDoor 1 件のみ (全 PJ 横断スキャン済)。
-- 非破壊追加。設計正本 pwa/design/season_budget_actual.md §5.1。

ALTER TABLE billing_cycles
  ADD COLUMN IF NOT EXISTS extra_budget_yen int4;

COMMENT ON COLUMN billing_cycles.extra_budget_yen IS
  '別財布 (cap_extra プール) の月次支払上限。NULL=cap未設定(従来=需要全額即払い) / 0=支払0で全額stock繰越 / N=上限N円。完了月だけ満額を置くと「完了時一括支払」になる。本契約 budget_yen とは別枠。設計正本 pwa/design/season_budget_actual.md §5.1。';
