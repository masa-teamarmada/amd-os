# HANDOFF: AMD Atlas — Phase 3完了 → Phase 4（Swift実装）

**最終更新**: 2026-04-23  
**セッション概要**: Phase 2（Inbox/えいみ投入）+ Phase 3（レポート生成・Gemini API・Vercelデプロイ）完了  
**次セッションの最初のアクション**: iOS Swift版にAtlas機能を実装する

---

## 完了済みフェーズ

### Phase 0 ✅ — md試作
- watchlist.md（A〜O 15ドメイン）、sources.md、レポートテンプレート

### Phase 1 ✅ — PWA基盤
- Supabase migration: `atlas_nodes`, `atlas_edges`, `atlas_observations`, `atlas_decisions`
- `/atlas` ページ（トピック一覧 + モーダル詳細、observations表示）
- `/atlas/decisions` ページ
- GlobalNav に Atlas タブ + Inbox バッジ

### Phase 2 ✅ — Signal Inbox
- Supabase migration: `atlas_signals`（inbox/accepted/held/rejected）
- `/atlas/inbox` — Accept/Hold/Reject UI、AcceptModal でトピック紐付け
- `/atlas/inbox/submit` — えいみ投入フォーム（全方位アンテナ原則・source_url必須）
- GlobalNav: 15秒ポーリングで未読バッジ（amber）表示
- サンプルシグナル3件投入済み（ガリウム規制・IEA洋上風力・Kiutra磁気冷凍機）

### Phase 3 ✅ — レポート生成
- Supabase migration: `atlas_reports`（daily/weekly/monthly/instant）
- `src/lib/atlas-report.ts` — Gemini 1.5 Flash で「マクロ気流」セクション生成
- Vercel Cron:
  - `/api/cron/atlas-daily` — 21:00 UTC（JST 06:00）
  - `/api/cron/atlas-weekly` — 金曜 08:00 UTC（JST 17:00）
  - `/api/cron/atlas-monthly` — 毎月1日 22:00 UTC（JST 07:00）
- `/atlas/reports` — レポート一覧ページ（アコーディオン形式で展開）
- Gemini APIキー: `amd-os-atlas`（gas-external-research プロジェクト）
- Vercel 環境変数 `GEMINI_API_KEY` 追加済み

---

## 現在の本番状態

**Vercel**: https://amd-os-pwa.vercel.app  
**Supabase**: nbnhrhybjslbawdukvvk（amd-os-v2）

### Supabase テーブル一覧（Atlas関連）
| テーブル | 用途 |
|---|---|
| `atlas_nodes` | トピック・グラフノード |
| `atlas_edges` | ノード間リレーション |
| `atlas_observations` | 観測記録（append-only）|
| `atlas_decisions` | 判断ログ |
| `atlas_signals` | えいみ投入キュー（Inbox）|
| `atlas_reports` | 生成済みレポート |

---

## Phase 4: Swift実装（次セッション）

### やること
iOSネイティブアプリで以下を実装する：

1. **Atlas タブ** — トピック一覧（PWAと同等）
2. **レポート閲覧** — `/atlas/reports` 相当のUI
3. **Push通知** — APNs経由でHIGHシグナルを即時配信
4. **Inbox（読み取り専用）** — シグナル確認、Accept/Hold/Reject

### 参照ファイル
- PWA実装: `/Users/masa/projects/amd-os/pwa/src/app/(app)/atlas/`
- データ型: `/Users/masa/projects/amd-os/pwa/src/lib/supabase-data.ts`（AtlasNode, AtlasSignal, AtlasReport）
- レポート生成: `/Users/masa/projects/amd-os/pwa/src/lib/atlas-report.ts`
- iOS プロジェクト: `C:/Users/masa/amd-os-ios/`（要確認）

### レポートフォーマット（確定済み）
- PJ名・企業名は入れない（読者が自分で文脈を当てる）
- 事実とトレンドの方向性のみ
- 週次に「マクロ気流」セクション（Gemini生成、3〜5文）
- iOS Push通知のタイトル形式: `🚨 Atlas HIGH` / 本文: シグナルタイトル

---

## 既知の状態・注意点

- `atlas_reports` テーブルは作成済みだが、cronが走るまでデータなし
  → 手動テストするには `/api/cron/atlas-daily` を直接GETするか、Supabase SQLでINSERT
- Gemini APIキーは `gas-external-research` プロジェクトに紐付き（Tier 1 後払い）
- `@google/generative-ai` v0.24.1 インストール済み
- Supabaseダッシュボードが描画されない問題 → Management API（fetch from browser localStorage token）で回避できた
- PWA側のCRON_SECRETが未設定（開発環境では `NODE_ENV !== production` でスキップ）
  → Vercel Cron は自動でAuthorizationヘッダーを付けるのでdeploy後は問題なし

---

## このセッションで得た知見

- **Anthropicキーは定額超過で従量課金**になっている → レポート生成はGemini（未使用定額あり）を使う
- **Gemini APIキーはブラウザ操作で取得可能**（Google AI Studio の `aistudio.google.com/apikey`）
- **Supabase Management API**: `fetch('https://api.supabase.com/v1/projects/{ref}/database/query', ...)` + localStorage のダッシュボード認証トークンで DDL実行可能
- **Supabaseダッシュボードのbody.innerText が空になる問題**: React の遅延レンダリング。`window.monaco` も見えない。Management API で代替。
- **レポートのトーン確定**: PJ名を入れない・推奨アクションなし・事実とトレンドのみ・FT/Economistスタイル
