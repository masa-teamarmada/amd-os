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
