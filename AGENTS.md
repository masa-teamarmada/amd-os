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
- [ ] handoff するなら 下の「OSマニュアル同期ゲート」の棚卸し表がすべて埋まっている

## 履歴

- 2026-04-28: 4プラットフォームを単一モノレポに統合（旧パス: `~/amd-os/`, `~/amd-os-v2-web/`, `~/dev/amd-os-ios/`, `~/dev/amd-os-android/`）
- 2026-08-22: 全 `CLAUDE.md` を廃止。共通ルールは `AGENTS.common.md`、固有ルールは各 `AGENTS.md` へ
- 2026-08-29: `AGENTS.reference.md` の層を全廃。各ディレクトリの内容は隣の `AGENTS.md` に統合した（2枚に割れていて、どちらも自動読込されないため読まれていなかった）

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

## セッション開始時の同期4ステップ

エラー閉じ・別マシン作業・別セッションの未push commit を最初に検知するため、毎セッション開始時に実行:

```sh
cd ~/projects/AMD/amd-os

# 1. リモート状態を取り込む
git fetch --all --prune

# 1.5. fetchだけで済ませず、mainの実際の乖離を数える
git rev-list --count HEAD..origin/main
git rev-list --count origin/main..HEAD

# 2. ローカルにあって push されてない commit を検知（全ブランチ横断）
git log --branches --not --remotes --oneline

# 3. ローカル全ブランチの先端を確認
git branch -a

# 4. 作業ツリーが綺麗か
git status -s
```

**(2) の出力が空でなければ、push されてない作業が必ずある。** 内容を見てから取り込む。未 push commit を勝手に消さない。

- `HEAD..origin/main > 0` かつ `origin/main..HEAD = 0` なら、ユーザー所有のdirtyを確認したうえで `git merge --ff-only origin/main` し、behindが0になったことを再確認する
- **「共有checkoutだからbehindは常態」「具体数は当てにしない」は禁止。** 数は毎回変わっても、確認時点の実数とSHAを記録し、behindを未解決として扱う
- disposable clean cloneからpush・deployした場合も、終了前に正規checkoutで再fetchする。正規checkoutのbehindが残るなら、deploy完了とcheckout同期未完を分けて報告し、リポジトリ全体のcloseoutを完了扱いにしない

## push 直前の fetch

- 1機能 = 1 commit、commit のたびに `git push origin main`。機能完成まで push を待たない
- **push 直前に必ず `git fetch origin main` して origin/main の直近 commit を見る** — 複数セッションが並行稼働しているため、自分が知らない間に他セッションが同じファイルを更新している可能性が高い。確認せずに「未実施」「未反映」等の状態記述を push すると、他セッションが既に完了させた事実を古い記述のまま固めてしまう（2026-07-13 PF-021 セッションで発生、訂正 commit が追加で必要になった）
- 守らないと巻き戻り事故が起きる。過去事例: 9 commit が未 push のまま origin/main を起点にビルドし直して機能消失（`ios/BUGS.md` 2026-04-28 エントリ）

## branch 禁止の防止層

- 防止層は `.codex/config.toml` の `multi_agent = false` と、`.githooks/reference-transaction` の branch 作成拒否。clone 後は `bash scripts/install-main-only-git-hook.sh` を1回実行する
- この hook が止めるのは **作成だけ**。branch の削除と更新は通す。誤って作られた枝を畳めなくなると、closeout の「作った枝は必ず閉じる」義務が実行できなくなるため。2026-08-09 まで削除も誤ってブロックしていた（`pwa/BUGS.md` の `[git/hook]` 参照）
- PWA の本番反映は `main push = Vercel 自動 deploy`。**main に無いものは本番に存在できない** — これがこのルールの機械的な裏付け
- 同じ差分が別 SHA で main に入った一時 branch は `patch-equivalent-main` として扱い、証跡保存後の削除候補にする。「同じ内容だけど浮いている branch」を放置しない
- closeout では「このセッションで作った branch/worktree: none」または「作ったが削除済み / main に畳み済み」を必ず書く。これが書けない状態は完了ではない

### なぜ branch を全面禁止にしたか

2026-05-30 に AI が自動で切った branch へ無関係な作業が積み上がり、main と乖離して巨大コンフリクトになった。
2026-06-12 には `codex/*` が 30 本以上作られ、本番ライン 64 commit が未 push のローカル branch に幽閉されて、
まさが画面で確認済みの正本が「巻き戻った」ように見える事故になった。この2件を最後に branch 作成を全面禁止にしている。
経緯の詳細は `pwa/BUGS.md` と `ios/BUGS.md`。

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

## OSマニュアル同期ゲート（handoff 時）

handoff を実行する時は、Codex の handoff skill と同じ仕様で閉じる。

- このセッションで実装・変更した **新たな仕様** を棚卸しする
- ユーザー/開発者が次回知るべき使い方なら `pwa/manual/*.md` (= AMD OS マニュアル正本) に追記する
- 詳細仕様は移行済みなら `pwa/spec/*.md`、未移行なら該当 `pwa/design/*.md` / `FEATURE_REGISTRY.md` / `db_schema.md` に置き、マニュアルには読み手向けの要約と運用手順を置く
- 章対応は `pwa/src/app/(app)/manual/manual-chapters.ts` を見る。新章を作る場合は `manual-chapters.ts` と `pwa/design/os_manual.md` も同時に更新する
- 純粋な refactor / typo / test only など、マニュアル対象外なら「対象外: 理由」を書く
- handoff のチャット出力には以下の棚卸し表を必ず含め、すべて `✅` または `対象外: 理由` になるまで migration prompt に進まない

```md
| # | 新仕様/仕様変更 | spec/design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|---|
| 1 | ... | pwa/spec/... or pwa/design/... | pwa/manual/... | ✅ / 対象外: 理由 / ⚠️ |
```

HANDOFF だけに恒久仕様を書いて閉じるのは禁止。長く残る仕様は `pwa/manual/` と、移行済みなら `pwa/spec/`、未移行なら `pwa/design/` に逃がしてから、HANDOFF には次セッション用の状態だけを書く。

## 経営会議の始め方（D-6 Strategy Signals dialogue）

まさが **新セッションでも既存セッションでも** 以下のいずれかを言ったら、即経営会議モードに入る:

- 「経営会議やろう」「経営会議始めよう」
- 「経営シグナル見よう」「signals レビュー」
- 「strategy signals やろう」

手順:

1. `project_strategy_signals` の `status='candidate'` を impact 順で全 PJ 横断 read
2. 1 議題ずつ提示 → まさの判断後に `POST /api/strategy-signals` (confirm/reject/update/create)
3. セッション終了時に `POST /api/dialogue-meeting` で議論ログを PJ ごとに保存 (会社全体は `project_id='p00'`)

daily 議題プリペアは scheduled task `amd-os-management-dialogue-prep` が毎朝 07:00 JST に自動で走り、`project_strategy_signals` に `candidate/proposed` を積む。まさが claude/codex を開いた瞬間には議題が既に揃っている前提。

詳細手順は `pwa/AGENTS.md` の該当節を読む。

---

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

## 🚨 画像生成ごまかし禁止 (絶対ルール)

まさが「画像生成して」「imagegen で作って」「フレーム画像を作って」「テクスチャ作って」等を依頼してきた場合:

1. **手元の MCP / Tool に本物の画像生成 (DALL-E / Imagen / Midjourney / Stable Diffusion / NanoBanana 等) があるか必ず確認する**
   - `ToolSearch` で `image generation imagen dall-e generate` 等で検索
   - 2026-05 時点では Drive / Slack / Notion / Calendar / Gmail / DocuSign / Chrome MCP のみで画像生成 MCP は無い
2. **無ければ必ずまさにそう伝える**:
   - 「画像生成 MCP が手元に無いので、ChatGPT / Midjourney / Imagen / NanoBanana 等の外部サービスで生成して、PNG/JPG ファイルを返してもらえれば `pwa/public/` 配下に置いて背景として組み込みます」
   - まさが外部で生成 → 画像をくれる → こちらは public に配置して `<img>` / `background-image: url(...)` で使う
3. **🚫 絶対禁止**: 画像生成できないからといって、SVG / CSS / inline gradient / 絵文字 / ASCII art / drei `<Plane>` 装飾 / Three.js shader 自作 等で **「それっぽい画像っぽさ」を自作してごまかすこと**
   - これは「画像をくれと言われたのに自作で誤魔化した」ことになり、まさの意図 (本物の生成画像のクオリティ・一貫性・ブランド感) を裏切る
   - 「コードで頑張って描いた装飾」と「画像生成のアセット」は本質的に別物。混同するな
   - 「SVG で frame っぽいの描きました」「CSS で frame っぽいの作りました」は **画像生成タスクの完了ではない**
4. **画像生成タスクの完了条件**: `pwa/public/` 配下に **本物の画像ファイル (PNG/JPG/WebP/SVG-from-imagegen)** が存在し、それを `<img src>` / `next/image` / `background-image: url(...)` で使っていること

**過去事例 (2026-05-06)**: フレーム画像生成依頼に対して SVG `<polyline>` で角飾りや `>>>` arrow を自作して「画像の代わり」と称した。後でまさから「画像生成やってないよね」と指摘されて本ルール追加。同じ過ちを繰り返さない。

---

## 技術スタック

Next.js 16 + React 19 + Tailwind CSS v4

## プロジェクト情報

- **ローカルディレクトリ（正本）**: `/Users/masa/projects/AMD/amd-os/pwa`
- **バックエンド**: Supabase（直接接続） + AMD OS GAS（`WEBAPP_BASE_URL` 経由）
- **デプロイ**: Vercel（armada0130 / amd-os-pwa）
- **本番URL**: https://amd-os-pwa.vercel.app

## デプロイ方式・Git運用（2026-06-12 まさ確定 A案）

- **PWA の本番反映 = `origin/main` への push**。Vercel が main push を自動 production build する。**「まさが画面で見る OS = origin/main」が常に成立する**ことがこの方式の目的。
- **Vercel CLI による直接 deploy (`npx vercel --prod` / `npx vercel deploy`) は全面廃止**。push 状態と無関係な worktree から本番が作られると、正本巻き戻り事故 (2026-06-12 L2 リネーム幽閉事故) が再発するため。
- **main 以外の branch は build されない** (`pwa/vercel.json` の `ignoreCommand`)。preview deploy は運用しない。
- **ブランチ作成は全面禁止** (`AGENTS.common.md` / root `AGENTS.md` 参照)。main に無いものは本番に存在できない。
- 本番反映は必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 経由 (= main/clean/origin 整合検査 + rollback guard + push + build 監視 + macOS 通知)。
- `git remote -v`: `https://github.com/masa-teamarmada/amd-os.git`
- `git branch --show-current`: `main` (これ以外なら作業開始前に直す)
- `.vercel/project.json`: projectName `amd-os-pwa` / projectId `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` (緊急 rollback の `vercel promote` 用に維持)

## ドキュメント構成（**この順で読む**）

| 何を知りたいか | ファイル | 内容 |
|---|---|---|
| **AMD OS マニュアル正本** ⭐⭐⭐ (= 2026-05-25 以降) | `pwa/manual/1-1-intro.md` 〜 `9-3-appendix-changelog.md` | **ユーザー + 開発者マニュアル**。過去判断 / 用語と実装の対応 / cron 廃止経緯 / Codex-Claude-Vercel-LaunchAgent 責務分担マトリクス / 過去事故ログを集約。**新セッションは必ずここから読む** |
| **AMD OS 中核データ正本** ⭐⭐⭐ | `pwa/design/L2_DATA.md` | **M/W/D/H L2 (monthly report / AMDプロトコル / MS進捗 / PJナレッジ / メンバーナレッジ / MTGサマリ / OS台帳差分 / XRL根拠 / 経営・事業シグナル) + レポート + 全 cron**。データに触る作業の前に必ず読む |
| **設計書 (/spec) 移行入口** ⭐ | `pwa/spec/1-1-overview.md` / `pwa/spec/1-2-document-layer-migration-map.md` | manual / spec / bzm の3層分割、移行中の正本境界、次に移す章の優先順位 |
| **再構築カバレッジ監査** ⭐⭐⭐ | `pwa/spec/1-3-reconstruction-coverage-audit.md` | `/spec` だけで current OS を再構築できるかの章別評価。作業前に該当領域の不足を確認する |
| **PWA runtime / L2 現行仕様** ⭐ | `pwa/spec/2-1-pwa-runtime-routes.md` / `pwa/spec/3-1-l2-data-extraction-current-spec.md` | PWA route/API/cron/auth と M/W/D/H L2/outbox/採否ループ。移行完了まで `design/SPEC_pwa.md` / `design/L2_DATA.md` と両方見る |
| **設計 md フォルダ全体の入口** ⭐ | `pwa/design/README.md` | `/spec` 未移行領域の設計正本インデックス。**まずここを読んで「次に何を読むか」を決める** |
| **PWA 全体の正本仕様** ⭐ | `pwa/design/SPEC_pwa.md` | 画面・ルート・データモデル・cron・共通インフラ・運用コマンド・実装規約。`/spec` へ章移行予定 |
| **重要UI登録簿** ⭐ | `pwa/design/FEATURE_REGISTRY.md` | 画面ごとの「消してはいけない業務導線」と `test:critical-ui` anchor |
| **仕様統制** ⭐ | `pwa/design/SPEC_GOVERNANCE.md` | 仕様がmdへ書き込まれる仕組み、spec/ADR/traceability運用、新セッションの読み順 |
| **コックピット詳細 / 月次ルーティン** ⭐ | `pwa/design/cockpit.md` | PJ Status / MS / 経営・事業シグナル / 月次ルーティン stepId × クリック挙動 (回帰多発) |
| テーマ別設計 (Atlas / Venture Map / AMD Score / VC List 等) | `pwa/design/<topic>.md` | `pwa/design/README.md` の表参照 |
| 直近セッション + 次の一手 | `pwa/HANDOFF_pwa_rebuild.md` | スリム保持 (~200 行以下) |
| バグ・教訓 | `pwa/BUGS.md` | 症状/原因/解決策/教訓 形式 |
| 過去セッションの作業ログ | `pwa/design_log/sessions_YYYY-MM.md` | 月単位の作業ログ (append-only) |

**🚨 重要 — 設計 md の置き場所ルール**:
- 使い方は `pwa/manual/`、確定実装仕様は移行済みなら `pwa/spec/`、未移行なら `pwa/design/` に置く
- `pwa/design/` は廃止済みではなく移行中。既存ファイルを削除せず、章単位で `/spec` へ移す
- `/spec` の品質バーは「読めば current AMD OS を再構築できる」こと。薄い要約で終えず、入力/出力、DB table/column、API/route/function、batch/cron/automation、authority、failure mode、validation を書く
- manual / spec / bzm を変更したら、それぞれ `manual/9-3-appendix-changelog.md` / `spec/6-1-appendix-changelog.md` / `bzm/9-5-appendix-changelog.md` に日時つきで追記する
- `pwa/design_log/` には **過去セッションの sessions_*.md** だけ。新規設計 md を作ってはいけない (次セッションのえいみが見落とす)
- 新セッション開始時は **必ず `pwa/spec/1-1-overview.md` / `pwa/spec/1-2-document-layer-migration-map.md` と `pwa/design/README.md` から読む**

**🚨 handoff 時の OS マニュアル同期ゲート**:
- handoff を実行する時は、このセッションで実装・変更した新たな仕様を棚卸しする
- ユーザー/開発者が次回知るべき仕様なら、`pwa/manual/*.md` (= AMD OS マニュアル正本) に追記する
- 詳細仕様は移行済みなら `pwa/spec/*.md`、未移行なら該当 `pwa/design/*.md` / `FEATURE_REGISTRY.md` / `db_schema.md` に置き、マニュアルには読み手向けの要約と運用手順を置く
- 章対応は `pwa/src/app/(app)/manual/manual-chapters.ts` を見る。新章を作る場合は `manual-chapters.ts` と `pwa/design/os_manual.md` も同時に更新する
- 純粋な refactor / typo / test only など、マニュアル対象外なら「対象外: 理由」を書く
- handoff のチャット出力には `新仕様/仕様変更 | spec/design正本 | OSマニュアル章 | 状態` の表を必ず出し、すべて `✅` または `対象外: 理由` になるまで migration prompt に進まない

---

## 🔗 メンバーコードネームリンク（admin-only）

- OS内でAMDメンバーの `code_name` を文章・通知・カード・台帳セルに表示するときは、原則 `/mypage?memberId=<members.member_id>` にリンクする。
- `<members.member_id>` は Supabase の `members.member_id` をそのまま使う。例: `ID001`。`001` のように `ID` prefix を落としたURLは禁止。
- 他メンバーのマイページ閲覧は admin (`members.is_admin=true`) 専用。一般ユーザー向けの相互閲覧導線として扱わない。
- 自由文は共通UI `LinkedMemberText` を使い、構造化されたメンバー台帳・一覧では行の `member_id` から明示的に `Link` を組む。
- `/admin/members` の codeName セルはこの rule の基準UI。コードネームをクリックすると対象メンバーのマイページへ飛び、編集はセル内の編集ボタンから行う。

---

## 🔢 build version の bump up（毎回必須）

**コード修正で deploy する前に必ず [`src/lib/build-info.ts`](pwa/src/lib/build-info.ts) の `BUILD_VERSION` を bump up する**。

画面左上の AMD OS ロゴ直下に表示され、まさが見た瞬間に「リロード効いてるか」「Service Worker / CDN cache が新しい build に切り替わったか」を判別できるようにする運用ルール。

### bump up の粒度

- **patch (v0.3.0 → v0.3.1)**: 細かい修正 / UI 微調整 / バグ fix / デバグ目的の確認 / 既存機能の挙動変更 / リファクタ / UI 簡略化
- **minor (v0.3.0 → v0.4.0)**: **本物の新機能追加 / 新画面追加 / 新 DB テーブル追加**。 既存機能の整理は patch 止まり
- **major (v0.3.0 → v1.0.0)**: 大きな仕様変更 / アーキテクチャ刷新

**迷ったら patch**。 minor は「これは新機能と言える」と確信が持てる時だけ (= まさ #89 確定 2026-05-26 で patch 中心の運用に修正)。 audience 廃止 / リファクタ / UI 整理は patch。
**bump up を忘れたまま deploy しない**。

### キャッシュ問題の判別フロー

まさが「変更が反映されてない」と言ったとき:

1. **画面左上の version 表示を確認**
2. version が**新しい** → コードは反映されてる、表示ロジック側の問題 (filter / fetch / 別 snapshot 参照など)
3. version が**古い** → SW / CDN / ブラウザキャッシュ。DevTools → Application → Service Workers → Unregister + Clear site data + ハードリロード (Cmd+Shift+R)

---

## ⚠️ Vercel deploy 運用（2026-06-12 まさ更新: 原則ノンストップ）

**本番反映 = main push (Vercel Git 自動 deploy)。原則、push・deploy 完了まで止めずに進める (事前確認で止めない)。**
まさは他作業の合間にしか見に来れないため、そこで止めると deploy 完了までさらに待たせることになる。

- 実装 → `tsc --noEmit` → `npm run build` → local commit → そのまま deploy.sh で push まで実行する。
- deploy bundle (含める変更 / 除外 / local build・test 確認結果 / rollback・本番確認方法) は**事後報告**としてチャットに残す。
- **例外として事前承認を取るもの (2026-06-17 まさ確定で縮小)**: 既存業務導線 (FEATURE_REGISTRY) の削除・置き換え、まさが明示的に「確認してから」と言った作業 **のみ**。
  - **DB migration / DDL (テーブル変更・新規) と、本番データの書き込み・backfill は事前承認不要 = 確認せず進める。** まさ発言 (2026-06-17): 「このルール (DDL と本番への調達データ書き込みは事前承認が要る) は定めた記憶がない。毎回確認されるんだけど、確認せずに進めてほしい。ルール書き換えておいて」。
  - 真に破壊的な操作 (DROP TABLE / 大量 DELETE / `rm -rf` / `git push --force` 等) は引き続き `AGENTS.common.md` の破壊的操作の例外に従う。DDL の追加・列追加・通常の insert/update はこれに当たらない。
- てにをは、微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつ push する運用は禁止。複数成果を束ねて1回で push する。
- workerは local build / lint / static check / スクショ / ローカル確認 + local commit で止めない。PWA本番反映対象なら、そのまま `deploy.sh` 経由で push・Vercel build監視・本番確認まで進める。
- 「deploy / push / stage はしていない」は、まさが明示的に停止を指示した場合、真に破壊的な操作、またはdeploy scriptのhard-stopを除き未完扱い。
- 既存 dirty がある場合も同じ。**「別件の未コミット差分があるので push/deploy していない」は禁止**。今回の対象ファイルだけを明示して stage / commit し、既存 dirty は戻さず `除外した差分` として事後報告する。`git add .`は禁止。
- disposable clean cloneでpush・deployした場合、**正規checkoutが古いままでも正常、とは扱わない**。終了前に正規checkoutで`git fetch origin main`とahead/behindの実数確認を行う。安全にfast-forwardできるなら同期し、できない場合はdeploy完了とcheckout同期未完を分け、後者をP0の未解決として残す。「behindは常態」とHANDOFFへ書くことは禁止。
- ローカルサーバー起動やブラウザ目視を、dirty 切り分けや push/deploy の代替にしない。まさが「ローカルでテストするのをやめて」と言った場合は即停止し、以後そのセッションでは追加のローカル確認を増やさない。

## ⚠️ Vercel デプロイコマンド（正本）

```bash
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

`AMD_OS_VERCEL_DEPLOY_APPROVED=1` は旧事前確認運用の復活ではなく、deploy scriptを非対話で最後まで走らせるための実行スイッチ。まさ確認待ちの理由にしない。

このスクリプトは (2026-06-12 push 方式に全面改修):
1. main checkout / clean tree / origin/main 整合を検査 (main 以外・未コミット tracked 変更・origin 未取り込みは hard-stop)
2. rollback guard (`deploy-version-guard.cjs`) で BUILD_VERSION の巻き戻り deploy を阻止
3. `git push origin main` → Vercel 自動 production build 発火
4. 新しい production deployment が Ready になるまで polling (最大 15 分)
5. 完了 → macOS 通知 (Glass 音) / 失敗 → Basso 音

**直接 `npx vercel` を叩かない (CLI deploy 全面廃止)**。生 `git push origin main` も、PWA 本番に影響する変更では使わずこのスクリプトを通す (検査と通知が飛ぶため)。

**main 以外の branch push は build されない** (`pwa/vercel.json` の `ignoreCommand: [ "$VERCEL_GIT_COMMIT_REF" != "main" ]`)。誤って branch を push しても本番・preview とも作られないが、そもそもブランチ作成自体が全面禁止。

ロールバック方法（緊急時のみ CLI 使用可）:
```bash
npx vercel promote <デプロイID> --scope armada0130 --yes
# デプロイIDは vercel ls --scope armada0130 で確認
# 恒久復旧は revert commit を main に push して行う (本番と main の乖離を残さない)
```

---

## ✅ `/tasks` / agent task helper は廃止済み

`/tasks` 画面と `npm run agent:tasks` helper は 2026-06-21 に廃止済み。Codex / Claude Code のえいみは、会話中に発生した新しい実装・調査・docs・確認タスクを `tasks` table へ新規登録しない。

- 既存 `tasks` table と `/api/tasks` は、cockpit legacy kanban / H-1 next action 互換のため残す。
- H-1 の `POST /api/task-calendar/register-tasks` は残すが、通知・Slack nudge は `/tasks` ではなく対象 PJ cockpit へ戻す。
- 詳細は `pwa/manual/2-7-task-management.md` と `pwa/spec/5-7-task-management-current-spec.md`。

---

## 🚫 Anthropic API 直叩き封鎖 — 背景抽出は Codex automation 一本 (2026-07-01 まさ確定)

まさ確定 2026-07-01:「定額トークンが余ってるのに Anthropic API 従量課金を使う意味がない。背景抽出は Codex automation (定額枠) に一本化しろ」。

- PWA/Vercel 側で `new Anthropic()` を**直接書かない**。必ず共通ファクトリ [`src/lib/anthropic-client.ts`](pwa/src/lib/anthropic-client.ts) 経由にする。
  - `getBackgroundAnthropic(caller)` = cron / routine / 背景 lib 用。`ALLOW_PWA_LLM_CRONS !== "1"` のとき **throw** する (= デフォルト封鎖)。呼び出し側 (route) は `BackgroundAnthropicDisabledError` を catch して `{ ok:true, disabled:true }` を返す。
  - `getInteractiveAnthropic()` = まさが能動操作する対話 UI 用 (つくよみチャット / 月報 narrate / PL hearing / report 生成 等)。封鎖しない。
- 背景 L2 抽出の唯一経路は **Codex automation** (`~/.codex/automations`)。受け皿は D-6〜D-14 / W-1 / H-1 が ACTIVE 稼働済み。PWA cron route は封鎖されても抽出は死なない。
- `ALLOW_PWA_LLM_CRONS=1` は Vercel 本番 env に**設定しない**。どうしても PWA 側で従量課金 LLM を使う必要が出たときだけ、owner (まさ) 承認の上で明示する。
- 新しく LLM を使う route/lib を足すときも、背景実行系なら必ず `getBackgroundAnthropic()` 経由にする。`new Anthropic()` をベタ書きすると、うっかり課金経路が復活する。
- 背景 cron を退避した履歴は [`vercel.disabled-crons.json`](pwa/vercel.disabled-crons.json)。vercel.json に LLM cron を戻さない (`pwa/design/L2_DATA.md` の「PWA/Vercel LLM cron 禁止」も参照)。

---

## ⚠️ DDL適用（Supabase Management API 経由）

```bash
python -X utf8 scripts/apply_ddl.py  # cwd=pwa/ scripts/migrations/NNN_name.sql
```

- `.env.local` の `SUPABASE_ACCESS_TOKEN`（sbp_…）を使用
- **User-Agent ヘッダー必須**（Cloudflare 1010 回避）
- migrations は `pwa/scripts/migrations/NNN_name.sql` に必ず残す
- supabase-js REST + `rpc("exec_sql")` は存在しない。SQL Editor 手動依頼もNG

---

## 🚨 列名・テーブル名は想像で書かない (`db_schema.md` を必ず参照)

新規 cron / API route / Edge Function / GAS 関数で Supabase テーブルを叩く前に、
**[`design/db_schema.md`](pwa/design/db_schema.md) を必ず grep して実際の列名を確認**してから
select / filter / insert / upsert を書くこと。

過去事故: `member_activities` の列を `code_name` / `created_at` / `activity_text` / `kind` と
想像で書いたら全部間違ってて (実体は `member_id` / `extracted_at` / `content_preview` /
`source`)、PostgREST 42703 エラーで `actsRes.ok=false` → 入力ゼロで進行 → 他人の活動が
本人のものとして LLM 抽出される事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。

**運用**:
- DDL を変更したら同じ commit で `python3 -X utf8 scripts/dump_schema.py` を実行して `design/db_schema.md` を再生成 → commit に含める
- 他の md (HANDOFF / 設計 md) で「テーブル X の列 Y」を書くときも、必ず `db_schema.md` から正しい列名をコピーする (= 二次情報を参照しない)
- えいみが新セッション開始時に「列名を書く必要があるなら必ず先に `db_schema.md` を grep する」セルフルールを徹底

`db_schema.md` は自動生成 (Supabase Management API → information_schema.columns)。
手動編集禁止 (= 次回再生成で消える)。

---

## 🧭 まさえいMTG (D-6 Strategy Signals dialogue) の始め方

> **呼び方ルール (まさ #7 2026-05-24 確定)**: このセッションは「**まさえいMTG**」と呼ぶ。
> 「まさ × えいみ経営会議」「経営会議」とは書かない (= かる/ちこ など、そこに入っていない
> メンバーが疎外感を持つ「経営会議」表現を避けるため)。チーム外の人が読んだ時に「2 人で
> 議論したセッション」だと分かり、かつチームへの提案前提だと伝わる表現にする。

**まさが claude/codex セッションで「まさえいMTGやろう」「経営シグナル見よう」「signals レビュー」のいずれかを言ったら、即この手順に入る** (= 再起動不要、新セッション初回でもOK)。

詳細仕様: [`design/project_strategy_signals.md`](pwa/design/project_strategy_signals.md) の「議論セッション運用」セクション。

### えいみがやる手順

1. **candidate を全 PJ 横断 read** (= service_role REST または直 SQL):
   ```
   GET /rest/v1/project_strategy_signals
       ?select=signal_id,project_id,ym,signal_type,impact_level,decision_state,title,summary,signal_date,confidence
       &status=eq.candidate
       &order=impact_level.desc,signal_date.desc,created_at.desc
   ```
   - impact: `critical` > `high` > `medium` > `low` の順
   - 同 impact 内は signal_date / created_at で新しい順

2. **最初の 1 件を提示** (= 全部一気に出さない、1議題ずつ):
   - PJ コードネーム + signal_type chip + impact chip + title 1行 + summary 2-3行
   - 「これどう?」と短く問う

3. **まさの反応に応じて API を叩く** (= その場で、後でやらない):
   - `進める` / `これで確定` / `decided` → `POST /api/strategy-signals { action:'confirm', signal_id, decision_state:'decided' or 'executing', confirmed_by:'まさ' }`
   - `違う` / `不採用` / `保留` → `action:'reject'`
   - `こう修正` → `action:'update'` で title/summary/impact 等を差し替え
   - `これ別 signal で残したい` → `action:'create', status:'confirmed', decision_state:'decided'`

4. **次の議題へ。1セッションで 5-10 件目安**、まさが「これで終わり」と言うまで続ける

5. **セッションの最後に議論ログを保存** (= PJ単位、会社全体は p00):
   ```
   POST /api/dialogue-meeting
   { project_id, summary_short, decided[], progress[], next_actions[], risks[],
     related_signal_ids: [confirm/create した signal_id 全部] }
   ```
   - cockpit の MTGサマリ欄に自動で並ぶ (`source_kinds='dialogue'`)
   - PJ 横断で議論した場合は、関連 PJ ごとに 1 行ずつ insert (= まとめ1行でなく)
   - `summary_short` には「議論の背景 + 何を話したか」を 2-4 文で書く。1 行で済ませない
   - `decided[]` の項目は「**提案**」のニュアンスで書く (= まさえいMTGで議論して出した提案、チームに相談する前提)。「決定」「決まったこと」と書かない

6. **議事録の narrative 化** (= 5 の直後):
   ```
   POST /api/dialogue-meeting/narrate
   { meeting_id: "dialogue:{project_id}:..." }
   ```
   - Sonnet 4.6 が raw 配列を `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の Markdown narrative に書き直し
   - まさえいMTGの `✅決まったこと` は「チームへ出す提案として固まったこと」の意味で書く。会社として正式決定済みと誤読される表現は避ける
   - `project_meeting_summaries.narrative_md` に保存される
   - cockpit の MTGサマリ詳細では narrative が主表示、raw は折りたたみ「元データ」へ
   - 全件まとめて narrate するなら `{ all: true, limit: 20 }` を叩く

### 認証

- まさ session でログイン済みなら admin auth で通る
- セッション外から叩くなら `Authorization: Bearer ${CRON_SECRET}` (= `.env.local` の `CRON_SECRET`)

### candidate が空 / 古いとき

`status='candidate'` 行が無い、または `signal_date` が 1 週間以上前なら、えいみが OS を横断 read して新規 candidate を `proposed` で積んでから議論を始める (= daily routine と同じ動作を手動でやる)。

横断 read 対象: `monthly_reports` / `project_meeting_summaries` / `tsukuyomi_nudge_queue` / `billing_cycles` / `project_xrl_log` / `atlas_signals` / `amd_management_score_snapshots` / `amd_management_score_evidence` (= p00 用)。

### よくある間違い

- ❌ 議題を 10 件一気に箇条書きで出す → 1 件ずつ会話形式で
- ❌ まさが返事する前に勝手に confirm する → まさの明示判断後
- ❌ 議論ログ保存を後回しにする → セッション終了時に必ず叩く
- ❌ p00 を忘れる → AMD 全体の議題 (Management Score / freee / 月次運用) は p00
