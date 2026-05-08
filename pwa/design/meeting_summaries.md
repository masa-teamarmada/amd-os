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

| 観点 | Phase 1 (廃) | Phase 2 (現行) |
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
- **2026-05-09 初回バックフィル時の観察**: p20 (SX) 202604 で `inserted_none` が大半、`inserted` (Notion 本文あり) が 1 件、`gmailThreads: 0` が大半。reportEmails 設定が空 or CircleBack/GMeet 通知が登録アドレスに届いていない可能性。次セッションで `DB_Projects.reportEmails` の中身を確認 + 議事録メール経路の整備が必要 (Phase 2.1 と呼ぶ)
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
| 2026-05-09 | p20 (SX) 202604 初回バックフィル: `inserted` 1 / `inserted_none` 多数。Gmail thread 取得 0 件のため reportEmails 整備は Phase 2.1 で対応 | 同上 |
| TBD | Phase 2.1: reportEmails の整備 + CircleBack / GMeet 議事録メールの経路確認 | |
| TBD | Phase 2.5: AMD-Report GAS の R313 を会議サマリ集約に書き換え (別セッション) | |
