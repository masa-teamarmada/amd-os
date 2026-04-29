# AMD OS iOS TestFlight Workflow

> See also: [CLAUDE.md](CLAUDE.md) — 最重要ルール / [HANDOFF.md](HANDOFF.md) — 現在の配布状況 / [DESIGN.md](DESIGN.md) — 全画面の正本仕様

## 基本方針

- `main` は TestFlight に配ってよい安定版だけを置く
- `develop` は日々の開発用に使う
- 新機能や修正は `develop` か、その子ブランチで進める
- TestFlight に出したいタイミングだけ `develop` から `main` へ戻す

## 今回の初期セットアップ

- `2026-04-25` 時点で、`amd-os-ios` 配下に専用 git repo を作成済み
- 現在の安定版は `0.1.0 (19)`
- `main` に TestFlight 用 commit が入っている
- `develop` は `main` を fast-forward 済みなので、いまは `main` と `develop` が同じ commit を指している
- つまり「いま `develop` にいる」のは問題なく、ここから新規開発を始めてよい

## まず覚えること

- 配布済みの正本は `main`
- 次の作業場所は `develop`
- `develop` で開発を始めた瞬間から、`main` と `develop` は分岐していく
- 次回 TestFlight に出すときは、`develop` のうち安定した内容だけを `main` に入れる

## いまの運用

1. `main`
   現在の安定版。TestFlight 候補。
2. `develop`
   次の機能開発を進めるブランチ。

## 日々の開発

1. `develop` にいることを確認する
2. 必要なら `develop` から作業ブランチを切る
3. 実装・実機確認を行う
4. 安定したら `develop` に戻す

### いまのおすすめ

- しばらくは `develop` でそのまま開発してよい
- 大きい変更を触るときだけ `codex/...` のような子ブランチを `develop` から切る
- 1機能ごとに実機確認してから `develop` に戻す

## TestFlight 配布

1. `main` に切り替える
2. `develop` で安定した変更だけを `main` に反映する
3. `CURRENT_PROJECT_VERSION` を上げる
   `project.yml` と `AMDOS.xcodeproj/project.pbxproj` の両方を更新する
4. 実機で install / launch まで確認する
5. Xcode で Archive して App Store Connect に upload する
6. App Store Connect の TestFlight で内部テスターへ配布する

### 実運用の例

1. 普段は `develop` で機能追加する
2. 配りたい状態になったら `main` に切り替える
3. `develop` の内容を `main` に反映する
4. `CURRENT_PROJECT_VERSION` を 1 つ上げる
5. Archive / Upload する
6. TestFlight で配布する
7. 配布が終わったら `develop` に戻る

## 緊急修正の流れ

1. いま TestFlight に出ている不具合を最優先で直すときは `main` から直す
2. build 番号を上げて TestFlight を更新する
3. 修正済み `main` を `develop` に戻して差分を揃える

## build番号ルール

- `CFBundleShortVersionString`
  人間向けの見た目の版。必要なときだけ上げる
- `CURRENT_PROJECT_VERSION`
  TestFlight に再アップするたび必ず増やす番号
- `CURRENT_PROJECT_VERSION` を上げるときは、必ず `project.yml` と `AMDOS.xcodeproj/project.pbxproj` の両方を更新する

## 注意

- iOS 修正は `BUILD SUCCEEDED` だけで完了にしない
- 必ず `devicectl` で install / launch まで確認する
- 配布中に緊急修正が必要になったら、`main` で直してから `develop` にも戻す
- 「どのブランチにいるか分からない」ときは、配布作業なら `main`、通常開発なら `develop` を見る
