# 閲覧中・閲覧履歴: 他プラットフォームへの引き継ぎ

## 2026-10-09 — ログインメールをコード入力に統一（v3.162.9）

まさがSafariで申込→メールのリンクでChrome起動→認証失敗を再現。共通Authの初回/通常メールから認証リンクとログインボタンを削除し、数字コードとログイン画面へ戻る案内に統一。PWAの申込前・送信後・旧リンク失敗時の説明もコード入力へ統一。既存verifyOtp・社内Google・認可・DB・理論は変更なし。配信操作と先生本人のログイン成功は本人による実確認が必要。 2026-10-09: 共通Authの件名・本文4項目の一致と他Auth設定不変を本番読戻しで確認（メール送信なし）。外部Chromeの1636px/320pxでコード本文とPWA入力を確認、横溢れなし、入力・主操作48px・再申込44px。実callbackの通信代替検査と型/変更箇所の静的検査を通過。先生本人の受信・ログイン成功は未確認。


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
- 1分更新、3分で通信断が消える。非表示・画面退出で離脱。UUIDと連番で古い通信を棄却。同じユーザーの複数タブは1人として表示。
- 履歴は表示したページへの訪問ごとに1件。繰り返し更新では増えない。最新50件、時刻は日本時間。外部ユーザーの履歴は本人だけ。個人画面も本人の名前空間を使用。
- 外部アカウントの招待中・停止・権限失効は既存resolverで拒否。現行外部アカウントは未有効なので外部ユーザー実ログインの正常系は未検証。

ネイティブ対応は今回の実装範囲外。未移植項目を PARITY.md から消さない。


## 2026-10-08 業務フロー・押印承認

PWA先行。UIは`src/components/workflows/WorkflowWorkspace.tsx`、APIは`/api/workflows`、`/api/workflows/[requestId]`。service-only RPCとRLSは全プラットフォーム共通、migration20261008183000/20261008183500/20261008184000適用済み・再適用不要。きよID002のみ承認、本人の自己承認不可。ネイティブは専用画面未移植。移植時は既存認可済みAPI経路を利用し、service keyをクライアントへ置かない。仕様詳細spec5-6。メール監視はGAS→PWAの5分trigger、各クライアントには監視実行の責任なし。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 押印申請・きよ承認・文書固定・失効・履歴 | spec5-6、ios/DESIGN、FEATURE_REGISTRY | manual6-7 | 同期済み |
| 監視・2人への個別Slack・配信状態 | spec5-6、spec2-1、L2_DATA、operations-catalog | manual6-7 | 同期済み |
| 変更履歴 | spec6-1 | manual9-3 | 同期済み |
| DB | workflow_*6表、上記適用済みmigration、db_schema | manual6-7 | 同期済み |
| 理論・BZM・model | 変更なし | 対象外 | 同期不要 |
| iOS/macOS/Android画面 | ios/DESIGN、native handoff | 対象外 | 専用画面未移植 |


### 押印業務フローの反映途中・2026-10-08 17:30 JST

担当: このCodexチャット。開発作業、恒久仕様はspec5-6/manual6-7、design_logは変更なし。

- mainに押印承認、メール検知/outbox、画面をコミット。型検査、契約メール/操作権限、admin-kiyo、critical-ui、production buildを通過。DB rollback試験は他社当事者台帳の非干渉も確認済み。
- migration20261008183000/183500/184000はSupabase Management API201で適用済み。再適用しない。db_schemaは再生成済み。
- GAS push成功、既存production deploymentをversion1506へ更新済み。Google CLI認証期限切れは再認証で復旧。
- PWA deploy scriptはgit fetchでGitHubへの接続失敗（port443 timeout）によりpush前停止。本番PWA未反映。GAS/PWA経由のメール接続・5分trigger作成・Slack実配信・Chromeの新画面表示は未確認。監視を稼働済みとは扱わない。
- GASの公開runFuncは非JSONのGoogle404応答だったため、接続復旧後に再確認が必要。GAS部署のversion作成成功と公開実行成功を混同しない。

最初の一手はGitHub/OS通信の復旧後、`git fetch origin main` とbranch/dirty/ahead/behindの再確認。ほかのmain更新があれば安全に統合してBUILD_VERSION v3.162.0を下げない。その後 `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で一括push・Readyまで確認する。

次にBearer付き `/api/cron/contract-mail-watch` を実行してGoogleアカウントがID001まさと一致すること、初回history基準の保存をreadback。GAS `amie_contractWorkflowWatchStatus` → `amie_setupContractWorkflowWatch`（重複なく1本）→ `amie_contractWorkflowWatch`、5分後のlast_successを確認。Slackの固定えいみ送信経路・2人の配信結果を確認し、実Chromeで `/admin/workflows` ときよの押印承認タブ、申請フォーム・狭幅を確認してから完了。テスト契約やメールを本番で捏造しない。未pushのためこのチャットはアーカイブ不可。

## 2026-10-08 シーズ×ニーズ追加

PWA `/seed-needs` の新規一覧。spec5-19/manual2-5。DB migration495/496は適用済みで再適用不要。新3表のRLSはportfolio member限定。既存seedsはID参照のみ。記入例と実際の蓄積を分け、未接続も保持。iOS/macOS/Android専用画面は未移植。

## 2026-10-09 — 更新間隔の調整

PWAの定期更新は1分、通信断の失効期限は3分へ変更。初回表示・表示復帰・画面内ページ切替・閲覧情報パネルを開く操作は即時更新、非表示・退出は即時離脱を維持。共通定数はpage-viewing-core.tsでクライアントとサーバの双方が参照。DB migration追加・再適用なし。ネイティブ側の未移植範囲は従来どおり。

## 2026-10-10 押印承認の本番運用開始

PWAの業務フロー、きよの押印承認タブ、契約メール監視を本番へ反映。共通DBの自己承認禁止・版変更失効・通知outboxは適用済み。migration20261010104759も適用済み、4件とも履歴登録済みで再適用不要。GAS5分triggerは1本、まさのGoogleアカウント一致と初回基準・手動実行成功を確認。主要操作は44pxへ統一。iOS/macOS/Androidの専用画面は未移植。権限と押印状態の更新は既存の認可済みAPIへ委譲し、service_roleを端末へ置かない。

2026-10-10: 契約フローの入口を相手先/種類/目的の登録から始める。共通DBのpreparing・submitted_atとservice-only workflow_start/register_pdf追加済み（migration20261010114611、再適用不要）。PWAの6ステップ/次担当/同画面PDF登録はネイティブ未移植。workflow_submitは既存署名でpreparing→submittedを同じIDへ更新。通知/承認境界は共通。詳細spec5-6。

2026-10-11 00:20 JST: 契約フローにWord/PDF下書き、ファイル選択・ドラッグ＆ドロップ、25MB制限、版履歴、失敗時再試行を追加。承認用最終版と締結版はPDF、下書き登録では通知なし。6段階を横/縦の矢印で接続。非公開一時Storageと管理部門の契約Drive保存、service-only登録RPCを追加。migration20261010145238適用済み・再適用不要。正本spec5-6、使い方manual6-7。理論/model変更なし。
iOS/macOS/Androidのファイル登録と矢印UIは未移植。共通DB/認可済みAPIを利用し、端末へservice keyを置かない。
