---
テーマ: gas-external-research に AMD を追加 / Gemini 2.5 Flash APIエラー修正
最終更新: 2026-04-17 えいみ
---

## 完了タスク

- `010_Config.js` に AMD エントリ追加（`#a1_all` / C04NRE08FHD）
- GAPファンドキーワード追加（国・公的機関系 / 12大学 / 4地方）
- `030_Cron.js` の `externalResearch_testOne()` の `pjIndex` を 6（AMD）に設定
- clasp push 完了（2026-04-11 15:38）

## 未完了・継続タスク

- Slack `#a1_all` への実投稿確認（任意）
  - `externalResearch_testOne()` はSlack投稿しないため未確認
  - 確認したい場合は `externalResearch_run()` を手動実行（全PJ分が走るので注意）
  - 毎朝9時のcronで自然に確認できるのでスキップでもOK

## 今セッションで完了した追加作業（2026-04-11）

- AMD の `pjName` を `大学発ディープテックスタートアップ支援（Team ARMADA）` に変更（Gemini検索アンカー対策）
- `formatMessage_` のソースURL出力条件を「常に表示」に変更（全PJ共通）
- 動作確認済み: Gemini検索でディープテック業界ニュースが7ソース取得できることを確認

## clasp / OAuth の手こずりポイント（次回同じ轍を踏まないために）

### 問題: `invalid_grant`（invalid_rapt）

Google Workspace の再認証ポリシーにより `.clasprc.json` のトークンが失効する。

**症状**: `clasp push` 時に `invalid_grant` または `invalid_rapt` エラー

**NG だった対処**:
1. Node.js で localhost:8888 にリダイレクト受信サーバーを立てて OAuth flow を手動実施
   - Git Bash 上で node を起動 → Chrome からポートに届かない（ネットワーク分離）
   - PowerShell 経由で node を起動 → それでも Chrome から接続拒否
   - `/tmp/` パスが Windows で存在しない（`C:/Users/masa/AppData/Local/Temp/` を使う必要）
   - OAuthコードが届く前にサーバーを起動するタイミング制御が難しい

**正解の対処**:
```
PowerShellウィンドウを新規で開く
→ & 'C:/Users/masa/AppData/Roaming/npm/clasp.cmd' login
→ ブラウザが自動で開いてGoogleログイン
→ "Logged in! Token saved." が表示される
```

**ポイント**:
- `clasp login` 自体が内部でローカルサーバーを立ち上げてリダイレクトを受ける
- Git Bash 上ではなく **PowerShell から直接** `clasp.cmd` を実行することで Chrome → localhost 疎通が通る
- `clasp` コマンドは `C:/Users/masa/AppData/Roaming/npm/clasp.cmd`

### clasp push コマンド

```bash
cd "G:/共有ドライブ/claude/AMD_OS/gas-external-research"
/c/Users/masa/AppData/Roaming/npm/clasp push --force
```

## 2026-04-17 追加作業: Gemini APIエラー修正

### 問題
4/15〜4/16 にかけて `gemini_searchAndSummarize` が毎時失敗（24回）。
エラー: `Gemini API error 400: "Invalid value at 'contents[0].parts[0]' (text), Starting an object on a scalar field", status: "INVALID_ARGUMENT"`

### 原因
`gemini-2.5-flash` はThinking Model。4/15前後のAPIアップデートにより、Search Grounding（`google_search`ツール）使用時にThinking Modeとの衝突が発生するようになった。コードは変更なし（最終更新4/13）、API側の挙動変更。

### 修正内容
`020_GeminiSearch.js` の `gemini_searchAndSummarize` 内のpayloadに `thinkingConfig` を追加:
```js
generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
```
→ Thinking Modeを無効化し、Search Groundingを従来通り動作させる。

### デプロイ
- `clasp login` → `clasp push --force` 完了（2026-04-17 11:17）
- 今回は Git Bash から直接 `clasp login` で認証成功（ブラウザ自動オープン）

### 次回確認事項
- 翌朝9時のcronで `externalResearch_run` がエラーなく完走するか確認
- GASのエラーメール（noreply-apps-scripts-notifications@google.com）が届かなければ修正成功

## 2026-05-07 追加修正: 誤トリガー由来のGemini API 400を停止

### 問題
4/17修正後も `Summary of failures for Google Apps Script: gas-external-research` が継続。
Gmail本文の `Start Function` は正規入口の `externalResearch_run` ではなく `gemini_searchAndSummarize` だった。

### 原因
ヘルパー関数 `gemini_searchAndSummarize(prompt)` に時間ベーストリガーが直接刺さっていた。
時間トリガーはGASイベントオブジェクトを引数に渡すため、Gemini REST payload の `contents[0].parts[0].text` に文字列ではなくオブジェクトが入り、`Starting an object on a scalar field` で400になっていた。

### 修正内容
- Google Drive同期フォルダで0バイト化していた正規ファイル名を `* 2.js` / `* 2.json` から復元
- `.claspignore` を追加し、`* 2.js` / `* 2.json` をpush対象から除外
- `020_GeminiSearch.js` に非文字列promptガードを追加
- 誤トリガーで呼ばれた場合は `externalResearch_cleanupBadTriggers()` を呼び、`gemini_searchAndSummarize` 宛の時間トリガーを削除して正常終了するようにした

### デプロイ
- Mac側パス: `/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/claude/AMD_OS/gas-external-research`
- `npx @google/clasp login` で `masa@team-armada.jp` 再認証
- `npx @google/clasp push --force` 完了（2026-05-07 13:57 JST / 9 files）

### 次回確認事項
- 次の誤トリガー実行後、`gemini_searchAndSummarize` 宛トリガーが自己削除される想定
- 2026-05-08以降、同件名の失敗通知が再発しないか確認
- 正規cron入口は引き続き `externalResearch_run`

## 設計メモ

- AMD は **外部リサーチパイプライン**（`gas-external-research`）に追加。DI（内部収集）パイプラインには不要。
- AMD の収集ソースはウェブ検索のみ（Gemini Search Grounding）。Slack/Gmail/Calendar のクロールなし。
- 投稿先: `#a1_all`（C04NRE08FHD）
