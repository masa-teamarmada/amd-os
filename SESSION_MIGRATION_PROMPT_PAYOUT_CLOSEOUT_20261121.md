AMD OSの支払通知書・きよ報酬見通しを確認・再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` を作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF_PAYOUT_CLOSEOUT_20261121.md`
5. 表示・閲覧の確認なら `HANDOFF_KIYO_REWARD_OUTLOOK_20261120.md`、`pwa/design/FEATURE_REGISTRY.md` の `/admin/kiyo`、`pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
6. 通知書の発行・送付なら `HANDOFF_PAYOUT_20261110.md`、`pwa/spec/3-27-payout-notice-current-spec.md`、`pwa/spec/5-5-cross-platform-gas-ios-current-spec.md`、`pwa/BUGS.md`

状態:

- まさの「全PJのシーズン収支予定を月横断で見たい」「01ではPJ合算でなくメンバー別に表示したい」という画面改善は、すでにmainへ反映済み。`きよ → 04 報酬見通し` は管理者限定の閲覧で、既存の月初合意データを再利用する。計算式・報酬合意・支払・通知書への書込みは変えない。
- 通知書の送付・振込はこの画面から行わない。送付・振込の現状は未確認なので、発行や送付を頼まれたら、DBと実メールを読み取りで照合してから、認証・二重送信防止を確認する。えいみはメール送信をしない。
- この終了記録は `90bae3d18` でmainへ保存済み。共有mainには並行作業の終了記録が続くため、再開時はまず `git fetch origin main` と `git status --short` で状態を読戻す。`S01_富士山_日本語.md` は別セッションの未追跡原稿なので触らない。

運用:

- main一本。別作業の変更は保持し、今回の対象だけを保存する。製品仕様を変える場合は、design/spec/manualの正本、附則、Native境界を同じ作業単位で同期する。
- PWA表示はPCのChromeで確認する。コード変更時は対象検査の後、正規の `pwa/scripts/deploy.sh` を通じてmainへ反映し、本番版を照合する。支払・通知書・メール・外部送信は、明示された依頼範囲だけで実行する。
