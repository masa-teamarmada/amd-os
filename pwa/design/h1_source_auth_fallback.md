# H-1 source auth fallback design

最終更新: 2026-06-26
正本ステータス: H-1 MTGサマリ / H-1 reviewer の必須運用

---

## 目的

Notion connector の `UNAUTHORIZED oauth_token_invalid_grant` や再認証要求は、H-1 MTGサマリ / H-1 reviewer の停止理由にしない。これは「Notion という 1 connector の auth 状態」であって、「会議ソースが存在しない」証拠ではない。

H-1 は再認証待ちをせず、その場で browser/local fallback と Gmail / Drive / Calendar / Slack / 既存 AMD OS artifact を読みに行く。十分な会議本文が取れた場合は Notion なしで開催済み row を作る。十分でない場合も、停止ではなく `review_required` / coverage gap として、試した経路と不足理由を残す。

## 原則

- `oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` / `reauth required` は terminal blocker ではない。
- H-1 extractor / reviewer は、再認証をユーザーに依頼して待つ前に、同一ターン内で fallback ladder を実行する。
- 同時に、再認証そのものは即時復旧レーンへ流す。つまり「fallbackで業務継続」と「connector auth rescue」を並走させる。
- Notion が読めないだけで `source_kinds='none'` や `reviewer_blocked_notion_auth` にしない。
- raw Notion / Gmail / Drive / Slack の全文は durable artifact に保存しない。保存するのは短い引用、source ref、source hash、試行ログだけ。
- Notion 再認証は maintenance item として報告してよいが、MTG抽出・レビューの完了条件にはしない。

## immediate reauth rescue lane

auth failure を検知したら、H-1 は fallback ladder と並行して再認証アクションを作る。目的は「次回以降の Notion connector をすぐ復旧できる状態」にすることで、現在の抽出を止めることではない。

1. 最小 ping
   - Notion connector が `TRIGGER_REAUTHENTICATION` を返す場合、H-1 は追加で重い検索を繰り返さない。
   - 可能なら current user / search など最小の Notion connector call だけを実行し、Codex host 側の再認証 UI を即表示させる。
   - その UI を待たず、次の行で fallback ladder に進む。
2. 再認証アクション
   - H-1 は `app_notifications(kind='connector_auth')` を best-effort で作る。これは単なる報告ではなく、再認証先 URL / App deep link を含む復旧アクション。
   - helper は `pwa/scripts/notify_connector_auth.mjs`。24時間内に同じ connector の未読通知があれば新規作成せず、既存通知を最新の再認証アクション付きpayloadへ更新する。
   - helper は `~/.codex/cache/codex_apps_tools/*.json` と app directory から `connector_id` / `link_id` / `installUrl` を自動解決する。取得できない環境でも、Notion は現行既定値を持つ。
   - 現行 Notion:
     - `connector_id`: `asdk_app_69c18c28f1188191bf5b8445c4ab0a2e`
     - `link_id`: `link_69ee427bb90481919a44fb327ae7ed75`
     - Codex app link: `app://asdk_app_69c18c28f1188191bf5b8445c4ab0a2e`
     - ChatGPT Apps link: `https://chatgpt.com/apps/notion/asdk_app_69c18c28f1188191bf5b8445c4ab0a2e`
   - 実行例:
     ```bash
     cd /Users/masa/projects/AMD/amd-os/pwa
     npm run notify:connector-auth -- \
       --connector notion \
       --source h1_meeting_flow \
       --reason oauth_token_invalid_grant \
       --context "SX MTG 三浦工業 / 2026-06-26" \
       --dedupe-hours 24
     ```
   - connector error payload や host が再認証 URL / deep link を返す場合は `--reauth-url` / `--connector-id` / `--link-id` で明示上書きする。
   - PWA の `/notifications` は `reauth_url` を「再認証を開く」として表示する。`app://` は Codex App、`https://chatgpt.com/apps/...` はブラウザ側の再認証ページとして扱う。
   - PWA admin session は `connector_auth` を Realtime + 10秒pollで監視し、即時カード/Browser Notification を出す。
   - Swift は `app_notifications.native_notified_at IS NULL` の `connector_auth` を起動時/foreground復帰時に拾い、ローカル通知を出す。通知タップは通知ボックスではなく `reauth_url` を直接開く。
3. 同一runの扱い
   - まさが即再認証しても、H-1 はその場で待たない。
   - 同じ run 内で自然に再試行できる小さい範囲なら Notion Stage だけ再実行してよい。
   - できなければ次回 H-1 run で復旧確認する。今回の MTG は fallback source で完了させるか、source 不足として `review_required_raw_source_insufficient` に残す。

## fallback ladder

H-1 は上から順に、取れるところまで即時に試す。

1. Same-source fallback
   - Chrome / Codex Desktop のログイン済み Notion を read-only で開き、event title、event date、page URL、browser history、open tabs から該当 page を探す。
   - Notion Desktop / local cache / browser history が使える環境なら、同じく read-only で該当 page の有無だけ確認する。
   - 見つかった場合でも raw 全文を durable artifact に出さず、必要な短い snippets と source ref だけ扱う。
2. Cross-source fallback
   - Calendar: event description、attachments、Meet/Zoom URL、attendees、linked docs。
   - Gmail: Gemini notes、CircleBack 要約、Zoom/Meet recording 通知、参加者の follow-up、対象日 +-1 日の thread。
   - Drive: PJ folder、会議日 folder、Google Docs / Slides / Sheets / PDF、meeting_assets。
   - Slack: PJ channel / thread / files。
   - AMD OS local artifacts: `upcoming:<event_id>` card、prep-worker outbox、既存 `project_meeting_summaries`、手動添付。
3. Evidence decision
   - 会議の実質本文が 2 経路以上、または 1 経路でも Gemini/CircleBack/会議メモ本文として十分な場合、Notion なしで開催済み row を作る。
   - `source_kinds` は実際に使った source だけにする。例: `gmail+calendar`, `drive+calendar`, `gmail+drive+calendar`。
   - Notion connector failure は run summary に `notion_connector_reauth_bypassed` として残す。
4. Insufficient-source decision
   - Calendar の予定情報や日程調整メールだけで、会議後の内容が無い場合は議事録を捏造しない。
   - 既存 upcoming row を残し、`review_required_raw_source_insufficient` または `held_source_missing_after_reauth_bypass` として、試した fallback 経路を列挙する。

## extractor behavior

H-1 extractor は Notion Stage 1-3 のどこかで auth failure が出た時点で停止しない。`notionText=""` にして B-3 以降へ進み、Gmail / Drive / Slack / Calendar を必ず評価する。

開催済み row を保存する条件は「Notion が読めたか」ではなく「会議本文として十分な source があるか」。Notion が読めなくても、Gmail notes や Drive議事録や Calendar attachment が十分なら `narrative_md` を生成して保存する。

不足時は `blocked_notion_auth` ではなく、以下のどれかを使う。

- `notion_connector_reauth_bypassed`
- `notion_browser_fallback_unavailable`
- `held_source_missing_after_reauth_bypass`
- `review_required_raw_source_insufficient`

## reviewer behavior

H-1 reviewer は `notion_url` がある row でも Notion connector 再認証で止まらない。Chrome / local fallback を試し、それでも取れない場合は H-1 が使った Gmail / Drive / Slack / Calendar source refs を再取得して reviewer input を作る。

raw source が不足して重大情報の落ち検知ができない場合は、`reviewer_blocked_notion_auth` ではなく `review_required_raw_source_insufficient` として coverage gap candidate に回す。本文の自動上書きは引き続き禁止。

## run summary vocabulary

使ってよい status:

- `notion_connector_reauth_bypassed`: connector auth failure を検知し、fallback ladder に進んだ。
- `connector_auth_notification_created`: `app_notifications(kind='connector_auth')` を作った。
- `connector_auth_notification_updated`: 既存未読の再認証通知を最新の再認証アクション付きpayloadへ更新した。
- `notion_browser_fallback_used`: Chrome / local fallback で Notion source を読んだ。
- `notion_browser_fallback_unavailable`: Chrome / local fallback でも Notion source が取れなかった。
- `held_source_missing_after_reauth_bypass`: fallback 後も会議後本文が見つからず、開催済み row を作らなかった。
- `review_required_raw_source_insufficient`: raw source 不足のため、人間確認候補にした。

使ってはいけない terminal status:

- `blocked_notion_auth`
- `reviewer_blocked_notion_auth`
- `waiting_for_reauth`
- `reauth_required_stop`

## Miura 2026-06-26 example

`SX MTG 三浦工業` のように Notion connector が再認証を要求した場合、H-1 はその場で Calendar event、Gmail scheduling / follow-up、Drive の SX資料、Slack、Chrome history / logged-in Notion を確認する。

会議後本文が見つからない場合は、準備カードと日程調整情報だけから開催済み議事録を作らない。代わりに `held_source_missing_after_reauth_bypass` として、Notion 再認証ではなく「会議後 source 不足」を正しい未完了理由にする。
