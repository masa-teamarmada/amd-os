# AMD OS

株式会社チームアルマダの社内OS。4プラットフォームのクライアントが同じ Supabase backend を共有する **モノレポ**。

> 人格・権限境界・Git運用・破壊的操作などの共通ルールは `/Users/masa/projects/AGENTS.common.md`。
> これは Claude Code が起動時に自動で読むので、ここには **amd-os 固有のことだけ** を書く。
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

### デプロイ枠（2026-08-29 まさ指摘を受けて構造対策）

Vercel は **Hobby プランで1日100デプロイ / アカウント全体**。プロジェクト単位ではない。枯渇すると全プロジェクトが反映できなくなる（2026-06-03、2026-08-29 に発生）。

- **同じリポジトリに Vercel プロジェクトが2つ紐づいている**: `amd-os-pwa` (rootDir=`pwa`) と `kiyo-amd-os` (rootDir=`kiyo-admin`)。対策前は main への1 pushで**2デプロイ消費**していた（2026-08-29 は96件中、kiyo側49件がほぼ全部むだ打ち）。
- 対策として両プロジェクトに **パス限定の build スキップ**を設定済み。`pwa` 配下（`pwa/design_log` を除く）に差分が無い push では `amd-os-pwa` は build されず、`kiyo-admin` 配下に差分が無い push では `kiyo-amd-os` は build されない。`pwa/vercel.json` の `ignoreCommand` とVercelプロジェクト設定の両方に入っている。**この設定を外さない。**
- それでも `pwa/` を触る作業は1 push=1 build。**微細変更ごとの単発 push は禁止、束ねて1回**（既存ルール）。docs だけの変更は build されないので小刻みで良い。
- 残枠の確認（枯渇が疑われる時）:

```sh
AUTH=$(cat ~/Library/"Application Support"/com.vercel.cli/auth.json); TOKEN=$(echo "$AUTH" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
ORG=$(python3 -c "import json;print(json.load(open('pwa/.vercel/project.json'))['orgId'])")
curl -s "https://api.vercel.com/v6/deployments?teamId=$ORG&limit=100" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json,datetime,collections
d=json.load(sys.stdin); today=datetime.date.today(); c=collections.Counter()
for x in d.get('deployments',[]):
    if datetime.datetime.fromtimestamp(x['created']/1000).date()==today: c[x.get('name')]+=1
print('今日:', sum(c.values()), dict(c))"
```

- **API 経由の deploy 作成 (`POST /v13/deployments`) は別枠で上限が厳しい**（`api-deployments-free-per-day`）。復旧目的以外で使わない。通常の反映は main への push（＝Git 連携の自動 build）で行う。API 枠が尽きても push 経由の build は動く。
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
- branch 作成を拒否する機械的な防止層がこのリポにある: `.codex/config.toml` の `multi_agent = false` と `.githooks/reference-transaction`。止めるのは**作成だけ**で、削除と更新は通す（誤って作られた枝を畳めるようにするため）。main 一本という方針自体は `AGENTS.common.md`

## 迷ったとき読むファイル

| 知りたいこと | 読むべきもの |
|---|---|
| 全画面の正本仕様 | `ios/DESIGN.md` ⭐ |
| PWA の開発・デプロイ運用（deploy / build version / DDL / Anthropic 封鎖 / コードネームリンク） | `pwa/spec/5-2-development-operations-current-spec.md` ⭐ |
| PWA の設計正本の読み順 | 下の「PWA — 新セッション必読」 |
| 仕様統制・OSマニュアル同期ゲート | `pwa/design/SPEC_GOVERNANCE.md` |
| 経営会議 / まさえいMTG の進め方 | `pwa/design/project_strategy_signals.md`「議論セッション運用」 |
| 参照系データのキャッシュ | `pwa/spec/5-10-reference-data-caching-current-spec.md` |
| iOS / macOS / GAS 固有の運用 | 各ディレクトリの `AGENTS.md` |
| 既知バグ・事故事例 | `ios/BUGS.md` / `pwa/BUGS.md` |
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
- [ ] handoff するなら `pwa/design/SPEC_GOVERNANCE.md` のOSマニュアル同期ゲートの棚卸し表がすべて埋まっている

## 履歴

- 2026-04-28: 4プラットフォームを単一モノレポに統合（旧パス: `~/amd-os/`, `~/amd-os-v2-web/`, `~/dev/amd-os-ios/`, `~/dev/amd-os-android/`）
- 2026-08-22: 全 `CLAUDE.md` を廃止。共通ルールは `AGENTS.common.md`、固有ルールは各 `AGENTS.md` へ
- 2026-08-29: `AGENTS.reference.md` の層を全廃。各ディレクトリの内容は隣の `AGENTS.md` に統合した（2枚に割れていて、どちらも自動読込されないため読まれていなかった）
- 2026-08-29: このファイルに紛れ込んでいた共通ルール（git同期手順、push前fetch、画像生成の扱い）を `AGENTS.common.md` へ戻した。**共通ルールを書いてよいmdは `AGENTS.common.md` だけ**（まさ確定）。PWAの運用詳細は `pwa/spec/5-2` へ、まさえいMTGは `pwa/design/project_strategy_signals.md` へ、マニュアル同期ゲートは `pwa/design/SPEC_GOVERNANCE.md` へ移した

---

## ディレクトリ構成

```
amd-os/
├── AGENTS.md          ← 概要・アーキテクチャ・常時ルール
├── gas/               ← Google Apps Script (freee/Slack 連携、外部→Supabase ハブ)
├── ios/               ← Swift / SwiftUI ネイティブアプリ
│   ├── DESIGN.md      ⭐ 全画面の正本仕様
│   ├── HANDOFF_ios_to_pwa.md      ← iOS→PWA 移植引き継ぎ
│   ├── HANDOFF_ios_to_android.md  ← iOS→Android 移植引き継ぎ
│   ├── BUGS.md / DEBUG.md / TESTFLIGHT_WORKFLOW.md
│   ├── AMDOS/         ← Swift ソース
│   └── supabase/      ← migrations + Edge Functions（共通インフラ）
├── macos/             ← 独立したSwiftUI macOSクライアント
│   ├── AMDOSMac/      ← AMDOSCore / AMDOSDesign / Features
│   ├── DESIGN.md      ← macOS画面設計正本
│   └── PARITY.md      ← PWA・重要UI・iOS全件対応表
├── pwa/               ← Next.js (App Router) Web/PWA
├── android/           ← Jetpack Compose (TBD)
└── services/          ← 独立デプロイの補助サービス群
    └── project-share/ ← PJ関係者へパスワード認証のみでファイル共有するVercelサービス
        ├── README.md  ← 汎用機能とPJ別インスタンスの境界
        ├── SPEC.md    ← 恒久仕様（認証・Blob・デプロイモデル）
        └── vsx/ cx/ se/ zmp/ kute/  ← PJ別インスタンス
```

## プラットフォーム間の引き継ぎ

iOS が先行実装することが多い。他プラットフォームへ移植するときの流れ:

1. iOS で実装 → `ios/DESIGN.md` を同じ commit で更新
2. iOS の commit を push、main に取り込み
3. `ios/HANDOFF_ios_to_<target>.md` を書く（または既存に追記）— 差分・移植先ファイルパス・既適用済みインフラの注意書き
4. push、main に取り込み
5. 他プラットフォーム担当の Claude が pull → ハンドオフ doc を読んで実装
6. 実装完了したら ハンドオフ doc 末尾「反映状況」に commit hash と要点を追記

DESIGN.md は全プラットフォーム共通の正本。Android / PWA も書き換えるときはここを更新する。

## 過去のハマり（要点）

詳細は `ios/BUGS.md`。新規セッションは最低でも目次を読む:

- **Drive 同期トラップ**: GitHub リポを Google Drive 配下で運用すると `.git` が壊れる → Drive外で運用
- **未push commit巻き戻り**: 9 commit がローカル滞留 → origin/main 起点ビルドで機能消失
- **xcodebuild の `INSTALL SUCCEEDED` 誤認**: 実機反映してない → `devicectl` 明示インストールが必要
- **祝日判定の再帰暴走**: `isJapaneseHoliday` の前日参照が連休で無限ループ → 非再帰へ
- **Supabase migration 履歴ズレ**: ローカルとリモートの migration version が食い違う → `migration repair` で揃える

## PWA — 新セッション必読 (= この順)

**まず読む = OS マニュアル入口 + 設計書の再構築監査**:

00. [`pwa/manual/1-1-intro.md`](pwa/manual/1-1-intro.md) ⭐⭐⭐ — **AMD OS マニュアル**入口。**新セッションのえいみは必ずここから読む**。過去判断ログ / 用語と実装の対応 / cron 廃止経緯 / Codex-Claude-Vercel-LaunchAgent 責務分担マトリクス / 過去事故ログは [`pwa/manual/9-1-decisions-and-history.md`](pwa/manual/9-1-decisions-and-history.md) と [`pwa/manual/9-3-appendix-changelog.md`](pwa/manual/9-3-appendix-changelog.md) に集約
00.5. [`pwa/spec/1-3-reconstruction-coverage-audit.md`](pwa/spec/1-3-reconstruction-coverage-audit.md) ⭐⭐⭐ — 設計書だけで current OS を再構築できるかの監査表。作業前に該当領域が `rebuildable` / `partial` / `not yet` のどれかを見る

そのあと **設計仕様 md** (= `/spec` へ移行中。未移行領域は `pwa/design/` が正本):

0. [`pwa/spec/1-1-overview.md`](pwa/spec/1-1-overview.md) / [`pwa/spec/1-2-document-layer-migration-map.md`](pwa/spec/1-2-document-layer-migration-map.md) — manual / spec / bzm 3層分割と移行マップ
1. [`pwa/spec/2-1-pwa-runtime-routes.md`](pwa/spec/2-1-pwa-runtime-routes.md) — PWA ランタイム / route / API / cron / auth 境界
2. [`pwa/spec/3-1-l2-data-extraction-current-spec.md`](pwa/spec/3-1-l2-data-extraction-current-spec.md) — M/W/D/H L2 / 5 生データ / outbox / LaunchAgent / 採否ループ
3. [`pwa/design/L2_DATA.md`](pwa/design/L2_DATA.md) ⭐⭐⭐ — 中核データ正本 (M/W/D/H L2 + レポート + 全 cron)。移行完了までは `/spec` と両方見る
4. [`pwa/design/README.md`](pwa/design/README.md) — 未移行設計フォルダのインデックス
5. [`pwa/design/SPEC_pwa.md`](pwa/design/SPEC_pwa.md) ⭐ — PWA 全体仕様。移行完了までは `/spec` と両方見る
6. [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md) ⭐ — 消してはいけない業務導線
7. [`pwa/design/SPEC_GOVERNANCE.md`](pwa/design/SPEC_GOVERNANCE.md) ⭐ — 仕様統制
8. [`pwa/design/cockpit.md`](pwa/design/cockpit.md) ⭐ — コックピット詳細
9. [`pwa/design/routine.md`](pwa/design/routine.md) ⭐ — 月次ルーティン (回帰多発)
10. その他テーマ別 md は `pwa/design/README.md` の表参照

そのあと:
- [`pwa/HANDOFF_pwa_rebuild.md`](pwa/HANDOFF_pwa_rebuild.md) — 直近セッション状態・次の一手
- [`pwa/BUGS.md`](pwa/BUGS.md) — バグ・教訓・回帰防止メモ
- [`pwa/design_log/sessions_YYYY-MM.md`](pwa/design_log/) — 過去セッションログ (時系列)

**設計変更を入れるときは、使い方は `pwa/manual/`、確定実装仕様は `pwa/spec/`、理論・数式・rubric は `pwa/bzm/` を同じ commit で更新する**。変更した層の附則 (`manual/9-3`, `spec/6-1`, `bzm/9-5`) に日時つきで必ず追記する。
新規の設計 md を `design_log/` に作らない (見落とされる)。

**モデル（理論の正本）の入口は `amd-os/model/`（2026-08-22 まさ確定、教科書 `amd-os/bzm/` とは別の層）。** えいみの評価・表示・会話は `model/LOCK.json` に載った確定文書だけを前提にする。新しい概念・パラメータ・数式は `model/proposals/` に提案として書き、まさの承認を `model/APPROVALS.md` に記録して relock するまで正本に入れない（2026-08-21 の含意年数、会話内の P^PJ のような「勝手な持ち出し」の再発防止）。ロックは critical-ui guard / `.githooks/pre-commit` / Claude Code hook の3層で機械的に止める。運用規約は `model/README.md`、版数台帳は `model/MODEL_VERSION_LEDGER.md`、OS 表示は `/model`。
