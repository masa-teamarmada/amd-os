# AION2認証通知の確認ボタン

`C:/projects/aion2` のローカル監視から送るSlack DMの確認結果を、AMD OSが中継する。ゲームの認証入力や画面操作は行わない。

## 契約

- ローカル監視はディーヴァ認証を2回連続で見つけた時、検知した `AION2.exe` のPID、実行ファイルパス、起動時刻を保持する。
- `POST /api/aion2/alerts` の `create` で UUID の確認記録を作り、えいみBOTのDMに `aion2_confirm` ボタン（valueはUUID）を送る。Slack送信成功後、`activate` がサーバ時刻から30秒の期限を設定する。
- `POST /api/slack/interactive` はSlack署名を検証する。`aion2_confirm` はまさ本人 `U04PJK178JV` のえいみBOT DM `D0AMLE6S4KA` だけ受け付け、期限内かつ `pending` の行を `acknowledged` にする。既存のSlackボタン処理には影響しない。
- ローカル監視は `GET /api/aion2/alerts?id=...` で約1秒ごとに状態を確認する。30秒の期限後、Slackからの押下が届くための猶予を3秒取る。`expire` が原子的に `pending` から `expired` へ変えた場合に限り、保持したプロセスと現在のPID、パス、起動時刻が一致した時だけ強制終了する。押下時刻はSlackの署名済み `action_ts` を使う。
- 通知失敗、確認記録の作成・開始失敗、状態照会不能、監視停止、監視プログラム終了では強制終了しない。Slack送信後に確認の開始に失敗した場合はDMで自動終了が動かないことを追報する。
- `public.aion2_verification_alerts` はservice role専用。RLSを有効にし、anonとauthenticatedの表権限を除く。ローカルからのAPIアクセスは既存の `CRON_SECRET` をBearerで検証する。秘密値はSlackボタンやブラウザへ出さない。
- `POST /api/aion2/alerts` は `create` / `activate` / `expire` / `cancel` を受け付ける。`GET` と `POST` は無キャッシュ。期限が過ぎたボタンや二重押しは終了判定を巻き戻さない。

強制終了でゲーム側の認証失敗判定を回避できる保証はない。Apple WatchではSlack通知の受信を確認済みで、ボタン操作はiPhoneのSlack DMで行う。
