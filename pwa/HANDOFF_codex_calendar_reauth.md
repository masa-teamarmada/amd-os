# Codex Desktop へ渡す prompt: Google Calendar MCP 再認証 + 再認証ヘルスチェック設計

> **何これ**: 2026-06-24 に判明した「H-1 Phase P が `ACCESS_TOKEN_SCOPE_INSUFFICIENT` で 11 件全 skip していた事故」の根治のための作業。Claude (Mac) 側は `F2+F3 fallback` で freebusy 無しでも spawn できるよう SKILL.md を直したが (commit a19d05e8)、本当は freebusy / colors が取れる方が prep 枠の前倒し配置で気持ちいいので、Codex Desktop 側で OAuth scope を足して再認証する。
>
> あわせて「将来また再認証が必要になった時にまさが OS の通知だけ見ていれば気づける」設計を入れる。
>
> **これは Codex Desktop の新規 session に貼り付けて実行させる prompt**。1つ目の `## STEP 1` で動作確認まで、2つ目の `## STEP 2` で再認証ヘルスチェック設計を完遂する。両方とも end-to-end でやり切る。

---

## 前提情報 (Codex に伝える文脈)

- 環境: macOS、cwd は `/Users/masa/projects/AMD/amd-os`
- `~/.codex/config.toml` に `[plugins."google-calendar@openai-curated"]` が `enabled = true` で登録されている
- AMD OS の H-1 automation (`~/.codex/automations/amd-os-l6-meeting-flow/automation.toml`、name=H-1、cron 平日 09-21 時 15 分) が `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__*` 形式で Google Calendar MCP を呼んでいる
- 直近 H-1 run の review_required artifact (`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/review_required/*.json`) で、`get_colors` / `get_availability` (freebusy) が `ACCESS_TOKEN_SCOPE_INSUFFICIENT` を返している
- 既存の `list_events` / `get_event` / `create_event` などは動いている (= Phase A 議事録抽出が無事に narrative_md を書けている事実から)
- つまり OAuth に付いてる scope が `calendar.events` 系だけで、`calendar.freebusy` と `calendar.colors.readonly` が抜けている可能性が極めて高い
- まさは Codex Desktop の UI を自分で操作できるので、connector の reconnect ボタンを押す等のステップはまさに振ってよい (= ただし最小ステップで)
- Supabase 接続情報は `pwa/.env.local` の `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を使う
- AMD OS の通知系設計は `pwa/design/L2_DATA.md`、`l2_notifications` の `l2_kind` ホワイトリストは `pwa/src/app/api/notifications/feedback/route.ts:132` `allowedKinds` が正本

---

## STEP 1: いますぐ再認証 + 動作確認 (PWA 改修なし)

### 1.1 現状把握

1. `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_calendars` を呼んで現在の OAuth が生きていることを確認
2. `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_events` を `primary` calendar に対して `timeMin=now`, `timeMax=now+1h` で叩いて 200 OK が返ることを確認
3. `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__suggest_time` (= freebusy 相当の MCP) または `get_availability` 相当の操作を試し、**`ACCESS_TOKEN_SCOPE_INSUFFICIENT` が返ることを再現確認**する。再現できない (= もう取れる) なら STEP 1.2 / 1.3 を skip して 1.4 へ進む
4. 同様に色情報の取得 (`get_colors`) も呼んで scope 不足を再現確認する

### 1.2 必要 scope の洗い出し

Google Calendar API v3 で必要な OAuth scope:

| 機能 | 必要 scope |
|---|---|
| event 一覧 / read | `https://www.googleapis.com/auth/calendar.events.readonly` (既に付いてるはず) |
| event 作成 / update | `https://www.googleapis.com/auth/calendar.events` (既に付いてるはず) |
| freebusy 取得 | `https://www.googleapis.com/auth/calendar.freebusy` (= 不足が疑われる) |
| 色情報 取得 | `https://www.googleapis.com/auth/calendar.readonly` または `https://www.googleapis.com/auth/calendar` (= `colors.readonly` 単独 scope は存在しない、上位の `readonly` か `calendar` が必要) |

scope の正確な必要セットは Google 公式: https://developers.google.com/calendar/api/auth で最終確認する。

### 1.3 まさへ最小ステップで再認証を振る

`google-calendar@openai-curated` は OpenAI 公式 curated connector のため、scope 追加は Codex CLI 単体ではできない。Codex Desktop UI の Settings → Plugins / Connectors → `Google Calendar` の **reconnect / re-authorize** ボタンを押してもらう必要がある。

まさに伝えること (= 1 メッセージにまとめて Slack DM か Codex セッション内で):

```
🔧 まさ、Google Calendar MCP の OAuth scope が `calendar.freebusy` と `calendar.readonly` (色取得用) で不足してて、H-1 Phase P の freebusy 経由空き枠探索と色判定が止まってる。再認証お願い:

1. Codex Desktop アプリを開く
2. Settings (歯車) → Plugins (または Connectors) → Google Calendar を探す
3. 「Reconnect」または「Sign in again」ボタンを押す
4. Google の同意画面で、求められた全権限にチェック入れて「許可」
5. 完了したらこのチャットに「再認証した」と返してください

→ 戻ってきたら自動で動作確認します
```

### 1.4 再認証後の動作確認

まさが「再認証した」と返してきたら:

1. `list_calendars` 再実行 → 認証が更新されていることを確認 (token 更新時刻)
2. **freebusy テスト**: primary calendar に対して `suggest_time` (または `get_availability`) を `now` 〜 `now + 24h` の window で叩く
3. **colors テスト**: `get_colors` 相当を叩く
4. 両方 200 OK で返ったら成功。失敗したらどのエラーが返ったかを記録し、別の scope セットを試す
5. 成功したらまさに完了報告:
   ```
   ✅ Google Calendar MCP 再認証完了。freebusy / colors 両方取れるようになった。
   次の H-1 run (= 平日 09-21 時の毎時 15 分発火) で Phase P が deterministic fallback ではなく freebusy 経由の空き枠前倒しモードに切り替わる。
   ```

### 1.5 H-1 の次 run で Phase P が動くか確認

- 次の H-1 run 完了後、`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/review_required/` の最新 artifact または `memory.md` 末尾を read
- `phase_p_decision.blockers` から `ACCESS_TOKEN_SCOPE_INSUFFICIENT` 系が消えていることを確認
- `db_state.phase_p_candidates_next_7_days` に対して `prep_calendar_event_id` が NOT null になっている row が増えているか SQL で確認:
  ```bash
  curl -s -G "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/project_meeting_summaries" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    --data-urlencode "select=project_id,meeting_id,title,meeting_start_at,prep_calendar_event_id,prep_worker_status,prep_worker_spawned_at" \
    --data-urlencode "source_kinds=like.%upcoming%" \
    --data-urlencode "meeting_start_at=gt.now()" \
    --data-urlencode "meeting_start_at=lt.now()+interval+%277+days%27"
  ```
- 起点時刻に達した MTG (= 7/8 SX定例なら 7/7 17:00 JST 以降) で `prep_worker_spawned_at` が打たれていれば成功

---

## STEP 2: 再認証ヘルスチェック設計 (= 将来の再認証必要を自動検知)

> **目的**: OAuth トークンの期限切れ / scope 削減 / Google 側のポリシー変更で MCP が動かなくなった瞬間、まさが気づける状態を作る。「review_required artifact を 26 日ぶん溜め込んでまさが気づく」運用は再発させない。

### 2.1 設計の核

- **どこで検知するか**: AMD OS の各 automation (H-1、L2 系、ms-progress、dialogue-prep など) が MCP を呼んだ時の error catch 層
- **どう通知するか**: Supabase `l2_notifications` テーブルに `l2_kind='auth_reauth_required'` (= 新規) で insert + Slack DM nudge (= 既存 nudge 経路と統合)
- **重複防止**: 同一 `(connector_id, error_kind)` の未解決通知が既に存在する場合は新規作成せず `last_seen_at` だけ更新
- **解決検知**: 次の automation run で同じ MCP 呼びが成功したら通知を自動 `status='resolved'` にする (= 「再認証した」自己申告ボタンも `/notifications` UI に作るが、優先度は低い)

### 2.2 PWA 側で必要な変更

#### (a) `allowedKinds` に `auth_reauth_required` を追加

ファイル: `pwa/src/app/api/notifications/feedback/route.ts` の 132-151 行 `allowedKinds` Set に `"auth_reauth_required"` を追加。

#### (b) 通知作成 API ルート

```
POST /api/notifications/auth-reauth
body: {
  connector_id: string,    // 例: "google-calendar", "google-drive", "notion", "slack"
  mcp_name: string,        // 例: "509862f5-b23a-4c45-bf99-9978f6bc4d61" (= MCP の uuid 形式 prefix)
  error_kind: string,      // 例: "ACCESS_TOKEN_SCOPE_INSUFFICIENT", "invalid_grant", "401_unauthorized"
  failing_method: string,  // 例: "get_availability", "get_colors"
  missing_scopes?: string[], // 例: ["calendar.freebusy", "calendar.readonly"]
  message?: string,        // 自由文 (1 行)
  source_run_id?: string,  // 呼び出し元の automation run id
}
auth: Bearer ${CRON_SECRET}
```

挙動:
- 同一 `(connector_id, error_kind)` の `l2_notifications` で `status='pending'` が既存なら、`metadata_json.last_seen_at` を `now()`、`metadata_json.seen_count += 1`、`metadata_json.failing_methods` に `failing_method` を追加 (`uniq`) して終了
- 既存無しなら新規 insert (`l2_kind='auth_reauth_required'`, `status='pending'`, `importance='high'`, title + body は標準テンプレ)
- `members.code_name='まさ'` AND `is_admin=true` の `slack_id` を解決して **Slack DM 送信**:
  ```
  ⚠️ {connector_id} の再認証が必要

  Codex Desktop の Settings → Connectors → {connector_id} → Reconnect を押してね。
  詳細は AMD OS の /notifications で確認。

  失敗してる method: {failing_method}
  必要 scope (推測): {missing_scopes.join(", ")}
  ```
- 既存通知でも `last_nudged_at` が 24h より古ければ再 nudge (= スパムにならない頻度)

#### (c) 解決検知

```
POST /api/notifications/auth-reauth/resolve
body: {
  connector_id: string,
  source_run_id?: string,
}
auth: Bearer ${CRON_SECRET}
```

挙動:
- 同一 `connector_id` の `l2_notifications` で `status='pending'` を **全件** `status='resolved'`, `resolved_at=now()`, `metadata_json.resolved_by_run_id=source_run_id` に更新
- Slack DM で **resolve 通知**:
  ```
  ✅ {connector_id} 復活したよー。{seen_count} 回エラーが出てたけど、もう大丈夫。
  ```

#### (d) `/notifications` 画面側のラベル / 採否

- `pwa/src/app/(app)/notifications/` の通知 list 描画コードに `l2_kind='auth_reauth_required'` の chip ラベルを追加 (= 「🔐 再認証必要」のような表示)
- 「対応した」ボタン (= 上記 (c) resolve API を叩く) を追加
- importance='high' は赤色 / 先頭固定で表示する既存ロジックに乗せる

### 2.3 automation 側で必要な変更

各 automation の SKILL.md 末尾に **共通ガイドライン** として以下を追加 (= H-1 / L6 reviewer / L2 系 / dialogue-prep / ms-progress / strategy-signals 全部):

```md
## MCP 失敗時の通知 (= 再認証検知)

MCP 呼びで以下のエラーが返ったら、即 PWA `/api/notifications/auth-reauth` を叩く:

| エラー文字列 | error_kind 値 |
|---|---|
| `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | `ACCESS_TOKEN_SCOPE_INSUFFICIENT` |
| `invalid_grant` | `invalid_grant` |
| `401` または `Unauthorized` (HTTP status 系) | `401_unauthorized` |
| `403` または `Forbidden` (scope や consent 系) | `403_forbidden` |
| `Refresh token has been expired or revoked` | `refresh_token_expired` |

automation 側のコード擬似的:

\`\`\`bash
# pwa/.env.local から CRON_SECRET を読む
CRON_SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | cut -d= -f2- | tr -d '"')
PROD_URL="https://amd-os-pwa.vercel.app"  # 本番優先、DNS失敗時は localhost fallback

curl -s -X POST "$PROD_URL/api/notifications/auth-reauth" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"connector_id\":\"google-calendar\",\"mcp_name\":\"509862f5-...\",\"error_kind\":\"ACCESS_TOKEN_SCOPE_INSUFFICIENT\",\"failing_method\":\"get_availability\",\"missing_scopes\":[\"calendar.freebusy\"],\"source_run_id\":\"<run_id>\"}"
\`\`\`

逆に MCP が成功した時は、その connector の通知を resolve する:

\`\`\`bash
curl -s -X POST "$PROD_URL/api/notifications/auth-reauth/resolve" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"connector_id\":\"google-calendar\",\"source_run_id\":\"<run_id>\"}"
\`\`\`

通知を投げた後、当該 MCP が必要だった作業は (Phase P の F2+F3 fallback のように) deterministic fallback があれば続行する。fallback 無しなら当該データソース部分だけ skip して run summary に記録する。run 全体を止めない。
```

### 2.4 H-1 SKILL.md への特例追加

H-1 `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` の Phase P エラーハンドリング表 (2026-06-24 更新済み) に **追加列** を入れる:

| 状況 | 対応 | 通知 |
|---|---|---|
| Calendar `get_availability` ACCESS_TOKEN_SCOPE_INSUFFICIENT | F2 fallback で続行 | `POST /api/notifications/auth-reauth { connector_id: "google-calendar", failing_method: "get_availability", missing_scopes: ["calendar.freebusy"] }` |
| Calendar `get_colors` ACCESS_TOKEN_SCOPE_INSUFFICIENT | Phase P は色不要、続行 | 同上 (`failing_method: "get_colors"`, `missing_scopes: ["calendar.readonly"]`) |
| Calendar `create_event` 401/403 | F3 fallback で続行 | 同上 (`failing_method: "create_event"`, `missing_scopes: ["calendar.events"]`) |

H-1 run の最後で、当該 run で **正常に呼べた** MCP が一覧化されている前提で、それらの connector の pending 通知を resolve する。

### 2.5 DB schema

migration を追加する必要なし。既存 `l2_notifications` テーブルの `metadata_json` (jsonb) に格納:

```json
{
  "connector_id": "google-calendar",
  "mcp_name": "509862f5-b23a-4c45-bf99-9978f6bc4d61",
  "error_kind": "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
  "failing_methods": ["get_availability", "get_colors"],
  "missing_scopes": ["calendar.freebusy", "calendar.readonly"],
  "first_seen_at": "2026-06-24T12:34:56Z",
  "last_seen_at": "2026-06-24T15:34:56Z",
  "seen_count": 3,
  "last_nudged_at": "2026-06-24T12:34:56Z",
  "source_run_ids": ["2026-06-24T03-19-30+0900-macbook-fallback-phase-p-scope", "..."]
}
```

`l2_notifications` の主 column:
- `l2_kind = 'auth_reauth_required'`
- `title = "🔐 {connector_id} の再認証が必要"`
- `body = "Codex Desktop の Settings → Connectors → {connector_id} → Reconnect を押してね"`
- `importance = 'high'`
- `status = 'pending'` → `'resolved'`
- `project_id = NULL` (= 全体通知)
- `member_id = まさの member_id` (= admin にだけ届くようにする)

### 2.6 マニュアル / 設計 md 更新

- `pwa/design/L2_DATA.md` の `allowedKinds` 一覧表に `auth_reauth_required` を追加 (= MCP 再認証通知という分類)
- `pwa/manual/3-2-data-and-extraction.md` の通知一覧に追加
- `pwa/manual/9-3-appendix-changelog.md` と `pwa/spec/6-1-appendix-changelog.md` に変更記録を追記
- `pwa/scheduled-tasks/README.md` (= もしあれば) の「automation 共通ルール」節に「MCP 失敗時は auth-reauth 通知を投げる」を追記

### 2.7 完了条件

- [ ] PWA に `POST /api/notifications/auth-reauth` と `POST /api/notifications/auth-reauth/resolve` の 2 route 追加 + デプロイ
- [ ] `allowedKinds` に `auth_reauth_required` 追加 + デプロイ
- [ ] `/notifications` 画面で `auth_reauth_required` の chip ラベルと「対応した」ボタンが見える
- [ ] H-1 を含む 1 つ以上の automation で実際に MCP 失敗 → 通知投入 → Slack DM 到達 まで end-to-end 確認
- [ ] 再認証して MCP が回復 → 次の run で resolve 通知 → 「✅ 復活したよー」DM 到達 まで end-to-end 確認
- [ ] BUILD_VERSION を patch bump
- [ ] commit + push (Vercel 自動 deploy)
- [ ] handoff doc / changelog 追記

---

## まさへの完了報告フォーマット

STEP 1 と STEP 2 を完遂したら、Slack DM か Codex session 内でこの形式で報告:

```
✅ Google Calendar MCP 再認証 + ヘルスチェック設計、完了したよー

【STEP 1: 再認証】
- 不足してた scope: calendar.freebusy / calendar.readonly
- 再認証後の確認:
  - get_availability ✅ 200 OK
  - get_colors ✅ 200 OK
  - list_events / create_event は引き続き OK
- 次の H-1 run (= {次の発火時刻 JST}) で Phase P が freebusy 経由の空き枠前倒しモードに切り替わる予定

【STEP 2: ヘルスチェック設計】
- PWA: /api/notifications/auth-reauth + /resolve を追加 (commit {sha})
- allowedKinds に auth_reauth_required 追加 (commit {sha})
- /notifications UI に chip 表示 + 「対応した」ボタン追加
- H-1 SKILL に MCP 失敗 → 通知 + resolve ロジック追記
- BUILD_VERSION: v0.34.{x+1}
- 検証: H-1 で意図的に Calendar MCP を 1 回失敗させて通知 → Slack DM → resolve まで通った

【今後の運用】
- 再認証が必要になったら AMD OS の /notifications に「🔐 {connector} の再認証が必要」が出て、Slack DM も飛ぶ
- 再認証完了後、次の automation run で自動 resolve + 「✅ 復活したよー」DM
- 通知の自己申告 resolve ボタンも /notifications にあるので、即時 dismiss も可能
```
