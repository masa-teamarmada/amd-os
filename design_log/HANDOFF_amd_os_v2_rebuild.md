# HANDOFF: AMD OS v2 リビルド

## 最終更新
2026-04-06 — Phase 2B: Billing モバイルWeb + Edge Functions 実装完了。Vercelデプロイ + freee secrets セット待ち。

## 完了タスク
- 現行スプシDB全51テーブルの棚卸し・テーブル分類・新PostgreSQLスキーマ設計（7ドメイン）
- アーキテクチャ決定（Supabase + Next.js + Swift iOS）・移行フェーズ計画
- **Phase 1: Supabase基盤構築（全完了）**
  - プロジェクト: `amd-os-v2`（ref: `nbnhrhybjslbawdukvvk`、東京リージョン）
  - 38テーブル + 3ビュー + RLS全38テーブル適用
  - Google OAuth有効化 + GCP redirect URI追加済み
  - Edge Functions: `health-check` + `daily-intelligence`
- **Phase 2: Next.js scaffold + Dashboard UI（完了）**
  - `/Users/masa/amd-os-v2-web/` にNext.js 16構築
  - 白基調コックピットUI（6セクション）テストデータ動作確認済み
- **Phase 2B: Billing モバイルWeb + Edge Functions（完了）**
  - RLS書き込みポリシー追加（billing_cycles UPDATE, invoices INSERT/UPDATE等）
  - settingsテーブル（freeeトークン保存用）、Storageバケット（invoices）
  - Edge Functions 2本デプロイ済み:
    - `billing-action` — 状態遷移（confirm_budget/confirm_payment/close_cycle/report_budget）
    - `freee-invoice` — 請求書CRUD（create/send/cancel/get）
  - 共有モジュール: `_shared/freee.ts`（OAuth token管理）、`_shared/supabase.ts`
  - モバイルWeb UI（`/m/` ルート）:
    - `(mobile)/layout.tsx` — ボトムタブ、認証ガード
    - `m/page.tsx` — Billing Home（月別PJカード一覧、KPI）
    - `m/[projectCode]/page.tsx` — PJ詳細（タイムライン、アクションボタン）
    - `m/invoice/page.tsx` — 請求書作成フォーム
    - `m/payment/page.tsx` — 入金確認（kyoko限定）
    - `m/profile/page.tsx` — プロフィール
  - コンポーネント: BottomTabs, PipelineCard, StatusTimeline, MonthSelector
  - データ層: billing-queries.ts, edge-functions.ts

## 未完了・継続タスク
- [ ] **Vercelデプロイ** — Vercelログイン認証待ち → デプロイ → チーム共有
- [ ] **freee認証情報セット** — GASのScriptPropertiesからFREEE_*を取得してSupabase Edge Function secretsにセット
- [ ] PC版Dashboard再設計（BillingPipeline/ActionItems撤去 → 進捗管理特化）
- [ ] L2データ構造の棚卸し・コックピット情報設計
- [ ] Apple Developer承認後: Swift iOSネイティブアプリ + APNs push通知
- [ ] Slack OAuth設定（つくよみ連携時）

## 設計決定
- **PC版 = PJ進捗管理特化 / スマホ版 = Billing特化** — UI完全分離
- **Apple Developer未承認 → モバイルWebで先行** — `/m/`ルートでブラウザ即利用
- **freee API = Edge Functions経由** — client_secretデバイス非保持、iOS/Web共有
- **入金確認 = kyoko@team-armada.jp 限定** — Edge Functionでメールチェック
- **Push通知 = Apple Developer承認後** — 暫定はSlack通知で代替

## 既知の問題
- dev serverはポート3001（3000はKAGAMI使用中）
- GCP redirect URIに `http://localhost:3001/callback` 未追加
- Vercelデプロイ後にカスタムドメイン + GCP redirect URI追加必要
- freee Advisory Lock: `pg_advisory_lock`/`pg_advisory_unlock` RPCがSupabaseで利用可能か未検証（fallback: optimistic locking）

## Supabase接続情報
- Project ref: `nbnhrhybjslbawdukvvk`
- Dashboard: https://supabase.com/dashboard/project/nbnhrhybjslbawdukvvk
- API URL: `https://nbnhrhybjslbawdukvvk.supabase.co`

## Next.js プロジェクト情報
- ディレクトリ: `/Users/masa/amd-os-v2-web/`
- Node.js: v22.14.0（`~/local-node/bin/node`）
- dev server: `cd /Users/masa/amd-os-v2-web && PATH=$HOME/bin:$HOME/local-node/bin:$PATH npx next dev --port 3001`

## ファイル構成（新規追加分）
```
supabase/
  functions/
    _shared/freee.ts        — freee OAuth + API callers
    _shared/supabase.ts     — service_role client + helpers
    billing-action/index.ts — 状態遷移
    freee-invoice/index.ts  — 請求書CRUD
  migrations/
    20260406_billing_write_policies.sql

src/app/(mobile)/
  layout.tsx
  m/page.tsx
  m/[projectCode]/page.tsx
  m/invoice/page.tsx
  m/payment/page.tsx
  m/profile/page.tsx

src/components/mobile/
  BottomTabs.tsx
  PipelineCard.tsx
  StatusTimeline.tsx
  MonthSelector.tsx

src/lib/
  supabase/billing-queries.ts
  edge-functions.ts
```

## このセッションで得た知見
- Supabase Edge Functions（Deno）はNext.jsのtsconfig.jsonからexcludeが必要
- npx supabase は ~/.npm/... にキャッシュされ、brewなしで動く
- `supabase functions deploy --no-verify-jwt` でJWT検証をスキップ（Edge Function内で手動検証）
- git rootが/Users/masa/のためVercel CLI直デプロイが効率的
