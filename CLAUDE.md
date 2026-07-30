# CLAUDE.md — AMD OS Monorepo

このリポジトリで作業する Claude / えいみが **必ず守る** ルール。
ここはモノレポのルート。プラットフォーム固有のルールは各サブディレクトリの `CLAUDE.md` に書く。

---

## 🚨 ここはモノレポ — 大原則

- **正本リポ**: `github.com/masa-teamarmada/amd-os` （これ唯一）
- **推奨パス**: 現行 workspace では `~/projects/AMD/amd-os/` に clone する
- 旧スタンドアロンリポ（`amd-os-ios` / `amd-os-pwa` / `amd-os-android` / `amd-os` GAS版）は **archive 済 / 廃止予定**。**参照しない・clone しない**
- 旧クローンが残ってる PC では `~/.Trash/` に退避

---

## 📂 構成

```
amd-os/
├── CLAUDE.md          ← この文書（モノレポ全体ルール）
├── AGENTS.md          ← 概要・アーキテクチャ
├── gas/               ← Google Apps Script (freee/Slack 連携、外部→Supabase ハブ)
│   ├── CLAUDE.md      ← gas固有ルール
│   └── AGENTS.md
├── ios/               ← Swift / SwiftUI ネイティブアプリ
│   ├── CLAUDE.md      ← iOS固有ルール
│   ├── AGENTS.md
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
│   ├── CLAUDE.md      ← PWA固有ルール
│   ├── AGENTS.md
│   └── src/
├── android/           ← Jetpack Compose (TBD)
└── services/          ← pwa/ios/macos/androidに属さない独立デプロイの補助サービス群
    └── project-share/ ← PJ関係者へパスワード認証のみでファイル共有するVercelサービス
        ├── README.md  ← 汎用機能とPJ別インスタンスの境界
        ├── SPEC.md    ← 恒久仕様（認証・Blob・デプロイモデル）
        ├── vsx/       ← VSX(香川大学/AgVenture Lab)向けPJ別インスタンス
        ├── cx/        ← CX向け汎用ファイル共有
        ├── se/        ← SE向け汎用ファイル共有
        ├── sx/        ← SX向け汎用ファイル共有
        ├── zmp/       ← ZMP向け汎用ファイル共有
        └── kute/      ← KUTE(工学院大学)向け汎用ファイル共有
```

---

## 🚨 セッション開始時の 4 ステップ（全プラットフォーム共通）

エラー閉じ・別マシン作業・別セッションの未push commit を **最初に検知** するため、
毎セッション開始時に必ず実行:

```sh
cd ~/projects/AMD/amd-os

# 1. リモート状態を取り込む
git fetch --all --prune

# 2. ローカルにあって push されてない commit を検知（全ブランチ横断）
git log --branches --not --remotes --oneline

# 3. ローカル全ブランチの先端を確認
git branch -a

# 4. 作業ツリーが綺麗か
git status -s
```

**(2) の出力が空でなければ、push されてない作業が必ずある**。
内容を見てから取り込むこと。**「未 push commit を見つけたら勝手に消さない」**。

---

## 🚨 commit したら即 push（最重要ルール）

- 機能完成まで push を待たない
- 1機能 = 1 commit、commit のたびに `git push origin main`
- 「1日の作業終わりに必ず push」を最低ライン
- **push 直前に必ず `git fetch origin main` して origin/main の直近 commit を見る** — 複数 worktree・複数セッション (司令塔+worker) が並行稼働しているため、自分が知らない間に他セッションが同じファイル・同じストリームを更新している可能性が高い。確認せずに「未実施」「未反映」等の状態記述を push すると、他セッションが既に完了させた事実を古い記述のまま固めてしまう (2026-07-13 PF-021 セッションで発生、訂正 commit が追加で必要になった)

これを守らないと、別PC・別セッションの Claude が作業を見逃して **巻き戻り事故** が起きる。
過去事例: 9 commit が未 push のまま origin/main を起点にビルドし直して機能消失。
詳細は `ios/BUGS.md` の 2026-04-28 エントリ参照。

---

## 🚫 ブランチ作成は全面禁止 — このリポは main 一本 (2026-06-12 まさ確定)

- **Claude / Codex / えいみは、いかなる理由でもブランチを作らない。main で直接 commit & push する。**
- 旧ルールにあった `wip/` 短命ブランチの例外も **廃止**。例外は無い。
- Claude Code / Codex のデフォルト挙動に「default ブランチで作業を始めたら branch を切る」「worker ごとに branch を切る」があるが、**このリポでは絶対に従わない**。
- 長期の大物（教科書 md / 設計ドキュメント等）も **main 上で直接育てる**。途中状態が main にあっても PWA build は壊れない（md・表示物が中心）。
- 唯一の例外: **まさがそのセッションで明示的に「ブランチ切って」と言った時だけ**。過去ログや慣習からの類推は例外にならない。
- 既存の `codex/*` 等の残存ブランチに **新しい commit を積まない**。価値ある未マージ作業は main に畳んでから捨てる。
- PWA の本番反映は `main push = Vercel 自動 deploy`（`pwa/CLAUDE.md` 参照）。**main に無いものは本番に存在できない** — これがこのルールの機械的な裏付け。
- **Codex Desktop でこの repo を target にした Local 子タスク作成・UI の Handoff は使わない。** 作業者へこのルールが渡る前に、アプリ側が正本 checkout へ `codex/<thread-id>` branch を作って切り替えることがある。分担は同じ main、または main の disposable clean clone で行う。
- 防止層は、repo の `.codex/config.toml` にある `multi_agent = false` と、`.githooks/reference-transaction` の branch 作成拒否。clone 後は `bash scripts/install-main-only-git-hook.sh` を1回実行する。
- Codex で「ブランチを切り替えるには変更をコミットしてください」アラートが出たら **キャンセルする**。`コミットしてブランチを切り替える` は押さず、branch / dirty / worktree / unpushed commit を監査してから main を復旧する。

### dirty はブランチ作成理由にならない (2026-07-07 まさ再確定)

- このリポでは dirty が残っていること自体は通常状態。**dirty があるから branch / worktree を切る、は全面禁止**。
- dirty を見つけたら、新しい枝を増やす前に `codex/*` / worker worktree / main 未反映 commit を棚卸しし、owner/action/deadline を付ける。
- **dirty を理由に stage / commit / push / deploy を止めない**。既存 dirty は戻さず、今回触った対象ファイルだけを明示して stage する。`git add .`は禁止。
- 最終報告で「別件の未コミット差分があるので push/deploy していない」と書くのは禁止。まさが明示的に止めた場合、真に破壊的な操作、または正規 deploy script の hard-stop 以外で止めたら未完了。
- 実装が必要で root checkout を巻き込みたくない場合でも、`git worktree add -B codex/... origin/main` は使わない。対象差分だけを main に載せるか、どうしても隔離が必要なら main を checkout した disposable clean clone で作業し、closeout で clone 削除候補まで明記する。
- 同じ差分が別 SHA で main に入った一時 branch は `patch-equivalent-main` として扱い、証跡保存後の削除候補にする。「同じ内容だけど浮いている branch」を放置しない。
- closeout では「このセッションで作った branch/worktree: none」または「作ったが削除済み / main に畳み済み」を必ず書く。これが書けない状態は完了ではない。

### 過去事故 (2026-05-30)

AI が自動で `feat/bzm-textbook` を切り、以降の複数セッションがその上に BZM 以外の作業（cockpit / payment / design_log / ERS）まで無関係に積んだ。結果 main と乖離し、畳む時に 15 ファイルのコンフリクト予測 +「今どのブランチ?」混乱が発生。**ブランチのメリット（main 隔離）はこのリポの運用では薄く、デメリット（乖離・混乱・巨大コンフリクト）だけが膨らむ**。main 一本なら全セッションが同じ場所を見る。

### 過去事故 (2026-06-12) — ルール違反のブランチ散乱で正本が「消えた」

Codex セッション群が本ルールに違反して `codex/*` ブランチを 30 本以上作成し、本番ライン (v0.16.29、L2 の D/M/H 再ナンバリング正本を含む 64 commit) が **未 push のローカルブランチに幽閉**された。main は v0.15.1 で停止。まさが OS 画面で確認済みの正本 (spec 3-1 の L2 リネーム) が「巻き戻った」ように見える事故になった。復旧は main への fast-forward + push で完了。**この事故を最後にブランチ作成を全面禁止とした。**

---

## 🧩 services/ — PWAとは別の独立Vercelサービス

`services/` 配下（例: `services/project-share/`）は `pwa/` の Next.js ビルド・デプロイ
パイプラインとは完全に独立した Vercel プロジェクトとしてデプロイする。PWAの
`main` push自動deploy対象とは混同せず、各サービスのREADMEに記載した方法で反映する。
Git連携が未確認のサービスでは、`main` pushだけで反映されたと判断しない。PJ別の秘密値（パスワード・
署名鍵・APIキー等）は、各サービスのVercelプロジェクトの Environment Variables にのみ置き、
リポジトリ内のどのファイルにも書かない。詳細・ビルド手順は各サービスの `README.md` /
`AGENTS.md` を正本にする。

## 🌐 共通インフラ

これらは **全プラットフォーム共通** で1つだけ存在する:

| インフラ | 場所 / 設定 | デプロイ方法 |
|---|---|---|
| Supabase DB schema | `ios/supabase/migrations/` | `npx supabase db push`（worktree から） |
| Supabase Edge Functions | `ios/supabase/functions/` | `npx supabase functions deploy <name>` |
| Supabase project | `nbnhrhybjslbawdukvvk` | dashboard で管理 |

**重要**: schema や EF を変更したら **Supabase 本番に適用してから** クライアント実装に進む。
適用済みの migration を **再適用しない**（CREATE POLICY などは冪等じゃない）。

---

## 🔁 プラットフォーム間の引き継ぎ

iOS が先行実装することが多い。他プラットフォームへ移植するときの流れ:

1. iOS で実装 → `ios/DESIGN.md` を同じ commit で更新
2. iOS の commit を push、main に取り込み
3. `ios/HANDOFF_ios_to_<target>.md` を書く（または既存に追記）
   - 差分・移植先ファイルパス・既適用済みインフラの注意書き
4. push、main に取り込み
5. 他プラットフォーム担当の Claude が pull → ハンドオフ doc を読んで実装
6. 実装完了したら ハンドオフ doc 末尾「反映状況」に commit hash と要点を追記

DESIGN.md は **全プラットフォーム共通の正本**。Android / PWA も書き換えるときは
ここを更新する。

---

## 📌 ぱっと迷ったとき読むファイル

| 知りたいこと | 読むべきもの |
|---|---|
| 全画面の正本仕様 | `ios/DESIGN.md` ⭐ |
| iOS固有の運用 | `ios/CLAUDE.md` |
| PWA固有の運用 | `pwa/CLAUDE.md` |
| GAS固有の運用 | `gas/CLAUDE.md` |
| 既知バグ・事故事例 | `ios/BUGS.md` |
| iOS→他プラ 引き継ぎ | `ios/HANDOFF_ios_to_<target>.md` |
| アーキテクチャ概要 | `AGENTS.md` |
| Project Share (PJ別ファイル共有) 運用 | `services/project-share/README.md` / `services/project-share/SPEC.md` / 各インスタンスの `AGENTS.md` |

---

## ⚠️ 過去のハマり（要点）

詳細は `ios/BUGS.md`。**新規セッションの Claude は最低でも目次を読む**:

- **Drive 同期トラップ**: GitHub リポを Google Drive 配下で運用すると `.git` が壊れる → Drive外で運用
- **未push commit巻き戻り**: 9 commit がローカル滞留 → origin/main 起点ビルドで機能消失
- **xcodebuild の `INSTALL SUCCEEDED` 誤認**: 実機反映してない → `devicectl` 明示インストールが必要
- **祝日判定の再帰暴走**: `isJapaneseHoliday` の前日参照が連休で無限ループ → 非再帰へ
- **Supabase migration 履歴ズレ**: ローカルとリモートの migration version が食い違う → `migration repair` で揃える

---

## 🛠️ Claude / えいみ向けの行動指針

- **モノレポ意識**: 何かを変える前に「これは全プラットフォームに影響する？」を考える
- **macOS移植**: PWAをWKWebViewで包まず、`macos/`の独立SwiftUIアプリとして作る。ナビは「仕事 / 探索 / 管理 / 設定」、PWA route・重要UI・iOS画面の未移植項目は`macos/PARITY.md`から削除しない
- **メタ判断セルフチェック**: まさの指摘や直近タスクにそのまま反応する前に、「既存の正本体系・DB設計・算定ロジックと整合するか」「UI都合で新しい分類や概念を増やしていないか」「まさより一段メタに見てこの方向で本当に良いか」を自問してから答える。違和感があれば、実装前にその違和感を明示して方向修正する
- **DESIGN.md ファースト**: 画面追加 / 削除 / 改名 → 同じ commit で DESIGN.md を更新
- **HANDOFF doc を書く**: main 更新時、他プラットフォームに影響するなら必ず追記
- **共通インフラは慎重に**: Supabase 変更は影響範囲が大きい、適用順序を間違えない
- **会話中の新タスクを `/tasks` に登録しない**: `/tasks` 画面と `npm run agent:tasks` helper は 2026-06-21 に廃止済み。新しい作業はチャット内の実行・handoff・必要な正本 docs へ残し、`tasks` table へ新規登録する運用を復活させない。H-1 next action など既存 API 互換は `pwa/manual/2-7-task-management.md` / `pwa/spec/5-7-task-management-current-spec.md` を参照。
- **commit & push を癖に**: 1日の終わり、1機能完成、ブランチ切り替え前 → 必ず push
- **新ファイルは即 push**: 別PCのえいみが pull すれば見えるように
- **CLAUDE.md / AGENTS.md / DESIGN.md は git で正本管理**。Drive や Notion に置かない

---

## 📖 handoff 時の OS マニュアル同期ゲート

Claude / えいみがこのリポジトリで handoff を実行する時は、Codex の handoff skill と同じ仕様で閉じる。

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

---

## 🧭 まさ × えいみ daily 経営会議 (D-6 Strategy Signals dialogue) のトリガ

まさが**新セッションでも既存セッションでも**以下のいずれかを言ったら、即経営会議モードに入る:

- 「経営会議やろう」「経営会議始めよう」
- 「経営シグナル見よう」「signals レビュー」
- 「strategy signals やろう」

**手順は `pwa/CLAUDE.md` 末尾「🧭 まさ × えいみ 経営会議 (D-6 Strategy Signals dialogue) の始め方」を Read してから動く** (= ここでは概要のみ):

1. `project_strategy_signals` の `status='candidate'` を impact 順で全 PJ 横断 read
2. 1 議題ずつ提示 → まさの判断後に `POST /api/strategy-signals` (confirm/reject/update/create)
3. セッション終了時に `POST /api/dialogue-meeting` で議論ログを PJ ごとに保存 (会社全体は `project_id='p00'`)

daily 議題プリペアは scheduled task `amd-os-management-dialogue-prep` が毎朝 07:00 JST に自動で走り、`project_strategy_signals` に `candidate/proposed` を積む。まさが claude/codex を開いた瞬間には議題が既に揃っている前提。

---

## 🚪 完了条件

各セッションを「完了」と扱える状態:
- [ ] コード変更が終わってる
- [ ] DESIGN.md / HANDOFF_*.md が必要に応じて更新済み
- [ ] iOS 触ったなら実機デプロイまで完了（`devicectl install` + `launch` 成功）
- [ ] macOS 触ったなら `macos/` の生成・`xcodebuild`・起動確認まで完了し、`macos/PARITY.md` の未移植を明記
- [ ] PWA 触ったなら main push (= Vercel 自動 deploy、原則ノンストップ) まで完了
- [ ] GAS 触ったなら `clasp push` 完了
- [ ] commit はすべて GitHub に push 済み
- [ ] main 更新したなら他プラットフォーム向けハンドオフ doc 更新 + push 済み
