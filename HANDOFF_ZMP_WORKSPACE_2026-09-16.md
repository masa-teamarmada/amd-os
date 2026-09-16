# HANDOFF — ZMPゴール・タスク・ガント再整理

最終更新: 2026-09-16 JST  
作業種別: mixed（AMD OS開発 + ZMP運用判断）

## 最新セッション

- ZMPワークスペースの実行入口を`ゴールツリー / タスク / ガント / 週次差分 / 関係先`へ変更し、旧「テーマ」タブを廃止した。
- スタッフ研修・リハーサルはゴールツリーとの関連を外し、`ツリー外`タスクとしてタスク一覧とガントへ残した。
- KR経営改革の活動中の枝を外し、追加契約成立時のみ再検討する完了済み判断へ整理した。関連する活動中TODO 6件は`dropped`。
- ゴールツリーでは承認済みのツリー外タスクを出さず、未承認の紐づけ先未確定TODOだけを候補として表示する。
- 詳細な実装履歴は`pwa/design_log/sessions_2026-09.md`、ZMPの運用判断は`/Users/masa/projects/AMD/ZMP/ZMP_WORKSPACE_OPERATING_DECISIONS.md`。

## Repo / 本番

- canonical repo: `/Users/masa/projects/AMD/amd-os`
- default branch: `main`
- accepted implementation commit: `5c06cd743380f20e61b4c21ad4195da6c644a666`
- production: `v3.140.3` / `5c06cd743380f20e61b4c21ad4195da6c644a666`
- URL: `https://amd-os-pwa.vercel.app/project/p19/workspace`
- DB migrations: `20260916023000_zmp_active_goal_tree_correction.sql`、`20260916024000_zmp_retire_duplicate_trademark_question.sql`
- migration historyを含む本番DB読み戻し済み。

## 検証済み

- `npm run test:zmp-workspace-themes`
- `npm run test:critical-ui`
- `npx tsc --noEmit`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- `git diff --check`
- 認証済み本番でゴールツリー、タスク、ガントを確認。
- デスクトップと390px相当のスマホ幅で横overflowなし。

## 未解決

- 旧水素系の未承認候補15件は判断待ち。今回の要望外なので削除していない。
- 実装上の残作業はなし。

## 次の最初の行動

新しいMTG記録を確認し、未解決の問いはゴールツリー、実行内容はタスクへ登録する。同じレコードがガントにも出ることを確認する。未承認候補15件を整理する場合は、各行を承認または却下し、一括削除しない。

## 正本

- 画面利用: `pwa/manual/2-3-pj-cockpit.md`
- ワークスペース仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- ゴールツリー仕様: `pwa/spec/3-21-question-tree-current-spec.md`
- コックピット仕様: `pwa/spec/3-8-cockpit-current-spec.md`
- 全画面索引: `ios/DESIGN.md`
- 開発履歴: `pwa/design_log/sessions_2026-09.md`
- ZMP運用判断: `/Users/masa/projects/AMD/ZMP/ZMP_WORKSPACE_OPERATING_DECISIONS.md`

