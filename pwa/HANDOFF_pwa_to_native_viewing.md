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

PWA先行。UIは`src/components/workflows/WorkflowWorkspace.tsx`、APIは`/api/workflows`、`/api/workflows/[requestId]`。service-only RPCとRLSは全プラットフォーム共通、migration20261008183000/20261008183500適用済み・再適用不要。きよID002のみ承認、本人の自己承認不可。ネイティブは専用画面未移植。移植時は既存認可済みAPI経路を利用し、service keyをクライアントへ置かない。仕様詳細spec5-6。メール監視はGAS→PWAの5分trigger、各クライアントには監視実行の責任なし。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 押印申請・きよ承認・文書固定・失効・履歴 | spec5-6、ios/DESIGN、FEATURE_REGISTRY | manual6-7 | 同期済み |
| 監視・2人への個別Slack・配信状態 | spec5-6、spec2-1、L2_DATA、operations-catalog | manual6-7 | 同期済み |
| 変更履歴 | spec6-1 | manual9-3 | 同期済み |
| DB | workflow_*6表、上記適用済みmigration、db_schema | manual6-7 | 同期済み |
| 理論・BZM・model | 変更なし | 対象外 | 同期不要 |
| iOS/macOS/Android画面 | ios/DESIGN、native handoff | 対象外 | 専用画面未移植 |
