# AMD OS

株式会社チームアルマダの社内OS。4プラットフォームのクライアントが同じ Supabase backend を共有する **モノレポ**。

> 人格・権限境界・Git運用・破壊的操作などの共通ルールは `/Users/masa/projects/AGENTS.common.md`。
> これは Claude Code が起動時に自動で読むので、ここには **amd-os 固有のことだけ** を書く。
> 詳細手順・過去事故の経緯・handoff ゲート・経営会議の進め方は `AGENTS.reference.md` を必要なときだけ読む。
> **このリポに `CLAUDE.md` を置かない**（共通ルールの重複正本になるため 2026-08-22 に全廃）。

## セッションの cwd はモノレポのルート

**Claude / Codex / えいみのセッションは `/Users/masa/projects/AMD/amd-os` を cwd にする。`pwa/` を cwd にしない。**

`pwa/AGENTS.md` には Next.js が自動生成した `BEGIN:nextjs-agent-rules` ブロック（「This is NOT the Next.js you know」）が入っている。
これは `next dev` が `node_modules/next/dist/server/lib/generate-agent-files.js` から書き戻すもので、**AMD OS のルールではない**。
pwa を cwd にすると毎セッションこれを読み込む。

- 書き戻しはマーカーの**間だけ**の置換なので、AMD OS 本文が消えることはない。
  ただし `pwa/AGENTS.md` を削除すると scaffold 経路に落ちて全上書きされるため、`pwa/AGENTS.md` は消さない。
- pwa 基準の相対パスで動くコマンド（`node scripts/*.mjs`、`npm run *`、`python3 scripts/*.py`）は、
  各コマンドの中で `cd /Users/masa/projects/AMD/amd-os/pwa` して入る。Bash はシェル状態を持ち越さないので毎回書く。
- 他のサブディレクトリ（`ios/` `macos/` `gas/` `services/*`）も同じ。cwd はルート、必要なときだけ `cd` で入る。

## リポジトリ

- **正本**: `github.com/masa-teamarmada/amd-os` （**唯一のリモート**）
- **推奨パス**: 現行 workspace では `~/projects/AMD/amd-os/` に clone
- 旧スタンドアロンリポ（`amd-os-ios` / `amd-os-pwa` / `amd-os-android` / `amd-os` GAS版）は archive 済 — **参照しない・clone しない**
- **別 Mac / 新 Mac セットアップ**: [`SETUP_NEW_MAC.md`](SETUP_NEW_MAC.md) と `scripts/dev-doctor.sh` を使う
- **clone 後に `bash scripts/install-main-only-git-hook.sh` を1回実行する**。branch 作成を拒否する hook が入る（削除と更新は通すので、誤って作られた枝は畳める）

## コードベース

| dir | 役割 |
|---|---|
| `gas/` | Google Apps Script。freee連携、Slack通知、外部サービス→Supabase 供給ハブ |
| `pwa/` | Web/PWA版。Next.js (App Router) + Vercel デプロイ |
| `macos/` | macOS版。独立したSwiftUIクライアント。AMDOSCore + AMDOSDesign |
| `ios/` | Swift / SwiftUI ネイティブアプリ。TestFlight 配布 |
| `android/` | Jetpack Compose ネイティブアプリ（TBD） |
| `services/` | pwa/ios/macos/android のいずれにも属さない独立デプロイの補助サービス群（例: `services/project-share/`）。`pwa/` のビルド・デプロイとは完全に別の Vercel プロジェクト。詳細は各サービスの `README.md` / `SPEC.md` |

プラットフォーム／サービス固有のルールは各サブディレクトリの `AGENTS.md` / `README.md` を優先して読む。

## アーキテクチャ

- **Supabase が DB の正本**（migrations / Edge Functions は `ios/supabase/` で集中管理）
- GAS は外部サービス（freee, Slack等）から Supabase へデータを供給するハブ役
- 各クライアント（pwa / ios / android）は Supabase を直接読み書き
- macOSはPWAをWKWebViewで包まず、`macos/PARITY.md`でPWA route・重要UI・iOS画面をNativeScreenIDへ対応付ける。読み取りはRLS、書込みは既存の認可済みAPI・Edge Function・GASへ委譲する

## 共通インフラ（全プラットフォーム共通で1つだけ）

| インフラ | 場所 / 設定 | デプロイ方法 |
|---|---|---|
| Supabase DB schema | `ios/supabase/migrations/` | `npx supabase db push` |
| Supabase Edge Functions | `ios/supabase/functions/` | `npx supabase functions deploy <name>` |
| Supabase project | `nbnhrhybjslbawdukvvk` | dashboard で管理 |

**schema や EF を変更したら Supabase 本番に適用してからクライアント実装に進む。適用済みの migration を再適用しない**（CREATE POLICY などは冪等ではない）。

## デプロイ

- **gas** → `clasp push`
- **pwa** → **main への push = Vercel 自動 production deploy** (2026-06-12 まさ確定 A案)。原則、deploy前の事前確認で止めず、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 経由で push・build監視まで進める。deploy bundle は事後報告として残す。CLI 直接 deploy (`npx vercel`) は全面廃止。main 以外の branch は `pwa/vercel.json` の ignoreCommand で build されない。微細変更ごとの単発 push は禁止、束ねて 1 回
- **ios** → `xcodebuild → devicectl install → process launch`、毎回
- **android** → TBD
- `services/` は PWA の main push 自動 deploy 対象では**ない**。各サービスの README に記載した方法で反映し、Git連携が未確認のサービスでは main push だけで反映されたと判断しない。PJ別の秘密値は各 Vercel プロジェクトの Environment Variables にのみ置き、リポジトリ内のどのファイルにも書かない

## このリポ固有の運用

- 既存の `codex/*` 等の残存ブランチに **新しい commit を積まない**。価値ある未マージ作業は main に畳んでから捨てる
- Codex で「ブランチを切り替えるには変更をコミットしてください」アラートが出たら **キャンセルする**。`コミットしてブランチを切り替える` は押さず、branch / dirty / worktree / unpushed commit を監査してから main を復旧する
- **画面追加 / 削除 / 改名は同じ commit で `ios/DESIGN.md` を更新する**。DESIGN.md は全プラットフォーム共通の正本
- **会話中の新タスクを `/tasks` に登録しない**。`/tasks` 画面と `npm run agent:tasks` helper は 2026-06-21 に廃止済み。既存 API 互換は `pwa/manual/2-7-task-management.md` / `pwa/spec/5-7-task-management-current-spec.md` を参照
- `macos/PARITY.md` の未移植項目を削除しない
- **モノレポ意識**: 何かを変える前に「これは全プラットフォームに影響する？」を考える
- `AGENTS.md` / `DESIGN.md` は git で正本管理。Drive や Notion に置かない

## 迷ったとき読むファイル

| 知りたいこと | 読むべきもの |
|---|---|
| 全画面の正本仕様 | `ios/DESIGN.md` ⭐ |
| 詳細手順・過去事故・handoffゲート・経営会議 | `AGENTS.reference.md` |
| iOS / PWA / GAS 固有の運用 | 各ディレクトリの `AGENTS.md` |
| 既知バグ・事故事例 | `ios/BUGS.md` |
| iOS→他プラ 引き継ぎ | `ios/HANDOFF_ios_to_<target>.md` |
| Project Share 運用 | `services/project-share/README.md` / `SPEC.md` |

## 完了条件

- [ ] コード変更が終わってる
- [ ] DESIGN.md / HANDOFF_*.md が必要に応じて更新済み
- [ ] iOS 触ったなら実機デプロイまで完了（`devicectl install` + `launch` 成功）
- [ ] macOS 触ったなら `macos/` の生成・`xcodebuild`・起動確認まで完了し、`macos/PARITY.md` の未移植を明記
- [ ] PWA 触ったなら main push (= Vercel 自動 deploy、原則ノンストップ) まで完了
- [ ] GAS 触ったなら `clasp push` 完了
- [ ] commit はすべて GitHub に push 済み
- [ ] main 更新したなら他プラットフォーム向けハンドオフ doc 更新 + push 済み
- [ ] handoff するなら `AGENTS.reference.md`「OSマニュアル同期ゲート」の棚卸し表がすべて埋まっている

## 履歴

- 2026-04-28: 4プラットフォームを単一モノレポに統合（旧パス: `~/amd-os/`, `~/amd-os-v2-web/`, `~/dev/amd-os-ios/`, `~/dev/amd-os-android/`）
- 2026-08-22: 全 `CLAUDE.md` を廃止。共通ルールは `AGENTS.common.md`、固有ルールは各 `AGENTS.md`、詳細は `AGENTS.reference.md` へ三分割
