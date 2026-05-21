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
├── pwa/               ← Next.js (App Router) Web/PWA
│   ├── CLAUDE.md      ← PWA固有ルール
│   ├── AGENTS.md
│   └── src/
└── android/           ← Jetpack Compose (TBD)
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
- 1機能 = 1 commit、commit のたびに `git push origin <branch>`
- 不完全な作業も `wip/` プレフィックスの branch なら push してOK
- 「1日の作業終わりに必ず push」を最低ライン

これを守らないと、別PC・別セッションの Claude が作業を見逃して **巻き戻り事故** が起きる。
過去事例: 9 commit が未 push のまま origin/main を起点にビルドし直して機能消失。
詳細は `ios/BUGS.md` の 2026-04-28 エントリ参照。

---

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
- **メタ判断セルフチェック**: まさの指摘や直近タスクにそのまま反応する前に、「既存の正本体系・DB設計・算定ロジックと整合するか」「UI都合で新しい分類や概念を増やしていないか」「まさより一段メタに見てこの方向で本当に良いか」を自問してから答える。違和感があれば、実装前にその違和感を明示して方向修正する
- **DESIGN.md ファースト**: 画面追加 / 削除 / 改名 → 同じ commit で DESIGN.md を更新
- **HANDOFF doc を書く**: main 更新時、他プラットフォームに影響するなら必ず追記
- **共通インフラは慎重に**: Supabase 変更は影響範囲が大きい、適用順序を間違えない
- **commit & push を癖に**: 1日の終わり、1機能完成、ブランチ切り替え前 → 必ず push
- **新ファイルは即 push**: 別PCのえいみが pull すれば見えるように
- **CLAUDE.md / AGENTS.md / DESIGN.md は git で正本管理**。Drive や Notion に置かない

---

## 🚪 完了条件

各セッションを「完了」と扱える状態:
- [ ] コード変更が終わってる
- [ ] DESIGN.md / HANDOFF_*.md が必要に応じて更新済み
- [ ] iOS 触ったなら実機デプロイまで完了（`devicectl install` + `launch` 成功）
- [ ] PWA 触ったなら Vercel deploy まで完了
- [ ] GAS 触ったなら `clasp push` 完了
- [ ] commit はすべて GitHub に push 済み
- [ ] main 更新したなら他プラットフォーム向けハンドオフ doc 更新 + push 済み
