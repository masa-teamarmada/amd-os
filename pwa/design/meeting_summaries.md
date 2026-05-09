# MTG サマリ — 設計の正本

最終更新: 2026-05-09 (Phase 2 移行)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

PJ コックピット (`/project/[projectId]/cockpit`) の **MTGサマリ枠** に「定例MTG各回のサマリを時系列で並べる」機能の仕様。

- データソース: **Notion 議事録ページ本文 + Gmail 議事録メール (CircleBack 要約 / GMeet recording 通知 等)** の結合
- 抽出: GAS の daily cron が **calendar event 単位** に Gemini で `summary_short` + `decided / progress / nextActions / risks` を生成
- 保存: Supabase の `project_meeting_summaries` (PK: `meeting_id` = calendar event id)
- 表示: PWA の `CockpitMeetingSummary` が Supabase を直読み

このドキュメントは **PWA / GAS / Supabase 横断の正本**。

---

## Phase 2 の大方針 (Phase 1 から何を変えたか)

| 観点 | Phase 1 (廃) | Phase 2 → Phase 3 (現行) |
|---|---|---|
| 主軸 | Notion 議事録ページ単独 | **1 calendar event = 1 行** |
| `meeting_id` PK | Notion page id | **calendar event id** (Notion 議事録ページの `eventId` プロパティから) |
| 議事録ソース | Notion ページ本文のみ | **Notion ページ本文 + Gmail (reportEmails ±1日)** を結合 |
| 議事録なし扱い | 抽出スキップ (= 行が出ない) | `summary_short = "議事録なし"` でマーカー行を残す |
| 範囲 | 1 PJ × 1 ym | 同左 (cron は daily 実行で当月分を再走) |
| 差分検知 | 本文 sha256 | (Notion 本文 + Gmail 結合テキスト) sha256 |

**変えた理由**: Phase 1 は Notion 議事録の本文が薄い (タイトルだけ等) と Gemini も「内容なし」を返してしまい、大半が空 items になっていた。実運用では「**議事録の中身は Notion とは限らず、CircleBack 要約や GMeet recording 通知が Gmail に流れてきて、それを議事録として使ってる**」(まさの運用)。だから議事録ソースを広げる。

---

## データフロー

```
[Calendar event] (PJ ごとの色 / alias で PJ 判定)
   │ cron_createMinutesFromCalendar (CalendarToNotionMinutes.js, 03:00 JST 既存)
   ↓
[Notion 議事録 DB] 1 page = 1 calendar event (eventId プロパティで紐付け)
   │
   ↓
[GAS daily cron 03:00 JST]
   nav_cronMonthlyExtractAt3 (152_NavigatorCron.js)
     ↓ for each active PJ:
        nav_meeting_extractForProjectYm_(projectId, currentYm) (074_MeetingSummaryRepo.js)
          │ a) Notion 議事録 DB を当月 query (305 流用)
          │ b) PJ 解決 → 当該 PJ のページに絞る (Notion PJ relation)
          │ c) Gmail を **当月 1 回** mr_extractFromGmail_ で取得しキャッシュ (307 流用)
          │ d) for each Notion page:
          │      - eventId プロパティ = calendar event id (= meeting_id PK)
          │      - Notion 本文取得 (props 「内容」 + blocks 結合)
          │      - Gmail キャッシュから「event 日 ±1日」の thread を pickup
          │      - 結合テキストの sha256 で差分検知 → 変わってれば Gemini call
          │      - 議事録なしケースは summary_short="議事録なし" で upsert (LLM 呼ばない)
          ↓
[Supabase: project_meeting_summaries]
   ↓
[PWA] CockpitMeetingSummary が直読み
```

**重要**: Notion 議事録ページが無ければこの cron では拾えない。
ただし上流の `cron_createMinutesFromCalendar` (CalendarToNotionMinutes.js) が
毎日 03:00 で **明日分の calendar event について議事録枠を自動生成** しているので、
通常は Notion 議事録ページが存在する状態で当 cron が走る。allDay event /
`+`プレフィックス / `EXCLUDE` alias は除外される (= 議事録ページが作られない)。

---

## Phase 3: 毎時 polling + iOS APNs 通知

Phase 2 (月単位 fallback) に加えて、Phase 3 (毎時 0 分の cron で「会議終了直後の events」を polling して抽出) を追加。これが議事録抽出の**正規ルート**。

> **設計判断**: 当初 `ScriptApp.newTrigger.at(終了+60分)` で各 event ごとに ad-hoc trigger をセットする方式を試したが、GAS の time-trigger 上限 (1 script 20-100 個) に引っかかった。代わりに「毎時 0 分の cron 1 個だけ」で「過去 60-180 分に終わった events」を毎回スキャンする方式に切り替え。終了 +60 分ピッタリには発火しないが +60 〜 +180 分のどこかで処理されるので実用上 OK。**直前追加 MTG への対応もこれで担保される** (開催前 scheduling 不要)。

### 動き方

```
[03:00 daily cron] (152_NavigatorCron.js nav_cronMonthlyExtractAt3)
   └ Phase 2 fallback だけ (各 active PJ × 当月で nav_meeting_extractForProjectYm_)
     = 拾い漏れ救済 + 「議事録なし」確定 + 差分検知で重複処理回避

[毎時 0 分 trigger] (153_MeetingHourlyTrigger.js)
   nav_meeting_pollRecentlyEndedEvents
        │ a) listEventsByApi_(calendarId, now-4h, now) で過去 4h 全 events 取得
        │ b) 終了時刻が「now の 60〜180 分前」の events だけ filter
        │    (= 会議終わって 1〜3 時間が経過したあたりを毎時拾う)
        │    重複処理は Supabase の source_hash 差分検知で防ぐので窓は広めでも問題ない
        │ c) PJ 判定 (CFG_ColorPJHistory + CFG_PJAlias)
        │    allDay / +prefix / EXCLUDE alias / pjCode=AMD は除外
        │ d) 各 event について nav_meeting_processOneEvent_(eventId, projectId)  ← 074_MeetingSummaryRepo.js
        │      - Notion 議事録 DB から eventId プロパティ equals でページを 1 件取得
        │        (新 helper _meeting_findNotionPageByEventId_)
        │      - Notion ページ本文 (props 「内容」 + blocks)
        │      - Gmail を「会議日 ±1 日」だけクエリ (1 event 用)
        │      - 結合 → Gemini → upsert (Phase 2 と同じロジック)
        │ e) sourceKinds != 'none' なら meeting_notifications に upsert (Swift APNs 通知用)
        ↓
[Supabase: meeting_notifications]
   meeting_id PK / notified_at NULL の状態で挿入
        ↓
[iOS Swift] (★ ios/HANDOFF_meeting_notifications.md 参照、別セッション実装)
   notified_at IS NULL を polling or realtime sub
        ↓ APNs ローカル通知
        ↓ notified_at = now() に UPDATE
```

### Phase 2 fallback の役割

- **拾い漏れ救済**: Phase 3 polling が漏らした event (= cron が落ちてた等)、または Phase 3 で抽出失敗した event を翌朝 03:00 に再走査
- **「議事録なし」確定**: 会議終了から十分時間が経った event (= 当月分の過去会議) を「議事録なし」マーカーで残す
- 差分検知 (source_hash) があるので Phase 3 で抽出済の event は LLM 呼ばずスキップ

### Setup (1 度だけ実行)

```bash
# 毎時 0 分の hourly poll trigger を設置
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_setupHourlyPollTrigger_"
```

### ScriptProperties

| キー | 用途 |
|---|---|
| `MAIN_CALENDAR_ID` | (任意) curl/手動テスト用 calendar id override。本番 cron では `Session.getEffectiveUser().getEmail()` で取れる |

### 制約・注意点

- **GAS time-based trigger は 1 script あたり 20-100 個上限**。Phase 3 は固定 1 個 (毎時) に抑えてあるが、本体GAS 全体では他 cron 含めて 18 個前後 (cron_invoiceSendNudge_ が 4 重複で枠を浪費、要整理 — 別件)
- **窓 60〜180 分**: cron 跨ぎや遅延の取りこぼし防止のため広めに取ってある。重複処理は source_hash で防ぐ
- **Web App 経由 (curl) 実行時**: `Session.getActiveUser()` が空。`Session.getEffectiveUser()` (= deployment owner = まさ) で代替するため、Web App 設定が "Execute as: Me" 必須
- **直前追加 MTG**: 会議が始まる前の scheduling は不要 (= 終了後の polling だけで拾える)。03:00 以降に追加された MTG も最大 1 時間以内に検知される

### 通知 (iOS Swift)

Phase 3 で議事録が拾えたら `meeting_notifications` テーブル (PK: meeting_id) に upsert される。Swift 側は `notified_at IS NULL` を polling or realtime sub で取り、APNs ローカル通知 → `notified_at = now()` で UPDATE。詳細は [`ios/HANDOFF_meeting_notifications.md`](../../ios/HANDOFF_meeting_notifications.md)。

---

## 議事録ソース: 取得方法の正本

**🚨 まさの運用ルール**: 議事録は Notion とは限らない。CircleBack 要約 / GMeet recording 通知 / クライアント側議事録メール を **Gmail から拾う** 運用が混在。Phase 2 はこの両方を結合する。

### ソース 1: Notion 議事録ページ本文

- `nav_repo_notion_queryMinutesByYmFull_(token, dbId, ym)` ([gas/073_NavigatorRepo.js:1527](../../gas/073_NavigatorRepo.js)) で当月分の Notion ページ全件取得
- `_meeting_resolveProjectIdFromPage_` で PJ relation → AMD projectId 解決、対象 PJ のものに絞る
- `_notion_extractPropertyText_(page, "内容")` (props) + `nav_repo_notion_fetchPageBodyText` ([gas/122_NotionBlocksRepo.js:11](../../gas/122_NotionBlocksRepo.js)、blocks 本文 maxChars=20000) を結合

### ソース 2: Gmail スレッド (議事録メール)

- `mr_extractFromGmail_(projectId, startDate, endDate)` ([gas/307_MonthlyReport_GmailExtract.js](../../gas/307_MonthlyReport_GmailExtract.js)) を **daily cron 実行のうち、その 1 PJ × 1 ym で 1 回だけ** 月単位で呼ぶ → memory cache。
- 内部で `DB_Projects.reportEmails` (カンマ区切り複数) を `(from:X OR to:X)` でフィルタ。**ここに CircleBack の通知メールアドレス / GMeet recording の通知アドレス / クライアントメール を登録しておくと議事録メールが入る** (PJ ごとの reportEmails 設定運用)。
- 各 calendar event について、cache から「event 日 ±1日」の thread を `_meeting_pickRelevantGmailThreads_` で pickup
- 各 thread は最大 5 messages × 各 800 字で本文抜粋 (LLM トークン抑制)

### 議事録なしケース (Phase 2 マーカー)

両ソースとも 30 字未満なら:
- `summary_short = "議事録なし"`
- `decided / progress / next_actions / risks` 全て空配列
- `source_kinds = "none"`
- `source_hash = sha256("none|" + meetingDate + "|" + title)`

これにより calendar event はあるが議事録が無い MTG が UI 上「議事録なし」表示として残る。

---

## Supabase スキーマ

```sql
-- 024 (Phase 1 初版) + 025 (anon read 開放) + 027 (Phase 2 移行)

CREATE TABLE project_meeting_summaries (
  meeting_id          TEXT PRIMARY KEY,           -- ⭐ Phase 2: calendar event id
  project_id          TEXT NOT NULL,
  ym                  TEXT NOT NULL,              -- yyyymm
  meeting_date        DATE NOT NULL,
  meeting_start_at    TIMESTAMPTZ,
  title               TEXT NOT NULL,

  -- Phase 1 互換 (UI が「Notion で開く」リンクに使用)
  notion_url          TEXT,
  notion_page_id      TEXT,                       -- Phase 2 (027) 追加
  calendar_event_id   TEXT,                       -- 通常 = meeting_id (PK)

  -- 議事録抽出結果
  summary_short       TEXT NOT NULL DEFAULT '',
  decided             JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress            JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_actions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks               JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Phase 2 (027) 追加メタ
  gmail_thread_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 取得元 thread id 配列
  source_kinds        TEXT,                                -- 'notion' | 'gmail' | 'notion+gmail' | 'none'

  source_hash         TEXT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_model  TEXT,                                -- 例: 'gemini-2.5-flash' / NULL (none)

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: anon, authenticated とも SELECT 可 (PWA は anon key で読む)
-- 書き込みは service_role 経由 (GAS supa_upsert)
```

---

## GAS 側仕様 (Phase 2)

### 主要ファイル

| ファイル | 役割 |
|---|---|
| [gas/074_MeetingSummaryRepo.js](../../gas/074_MeetingSummaryRepo.js) | **本ロジック正本**。`nav_meeting_extractForProjectYm_` / `nav_meeting_backfillForProject_` |
| [gas/152_NavigatorCron.js](../../gas/152_NavigatorCron.js) | daily cron 入口。`nav_meeting_extractForProjectYm_(projectId, ymKey)` を呼ぶ |
| [gas/092_AdminLLMExtractors.js](../../gas/092_AdminLLMExtractors.js) | Protocol Store の `meeting_extract` プロンプト (`run_installMeetingExtractorConfig` で install) |
| [gas/180_SupabaseClient.js](../../gas/180_SupabaseClient.js) | Supabase 書き込み helper (`supa_upsert` / `supa_select`) |
| [gas/307_MonthlyReport_GmailExtract.js](../../gas/307_MonthlyReport_GmailExtract.js) | **流用先**: `mr_gmail_getProjectInfo_` / `mr_gmail_buildSearchQuery_` (reportEmails) |
| [gas/305_MonthlyReport_NotionExtract.js](../../gas/305_MonthlyReport_NotionExtract.js) | **流用先**: Notion DB query 系 |
| [gas/122_NotionBlocksRepo.js](../../gas/122_NotionBlocksRepo.js) | **流用先**: Notion ページ本文取得 |
| [gas/CalendarToNotionMinutes.js](../../gas/CalendarToNotionMinutes.js) | 上流: 毎日 03:00 で明日分の Notion 議事録枠を作る (`cron_createMinutesFromCalendar`) |

### Gemini プロンプト (Protocol Store: `meeting_extract` v2)

入力: 1 calendar event ぶんの結合テキスト
```
=== notion ===
<Notion 議事録ページ本文>

=== gmail ===
--- mail [MM/dd HH:mm] subject: ... ---
<本文抜粋>

--- mail [MM/dd HH:mm] subject: ... ---
...
```

出力: 厳密 JSON
```json
{
  "summary_short": "2 行以内・80 字以内",
  "decided":      ["..."],
  "progress":     ["..."],
  "next_actions": ["..."],
  "risks":        ["..."]
}
```

ルール (詳細は [gas/092_AdminLLMExtractors.js](../../gas/092_AdminLLMExtractors.js) `meeting_extract_basePrompt_`):
- `gmail` セクションには **会議と関係ないメール** が混ざりうる → LLM 側で選別
- 同一事項が両方にあれば 1 つにまとめる、より具体的な記述を優先
- 自動通知文・署名・URL は捨てる
- 各配列最大 5 件、入力に書かれてない推測禁止

### 差分検知

```
combinedText = (Notion 本文 + "\n\n" + Gmail 抜粋)
newHash = sha256(combinedText)
if existing.source_hash === newHash: skip (LLM 呼ばない)
```

毎日 cron で同じ議事録が再 query されても、本文が変わってない限り Gemini call はされない。

### GAS 6 分制限対策

`maxItems` で 1 回の関数呼び出しでの **LLM call 回数** を制限 (default 8、cron では 5)。
それを超えると `hasMore: true` を返して deferred。同関数を再度呼べば残りが処理される (差分検知ありなのでムダにならない)。

`nav_meeting_backfillForProject_` は内部で hasMore の限り最大 8 回再呼び。

### ScriptProperties

| キー | 用途 |
|---|---|
| `NOTION_TOKEN` | Notion API |
| `NOTION_DATABASE_ID` | 議事録 DB |
| `NOTION_PJ_DATABASE_ID` | PJ DB |
| `NOTION_MINUTES_DATE_PROP` | 議事録 DB の日付プロパティ名 (default: "日付") |
| `GEMINI_API_KEY` | Gemini |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Supabase service_role 書き込み |
| `PROTOCOL_STORE_SPREADSHEET_ID` | Protocol Store (`DB_LLMExtractorConfig`) |
| `COLOR_PJ_CONFIG_SPREADSHEET_ID` | CFG_ColorPJHistory / CFG_PJAlias (PJ 判定) |

`SUPABASE_SERVICE_KEY` は `_ROLE_KEY` ではない (gas/CLAUDE.md ルール 9 + BUGS.md 2026-05-08)。

---

## PWA 側仕様

### 主要ファイル

| ファイル | 役割 |
|---|---|
| [pwa/scripts/migrations/024_project_meeting_summaries.sql](../scripts/migrations/024_project_meeting_summaries.sql) | 初版 (Phase 1) |
| [pwa/scripts/migrations/025_pms_anon_read.sql](../scripts/migrations/025_pms_anon_read.sql) | RLS anon, authenticated |
| [pwa/scripts/migrations/027_pms_phase2_calendar_event.sql](../scripts/migrations/027_pms_phase2_calendar_event.sql) | Phase 2 移行 (DELETE 全行 + カラム追加) |
| [pwa/src/lib/supabase-data.ts](../src/lib/supabase-data.ts) | `fetchProjectMeetingSummaries` (Phase 1 と同じ) |
| [pwa/src/components/cockpit/CockpitMeetingSummary.tsx](../src/components/cockpit/CockpitMeetingSummary.tsx) | UI (Phase 1 と同じ、`item.notionUrl` チェックで NULL 行も対応済) |

PWA 側は Phase 2 移行で **コード変更不要**。Schema 追加カラム (`notion_page_id` / `gmail_thread_ids` / `source_kinds`) は UI には出さない (将来必要になったら supabase-data.ts に足す)。

### UI 仕様 (変更なし)

- 月でグルーピング、`meeting_date DESC` 降順
- 直近 1 年デフォルト + 「▼ それより前を表示」トグル
- 行クリックで折り畳み展開
- 議事録なしマーカー行は `summary_short` だけ "議事録なし" が出る (decided/progress/... は空なので非表示、`Notion で開く` リンクは notion_url があれば出る)

---

## 既知の制約・運用上の注意

- **議事録ページ未作成回**: `cron_createMinutesFromCalendar` で対象外 (allDay / `+`prefix / `EXCLUDE` alias) になった calendar event は議事録ページが無いので Phase 2 cron では拾えない。これは仕様 (= MTG ではないと判定された)
- **古い議事録 (eventId プロパティなし)**: CalendarToNotionMinutes 導入前の手動議事録ページは `eventId` が空で、Phase 2 では meeting_id を作れないので skip される (`action: "skipped_no_event_id"`)。Phase 1 で入れた 7 行も migration 027 の DELETE で消えてる
- **PJ 関係ないメールが Gmail cache に混じる**: `reportEmails` filter で from/to のいずれか一致のものだけ取るが、それでも会議無関係のメールが混ざることはある。±1日に絞り、最終的に LLM 側で選別する設計
- **PJ 別の議事録経路の傾向** (2026-05-09 まさ確認):
  - **p20 = CX (NIMS 関係)**: 議事録は Notion メインで Gmail には来ない傾向。`reportEmails` は NIMS 関係者の個人メール 2 件
  - **p21 = SX (愛媛大関係)**: Gmail に議事録 (CircleBack 要約 / メール議事録) が大量に来る。`reportEmails` に `@ehime-u.ac.jp` ドメインワイルドカード等 5 件登録済
  - PJ ごとに議事録経路の主軸が違うので、`source_kinds` 列で「どこから取れたか」が確認できる設計にしてある
- **Notion API レート**: 1 ym につき (Notion query 1 回 + Notion blocks API n 回) なので 30 件 MTG なら ~31 リクエスト。Notion レート制限は 3 req/sec 程度なので余裕あり
- **GmailApp.search コスト**: PJ × ym ごとに 1 回呼び (max 200 thread)。月 7 active PJ × 1 cron 実行 = 7 回 / 日。問題なし
- **Gemini レート / クォータ**: daily で会議数ぶんコールするが差分検知でほぼスキップされる。まさのアカウントは余裕あり
- **GAS 6 分実行制限 → maxItems バッチ化**: 1 回の cron 実行で各 PJ × 5 LLM call 上限。残りは翌日 cron に流れる (差分検知あり)

---

## R313 monthly_reports cron との関係 (TODO 別セッション)

R313 (AMD-Report GAS) の月次レポート生成は、Phase 2 完成後に「会議サマリ集約方式」に書き換える予定:

```
Phase 2 完了後:
  R313_MonthlyReport_Cron
    project_meeting_summaries.where(project_id, ym=当月).order(meeting_date)
      ↓ Sonnet で集約
    monthly_reports.draft_content / final_content を更新
```

これは AMD-Report GAS (本リポ外、別 clasp) の改修なので、別セッションで対応する。

---

## 反映状況 (append-only)

| 日付 | 範囲 | commit / 状態 |
|---|---|---|
| 2026-05-08 | Phase 1 仕様 md 初版 + PWA UI + GAS 実装 + migration 024 / 025 | 7f1aa74 |
| 2026-05-09 | **Phase 2 移行** (本仕様書き直し) | brave-cohen-15d352 セッション |
| 2026-05-09 | gas/074_MeetingSummaryRepo.js を Phase 2 に書き直し (Notion + Gmail 結合) | 同上 |
| 2026-05-09 | gas/092_AdminLLMExtractors.js: meeting_extract prompt v2 (combined sources) + version 260509_02 | 同上 |
| 2026-05-09 | migration 027 適用 (既存 7 行 DELETE + notion_page_id / gmail_thread_ids / source_kinds カラム追加) | 同上 |
| 2026-05-09 | GAS deploy v1425 + Protocol Store の meeting_extract prompt 更新 | 同上 |
| 2026-05-09 | p20 (**CX**, NIMS) 202604 初回バックフィル: `inserted` 1 / `inserted_none` 多数。p20 は元々 Notion メインなので `gmailThreads: 0` は想定通り | 同上 |
| 2026-05-09 | p21 (SX, 愛媛大) 202604 で **Phase 2 動作確認 OK**: 月 15 Gmail thread、`notion+gmail` 2 件 / `notion` 5 件 / `inserted_none` 13 件 / `skipped_no_event_id` 14 件 / `deferred_maxItems` 19 件 (daily cron で順次処理) / `error_llm` 1 件 | 同上 |
| 2026-05-09 | **Phase 3 実装** (会議終了 +60 分 trigger + 1 event 抽出 + iOS APNs 通知用 meeting_notifications テーブル) | 同上 |
| 2026-05-09 | gas/074: nav_meeting_processOneEvent_ + _meeting_findNotionPageByEventId_ + _meeting_loadOneByMeetingId_ 追加。153_MeetingHourlyTrigger.js 新規。152 cron に scheduling + fallback 構成 | 同上 |
| 2026-05-09 | migration 028: meeting_notifications テーブル作成 + RLS (anon/authenticated SELECT, authenticated UPDATE for notified_at) + 内容変更で notified_at 自動 NULL リセットトリガ | 同上 |
| 2026-05-09 | UI: source_kinds='none' を「議事録なし」、それ以外で内容空を「議事録あり・抽出空」と区別 (CockpitMeetingSummary.tsx + supabase-data.ts) | 同上 |
| 2026-05-09 | ios/HANDOFF_meeting_notifications.md 新規 (iOS Swift 側 APNs 通知の受け取り仕様、別セッション実装予定) | 同上 |
| 2026-05-09 | 初回 ad-hoc scheduling 試行 (3 trigger set) → GAS time-trigger 上限超え → **毎時 polling 方式に変更** | 同上 |
| 2026-05-09 | nav_meeting_pollRecentlyEndedEvents (毎時 polling) + nav_meeting_setupHourlyPollTrigger_ (setup) で再実装。GAS deploy v1430 / hourly poll trigger 1 個 set / 動作確認 OK | 同上 |
| 2026-05-09 | **prompt v3 化** (gas/092 meeting_extract): meeting_meta セクション (projectId/projectName/meetingTitle/meetingDate/sourceKinds) を冒頭に追加し「対象 PJ と無関係なら無視」明示。`_meeting_resolveProjectName_` 新設、source_hash に prompt version を混ぜる設計 (改訂で全行再抽出)。BUGS.md 「BWE 株主総会の MTGサマリ枠に CX のメールが混入」事故の再発防止 | 別セッション |
| **2026-05-09** | **Notion 議事録 cron 停止** (まさ判断、quirky-moore-b60501): 1 会議で 2 ページ生成 (cron テンプレ + Notion AI 自動生成) の事故により `gas/CalendarToNotionMinutes.js` の `run_createMinutes_apply` trigger 全削除 + ファイル冒頭に DEPRECATED 警告。今後は Notion AI / Meet 連携のページのみが議事録 DB に並ぶ | 72293f4 |
| **2026-05-09** | **AI 議事録ページ対応** (gas/074): `_meeting_fetchAiNotesBody_` 新設で `transcription` block → `summary_block_id` + `notes_block_id` 配下の標準 block を再帰取得 (heading_1〜4/paragraph/bulleted_list_item/to_do/quote/callout)。BWE 5/9 で検証成功 (decided 4 件 / 取締役辞任 + 株式譲渡 2 議案 + 採決結果 抽出) | fbeabb5 |
| **2026-05-09** | **page 選択ロジック簡素化**: cron テンプレ vs AI ページの本文厚さ比較を廃止し `last_edited_time 降順 sort で先頭採用` に統一 | 同上 |
| **2026-05-09** | **alias map 統合** (gas/079 NameAliasMap 新設): `members.member_name` + email から動的に正規化マップ生成 (「山田氏」=「りょー」「山地」=「まさ」「chiko」=「ちこ」)。074 / 155 双方の LLM プロンプトに渡す。BWE 検証で「山地正洋氏 → まさ」「吉﨑万莉氏 → まり」の正規化を確認 | 72293f4 |
| **2026-05-09** | **MTGサマリ feedback 対応** (gas/074 v4_alias_feedback): `_l2_loadFeedbackBlock_("meeting_summary", projectId, meetingId)` で過去依頼を取得 → userPrompt に追加。saved>0 で `_l2_recordFeedbackApplied_` で applied_count++。source_hash に active feedback hash を混ぜる → 修正依頼追加で自動再抽出。`POST /api/notifications/feedback` 末尾で **即 force 再抽出を fire-and-forget** | ac23ec1 |
| **2026-05-09** | **debug_meeting_inspectBlocks(pageId)** 新設 (gas/158): 任意ページの blocks 構造を JSON で返す常設 debug 関数 | fbeabb5 |
| TBD | Phase 2.1: reportEmails の整備 + CircleBack / GMeet 議事録メールの経路確認 | |
| TBD | Phase 2.5: AMD-Report GAS の R313 を会議サマリ集約に書き換え (別セッション) | |
