# SESSION MIGRATION PROMPT - AMD OS Management Score cash forecast handoff

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` を読み、そのあと `pwa/design/management_score.md`、`pwa/design/project_pl_monthly.md`、`pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- `/management-score` のキャッシュ残高予測は、当初計画残高をそのまま主線にしない。
- 主線は `実績接続見込み`: 最新 freee 実績残高 (`company_actual_monthly category='cash_balance'`) + 以後の見込み月次CF累計。
- `当初計画残高` は予実差分を見るために残す。実績で上書きしない。
- `実績残高` は freee `wallet_txns.balance` 月末合算由来の actual line。
- `/api/finance/live-cash-balances` は、実績残高がある場合 `cashBalance` = 実績接続見込み、`budgetCashBalance` = 当初計画、`actualCashBalance` = 実績残高、`forecastBasis` = `actual_connected` を返す。
- 実装 commit `81520b2a Connect cash forecast to latest actual balance` は main 履歴に入っている。handoff 時点の current production は `v0.36.32` / `3d90054e0ac37a30855f7e67c41c20047c4c6a9b` / `dirty=false`。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

最初の一手:
1. production が handoff 時点の最新 version / commit / dirty=false になっているか確認する。
2. ログイン済みブラウザで `/management-score` を開き、キャッシュ残高 chart に `実績接続見込み` / `当初計画残高` / `実績残高` が分離表示されることを見る。
3. finance 表や API を触る場合は、PL / cash / 支払予定 / 会社留保 / 報酬債務 / capリスクのどれを扱っているかを先に固定する。

残っている別bundle dirty:
- notification stop / meeting flow / task notification WIP
- contract / monthly agreement docs WIP
- Admin/Kiyo WIP
- meeting-assets / project-label WIP
- H-1 prep outbox markdowns
- `gas-slack/.clasp.json` local artifact

守ること:
- AMD OS は main 一本。BUILD_VERSIONを巻き戻さない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- `git add .` は絶対に使わない。選んだ bundle のファイルだけ個別 stage。
- 予算残高を実績で上書きしない。ただし意思決定用の未来残高は最新実績残高から接続する。
```
