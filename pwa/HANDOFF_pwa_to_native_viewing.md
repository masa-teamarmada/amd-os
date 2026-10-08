# 閲覧中・閲覧履歴: 他プラットフォームへの引き継ぎ

2026-10-08。PWAの共通閲覧ツールバーに追加。iOS/macOS/Androidの部品・送信は未実装。共通画面仕様は ios/DESIGN.md、認可と保存仕様は spec/2-1-pwa-runtime-routes.md、使い方は manual/2-1-member-quick-start.md を参照。

- Supabase migration `20261008120000` は本番適用・履歴登録済み。再適用しない。2テーブルは service_role のみアクセス可能。ネイティブから直接読書きしない。
- PWAは既存の認証Cookieを再検証する `/api/page-viewing` を使用。ネイティブへ移植する際は既存のネイティブ認証を受ける認可済みAPIを別途設計する。秘密値・service_roleをアプリに置かない。
- 同じ画面のキーは URL pathname と許可済みの画面内ページ名。ナビの切り替えを反映し、クエリ・ハッシュ・入力内容は保存しない。
- 10秒更新、30秒で通信断が消える。非表示・画面退出で離脱。UUIDと連番で古い通信を棄却。同じユーザーの複数タブは1人として表示。
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
