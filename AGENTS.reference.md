# AGENTS.reference.md — amd-os の詳細手順と経緯

`AGENTS.md` は常時読む最小ルール。このファイルは **該当する作業のときだけ** 対応項目を読む。
共通ルール（main一本、branch禁止、dirty、fetch/behind、spawn_task 禁止など）は
`/Users/masa/projects/AGENTS.common.md` が正本。ここには amd-os 固有の手順と、ルールの根拠になった事故だけを置く。

## 参照の選び方

| 作業 | 読む項目 |
|---|---|
| セッション開始 | セッション開始時の同期4ステップ |
| commit / push | push 直前の fetch |
| branch や worktree を見つけた | branch 禁止の防止層 / 過去事故 |
| 他プラットフォームへ移植 | プラットフォーム間の引き継ぎ |
| 詰まった・原因不明 | 過去のハマり |
| handoff する | OSマニュアル同期ゲート |
| 経営会議 | 経営会議の始め方 |

## ディレクトリ構成

```
amd-os/
├── AGENTS.md          ← 概要・アーキテクチャ・常時ルール
├── AGENTS.reference.md ← この文書
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

### 過去事故 (2026-05-30)

AI が自動で `feat/bzm-textbook` を切り、以降の複数セッションがその上に BZM 以外の作業（cockpit / payment / design_log / ERS）まで無関係に積んだ。結果 main と乖離し、畳む時に 15 ファイルのコンフリクト予測 +「今どのブランチ?」混乱が発生。**ブランチのメリット（main 隔離）はこのリポの運用では薄く、デメリット（乖離・混乱・巨大コンフリクト）だけが膨らむ**。main 一本なら全セッションが同じ場所を見る。

### 過去事故 (2026-06-12) — ルール違反のブランチ散乱で正本が「消えた」

Codex セッション群が本ルールに違反して `codex/*` ブランチを 30 本以上作成し、本番ライン (v0.16.29、L2 の D/M/H 再ナンバリング正本を含む 64 commit) が **未 push のローカルブランチに幽閉**された。main は v0.15.1 で停止。まさが OS 画面で確認済みの正本 (spec 3-1 の L2 リネーム) が「巻き戻った」ように見える事故になった。復旧は main への fast-forward + push で完了。**この事故を最後にブランチ作成を全面禁止とした。**

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
