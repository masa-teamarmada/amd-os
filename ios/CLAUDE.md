# CLAUDE.md — AMD OS iOS (Swift / SwiftUI)

このリポジトリで作業する Claude (Mac 側) が **必ず守る** ルール。

---

## 🚨 最重要: 正本は GitHub、Drive は廃止済み

- **正本**: `github.com/masa-teamarmada/amd-os-ios`
- **Mac での作業場所**: `~/dev/amd-os-ios`（Drive 外のローカルクローン）
- **Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` は廃止済み。**
  - 参照しない。書き込まない。同期トラブルで壊れる前提なので信用できない。

すべての作業は `~/dev/amd-os-ios`（または worktree）で行い、
GitHub の `main` ブランチに push する。

---

## 🚨 セッション開始時に必ず実行する 4 ステップ

エラー閉じ・別マシン作業・別セッションの未 push commit を **最初に検知** するため、
以下を毎セッション開始時に必ず行う:

```sh
cd ~/dev/amd-os-ios

# 1. リモート状態を取り込む
git fetch --all --prune

# 2. ローカルにあって push されてない commit を検知
git log --branches --not --remotes --oneline

# 3. ローカル全ブランチの先端を確認
git branch -a

# 4. 作業ツリーが綺麗か
git status -s
```

**(2) の出力が空でなければ、push されてない作業が必ずある**。
内容を見てから main に取り込むこと。**「未 push commit を見つけたら勝手に消さない」**。

---

## 🚨 main を更新したら必ずハンドオフを書く

iOS 側 (Swift) の更新内容は、Win 側のえいみが Android アプリに反映する。
**main ブランチに変更を入れた / TestFlight build を上げた直後は、
セッションを終わる前に必ず以下の 2 つを実行する。**

### 1. `HANDOFF_ios_to_android.md` を更新（or 新規作成）

書く内容（テンプレ）:

```markdown
# iOS → Android ハンドオフ

最終更新: YYYY-MM-DD HH:MM (JST)
対応 iOS commit: <SHA> "<commit message>"
TestFlight build: <番号> (該当する場合)

## 今回の変更スコープ
- 追加した機能 / 画面
- 変更した機能 / UI
- 削除した機能

## UI 仕様
## データモデル / 永続化
## 外部 API / Supabase 契約
## 検証済み挙動
## Android 実装時の注意 / 差異

## Android 反映状況
（Win 側のえいみがここを追記する）
```

### 2. GitHub にも push する

```sh
git push origin main
git push origin --tags  # TestFlight タグを切った場合
```

---

## 📂 リポジトリ構成

| 場所 | 役割 | 信頼性 |
|------|------|--------|
| `github.com/masa-teamarmada/amd-os-ios` | **正本**。Mac/Win 双方が参照する | ✅ 高 |
| `~/dev/amd-os-ios` | Mac での実作業ローカルクローン | ✅ 高 |
| `~/dev/amd-os-ios/.claude/worktrees/...` | 一時的な git worktree | ✅ 高 |
| `<Drive>/共有ドライブ/claude/AMD_OS/amd-os-ios/` | **廃止**。参照禁止 | ❌ |

---

## 📌 必読ドキュメント（読む順）

セッション開始時、以下を **この順** で読む。**全て GitHub 管理下、Drive ではない。**

1. **`CLAUDE.md`** ← ここ。ルール・運用フロー・落とし穴
2. **`AGENTS.md`** — エージェント運用メモ（必読リストの要約）
3. **`DESIGN.md`** ⭐ — **全画面・全機能の正本仕様。何が在るべきかはここ**
4. **`HANDOFF.md`** — TestFlight 配布、ブランチ運用、現時点の作業状態
5. **`HANDOFF_ios_to_android.md`** — 直近の iOS → Android 引き継ぎ（毎 commit ごとに更新）
6. **`HANDOFF_PROMPT.md`** — 次セッションを始めるためのプロンプトテンプレ
7. **`BUGS.md`** — 既知バグと再発防止メモ
8. **`DEBUG.md`** — デバッグ手順
9. **`TESTFLIGHT_WORKFLOW.md`** — TestFlight 配布手順
10. **`project.yml`** — XcodeGen 設定

各 md は `CLAUDE.md` から辿れる構造。新規 md を作ったら必ずここに追記する。

---

## 🔁 毎回の作業フロー

```
[Mac] セッション開始時の 4 ステップ実行（未 push commit 検知）
  ↓
[Mac] ~/dev/amd-os-ios で Swift コード編集
  ↓ git commit（**機能単位で小まめに**、エラー閉じ対策）
[Mac] git push origin <作業ブランチ>（**毎 commit 後に push**）
  ↓
[Mac] main へ取り込み（fast-forward / merge）
[Mac] git push origin main
  ↓
[Mac] HANDOFF_ios_to_android.md を更新
[Mac] DESIGN.md を更新（画面・機能変更があれば）
  ↓ git push
[Win] えいみが GitHub から pull して Android 実装
  ↓ 実装後
[Win] HANDOFF_ios_to_android.md の「Android 反映状況」を追記して push
```

**ポイント**: 「commit したらすぐ push」を徹底する。これだけでエラー閉じ時の作業消失を防げる。

---

## ⚠️ 過去のハマり: Drive 同期トラップ（参考）

Drive 廃止前は次の事故が起きていた:

- 同じファイルを複数マシンが書き換えると Drive が片方を 0 byte にして
  もう片方を `名前 2.swift` で残す。`.git/HEAD`, `.git/index`, `project.yml`,
  `HANDOFF.md`, edge function `index.ts` などが繰り返し被害を受けた。
- Xcode が `名前 2.swift` を Project Navigator に拾い、`project.pbxproj` に
  ゴミエントリが入る。

→ いまは **Drive 廃止 + GitHub 正本** に統一したのでこの罠は基本踏まない。
   ただし古い Drive クローンが残っているマシンでは絶対に作業しない。

---

## ⚠️ 過去のハマり: 未 push commit による「巻き戻り」事故（2026-04-28）

エラー閉じしたセッションが claude/* ブランチに 9 commit (フロートボタン /
支払通知書 layout polish 等) を残していたが GitHub に push されていなかった。
別セッションが origin/main を起点にビルド・実機反映してしまい、
ユーザーから「機能が巻き戻ってる」報告が出た。

**再発防止**:
- 上記「セッション開始時の 4 ステップ」で未 push commit を必ず検知
- 各 commit 直後に `git push origin <branch>` を徹底
- 「実機ビルド前に、自分の HEAD が origin/main より進んでないか確認」

詳細は `BUGS.md` を参照。
