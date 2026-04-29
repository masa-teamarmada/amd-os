# DEBUG LOG

> See also: [CLAUDE.md](CLAUDE.md) — 最重要ルール / [DESIGN.md](DESIGN.md) — 全画面の正本仕様 / [BUGS.md](BUGS.md) — 既知バグと再発防止メモ

このファイルには **デバッグ手順の知見** を蓄積する。
DB スキーマ確認手順、ログの取り方、特定バグへの追跡手順など。

---

## 2026-04-24: PJ進捗で `column value_milestones.order_no does not exist`

### 症状
- iOSアプリの「PJ進捗」画面を開くと、Supabaseエラー:
  - `column value_milestones.order_no does not exist`

### 原因
- iOS側の `SupabaseService` が旧カラム名を前提にクエリしていた。
- 実DBスキーマでは以下が正:
  - `value_milestones.order_no` ではなく `value_milestones.sort_order`
  - `milestone_sub_items.order_no` ではなく `milestone_sub_items.weight`
  - `milestone_sub_items.is_done` ではなく `milestone_sub_items.status` (`open` / `done`)

### 対応
- `AMDOS/Core/Services/SupabaseService.swift` を実スキーマ準拠に修正。
- 読み取り系:
  - `value_milestones` の select/order を `sort_order` に変更
  - `milestone_sub_items` の select/order を `weight` に変更
  - 完了判定を `status == "done"` で処理
- 書き込み系:
  - MS更新: `sort_order` へ保存
  - サブ項目更新: `weight` / `status` へ保存
  - サブ項目トグル: `status` 更新に統一

### 動作確認
- `xcodebuild` 実行: `BUILD SUCCEEDED`
- 実機 `masaiPhone` (UDID: `22F6F889-985D-5CAF-AFF3-D50D5E80FFA0`) へインストール・起動成功
- 「PJ進捗」画面がエラーなく表示されることを確認

### 再発防止メモ
- PJ進捗まわりのクエリを変更する前に、必ず実DBスキーマを REST で1件確認すること。
- カラム名は `order_no` ではなく `sort_order` / `weight` / `status` を正とする。
