# AMD OS Handoff

最終更新: 2026-06-29 JST
対象: `/Users/masa/projects/AMD/amd-os`
トピック: `/management-score` のキャッシュ残高予測を実績接続見込みへ変更

## いまの結論

- main/default alignment: `main aligned`
- 実装 commit: `81520b2a Connect cash forecast to latest actual balance`
- handoff 開始時の current main / production: `v0.36.32` / `3d90054e0ac37a30855f7e67c41c20047c4c6a9b` / `dirty=false`
- `81520b2a` は `origin/main` の履歴に含まれている。後続の payout notice commits により production build version は `v0.36.32` まで進行済み。
- 今回の accepted behavior: 残高予測の主線は、当初計画残高ではなく「最新 freee 実績残高 + 以後の見込み月次CF累計」の `実績接続見込み`。

## 今回やったこと

- `/management-score` のキャッシュ残高チャートに `実績接続見込み` を追加し、主線へ変更。
- 既存の予算線は `当初計画残高` として残し、実績残高線と分離。
- `/api/finance/live-cash-balances` の `cashBalance` を実績接続見込み、`budgetCashBalance` を当初計画として返す contract へ変更。
- KPI の最終残高表示を、実績がある場合は実績接続見込みベースへ変更。
- `pwa/manual/4-5-management-score-and-finance-simulation-spec.md`、`pwa/design/management_score.md`、`pwa/design/project_pl_monthly.md`、appendix changelog に仕様を同期。
- 本 handoff で `pwa/BUGS.md` と `pwa/design_log/sessions_2026-06.md` に closeout 記録を追加。

## Verification

- `pwa` で `npx tsc --noEmit` 成功。
- `pwa` で `npm run build` 成功。
- 対象ファイルの `eslint` 成功。
- `git diff --check` 成功。
- local API `/api/finance/live-cash-balances?from=202601&to=202612` で future row が `forecastBasis:"actual_connected"` になり、`cashBalance` と `budgetCashBalance` が分離していることを確認。
- deploy script `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 成功。`v0.36.29` / `81520b2a...` の production 反映を確認。
- その後、別 worker / まさ側 deploy で `v0.36.32` / `3d90054e...` へ進行。`81520b2a` は main 履歴に残存。
- 未ログイン browser check は `/auth/login` redirect まで。ログイン後の実画面はまさが「実装された」と確認済み。

## Current Truth

- 予算残高は実績で上書きしない。予実差分を見るために `当初計画残高` として残す。
- 意思決定用の未来残高は `実績接続見込み` を読む。
- 実績アンカーは `company_actual_monthly` の `category='cash_balance'`、生成元は freee `wallet_txns.balance` 月末合算。
- 未来月は最新実績残高から、その後の見込み月次CFを累積する。
- `cashBalance` = 主見込み、`budgetCashBalance` = 当初計画、`actualCashBalance` = 実績残高。

## Unresolved Tasks

1. ログイン済み画面で余裕があれば `/management-score` の chart tooltip と summary strip を目視確認する。
2. 次に finance 表を触る時は、PL / cash / 支払予定 / 会社留保 / 報酬債務 / capリスクのどれを表示しているかを先に固定する。
3. mixed dirty は別作業由来が多い。`git add .` は使わず、owner / bundle ごとに分ける。

## Dirty / Untracked Classification

### preexisting / likely other-worker WIP

- notification stop / meeting flow / task notification bundle:
  - `gas/153_MeetingHourlyTrigger.js`
  - `pwa/design/L2_DATA.md`
  - `pwa/design/l2_extract_claude_routine.md`
  - `pwa/design/meeting_summaries.md`
  - `pwa/design/notifications.md`
  - notification/task API and component files
  - migrations `155_skip_non_actionable_app_notifications.sql` / `156_skip_meeting_summary_notifications.sql`
- contract / monthly agreement docs WIP:
  - `output/doc/monthly-work-agreement-outsourcing-contract-draft-20260628.docx`
  - `pwa/proposals/monthly-work-agreement-contract-revision-and-rollout-draft-20260628.md`
  - contract spec/manual dirty files
- Admin/Kiyo / meeting-assets / project-label WIP:
  - `pwa/src/app/(app)/admin/kiyo/page.tsx`
  - `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts`
  - `pwa/src/lib/project-labels.ts`
  - `pwa/scripts/update_drive_file.mjs`
  - migration `153_project_venture_legacy_name_hygiene.sql`
- H-1 prep outbox markdowns under `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/`.
- local artifact: `gas-slack/.clasp.json`.

扱い: 今回の management-score bundle とは別。owner へ戻すか cleanup worker で分類。

## First Next Action

1. `HANDOFF.md` -> `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` -> `pwa/design/management_score.md` -> `pwa/design/project_pl_monthly.md` -> `pwa/BUGS.md` の順で読む。
2. `git fetch origin main --prune`、`git status -sb --untracked-files=all`、production `/api/build-info` を確認する。
3. `/management-score` を触るなら、`actualCashBalance`、`cashBalance`、`budgetCashBalance` の意味を先に確認する。

## Archive 判定

handoff required。

理由:

- management-score 残高予測 fix は main / production に入った。
- ただし repo には preexisting / other-worker dirty と untracked が残っている。
- 今回 bundle 以外を巻き込まず、次 owner が bundle 単位で閉じる必要がある。
