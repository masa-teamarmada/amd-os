# 次セッションへの引き継ぎ — ZMPワークスペース運用

あなたは、株式会社チームアルマダのZMPプロジェクトとAMD OSを引き継ぐ「えいみ」。ZMPの運用判断を確認するときは`/Users/masa/projects/AMD/ZMP`、AMD OSを変更するときのcwdは`/Users/masa/projects/AMD/amd-os`にする。`pwa/`をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/ZMP/HANDOFF.md`
4. `/Users/masa/projects/AMD/ZMP/ZMP_WORKSPACE_OPERATING_DECISIONS.md`
5. `/Users/masa/projects/AMD/amd-os/HANDOFF_ZMP_WORKSPACE_2026-09-16.md`
6. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-21-question-tree-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

## 状態スナップショット

- ZMPワークスペース本番: `https://amd-os-pwa.vercel.app/project/p19/workspace`
- closeout時の配信版: `v3.140.9` / `f2ec7bf8a5ac4669696cefb16c81479fa656b7da`。ZMPの実装commit `5c06cd743380f20e61b4c21ad4195da6c644a666`を祖先に含む。
- 画面の実行分類: `ゴールツリー / タスク / ガント / 週次差分 / 関係先`。旧「テーマ」タブは廃止済み。
- スタッフ研修・リハーサルはゴールツリーから除外済み。タスク一覧では`ツリー外`、ガントでは日程付き作業として確認できる。
- KR経営改革は活動中のゴールではない。追加費用と対象業務が合意された場合だけ再検討し、合意がない限り着手しない回答済み判断として記録済み。関連する活動中TODO 6件は`dropped`。
- 本番DB migration 2件を適用済み。質問、action、関連、migration historyを読み戻し済み。
- 旧水素系の未承認候補15件は判断待ちとして残っている。根拠なく一括削除しない。
- ZMPディレクトリはgit管理外。運用判断の正本は`ZMP_WORKSPACE_OPERATING_DECISIONS.md`。
- AMD OSの正規checkoutは別セッション由来のdirtyとlocal commitを持つ。`git add .`、reset、rebase、stashを使わず、作業前に`git fetch`して現在のahead/behindと所有者を再確認する。

## 次のタスク

次回MTGの書き起こし、Slack、指定Messengerの新着から、未解決の問いと実行内容を分ける。問いはゴールツリー、実行内容はタスクへ登録し、同じレコードがガントでも確認できることを本番で読み戻す。MTG中に追加する場合も、研修・リハーサルのような単なる実行作業をゴール化しない。契約外のKR経営改革は、追加契約成立の事実が確認できるまで再開しない。

旧水素系の未承認候補15件を整理する依頼が来た場合は、各候補の根拠と現在性を確認し、承認または却下を個別に決める。未承認を一括削除したり、承認済みと見なしたりしない。

## 確立済みの運用ルール

- current truthはAMD OSのp19ワークスペース。候補、未承認、承認済み、回答済み、droppedを混同しない。
- 純粋な実行作業はタスク、達成判断に必要な未解決の問いはゴールツリー、日程はガント。三画面で同じ正本レコードを追う。
- DB変更はmigrationを残し、本番適用後にDBとログイン済み画面の両方を読み戻す。SQLファイル作成だけを完了と呼ばない。
- PWA変更はmainへcommit・pushし、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`で配信確認する。直接のVercel CLI deployは禁止。
- 画面変更はmanual/spec/changelogと`ios/DESIGN.md`を同じ変更で更新し、`test:zmp-workspace-themes`、`test:critical-ui`、型検査、build、デスクトップとスマホ幅の本番確認を行う。
- 正規checkoutの別作業dirtyを戻さない。対象ファイルだけを明示stageするか、origin/main起点の使い捨てclean cloneを使う。closeoutでは一時cloneを削除し、mainとorigin/mainの同期を確認する。
- Slack、Messenger、メールへの返信や通知は依頼がない限り行わない。今回は情報の確認とOS反映だけが対象。
