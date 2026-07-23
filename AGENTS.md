# AMD OS

株式会社チームアルマダの社内OS。4プラットフォームのクライアントが同じ Supabase backend を共有する **モノレポ**。

> **ルール本体は [CLAUDE.md](CLAUDE.md) に書く。これは概要のみ。**
> セッション開始時の 4 ステップ・引き継ぎ運用は CLAUDE.md 参照。
> **2026-06-12以降、PWAの本番反映は `main push = Vercel自動deploy`。原則、deploy前の事前確認で止めない。deploy bundle は事後報告として残す。**

## リポジトリ

- **正本**: `github.com/masa-teamarmada/amd-os` （**唯一のリモート**）
- **推奨パス**: 現行 workspace では `~/projects/AMD/amd-os/` に clone
- 旧スタンドアロンリポ（`amd-os-ios` / `amd-os-pwa` / `amd-os-android`）は廃止 — 参照禁止
- **別 Mac / 新 Mac セットアップ**: [`SETUP_NEW_MAC.md`](SETUP_NEW_MAC.md) と `scripts/dev-doctor.sh` を使う

## コードベース

| dir | 役割 |
|---|---|
| `gas/` | Google Apps Script。freee連携、Slack通知、外部サービス→Supabase 供給ハブ |
| `pwa/` | Web/PWA版。Next.js (App Router) + Vercel デプロイ |
| `macos/` | macOS版。独立したSwiftUIクライアント。AMDOSCore + AMDOSDesign |
| `ios/` | Swift / SwiftUI ネイティブアプリ。TestFlight 配布 |
| `android/` | Jetpack Compose ネイティブアプリ（TBD） |
| `services/` | PWA/ios/macos/androidのいずれにも属さない独立デプロイの補助サービス群（例: `services/project-share/` = Project Share機能）。詳細は各サービスの `README.md` |

プラットフォーム／サービス固有のルールがある場合は、各サブディレクトリの
`CLAUDE.md` / `AGENTS.md` / `README.md` を優先して読む。

## アーキテクチャ
- **Supabase が DB の正本**（migrations / Edge Functions は `ios/supabase/` で集中管理）
- GAS は外部サービス（freee, Slack等）から Supabase へデータを供給するハブ役
- 各クライアント（pwa / ios / android）は Supabase を直接読み書き
- macOSはPWAをWKWebViewで包まず、`macos/PARITY.md`でPWA route・重要UI・iOS画面をNativeScreenIDへ対応付ける。読み取りはRLS、書込みは既存の認可済みAPI・Edge Function・GASへ委譲する

## デプロイ
- **gas** → `clasp push`
- **pwa** → **main への push = Vercel 自動 production deploy** (2026-06-12 まさ確定 A案)。原則、deploy前の事前確認で止めず、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 経由で push・build監視まで進める。deploy bundle は事後報告として残す。CLI 直接 deploy (`npx vercel`) は全面廃止。main 以外の branch は `pwa/vercel.json` の ignoreCommand で build されない。微細変更ごとの単発 push は禁止、束ねて 1 回
- **ios** → `xcodebuild → devicectl install → process launch`、毎回
- **android** → TBD

## 引き継ぎ運用
- iOS が先行実装することが多い
- 移植時は `ios/DESIGN.md`（全画面の正本）と `ios/HANDOFF_ios_to_<target>.md` を読む
- 詳細は CLAUDE.md「プラットフォーム間の引き継ぎ」

## 履歴
- 2026-04-28: 4プラットフォームを単一モノレポに統合（旧パス: `~/amd-os/`, `~/amd-os-v2-web/`, `~/dev/amd-os-ios/`, `~/dev/amd-os-android/`）
