AMD OSの支払通知書・月別予定の終了状態から再開する。作業場所は /Users/masa/projects/AMD/amd-os 。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_PAYOUT_MONTHLY_PLAN_20261128.md
5. pwa/spec/3-27-payout-notice-current-spec.md → pwa/manual/6-5-admin-payouts-reward-notice-spec.md → pwa/BUGS.md

状態: まさの「閉じておこう」により終了。11/26の月別表の前月表示・実績月集計はe12a5e8e0で反映済み。11/28の終了確認では、後続修正24c568363 / v3.165.33がmain・origin/main・本番で一致した。初期支払月は日本時間の当月。選択した支払月の前月から月別表を表示する。後続の確定額イベントと振込済み控除も保持する。11/26に報告した金額・監査結果は当日の記録であり、現在の金額として転用しない。

作業場所: このチャットの旧パス /Users/masa/.codex/worktrees/f8bd/amd-os は、本体へのシンボリックリンクで復旧済み。独立したGit作業ツリーではない。新しい作業では正規の本体パスを直接使う。旧パスの配下を再帰削除しない。

検証: 終了時に月選択、シーズン集計、確定額上書きの検査が成功。全体構築・ブラウザ・DB更新は終了確認では再実行していない。11/26の実データ監査とPC Chrome確認の所在は専用HANDOFFを参照する。

次の行動: 新しい依頼がある場合だけ再開し、git fetch origin main後に同期・差分と本番を読戻す。数値を調べる場合は対象の支払月・稼働月を分け、通知書・保存支払・member_payout_amount_confirmation_events・実入出金日を照合する。監査スクリプトも後続の確定額イベントを読んでいるか先に確認する。今回の終了依頼から再計算、通知書発行、送付、振込を自動再開しない。

運用: main一本で新しい枝や作業ツリーを作らず、別作業の差分を保持する。既存未追跡のS01_富士山_日本語.mdは別件の記事原稿で、編集・削除・一括保存の対象外。次にその原稿を扱う担当が原稿の正本と保存先を照合する。製品を変更する場合だけmanual/spec/附則を同期し、正規deploy.shで反映・本番確認する。PC Chromeを使い、メールは送信しない。
