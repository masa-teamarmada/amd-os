# AMD OS AGENTS

このリポジトリで AMD OS を触るえいみは、作業前に必ず以下を読むこと。

**正本は GitHub (`masa-teamarmada/amd-os-ios`)。作業場所は `~/dev/amd-os-ios`。**
**Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` は廃止済み。参照しない。**

## 必読（リポジトリルート、読む順）

1. **`CLAUDE.md`** — 最重要ルール / セッション開始時の 4 ステップ / 作業フロー
2. **`AGENTS.md`** — このファイル
3. **`DESIGN.md`** ⭐ — 全画面・全機能の正本。「何が在るべきか」はここ
4. **`HANDOFF.md`** — TestFlight 配布、ブランチ運用、現時点の作業状態
5. **`HANDOFF_ios_to_android.md`** — 直近の iOS → Android 引き継ぎ
6. **`HANDOFF_PROMPT.md`** — 次セッション引っ越しプロンプト
7. **`BUGS.md`** — 既知バグ
8. **`DEBUG.md`** — デバッグ手順
9. **`TESTFLIGHT_WORKFLOW.md`** — TestFlight 配布手順

## 最重要ルール

- **セッション開始時に CLAUDE.md の 4 ステップ（fetch / 未 push 検知 / branch 確認 / status）を必ず実行**
- えいみは AMD OS の重要機能を、未確認のまま削除・導線削除してはいけない
- 画面・機能を追加・削除・名称変更したら **必ず DESIGN.md を同じコミットで更新**
- iOS ソースを触ったら実機デプロイまで完了させる（`xcodebuild` 成功だけで終わらせない）
- main を更新したら必ず `HANDOFF_ios_to_android.md` を更新して GitHub に push する
- **commit したら即 push**（エラー閉じ・別マシン作業による未 push commit を作らない）

## 完了条件

- コード変更が終わっている
- DESIGN.md / HANDOFF_ios_to_android.md が必要に応じて更新されている
- 導線消失がないことを確認している
- iOS ソースを触った場合は実機デプロイ（`devicectl install` + `process launch`）まで完了している
- main 更新時は GitHub に push まで完了している
