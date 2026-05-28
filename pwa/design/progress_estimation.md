# 進捗推定（milestone_monthly_progress 自動更新）

PWA で MS 別の月次進捗%を LLM に推定させて `milestone_monthly_progress` に書き込む仕組み。

## 2026-04-17: PWA への実装（GAS移植 + データソース変更）

### 背景
- 月次モーダルの「進捗確認」タブがレポート生成と連動して更新されず、4月レポートが書かれても進捗バーは 0% のままだった
- GAS には `cron_progressEstimateDaily_()`（R060_RewardV2_Estimator.gs）で日次推定する仕組みがあったが、GAS L1/L2 cron は廃止済みで動いていない
- PWA 側で進捗推定する仕組みが必要だった

### 決定
**進捗推定を PWA の API ルートとして実装し、月次モーダルから手動トリガーできるボタンを追加した。ソースは `monthly_reports.final_content / draft_content`（既に生成済みのレポート本文）を使う。**

### 実装

#### 1. `src/lib/progress-estimator.ts`（新規）
- `estimateProgress(projectId, ym)` 関数
- フロー:
  1. `value_plan_cycles`（status in active/confirmed/fixed/draft）と `value_milestones`（goal_level !== monthly）を取得
  2. `project_members` + `members` から PJ メンバー名（codeName）を取得
  3. 前月・当月の `milestone_monthly_progress` を取得（累積計算用）
  4. **`monthly_reports` から当月レポート本文を取得**（final_content > draft_content の優先順）
  5. `tsukuyomi_context` の `reward_estimate` タグでシステムプロンプト取得（無ければデフォルト文言）
  6. Claude Sonnet 4.5 に MS 一覧＋レポート本文を渡して推定
  7. LLM 応答の JSON パース: `{ progress: [{ milestoneKey, progressPct(対象月時点の累積値), reason }] }`
  8. MS個別期間の按分を基準に補正し、`milestone_monthly_progress` に累積値として upsert（conflict: `milestone_key, ym`）

- スキップ条件:
  - MS個別期間の開始前（期待進捗0%。既存のAI/自動由来行があれば0%補正）
  - `routine` タグの MS（LLM推定ではなく期間按分の `routine_auto`）
  - 現在のソースが `pm_manual` / `pm_confirmed` / `pm_rejected` / `criteria_toggle` / `tsukuyomi_revision`（手動・確定済みなので上書き禁止）
  - 既存値と同じ累積値

- モデル: `claude-sonnet-4-5-20250929`（GAS と同じ）。Haiku だと複雑な抽出タスクで精度が落ちるため使わない。

#### 2. `src/app/api/progress/estimate/route.ts`（新規）
- `POST { projectId, ym }` → `estimateProgress` 呼び出し
- レスポンス: `{ saved, total, skipped, message, diagnostics, details }`
- `diagnostics` に `planCycleFound / milestoneCount / sourceItemCountRaw / sourceBreakdown / usingServiceRole` を含める（デバッグ用）

#### 3. `src/app/api/report/generate/route.ts`（修正）
- レポート生成成功後に `estimateProgress` を fire-and-forget で呼ぶ
- エラーがあってもレポート生成の結果には影響させない（try/catch で握りつぶす）
- レスポンスに `progressEstimate` を含める

#### 4. `src/components/cockpit/CockpitMonthlyModal.tsx`（修正）
- 「進捗確認」タブに **「🤖 AIで再推定」ボタン** を追加
- ボタン押下で `/api/progress/estimate` を呼び出し、返ってきた `details[].cumulative` でローカルstateを更新 → **ページリロードなしでその場で進捗バーが更新される**
- 診断情報を結果メッセージに表示: `[PC=✓, MS=9, report=1, svcRole=✓]`
- モーダル幅を `!max-w-[1400px] sm:!max-w-[1400px] w-[95vw]` に変更（shadcn Dialog の base `sm:max-w-sm` を `!important` で上書き）

### 重要な発見

#### 環境変数の欠落（ハマりどころ）
Vercel production に以下が未設定だった:
- `SUPABASE_SERVICE_ROLE_KEY` — 無いと anon key fallback → RLS で `source_cache` / `monthly_reports` が読めない
- `ANTHROPIC_API_KEY` — 無いと LLM 呼び出しが失敗
- `FREEE_*` — invoice API が動かない

ローカルの `.env.local` には全部入っていた（開発時は動作していた）。Vercel に追加してデプロイで解決。

**教訓**: Next.js の `NEXT_PUBLIC_*` 以外の env var は、ローカル `.env.local` に設定しても Vercel には自動反映されない。デプロイ時に `vercel env add` で明示追加が必要。

#### source_cache → monthly_reports 移行
当初は GAS R060 と同じく `source_cache` からソースを引く設計で実装したが、実行したら 0 件だった。

原因: **GAS L1/L2 cron は廃止済み**。`source_cache` への書き込みが止まっている。レポート生成は MMO マシンの Claude Code scheduled task に移行済みで、直接 Notion/Slack/Gmail/Drive にアクセスしてレポート本文を生成し `monthly_reports` に書き込んでいる。

→ PWA の進捗推定も「既に生成されているクオリティの高い `monthly_reports` 本文」を LLM に渡して抽出する方針に変更した。シンプルで、データが確実に存在するソースを使える。

### 影響範囲
- `/Users/masa/projects/amd-os/pwa/src/lib/progress-estimator.ts`（新規）
- `/Users/masa/projects/amd-os/pwa/src/app/api/progress/estimate/route.ts`（新規）
- `/Users/masa/projects/amd-os/pwa/src/app/api/report/generate/route.ts`（修正: 推定の自動トリガー）
- `/Users/masa/projects/amd-os/pwa/src/components/cockpit/CockpitMonthlyModal.tsx`（修正: 再推定ボタン+幅+ローカルstate）
- Vercel production env vars: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FREEE_CLIENT_ID`, `FREEE_CLIENT_SECRET`, `FREEE_REFRESH_TOKEN`, `FREEE_COMPANY_ID`

### 動作確認
2026-04-17: SX プロジェクト 202604 で再推定ボタン実行。`✓ 4件のMS進捗を更新しました（推定9件中） [PC=✓, MS=9, report=1, svcRole=✓]` が表示され、進捗バーがリアルタイム更新されることを確認。

## データフローの現状（2026-04-17時点）

### 旧フロー（廃止済み）
```
GAS L1 cron (1日1回)
  → Notion/Slack/Gmail/Drive から差分取得
  → DB_SourceCache (スプシ) に書き込み
  → Supabase source_cache に同期

GAS L2 cron
  → source_cache からレポート生成 (R303)
  → monthly_reports に保存
  → 同時に cron_progressEstimateDaily_() で進捗推定
  → milestone_monthly_progress に保存
```

### 新フロー（2026-04時点）
```
MMO マシンの Claude Code scheduled task
  → Notion/Slack/Gmail/Drive に直接アクセス（MCP経由）
  → レポート生成
  → GAS WebApp API (tsukuyomi_postMessage 等) でSupabase monthly_reports に保存
  → Slack投稿もAPI経由

PWA 進捗推定 (新規)
  → monthly_reports からレポート本文取得
  → LLM (Claude Sonnet 4.5) でMS別%を抽出
  → milestone_monthly_progress に upsert
```

### `source_cache` の扱い
- **書き込みは止まっている**（GAS L1 cron 廃止）
- 既存データ（過去の同期済み分）は残っているが、新規データは入らない
- 参照しているコード:
  - `src/app/api/report/generate/route.ts` ← まだ `source_cache` 参照あり。実質空振りで動くが、将来的に `monthly_reports` ベースに書き換え推奨
  - `src/lib/progress-estimator.ts` ← 移行済み（`monthly_reports` を使う）

### 将来的な検討事項
- `report/generate` ルートも `source_cache` 依存をやめる必要あり（現状は空ソースで LLM に投げている）
- あるいは PWA の report/generate 自体が不要になる可能性（MMO の scheduled task で十分なら）

## 2026-05-02: つくよみ修正依頼からGmail生データ抽出へ

短期実装:
- 月次モーダルの「つくよみに修正依頼」で Gmail/メール抽出が必要そうな依頼を検知したら、PWA API から GAS `pwaApi` adapter を呼ぶ。
- GAS 側は既存の `mr_extractFromGmail_()` を使い、Gmail threads を返す。
- PWA 側は返却された threads を Supabase `source_cache(source='gmail')` に upsert し、その後のつくよみ修正提案・`member_activities` 抽出の根拠に使う。
- GAS収集が失敗または0件の場合だけ、PM修正依頼文に基づく暫定 `member_activities` 抽出にフォールバックする。

TODO（中長期）:
- GAS adapter を外し、PWA のサーバー側（Next API / Vercel Functions）から Google Gmail API を直接叩く収集器へ置き換える。
- 必要設計: メンバーごとの Google OAuth consent、Gmail readonly scope、refresh token の安全な保存、PJ単位の閲覧許可、token失効時の再認証導線。
- UI/つくよみ側は `/api/progress/revisions` から抽象化された収集関数を呼ぶだけにしておき、GAS→PWA直接実装への差し替えで画面側を変えない。
