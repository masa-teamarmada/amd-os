# 次セッションへの引き継ぎ — 事業計画・試算表・資本政策表のタブ整理

あなたは株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは `/Users/masa/projects/AMD/amd-os` にし、`pwa/`をcwdにしない。正規checkoutには別作業のdirtyと未push commitがあるため、所有者と意図を確認せず変更、reset、stash、rebase、削除、`git add .`をしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-09.md`

## 状態スナップショット

- コックピットはAMDメンバー限定、共有ワークスペースは当該PJメンバー限定（AMD外を含む）。この権限境界・入口・導線を変更してはいない。
- 機能commitは `584e1f59b02c2968c89535ac14df5d0abd3924ad`。コックピットと共有ワークスペースの事業計画グループに、`事業計画`、`試算表`、`資本政策表`の独立タブがある。
- `試算表`は事業計画の月次・年次試算。`資本政策表`は将来計画に応じて更新する資本政策。会社情報側は過去ラウンドの事実を記録する`資金調達履歴`であり、用途を混ぜない。
- この機能はproduction `v3.143.2`で外部Chromeを使ってreadback済み。以後のmain更新で表示版が進んでいる可能性があるため、変更時は `/api/build-info` と認証済み画面を再確認する。
- 正規checkoutには別作業由来のdirty 29 pathと未push 3 commitがある。安全に同期できない場合は最新`origin/main`からclean cloneを作り、対象差分だけを扱う。

## 次のタスク

今回の依頼範囲に未解決はない。まさの次の依頼から開始する。

## 確立済みの運用ルール

- タブ整理では、最初に計画として更新する情報か、会社の過去事実か、共有PJメンバーへ出すべき情報かを区別する。権限モデルを変えて解決しない。
- 共有面から除外する内部情報は、表示だけでなくコンポーネントをマウントせず取得もしない。今回のタブは共有対象として確定済み。
- PWA変更はmainへまとめてpushし、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`で反映する。直接のVercel CLI deployは禁止。
- 完了判定はpushではなく、`/api/build-info`のSHA/version/`dirty:false`と、認証済み外部Chromeの実画面readback。
- 画面・操作・仕様を変更したらmanual/spec/changelog、必要な`ios/DESIGN.md`、設計ログ、BUGSを同じ変更で同期する。
- 正規checkoutの別作業を戻さない。一時cloneと検証serverはcloseoutで片付ける。

## 完了条件

- コード、仕様、操作マニュアル、変更履歴、必要なBUGSが一致する。
- 対象テスト、型検査、build、critical UI検査、desktopと390px幅の実画面確認が成功する。
- mainへpush済みで、本番SHA/versionと認証済み外部Chromeの画面を読み戻す。
