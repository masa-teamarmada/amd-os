# 引っ越しプロンプト — PJ別週次 Slack レポートのPWA統合

AMD OSのPJ別週次Slackレポートを確認・再開・修正する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションのcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF_WEEKLY_SLACK_PWA_20261110.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-1-operations-settings-spec.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-3-automation-responsibility-current-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/design/AUTOMATIONS.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- すべてのPJを `settings.weekly_slack_report.{project_id}.enabled` で管理する。固定PJ一覧は使わず、新規PJを含め設定なしは停止。
- 管理画面は `/admin/projects` のPJ台帳。週次レポート列は他列と同じ見出し右端のドラッグで幅調整し、幅はブラウザに保存する。独自のスライダーや±ボタンを復活させない。
- PWA `GET/POST /api/automation/weekly-slack-report` が正規入口。GETは本文生成前に許可PJと根拠だけを返し、POSTは投稿直前に設定と宛先を再読込してSlackへ送る。停止PJは生成も投稿もしない。宛先チャンネルIDを生成処理・ログ・引き継ぎへ出さない。
- 旧GASの週次送信とGemini直接呼び出しは廃止済み。ただし共有GASプロジェクトには別用途処理があるので、一括削除しない。
- Codex automation `16-00-pj-pwa-slack` は現在 `PAUSED`。本セッションでは再開していない。再開時はまずPWA GETで対象PJを確認し、実送信はPWA POSTだけを使う。
- 過去の本番確認は `b24545fb` / `v3.143.6` 時点。現行版は必ず `/api/build-info` とPC Chromeで読み直す。スマホWeb確認はしない。

次の作業:

1. `git fetch origin main` の後、`git status -sb --untracked-files=all` と `HEAD...origin/main` を確認する。他作業のdirtyを混ぜない。
2. 定期送信を再開する必要があるかを確認する。必要なら、許可対象・根拠不足による見送り・停止設定による見送り・失敗だけを確認し、Slack本文やチャンネルIDを出さない。
3. 実装を変える場合は、PWAの回帰検査、PC Chromeでの管理台帳表示、正規のmain pushと本番readbackを行う。仕様・操作説明・機能台帳・自動化一覧・開発履歴も同じ変更で更新する。
