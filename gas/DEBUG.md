# AMD OS GAS DEBUG

## 2026-05-21: Tsukuyomi Slack reaction-only replies

### 症状

- まさがSlackで「さんきゅ」だけをつくよみに伝えたつもりでも、同じメッセージ内に `@うめ ... collaboratorに追加して` のような依頼文が残っていると、つくよみがリアクションだけでなく通常のテキスト返信を返した。
- `conversations.replies` をGAS経由で叩く検証中、Slack APIが `invalid_arguments` を返すケースがあった。

### 原因

- reaction-only 判定がメッセージ全体を見ていたため、最後の `@つくよみ さんきゅ` より前にある依頼文を「対応すべきリクエスト」と誤判定した。
- Slack API `conversations.replies` はJSON POSTではなく `application/x-www-form-urlencoded` 形式で送る必要があり、既存の汎用 `slack_callApi()` のJSON送信と相性が悪かった。

### 対応内容

- `/Users/masa/projects/AMD/amd-os/gas/171_TsukuyomiReply.js` に reaction-only 判定を追加。
  - `さんきゅ` / `ありがとう` / `助かった` / `いい感じ` などは `heart` + 月リアクションだけ返す。
  - `了解` / `おけ` / `確認した` などは `white_check_mark` + 月リアクションだけ返す。
  - `教えて` / `お願い` / `追加して` / `修正して` / `?` などの依頼・質問はテキスト返信対象として残す。
  - メッセージ末尾付近に `@つくよみ` またはSlack mentionがある場合、そのmention以降の文だけで reaction-only 判定する。
- `/Users/masa/projects/AMD/amd-os/gas/185_SlackNotify.js` で `conversations.replies` を form-urlencoded 送信へルーティング。
- Tsukuyomi Slack Appに `reactions:write` scopeを追加し、workspaceへ再インストール。
- 既存GAS deployment `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` を `@1464 - v1464_tsukuyomi_mention_tail_reactions` へ更新。

### 再発防止策

- Slackで「mention付きの短いお礼」を判定するときは、必ず最後の関連mention以降の本文を抽出してから分類する。
- Slack APIのmethodごとの送信形式差を軽視しない。`conversations.replies` 系はJSON共通関数へ安易に流さず、form-urlencoded経路を使う。
- `clasp push` だけで終わらせず、Web Appの既存deploymentを `clasp deploy --deploymentId ...` で更新する。
- reaction絵文字名は `SLACK_TSUKUYOMI_MOON_REACTION` で任意上書き可能にし、未設定時は `tsukuyomi_moon`、Slack側に無ければ `crescent_moon` へフォールバックする。

### Verification

- `node --check gas/171_TsukuyomiReply.js`
- `node --check gas/185_SlackNotify.js`
- `git diff --check`
- GAS bridgeで `conversations.replies` が `messages: 11` を返すことを確認。
- `tsukuyomiHandleThreadReplyEvent({ channelId:'C08VBBE9KNE', threadTs:'1778753844.006349', triggerUserId:'U04PJK178JV' })` が `reactionOnly:true`、`["heart","tsukuyomi_moon"]` を返すことを確認。
- Slack `#p19_zmp` thread `1778753844.006349` のユーザー返信 `1779365168.977029` に `heart` と `tsukuyomi_moon` が付いたことを確認。

---

## 2026-05-23: pwaApi runFunc を POST body 経由で叩けるようにする (長文対応)

### 症状

- えいみが pwaApi runFunc で `slackNotifyPostToChannel_` に長文 (約 2500 字) を渡そうとしたら、URL encode 後の args が 8606 bytes になり、GAS Web App の GET URL 制限 (約 8KB) を超えて `HTTP 400 Bad Request` (GSE Default Error) が返った。
- 1 投稿で送りたい本文を 2 個に分割せざるを得なかった。

### 原因

- `001_Router.js` の `doGet` だけが pwaApi mode を処理しており、`doPost` は存在しなかった。
- 自分の追加 (`001_Router.js` に `function doPost(e){return doGet(e)}`) が反映されないので原因を辿ると **`80_SlackWebhook.js` に既存の `doPost` があった**。GAS の load 順はファイル名アルファベット順で `001_` < `80_` なので、後勝ちで `80_` の doPost が上書きしていた (= 私の追加は無効化)。
- 結果、POST で叩いても `80_` の doPost が `mode=pwaApi` 分岐を持たず、最終的に `return ContentService.createTextOutput("ok")` で生 "ok" だけ返してた。

### 対応内容

- `001_Router.js` の `doPost` は削除 (衝突回避)。
- `80_SlackWebhook.js` の `doPost` の **冒頭** (Slack Interactivity 判定の直後、internal_setup より前) に以下を追加:

  ```js
  // ===== 0-pre) pwaApi: POST body 経由の runFunc 等を doGet ルータに委譲 =====
  if (mode === "pwaApi") {
    return doGet(e);
  }
  ```

- `clasp push` → `clasp deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v1472_pwaApi_doPost_via_slack_webhook"`
- `gas/CLAUDE.md` の「GAS 関数を CLI/curl から実行する手順」セクションに **POST 経由の例 (node fetch)** を追記。`POST は doPost が未実装で 404` の古い記述を削除。

### 再発防止策

- **doPost / doGet を新規追加するときは必ず `grep -rln "^function doPost"` で既存定義を確認する**。GAS は同名関数の後勝ち (ファイル名アルファベット順) なので、無音で上書きされる。
- POST 対応の薄いラッパー (`if (mode === ...) return doGet(e)`) は `001_Router.js` ではなく **既存 doPost を持つファイル** に追加する。
- curl で Apps Script Web App に POST すると 302 redirect 後に `script.googleusercontent.com/macros/echo` に飛び、curl は `--post30X` 指定しても body を維持できず GET になって失敗する。**POST 検証は node fetch を使う** (自動で正しく追従)。

### Verification

- `node -e 'fetch(URL, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fn:"slackNotifyGetProjectChannelId_", args:["p21"]})}).then(r=>r.text()).then(console.log)'` → `{"ok":true,"data":{"fn":"slackNotifyGetProjectChannelId_","ms":620,"result":"C093DQ4D04W"}}`
- v1472 deploy 完了。同じ exec URL で GET/POST 両方動作。

---

## 2026-05-23: SLACK_BOT_TOKEN vs SLACK_TSUKUYOMI_BOT_TOKEN (どっちが「つくよみ」か)

### 症状

- えいみが pwaApi runFunc で `slackNotifyPostToChannelTsukuyomi_("C093DQ4D04W", {text:"..."})` を叩いたら Slack API が `not_in_channel` を返した。
- ところが Slack 上では「つくよみ」(user id `U0A663YPJNQ`) が同じチャンネル `#p21_sx` に 2026-05-22 16:13 に週次レポートを投稿している (= bot は実際にいる)。

### 原因

- ScriptProperties には **2つの Slack bot token** がある:
  - `SLACK_BOT_TOKEN` → **つくよみ (user id `U0A663YPJNQ`) 本体** のトークン。各 PJ チャンネルに招待済み
  - `SLACK_TSUKUYOMI_BOT_TOKEN` → **別 bot** (おそらく旧「つくよみchronicle」)。 `#p21_sx` 等の主要 PJ チャンネルに居らず `not_in_channel`
- `115_SlackNotify.js` には 2 つの関数があり、紛らわしい:
  - `slackNotifyPostToChannel_(channelId, arg)` (line 223) → `SLACK_BOT_TOKEN` を使う ← **これがつくよみ**
  - `slackNotifyPostToChannelTsukuyomi_(channelId, arg)` (line 466) → `SLACK_TSUKUYOMI_BOT_TOKEN` を使う ← 名前に Tsukuyomi が入ってるが別 bot

### 対応内容

- 任意チャンネルにつくよみ名義で投稿する場合は `slackNotifyPostToChannel_` を使う運用に統一。
- `gas/CLAUDE.md` の「Slack 投稿」セクションに罠と正しい使い方を追記。

### 再発防止策

- 関数名に "Tsukuyomi" が入ってるからといって、それが「つくよみ」のtokenだとは限らない。Script Properties キー名を読んで実際に **どちらの bot token を使っているか** を確認する。
- `not_in_channel` エラーが出たら、まず `chat.auth.test` で bot user id を取り、Slack 検索結果 (実際に投稿している bot id) と一致するか比較する。

### Verification

- `slackNotifyPostToChannel_("C093DQ4D04W", {text:"テスト"})` → ok、Slack 上で `from つくよみ (U0A663YPJNQ)` で表示確認。
- テスト投稿は `slack_callApi("chat.delete", {channel, ts})` で削除。

---

## 2026-05-23: clasp v3 と古い ~/.clasprc.json の互換問題

### 症状

- `npx @google/clasp@2.4.2 push` 実行時に `Error retrieving access token: TypeError: Cannot read properties of undefined (reading 'access_token')` で失敗。
- `npx @google/clasp@latest login` 実行しても `Warning: You seem to already be logged in. You are logged in as masa@team-armada.jp.` と出てログイン flow が走らない。

### 原因

- 既存 `~/.clasprc.json` (v2 系の format) が残っており、clasp v3 の OAuth client format と互換性がなく access_token を取れない。
- ただし clasp は「ファイルが存在する」ことだけで「ログイン済み」と判定するため、ログイン更新 flow がスキップされる。

### 対応内容

- `mv ~/.clasprc.json ~/.clasprc.json.bak-20260523` で退避。
- `cd amd-os/gas && PATH=... npx -y @google/clasp@latest login` を foreground 実行 → ブラウザ自動 open → Google認証 → 完了。
- 新 `~/.clasprc.json` (632B) が生成され、`clasp push` 成功。

### 再発防止策

- clasp の `access_token undefined` エラーが出たら、**まず `~/.clasprc.json` を退避してから fresh login** する。バージョン番号で迷うより速い。
- `clasp login` を bash の **background 実行で呼んでもブラウザは前面に出ない** (GUI focus を奪わない)。 foreground 実行で自動で `open` が動く。

### Verification

- `clasp push` → "Pushed 221 files"
- `clasp deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v1472_pwaApi_doPost_via_slack_webhook"` → "Deployed ... @1472"
