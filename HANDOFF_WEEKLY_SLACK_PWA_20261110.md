# HANDOFF — PJ別週次 Slack レポートのPWA統合

- 更新: 2026-11-10 JST
- 作業種別: development
- 状態: 実装・本番反映済み。定期実行は現在 `PAUSED` のため、再開前の運用確認が残る。

## 現在地

- 正本は `pwa/spec/5-3-automation-responsibility-current-spec.md`、操作説明は `pwa/manual/6-1-operations-settings-spec.md`、業務導線は `pwa/design/FEATURE_REGISTRY.md`、運用一覧は `pwa/design/AUTOMATIONS.md`。
- 全PJの設定は `settings.weekly_slack_report.{project_id}.enabled`。設定がないPJは停止で、PJ名・ID・チャンネルの固定リストは使わない。
- PWAの `GET/POST /api/automation/weekly-slack-report` が許可判定とSlack投稿を担う。GETで許可PJだけを返し、POSTは投稿直前にも設定・宛先を再読込する。停止されたPJの本文は作らず、投稿もしない。
- 週次レポート列はPJ台帳の他列と同じく見出し右端のドラッグで幅を調整し、同じブラウザへ保存する。独自スライダー・±ボタンは使わない。
- 旧GASの週次送信・Gemini直接呼び出しはこの経路から廃止済み。共有GASプロジェクトの別用途処理まで削除してはいけない。
- Codex automation `16-00-pj-pwa-slack` は2026-11-10にローカル設定を読戻し、`PAUSED` を確認した。再開操作はこのcloseoutでは行っていない。
- 2026-09-25にCLMの内部向け週次レポートを、コラボメーカー側の参加者も閲覧する共有チャンネルへ投稿した。まさが投稿を削除し、2026-09-26にCLMの配信許可をOFFへ変更した。
- 2026-11-10の本番再確認でも、CLM（p34）はPWA入口の対象一覧に含まれず、個別判定は `allowed:false / weekly_report_disabled`。週次レポートはチームアルマダ内部のSlackチャンネルだけへ送る。

## 検証済みの履歴

- 実装の基点は `b24545fb`。PWA build、週次設定回帰、critical UI回帰、許可PJのdry run、停止PJの投稿拒否、PC Chromeでの列ドラッグと再読込後の幅保持を当時確認した。
- 本番確認時点は `v3.143.6`。現行ソースの版はその後進んでいるため、再開時は過去の版番号を現在の本番状態として扱わない。

## 未解決 / 最初の次アクション

1. 送信を再開する必要があるかを確認する。必要なら automation `16-00-pj-pwa-slack` を有効化する前に、PWAのGETで対象PJが期待どおりか、管理画面で各PJの許可設定が正しいか、各Slackチャンネルの参加者がチームアルマダ内部だけかを確認する。
2. 実送信を再開したら、初回は送信件数・PWAの停止設定見送り件数・失敗だけを確認する。チャンネルIDや本文をログへ出さない。
3. UIや送信経路を変える場合は、`manual/6-1`、`spec/5-3`、`FEATURE_REGISTRY`、`AUTOMATIONS`、`sessions_YYYY-MM` を同じ変更で同期する。

外部共有状態や参加者所属の自動判定は未実装。現行の防止手段はadminによる参加者確認とPJ別許可OFFで、社外参加者がいる共有チャンネルは許可しない。

## リポジトリ状態

- 今回のcloseoutでコード・DB・環境変数は変更していない。利用手順、実装仕様、事故記録、引き継ぎだけを更新した。
- closeout完了時点の本体チェックアウトは `main`、未コミット差分なし、`origin/main` と同期済み。

参照: `pwa/design_log/sessions_2026-09.md` の「2026-09-17 PJ別週次 Slack レポートの設定と実投稿の分離」。
