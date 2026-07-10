# HANDOFF

## プロジェクト

- AMD OS iOS ネイティブアプリ
- 正本: GitHub `masa-teamarmada/amd-os-ios`
- 作業ディレクトリ: `~/dev/amd-os-ios`（Drive 外のローカルクローン）
- ⚠️ Drive 上の `共有ドライブ/claude/AMD_OS/amd-os-ios/` は廃止済み。参照禁止。

## 必読の他ドキュメント

- `CLAUDE.md` — 最重要ルール / セッション開始時の 4 ステップ
- `AGENTS.md` — エージェント運用メモ
- `DESIGN.md` ⭐ — 全画面の正本仕様
- `HANDOFF_ios_to_android.md` — 直近の Android 向け引き継ぎ
- `BUGS.md` / `DEBUG.md` / `TESTFLIGHT_WORKFLOW.md`

## 現在の作業状態

- 月次ルーティンまわりは安定稼働
- TestFlight 配布の土台を整備済み
- 配布用ブランチは `main`、日々の開発は `develop`
- TestFlight 配布済み: `0.1.0`
  - 既存の内部テストグループ `AMD` に割り当て済み
  - 内部テスターとして実機確認済み: `肥塚恭子` さん 1 名
  - `umemoto@team-armada.jp` は招待送信済み・承認待ち
- 直近のローカル変更（Mac 側 masaiPhone 実機反映済み、TestFlight 未上げ）:
  - フロートボタン（Admin タブ全体）
  - 支払通知書ロジック改修（active メンバー × 全参加 PJ 起点）
  - PJ Config キーボード処理 / 戻るボタン重複解消
  - 月額固定 PJ で予算自動入力
  - DESIGN.md 新設
  - マイページ MS の「当月差分があるもののみ」絞り込み + 月次モーダル同等の差分テキスト

## 実行コマンド（実機反映の標準手順）

### iOS ビルド / 実機反映

```sh
xcodebuild \
  -project ~/dev/amd-os-ios/AMDOS.xcodeproj \
  -scheme AMDOS \
  -configuration Debug \
  -sdk iphoneos \
  -derivedDataPath /tmp/amdos-ios-deploy-deriv \
  CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES \
  build

xcrun devicectl device install app \
  --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 \
  /tmp/amdos-ios-deploy-deriv/Build/Products/Debug-iphoneos/AMDOS.app

xcrun devicectl device process launch \
  --device 22F6F889-985D-5CAF-AFF3-D50D5E80FFA0 \
  --terminate-existing \
  jp.team-armada.amdos
```

- 実機 UDID: `22F6F889-985D-5CAF-AFF3-D50D5E80FFA0` (`masaiPhone`, iPhone 16 Pro)
- Bundle ID: `jp.team-armada.amdos`

### archive / upload (TestFlight)

```sh
xcodebuild \
  -project ~/dev/amd-os-ios/AMDOS.xcodeproj \
  -scheme AMDOS \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/AMDOS-TestFlight-<日付>.xcarchive \
  archive
```

- Xcode Organizer から App Store Connect へ upload

## 未解決タスク

1. `umemoto@team-armada.jp` が App Store Connect 招待を承認したら `AMD` 内部テストグループへ追加
2. 必要なら他の AMD メンバーも `ユーザとアクセス` から招待し、内部テスターへ追加
3. 次に TestFlight へ出すときは `main` で `MARKETING_VERSION` を上げ、`CURRENT_PROJECT_VERSION` は同じ値に揃える

## 次セッションの最初の一手

1. `~/dev/amd-os-ios` で `git fetch --all --prune`
2. `git log --branches --not --remotes --oneline` で未 push commit を検知（CLAUDE.md の 4 ステップ）
3. `CLAUDE.md` / `DESIGN.md` / `BUGS.md` / `HANDOFF_ios_to_android.md` を読む
4. `git branch --show-current` でブランチ確認

## 運用ルール / 落とし穴

- iOS 修正は `xcodebuild` の `BUILD SUCCEEDED` だけで完了扱いにしない
- 必ず `devicectl device install app` の `App installed` と `device process launch` の起動成功まで確認する
- 別建ての build 番号運用は廃止。`CURRENT_PROJECT_VERSION` は `MARKETING_VERSION` と同じ値に揃える
- 内部テスター追加は 2 段階:
  - 先に `ユーザとアクセス` で App Store Connect ユーザーとして招待
  - 招待受諾後に TestFlight の内部テストグループへ追加
- main を更新したら `HANDOFF_ios_to_android.md` を更新して GitHub に push するまでがワンセット
- **commit したら即 push** を徹底する（エラー閉じ・他マシン作業で未 push commit を作らない）
- 画面・機能を追加・削除・名称変更したら **同じコミットで `DESIGN.md` を更新**
