# HANDOFF — CTB契約凍結

- 更新: 2026-11-05 JST
- 作業種別: development
- 正本: `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/spec/5-9-admin-operating-calendar-current-spec.md`

## 現在地

- まさの指定で、PJの凍結とは別に契約の履行状態「契約凍結」を追加。CTBの採用済み業務委託契約は2026年5月から凍結として本番DBに保存済み。契約書の押印状態と2027年2月13日の満了日は維持。
- PJ台帳と契約台帳の両方で「契約凍結」をPC Chromeで確認済み。契約画面は `https://amd-os-pwa.vercel.app/admin/contracts?projectId=p06&view=terms`。
- 凍結後の月次報告は管理カレンダーの生成対象外。凍結前の対象月は保持。既存のCTB月報予定は確認時点で0件。
- migration `20261105122042`は本番適用済み。再適用しない。実装はmainの`99bcd56b1`。PWA本番も同SHAで確認済み。

## 未解決・最初の次アクション

- 今回の依頼に残作業はない。外部Googleカレンダーの既存予定の整理は今回行っていない。新たに指摘された場合は、対象イベントと生成元を読んでから処理する。
- iOS/macOS/Android専用UIへの移植は今回の依頼外。必要になったときは`pwa/HANDOFF_pwa_to_ios.md`から始める。

## 参照先

- 操作: `pwa/manual/2-6-admin-ops.md`、`pwa/manual/6-7-contracts-management-spec.md`
- 仕様: `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/spec/5-9-admin-operating-calendar-current-spec.md`
- 実装履歴: `pwa/design_log/sessions_2026-11.md`
- 回帰: `pwa/scripts/check_admin_schedule.mts`、`pwa/scripts/check_pwa_critical_ui.cjs`

## Git状態

- 引き継ぎ作成前: main/origin/main=`99bcd56b1`、dirtyなし、本体worktree 1、ローカルbranch mainのみ。引き継ぎ文書commit後はその新SHAを確認する。
