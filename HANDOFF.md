# HANDOFF

最終更新: 2026-08-19 JST
対象: Admin管理カレンダーとGoogle Calendar実務時間枠

## 今回の到達点

- Adminトップを `/admin/schedule` にし、毎月自動で進む12か月表示へ変更した。
- 月表示は「いつ何をするか」を読める情報量へ修正した。
- 日付確定・当日以降・未完了の予定を、会社所有の共有カレンダー `AMD 管理カレンダー` へ毎日同期する。
- active adminのまさ・きよへ共有し、終日ではなく60/90/120分の「予定あり」時間枠として確保する。
- 既存48件を同じイベントIDのまま時刻付きへ更新し、再同期は `unchanged 48` のno-opを確認した。

## 正本と履歴

- 詳細仕様: `pwa/spec/5-9-admin-operating-calendar-current-spec.md`
- 機能索引: `pwa/design/FEATURE_REGISTRY.md`
- 利用者向け運用: `pwa/manual/2-6-admin-ops.md`
- 実装履歴: `pwa/design_log/sessions_2026-08.md`
- バグと教訓: `pwa/BUGS.md`
- 実装: `ios/supabase/functions/admin-schedule-calendar-sync/`、`pwa/src/app/api/cron/company-schedule/route.ts`

## Repo / deploy状態

- 実装commit: `f0dec491`、時間枠訂正commit: `cd64820e`（いずれもmain履歴内）
- Supabase Edge Function: production deploy済み
- PWA: closeout commitをmainへpushし、production `/api/build-info`を確認して確定する
- 確認済み: `npm run test:admin-schedule`、`npx tsc --noEmit`、対象eslint、`npm run build`

## 今回と無関係なdirty

以下は別作業のため触っていない。

- `pwa/manual/4-3-amd-score-spec.md`
- `pwa/spec/4-2-amd-score-current-spec.md`
- `docs/corporate/`
- `pwa/scripts/diagnose-cash-inflow.mts`
- `pwa/scripts/refresh-live-monthly-pl.mts`

## 未解決

管理カレンダー機能としてはなし。上記dirtyの処置は各所有作業で判断する。

## 次の最初の行動

新しい依頼から開始する。管理カレンダーを変更する場合は、先に5-9仕様と2-6 adminオペを読み、Google Calendar同期後は2回目がno-opになることまで確認する。
