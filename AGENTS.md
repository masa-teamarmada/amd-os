# AMD OS

株式会社チームアルマダの社内OS。4つのコードベースが同じSupabase backend を共有する。

## コードベース

| dir | 役割 | git remote |
|---|---|---|
| `gas/` | Google Apps Script。freee連携、Slack通知、外部サービス→Supabase 供給ハブ | `amd-os` |
| `pwa/` | Web/PWA版。Vercel デプロイ | (未設定) |
| `ios/` | Swift/iOS版 | `amd-os-ios` |
| `android/` | Android版 | `amd-os-android` |

## アーキテクチャ
- **Supabase が DB の正本**
- GAS は外部サービス（freee, Slack等）からデータを Supabase へ供給するハブ役
- 各クライアント（pwa/ios/android）は Supabase を読み書き

## デプロイ
- gas → `clasp push`（→ feedback_clasp_push_flow / feedback_clasp_source_dirs）
- pwa → 変更したら毎回 Vercel（→ feedback_pwa_deploy_always）
- ios → `xcodebuild → install → launch`、毎回（→ feedback_ios_deploy_always, feedback_xcode_build_deploy）
- android → TBD

## 移行メモ（2026-04-28）
- 旧パスから移動：`~/amd-os/` → `gas/`、`~/amd-os-v2-web/` → `pwa/`、`~/dev/amd-os-ios/` → `ios/`、`~/dev/amd-os-android/` → `android/`
