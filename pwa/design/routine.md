# 月次ルーティン廃止 — 設計の正本

> **2026-06-19 方針確定**: OS 上の PM 月次ルーティンは廃止。cockpit / dashboard / mypage / GAS legacy cockpit に、PM向けの月次 step / TODO / nudge を発生させない。

## 現行方針

- 報告書確認の軽い連絡は Slack 側で扱う。OS には report 確認 TODO / nudge カードを出さない。
- 報告会日程調整は廃止。2 か月に 1 回の対面ナレッジ会は OS の月次タスク外で運用する。
- 立替精算は `/reimburse` と admin 承認で扱い、PM 月次タスクにはしない。
- 請求書発行・送付は admin 業務。主入口は `/admin/billing`。
- CTB 見積は CTB 停止中のため廃止。
- 請求額は契約 apply 済みデータから `contract-billing-auto-confirm` と admin billing / payouts 側で扱う。PM/PL の通常 TODO には戻さない。

## PWA 実装境界

- `CockpitRoutine.tsx` / `CockpitRoutineGas.tsx` / `HudCockpitRoutineGas.tsx` / `CockpitRoutine*Modal.tsx` は削除済み。
- `/project/[projectId]/cockpit?step=<stepId>&ym=YYYYMM` は legacy query。現行 cockpit は `step` を解釈しない。
- `/mypage` は月次確認 TODO を生成しない。月次報酬予定は表示するが、月次ルーティン未対応による取り消し線・除外判定は行わない。
- `/dashboard` / `/hud/dashboard` の action queue は月次ルーティンから生成しない。
- `/api/hud/dashboard` は `actionItems: []` を返し、請求額確定・報告会日程調整・報告書確認・請求書送付などを生成しない。

## GAS legacy 境界

- `cron_checkRoutineAlertsDaily_` / `cron_invoiceSendNudge_` / `cron_nudgeBudgetReminder` は no-op。
- `setupRoutineAlertTrigger` / `invoiceSend_runInternalSetup_` / `setup_nudgeBudgetReminderTrigger` は既存トリガー削除のみ行い、新規トリガーを作らない。
- legacy GAS cockpit は routine section を描画せず、`cockpit_api_getRoutineFlow` は空の `flows` を返す。

## 残すもの

- 月次カードと `CockpitMonthlyModal`: 月次の進捗・報酬・レポートを確認する read/write surface として残す。
- `/admin/billing`: 報告書・立替・請求発行・請求送付・入金・支払通知の admin 管理表として残す。
- `/admin/payouts`: 支払通知書・報酬支払の正本。
- `/reimburse`: 立替申請・PM/admin承認の正本。

## 回帰防止

- PM 向け TODO 名として `請求額確定` / `報告会日程調整` / `月次報告書確認` / `請求書送付` / `CTB見積` を dashboard・mypage・cockpit に出さない。
- `CockpitRoutine*` component を再作成しない。
- Slack report nudge を OS UI の TODO に同期しない。
