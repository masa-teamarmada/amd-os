# Auth ログインメール

2026-10-08: magic_link と confirmation を日本語の同じログインボタンへ統一する。本文正本は `workspace-login.html`、件名は隣の `../config.toml`。初回のメール確認も同じボタンで既存の認証処理へ進む。

件名 `AMD OS ログインリンク（{{ .Token }}）` は配信ごとのコードで変わる。Gmailが同じ件名をまとめて同一本文を引用扱いにすることを避ける。番号の入力は不要。HTMLは約3 KiB、画像・外部CSS・スクリプト・非表示本文・引用タグを使わず、56pxの日本語CTAを上部へ表示する。リンクは `{{ .ConfirmationURL }}` のままなので、既存PKCEのattempt・callback・nextと認可を維持する。

[公式テンプレート仕様](https://supabase.com/docs/guides/auth/auth-email-templates)の`.Token`は配信ごとのOTP（桁数はAuth設定に従う）、`.ConfirmationURL`はAuthが生成する確認URL。GoTrueの[テンプレート処理](https://github.com/supabase/auth/blob/master/internal/mailer/templatemailer/template.go)は件名にも同じテンプレート変数を展開する。件名の番号も認証情報なので、届いたメールの件名をそのまま監査・ログ・資料へ転記しない。

## 本番反映と確認

リポジトリルートから、Python 3.12で実行する。Supabase管理資格情報は環境変数または既存の`pwa/.env.local`からメモリ上に読む。秘密値・メールリンクは出力しない。

```sh
python3.12 scripts/amie_auth_email_templates.py --apply
python3.12 scripts/amie_auth_email_templates.py
```

対象は共通Supabase `nbnhrhybjslbawdukvvk`の`mailer_subjects_magic_link`、`mailer_subjects_confirmation`、`mailer_templates_magic_link_content`、`mailer_templates_confirmation_content`の4項目のみ。反映後の読戻しで内容一致・他Auth設定の不変を検査する。`--apply`なしは読取りのみ。既に一致すれば再PATCHしない。SMTP・送信hook・URL allow list・セッション・DB・権限は変更しない。この操作や検査ではメールを送信しない。

2026-10-08 18:57 JSTに本番4項目の一致・他Auth設定不変を確認。外部Chromeの1636/390/320pxでボタンの初期表示、56px操作、横溢れなしを確認。本人の新規受信で、Gmailのボタン初期表示と日本語の配信件名を確認済み。設定読戻しやChromeの表示見本だけでGmailの実表示を検証済みと扱わない。
