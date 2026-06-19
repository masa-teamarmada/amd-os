# SESSION MIGRATION PROMPT - AMD OS monthly agreement / finance tables

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、`pwa/manual/4-5-management-score-and-finance-simulation-spec.md` を読んで。その次に `pwa/BUGS.md` を読んで。必要に応じて `pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、`pwa/design/project_pl_monthly.md`、`pwa/design_log/sessions_2026-06.md` の 2026-06-19 finance entries も読む。

作業開始前に必ず:
1. `git fetch origin main`
2. `git status -sb`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

current truth:
- 月初合意は `/admin/payouts` の支払 gate。未合意 / 条件更新あり / 修正要望中は server-side に支払データ保存・PDF生成・送付・送付済み確定を止める。admin override は reason / actor / target member/PJ/month を監査ログに残す時だけ許可。
- CTB p06 は 202605 から freeze overlay なので、202606 月初合意・支払 gate は `not_required`。`projects.status='active'` だけで戻さない。
- りり / ID006 と あき / ID029 は `members.exclude_from_payout_notice=true` の対象。月初合意・支払通知書・支払 gate では `not_required`。
- SX の 202604/202605 契約前稼働が 202606 以降の未払い残として大きく見えるのは異常ではない。`stockYen` は月末未払い残で、今月支払ではない。
- `/admin/payouts` には報酬債務台帳を置き、`carryInYen + (grossDueYen - carryInYen) - totalPay = stockYen` を member × PJ × 稼働月で読む。
- `/admin/payouts` と `/management-score` 下部の先12か月表は `キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` の4表。会社留保は支出ではなく `cap/売上枠 - 外部支払`。報酬債務は残高なので12か月合計しない。

次にやること:
1. あき / ID029 の除外が実DB/codeに反映されているか確認し、未反映なら実装する。
2. logged-in で `/admin/payouts?ym=202606`, `/management-score`, `/monthly-agreement?ym=202606`, `/admin/monthly-work-agreements?ym=202606` を確認する。
3. 4表のUX/数字をまさの目的別にさらに整える。1表に複数目的を戻さない。

注意:
- `stockYen` は支払予定でもPL原価でもなく、非役員メンバーへの月末未払い残高。
- 月初合意 gate は報酬計算式を変えない。支払 action 直前の read gate。
- hard guard の本番運用は契約改定・メンバー同意・法務レビューが前提。法的助言として断定しない。
- PWA deploy が必要なら repo root から `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
- `git add .` は使わない。
```
