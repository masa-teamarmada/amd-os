# 閲覧中・閲覧履歴: 他プラットフォームへの引き継ぎ

## 2026-10-08 — 外部メールのコード入力（v3.162.7）

PWAの共通ログインへ数値コードを追加。POST /auth/callbackでverifyOtp後、既存account/所属/DD検査と30日外部cookieを再利用する。申込ブラウザのPKCE cookieは不要。共通Authメール本文にTokenを表示するが、ConfirmationURLは維持。Swift/Androidのログイン画面は未変更で、外部資料はブラウザで開く前提。先生本人の新規メール受信・コード入力は未確認。 2026-10-08、本番v3.162.7 / a66b48c774c1c0c451a66cdde0ac412b5812944eを通常deploy.shで反映、公開build-info一致を確認。共通Authテンプレート4項目を読戻して一致、他Auth設定不変。実Authのasahinaコード検証は本番でもSOL workspace/DD一覧・SolvioraX DD本文200・使用済みコード拒否・外部署名cookieのみを確認（メール送信なし、先生本人の実績と区別）。Chrome本番のコード入力欄を確認し、390pxの画面証跡は/tmp/amie-workspace-code-production-20261008.png。先生本人の新規メール受信とログイン成功は未確認。

2026-10-08（v3.162.5）: PWAのDDページ入口は、内部memberも有効な外部sessionも無ければ元DD URLを保って共通ログインへ戻す。認証済みでも個別DD付与が必須。API/添付/印刷の認可・応答、ネイティブUI/認証方式は維持。spec/5-17・2-1、manual/2-1。

## 2026-10-08 — 共通Authのログインメール

共通Supabaseの初回/通常メールを日本語ログインボタンと配信ごとの件名へ変更。本番4項目のみ反映・読戻し済み。正本はios/supabase/templates/workspace-login.htmlとconfig.toml、詳細spec/2-1。既存ConfirmationURL/PKCE/認可を維持。Swift/Kotlin/macOS UIの変更・移植は不要。PWAのasahina実ログインとSOL/DD一覧を確認済み。実Gmailのボタン初期表示を本人確認済み。

## 2026-10-08 — 外部メール入口

PWAの公開入口とメール認証cookie分離を修正。ネイティブUIは未変更。許可済みPJ/workspace/DDの独立認可は既存を維持。

2026-10-08。PWAの共通閲覧ツールバーに追加。iOS/macOS/Androidの部品・送信は未実装。共通画面仕様は ios/DESIGN.md、認可と保存仕様は spec/2-1-pwa-runtime-routes.md、使い方は manual/2-1-member-quick-start.md を参照。

- Supabase migration `20261008120000` は本番適用・履歴登録済み。再適用しない。2テーブルは service_role のみアクセス可能。ネイティブから直接読書きしない。
- PWAは既存の認証Cookieを再検証する `/api/page-viewing` を使用。ネイティブへ移植する際は既存のネイティブ認証を受ける認可済みAPIを別途設計する。秘密値・service_roleをアプリに置かない。
- 同じ画面のキーは URL pathname と許可済みの画面内ページ名。ナビの切り替えを反映し、クエリ・ハッシュ・入力内容は保存しない。
- 10秒更新、30秒で通信断が消える。非表示・画面退出で離脱。UUIDと連番で古い通信を棄却。同じユーザーの複数タブは1人として表示。
- 履歴は表示したページへの訪問ごとに1件。繰り返し更新では増えない。最新50件、時刻は日本時間。外部ユーザーの履歴は本人だけ。個人画面も本人の名前空間を使用。
- 外部アカウントの招待中・停止・権限失効は既存resolverで拒否。現行外部アカウントは未有効なので外部ユーザー実ログインの正常系は未検証。

ネイティブ対応は今回の実装範囲外。未移植項目を PARITY.md から消さない。


## 2026-10-08 シーズ×ニーズ追加

PWA `/seed-needs` の新規一覧。spec5-19/manual2-5。DB migration495/496は適用済みで再適用不要。新3表のRLSはportfolio member限定。既存seedsはID参照のみ。記入例と実際の蓄積を分け、未接続も保持。iOS/macOS/Android専用画面は未移植。
