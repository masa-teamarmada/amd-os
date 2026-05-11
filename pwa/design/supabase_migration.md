# Supabaseデータ移行

## 2026-04-10: Spreadsheet → Supabase 初期データ移行完了

- **背景**: PWAのGAS API経由のデータ取得が8-10秒かかり、UXが著しく悪い。GASのSpreadsheet openById + getDataRangeの遅延とGoogleリダイレクトオーバーヘッドが原因。
- **決定**: Supabase PostgreSQLにデータを移行し、PWAからの読み取りをSupabase直接に切り替え
- **理由**: Supabase REST APIは0.1-0.5秒でレスポンスが返る。GAS版AMD OSとの並行運用のため、SpreadsheetもGASも引き続き運用し、GAS Cronの書き込み先にSupabaseを追加する双方向同期方式を採用
- **影響範囲**: 
  - 新規ファイル: `801_SupabaseMigration.js` (gas-main), `src/lib/supabase-data.ts` (PWA)
  - 変更: dashboard/page.tsx, cockpit/page.tsx, DashboardGrid.tsx (import先変更)
  - Supabase: 旧39テーブルDROP → 新28テーブル作成、RLSポリシー再構成

## 2026-04-10: RLSポリシーの再帰問題と対処

- **背景**: マイグレーションSQLに含まれていた `member_project_read` / `member_pm_read` ポリシーが `project_members` テーブルを再帰参照し、anon key使用時に `infinite recursion detected in policy for relation "project_members"` エラー
- **決定**: 再帰ポリシーをDROPし、全テーブルに `anon_read (USING true)` を追加（DEV_MODE限定）
- **理由**: 現時点では認証未実装（DEV_MODE）で全データ読み取り可能にする必要がある。本番移行時にSECURITY DEFINER関数でラップした非再帰ポリシーを再構築する
- **影響範囲**: RLSポリシー変更（全テーブル）

## 2026-05-11: migration 041 — ASPI Critical Technology Tracker 8 domains lane 構造

- **背景**: AMD 独自 5 lane (gx_energy/gx_circular/materials/life/robo) を論文・国際統計世界の標準 (ASPI Critical Technology Tracker 8 domains) に揃える。観測量 (B / V / I_R) を取得するため。
- **決定**: `project_ventures.lanes JSONB` を新規追加 (weighted multi-lane: `[{domain, weight}]`、合計 1.0、配列長 1-3)。check constraint で domain enum + weight 制約。
- **影響範囲**: `project_ventures` 列追加、10 PJ seed (まさ承認 mapping)。旧 `lane TEXT` は cron 移行が終わるまで併存。
- **正本 md**: [`aspi_lanes.md`](aspi_lanes.md)

## 2026-05-11: migration 042 — observation_log + lane_suggestions 新規 + papers/macro lane rewrite

- **背景**: Phase 2 で B (公募予算) / V (VC 投資) / I_R (研究費) を ASPI 8 domain × quarter で取得する観測量テーブルが必要。+ 新規 PJ の lane を LLM (Sonnet) が推定して人が承認するフロー。
- **決定**:
  - `papers_log` + `macro_index_log` の lane を旧 5 lane → ASPI 8 domain に rewrite (gx_energy + gx_circular は energy_environment に合算)
  - `macro_lane_weights` を ASPI 8 domain で再 seed
  - 新規 `observation_log` (lane, observed_at, observation_key='B'/'V'/'I_R', value, unit, source, raw_meta JSONB) + UNIQUE(lane, observed_at, observation_key, source)
  - 新規 `lane_suggestions` (project_id, suggested_lanes JSONB, reasoning, model, confidence, status='pending'/'approved'/'rejected'/'superseded')
  - `triple_helix_loading.available` を B/V/I_R 全 TRUE に
- **影響範囲**: schema 大改修、cron / lib 14 ファイル波及、UI (admin/projects + AmdScoreList) 改修。
- **正本 md**: [`aspi_lanes.md`](aspi_lanes.md)
- **ハマったポイント**: UNIQUE (lane, observed_at) があるテーブルで gx_energy + gx_circular → energy_environment の単純 UPDATE は重複事故 → 合算 INSERT + DELETE パターンで対処 ([BUGS.md](../BUGS.md) `[supabase] UNIQUE 制約のあるテーブルで lane rename 時の重複事故` 参照)
