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
