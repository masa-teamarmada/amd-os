# MTG サマリ — 設計の正本

最終更新: 2026-05-31 (Notion eventId 欠損 fallback / monthly_reports Supabase L2-first)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

---

## このドキュメントが扱う範囲

PJ コックピット (`/project/[projectId]/cockpit`) の **MTGサマリ枠** に「定例MTG各回のサマリ」と「これからある MTG の初見ブリーフ」を時系列で並べる機能の仕様。

- データソース: **Notion 議事録ページ本文 + Gmail 議事録メール (CircleBack 要約 / GMeet recording 通知 等) + Drive 関連資料 + Slack thread + Calendar event 本文** の結合
- 抽出: **Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow`** が calendar event 単位に、5 ソース + OS 文脈を読んで `narrative_md` + `summary_short` + `decided / progress / nextActions / risks` を生成
- 保存: Supabase の `project_meeting_summaries` (PK: `meeting_id` = calendar event id)
- 表示: PWA の `CockpitMeetingSummary` が Supabase を直読み
- 添付資料: PWA の MTG 詳細モーダルから、一般ファイル / スクショ / PDF / 画面キャプチャを `meeting_assets` に保存する。新規実体はDriveの `PJフォルダ / YYMMDD_会議名`、旧実体はprivate Storage互換で扱い、必要なものだけ `narrative_md` の Markdown 画像/リンクとして挿入する。
- 予定MTG: 日時が確定しているものだけ `source_kinds='upcoming'` として同じ `project_meeting_summaries` に保存し、会議前の「決めること / 用意するもの」を MTG サマリ欄の先頭に出す。日程未確定の仮置きは `source_kinds='upcoming_tentative'` / `prep_status='tentative'` とし、確定予定 count には含めず「日程調整中MTG」として同じ上段エリアに残す。
- future Calendar sync: H-1 automation が **今日0:00 JSTから今後60日** の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡す。前回議事録がまだ無いPJでも、Calendar上で確定しているMTGは `upcoming:<calendar_event_id>` としてカード化する。ただし weekly recurring MTG は series ごとに次回1件だけを保存・表示対象にし、それ以降の回はノイズとして同期/一覧表示しない。今日すでに開始済みの予定も、当日中はDrive資料やURL補強のため同期対象にする。PJ Drive folder に会議日フォルダや関連資料がある場合は、`drive_files` として予定カードの `関連Drive資料` に出す。
- 会議後 workflow: PWA `POST /api/meeting-workflow/finalize` が、routine 生成済み議事録の `decided` / `next_actions` / `narrative_md` から **日時まで明確な次MTG候補を複数抽出**し、次MTGカード・action item・Slack nudge 予約を作る。完了イベントは `POST /api/meeting-workflow/actions/:actionId/complete` で受ける。ここでは **LLM を呼ばない**。
- Notion 文字起こし導線: PWA の MTG サマリ / 予定MTGカードは、`project_meeting_summaries.notion_url` があれば **Notion文字起こしを開く** CTA を出す。未連携の場合、予定MTGは `source_url` の Calendar 予定を開き、Notion 側で録音/文字起こしを開始しやすくする。PWA から Notion の録音開始 API / 自動録音開始は呼ばない。あとから L6 が `notion_url` を埋めた場合に拾えるよう、カード上部に `メモ再読込` を置く。

このドキュメントは **PWA / GAS / Supabase 横断の正本**。

---

## 2026-05-29 current truth: token課金LLM cron ではなく MMOマシン automation + event-driven workflow

2026-05-22 の追加課金対策で、LLM 課金が発生する PWA / GAS background cron は停止済み。MTGサマリの品質改善は、PWA/GASに Anthropic/Gemini/OpenAI API 呼び出しを追加するのではなく、`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` を読む **Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow`** 側で行う。

- **LLMを使う場所**: H-1 MMOマシン automation。Notion/Gemini/CircleBack など既存AI議事録を素材にし、直近MTG・次MTG準備・現行MSを `os_context` として渡して `narrative_md` を作る。
- **LLMを使わない場所**: PWA/GAS/Vercel route。会議後 workflow は既存 `narrative_md` を使って、次MTG準備と通知の状態遷移だけを行う。
- **source_hash 方針**: 会議ソース + feedback + prompt revision で差分検知する。MS進捗のような揺れやすい OS context は hash に混ぜない。文脈更新のたびに再生成して credit を浪費しないため。
- **旧GAS LLM cron**: 153 / 152 は kill switch 維持。Gemini 経路なので復活させない。LLM 非依存の運用 cron はこの禁止対象ではない。
- **Notion eventId 方針**: Calendar event と Notion page の両方を見ている MMO automation が、該当 Notion page に `eventId` / 相当プロパティを可能な範囲で追記する。`eventId` が空でも title + event date + attendees + Gemini/Drive/Gmail URL で fallback し、欠損だけを理由に議事録を skip しない。
- **held-source guard**: Calendar 添付の Gemini / Google Meet notes Doc、Notion eventId 空の fallback match、`projects.report_emails` 空 PJ の Gmail Gemini notes / follow-up hit は、開催済みソースとして扱う。既存 `upcoming:<calendar_event_id>` は残し、開催済み row は `meeting_id=<calendar_event_id>` で別行作成し、可能なら `prep_source_meeting_id` で紐付ける。再発防止 fixture は `npm run test:l6-held-source-guard`。

品質劣化の主因は「元のAI議事録が低品質」ではなく、OS側が `summary_short` と配列へ潰して表示していたこと。正しい修正は、routine が `narrative_md` を本文として保存し、UI がそれを主表示すること。

### 議事録本文の上書き防止 (2026-05-27 追加)

`project_meeting_summaries.narrative_md` は議事録本文の正本。`summary_short` / `decided` / `progress` / `next_actions` / `risks` は検索・通知・補助表示用であり、本文の代替ではない。

- 開催済みMTGの `narrative_md` は、必ず `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の5見出しをこの順で使う。絵文字・見出し文言・順序は固定で、`## 🎯 背景` のように絵文字と語の間に空白を入れない。
- 各見出しの本文は段落で書く。箇条書き・チェックボックス・配列項目の貼り付けは議事録本文として扱わない。Markdown table は元データに表がある場合だけ許可する。
- `## ✅決まったこと` には、会議で実際に合意・確認・採択されたことだけを書く。Drive資料や準備資料だけから推定した論点は `## 📊経緯` または `## ⚠️残課題` に寄せる。
- 開催済みMTG (`source_kinds != 'none'` かつ `upcoming*` ではない) を保存する extractor / backfill は、原則 `narrative_md` を必ず同時に保存する。
- `narrative_md` が空、短すぎる、または箇条書き優勢の出力は「議事録を入れた」と見なさない。そういう場合は DB に直書きせず、run summary に `blocked_low_quality_narrative` として残す。
- 既存 row に 300 字以上の `narrative_md` がある場合、空・短文・箇条書き優勢の更新でそれを消してはいけない。migration 098 の `pms_preserve_rich_narrative` trigger が DB 側でも保護する。
- 手動修正 API (`POST /api/meeting-summary/manual-update`) も同じ保護を持ち、明示的な maintenance escape なしに rich narrative を空欄や箇条書きだけへ落とさない。
- 過去議事録の手動 backfill でも、`generated_by_model='codex_manual_*'` などで `summary_short` と4配列だけを入れる運用は禁止。まず narrative を作ってから upsert する。
- 表示側は `notion:<page_id>` 由来かつ `narrative_md` なしの弱い手動 duplicate が、同じ `project_id + meeting_date + normalized title` の強い row と並ぶ場合だけ非表示にする。DBからは消さず、正しい canonical row を読ませるための UI safety net。

---

## 旧GAS設計セクションの扱い

この下に残っている Phase 2 / Phase 3 / GAS LLM cron の説明は履歴と移植元の参照用。2026-05-29 現在の正本実装ではない。MTG サマリ / L2 議事録品質改善では、Windows MMO Codex Desktop automation H-1 と event-driven workflow だけを現行ルートとして扱う。

## Phase 2 の大方針 (履歴: Phase 1 から何を変えたか)

| 観点 | Phase 1 (廃) | Phase 2 → Phase 3 (旧GAS実装) |
|---|---|---|
| 主軸 | Notion 議事録ページ単独 | **1 calendar event = 1 行** |
| `meeting_id` PK | Notion page id | **calendar event id**。Notion 議事録ページの `eventId` プロパティがあれば使い、無い場合は Calendar event 側を正として title/date fallback で Notion page を探す |
| 議事録ソース | Notion ページ本文のみ | **Notion ページ本文 + Gmail (reportEmails ±1日)** を結合 |
| 議事録なし扱い | 抽出スキップ (= 行が出ない) | `summary_short = "議事録なし"` でマーカー行を残す |
| 範囲 | 1 PJ × 1 ym | 同左 (旧GASでは daily 実行で当月分を再走) |
| 差分検知 | 本文 sha256 | (Notion 本文 + Gmail 結合テキスト) sha256 |

**変えた理由**: Phase 1 は Notion 議事録の本文が薄い (タイトルだけ等) と Gemini も「内容なし」を返してしまい、大半が空 items になっていた。実運用では「**議事録の中身は Notion とは限らず、CircleBack 要約や GMeet recording 通知が Gmail に流れてきて、それを議事録として使ってる**」(まさの運用)。だから議事録ソースを広げる。

---

## 旧GASデータフロー (履歴)

この節の `cron` / `trigger` / `Gemini call` は 2026-05-22 以前の実装履歴。セットアップ手順を再実行しない。

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

**重要**: Notion 議事録ページが無ければ旧GAS経路では拾えない。
ただし上流の `cron_createMinutesFromCalendar` (CalendarToNotionMinutes.js) が
毎日 03:00 で **明日分の calendar event について議事録枠を自動生成** しているので、
通常は Notion 議事録ページが存在する状態で当 cron が走る。allDay event /
`+`プレフィックス / `EXCLUDE` alias は除外される (= 議事録ページが作られない)。

---

## Phase 3: 毎時 polling + iOS APNs 通知 (履歴)

Phase 2 (月単位 fallback) に加えて、Phase 3 (毎時 0 分の cron で「会議終了直後の events」を polling して抽出) を追加した旧仕様。現在の正規ルートではない。

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

### Setup (実行禁止: 履歴)

```bash
# 旧GAS hourly poll trigger。2026-05-26 現在は実行しない
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

## 予定MTG / 初見ブリーフ (2026-05-25 追加)

開催前の MTG は、議事録抽出を待たずに `project_meeting_summaries` へ `source_kinds='upcoming'` で保存する。これにより PJ コックピットの MTG サマリ枠が、過去の議事録だけでなく「今日・明日なにを決めるべきか」を見る場所にもなる。

### 保存ルール

| column | 予定MTGでの意味 |
|---|---|
| `meeting_id` | `upcoming:{calendar_event_id}`。Calendar ID がない場合は `upcoming:{project_id}:{yyyymmdd}:{title_hash}` |
| `source_kinds` | 日時確定なら `upcoming`。日程未確定・仮置きなら `upcoming_tentative` |
| `source_url` | Google Calendar event URL |
| `summary_short` | この MTG の狙い |
| `decided` | この MTG で決めること |
| `progress` | 前提・持ち込みたい現状 |
| `next_actions` | それまでに用意するもの |
| `risks` | 未整理の論点・気をつけること |
| `narrative_md` | Codex / えいみと作った初見ブリーフ。背景、今回の焦点、会議後に残したい状態、準備を文章でつなぐ |

### API

`POST /api/meeting-prep` は `project_meeting_summaries` へ予定MTG row を upsert する。admin session または event-driven workflow 用の `Authorization: Bearer ${WORKFLOW_SECRET}` で実行できる。`WORKFLOW_SECRET` 未設定の環境では `CRON_SECRET` を fallback として許可する。`meeting_start_at` が空、または `is_tentative=true` / `prep_status='tentative'` の場合は `source_kinds='upcoming_tentative'` として保存する。

`POST /api/meeting-prep/calendar-sync` は、H-1 routine がGoogle Calendar MCPで読んだ future events を受け取り、PJ判定して `source_kinds='upcoming'` row を upsert する。PWA route 自体はGoogle Calendarへアクセスしない。受け付ける event metadata は `calendar_event_id` / `recurring_event_id` / `title` / `start` / `end` / `url` / `description` / `location`。`project_id` を event ごとに渡した場合は強制紐付け、無い場合は `projects.project_name` / `project_id` / `client_name` で判定する。既に手動編集された準備本文は上書きせず、日時・title・Calendar URLだけ同期する。

weekly recurring MTG は、Google Calendar の `recurring_event_id` が取れる場合はその series id、取れない場合は PJ + title + 曜日 + 開始時刻で series を推定し、6〜8日間隔の連続予定なら次回1件だけを upsert する。同じPJに複数の weekly series がある場合も series ごとに1件ずつ残す。既にDBに複数回分が存在している場合に備え、`CockpitMeetingSummary` 側でも同じ考え方で一覧表示を次回1件に絞る。

`calendar-sync` は任意で `drive_files` も受け取る。これは route が Drive を読みに行くのではなく、H-1 routine が Google Drive MCP で会議日フォルダ・議案資料・予実表・招集通知などを見つけて渡す metadata。最大 8 件程度を `narrative_md` の `関連Drive資料` にリンクとして載せ、`source_hash` にも含める。Drive探索は root 直下だけでなく、日付 token (`YYMMDD` / `YYYYMMDD` / `YYYY-MM-DD`) と会議 title token で1階層のサブフォルダまで見る。これにより CLG `260527_取締役会` のように、資料が Drive サブフォルダに置かれている予定MTGでも事前カードから見える。

主な入力:

```json
{
  "project_id": "p25",
  "meeting_date": "2026-05-26",
  "meeting_start_at": "2026-05-26T15:00:00+09:00",
  "title": "KUTE MTG",
  "calendar_event_id": "...",
  "source_url": "https://www.google.com/calendar/event?...",
  "summary_short": "...",
  "decided": ["..."],
  "progress": ["..."],
  "next_actions": ["..."],
  "risks": ["..."],
  "narrative_md": "..."
}
```

### UI

- `CockpitMeetingSummary` は `source_kinds='upcoming'` の行を、通常の月別議事録とは分けて先頭の「予定MTG / 準備中」ブロックに表示する。`meeting_id LIKE 'upcoming:%'` だけでは確定予定扱いにしない。weekly recurring MTG は series ごとに次回1件だけ表示する。日程未確定の仮置き (`upcoming_tentative`) は「日程調整中MTG」ブロックに表示し、確定予定 count には含めない。仮置き用の `meeting_date` は DB の都合で入っていても、一覧では未定として表示する。
- row には `予定MTG` chip と Calendar link を出す。
- 詳細モーダルは `narrative_md` の「初見ブリーフ」を主表示にする。`decided / progress / next_actions / risks` は箇条書きではなく、「会議後に残したい状態」「いまの状況」「当日までに揃えるもの」「必ず確認すること」という文章カードとして補助表示する。既存 `risks` の値は破壊せず「必ず確認すること」に読み替えて表示・編集する。
- 編集欄は `1段落1ブロック` で保存する。短い断片を並べる用途ではなく、初めて読む人が背景・狙い・準備を文章として追える粒度にする。
- 「Codex相談メモをコピー」で、今の内容を Codex に渡すための Markdown prompt としてコピーできる。
- 「準備内容を編集」から同じ row を更新できる。保存先は `POST /api/meeting-prep`。

通常の MTG が終わったあとは、議事録抽出 routine が同じ Calendar event を通常の議事録 row として保存する。予定MTG row は「準備時点の考え」として残してよい。

## 議事録の手動修正 (2026-05-27 追加)

MTGカードの一覧に出る短い文章は `project_meeting_summaries.summary_short`。詳細モーダルは `narrative_md` があればそれを主表示し、無い場合だけ `summary_short` と `decided / progress / next_actions / risks` を表示する。今後の `narrative_md` は、MTGに参加していなかったメンバーが読んでも背景・議論の流れ・決定/未決・次の一手が分かる文章 narrative を正とする。箇条書きの羅列は議事録本文として扱わない。

通常MTG / dialogue の詳細モーダルには「表示内容を編集」を置き、表示中の section と同じ source field を `POST /api/meeting-summary/manual-update` で直接上書きする。`narrative_md` が表示されている場合は `narrative_md` を、raw 配列が表示されている fallback 時だけ `decided / progress / next_actions / risks` を編集する。

- `title`
- `summary_short`
- `narrative_md`
- `decided`
- `progress`
- `next_actions`
- `risks`

手動修正では `source_hash` を変更しない。同じ Calendar / Notion / Slack / Drive / Gmail ソースに対する抽出 routine は source hash が一致する限り再生成せず、手動修正文を壊さない。2026-05-29 以降、コックピットの MTG 詳細モーダルでは「つくよみに修正依頼」を出さない。誤抽出は `POST /api/meeting-summary/manual-update` で人間が直接直し、保存後の `generated_by_model` は `manual-edit` とする。

## MTG 添付資料 / スクショアップロード (2026-05-27 追加)

Meet / CircleBack / Gmail 議事録メールだけでは、会議中に画面共有された表・スライド・ホワイトボード・スクショを拾えない。そこで、MTG 詳細モーダルに **添付資料トレイ** を追加する。

### できること

- **最短MVP**: `選択` ボタンから md / docx / xlsx / pptx / txt / csv / zip / 画像 / PDF など一般ファイルを MTG に添付する。
- **便利版**: 添付トレイへ drag & drop、または `Cmd+V` / `ペースト` でクリップボード画像を追加する。添付ごとに caption を編集し、上下ボタンで表示順を変え、不要な添付を削除できる。
- **最高版**: `画面` ボタンから browser の `getDisplayMedia` を使い、画面共有の 1 frame を PNG として `asset_kind='screen_capture'` で保存する。browser が許可 dialog を出すため、無断キャプチャはしない。
- **本文への反映**: `本文へ` を押すと、現在の添付一覧を `narrative_md` に `<!-- meeting-assets:start -->` / `<!-- meeting-assets:end -->` block として挿入する。画像は `![caption](/api/meeting-assets/file/{asset_id})`、画像以外は link として表示する。
- **保存先表示**: MTG詳細モーダル上に `保存先: PJフォルダ / YYMMDD_会議名` を表示する。Drive folder link は権限内ユーザーが開くための導線だけにし、raw secret や外部公開URLは出さない。

### データ方針

- 新規アップロードの実ファイルは Google Drive の当該 PJ folder (`projects.drive_folder_id`) 配下に、MTG専用 folder `YYMMDD_会議名` を作成/再利用して置く。同名 folder が既にあれば再利用し、重複乱立させない。
- `YYMMDD` は `project_meeting_summaries.meeting_date` から作り、会議名は Drive / filesystem 安全な文字へ sanitize する。会議日または PJ folder mapping が解決できない場合は、silent success にせず明示エラーにする。
- 旧添付の互換用に private Supabase Storage bucket `meeting-assets` の閲覧 path は残す。新規保存先は Drive、OS DB には metadata のみ残す。
- DB には `meeting_assets` として `asset_id / meeting_id / project_id / drive_file_id / project_drive_folder_id / drive_folder_id / drive_folder_name / web_view_link / folder_display_path / media_type / caption / sort_order / asset_kind` を保存する。
- `project_meeting_summaries` 本体に base64 画像や signed URL は保存しない。`narrative_md` には永続 route `/api/meeting-assets/file/{asset_id}` だけを入れる。
- PWA route はアップロード・表示 URL 発行・Markdown 挿入だけを行い、従量課金 LLM を呼ばない。画像の意味抽出や表OCRを行う場合は、H-1 routine / Codex automation 側で `meeting_assets` を入力に含める。
- `extracted_text` は将来の OCR / vision 結果用。画像そのものではなく、短いテキスト化された根拠だけを保存する。

### API

| API | 役割 |
|---|---|
| `GET /api/meeting-assets?meeting_id=...` | admin session で添付一覧 + file route / 保存先表示 metadata を返す |
| `POST /api/meeting-assets` | multipart `files[]` を Drive の `PJフォルダ / YYMMDD_会議名` へ保存し、`meeting_assets` に metadata insert |
| `PATCH /api/meeting-assets` | `caption` / `sort_order` / `extracted_text` を更新 |
| `DELETE /api/meeting-assets?asset_id=...` | legacy Storage asset は Storage object と DB row を削除。Drive-backed asset はDrive実ファイルを消さず、OS添付rowだけ外す |
| `GET /api/meeting-assets/file/{asset_id}` | admin session で legacy Storage signed URL へ redirect、またはDrive fileを権限内でstream |
| `POST /api/meeting-assets/insert-markdown` | 添付一覧を `narrative_md` の添付資料 block に挿入/置換 |

### えいみ / CLI から資料をコックピットに載せる正しい手順 (2026-06-17 まさ指摘・再発防止)

`POST /api/meeting-assets` / `POST /api/project-documents` は `requireAdmin` / `requireAuth`（ブラウザ session 必須）で、**CLI の Bearer (CRON_SECRET) では叩けない**。`meeting-assets` Storage bucket は `image/* + application/pdf` のみ許可で **md/docx 等は 415**。ローカル `.env.local` に Google Drive 認証は無く Drive API 直叩きもできない。

→ えいみ / Codex が CLI から資料をコックピットに載せるときは、**PDF 変換や Storage 直挿しでこじらせない**。次の 3 手順を使う（まさが何度も指示している正規ルート）:

1. **実ファイルは共有ドライブに置く**: ローカルにマウントされた Google Drive (`~/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/...`) の、当該 PJ の `AMD OS 資料` フォルダへ `cp` する。例: p00 (AMD全社) = `共有ドライブ/ARMADA/a0_management/AMD OS 資料/`。`cp` だけで Drive へ同期される（コックピット「資料」セクションの実体フォルダ）。
2. **Drive ファイル ID は xattr から取る**: `xattr -p 'com.google.drivefs.item-id#S' "<file>"` → Drive item-id。Web URL は `https://drive.google.com/file/d/<id>/view`。Drive API 認証は不要。
3. **リンクを埋める**: その Drive URL を、該当 MTG カードの `project_meeting_summaries.narrative_md`（または相応の表示箇所）へ service_role REST で埋める。

MTG カード自体の生成は `POST /api/meeting-prep` が Bearer (CRON_SECRET) で叩けるので CLI から作れる。`source_kinds='upcoming'`、`meeting_id='upcoming:<calendar_event_id>'`（実 Calendar event id）にすると H-1 calendar-sync と重複しない。

### 会議後 workflow の次MTG抽出ルール

- `POST /api/meeting-workflow/finalize` は `next_meeting.meeting_start_at` が明示された場合、その1件を優先してカード化する。
- 明示入力がない場合も、議事録の `decided` / `next_actions` / `summary_short` / `narrative_md` から、`6/11（水）15:00` や `2026-06-11 15:00` のように **日付と時刻が両方ある** MTG表現だけを抽出する。
- future Calendar sync は `finalize` を待たない。前回MTGサマリが空でも、Calendar上で確定している未来予定は `calendar-sync` で予定MTGカード化する。
- `6月3週目以降`、`来月以降`、`日程調整` のような曖昧な候補は、予定MTGカードを自動生成しない。必要なら `POST /api/meeting-prep` で `is_tentative=true` の仮置きカードとして手動保存する。
- 旧実装の「次MTG指定がなければ7日後に1件作る」fallback は廃止。架空の予定カードを作らないため。
- 抽出候補が複数ある場合は最大6件まで `source_kinds='upcoming'` で保存する。ただし Google Calendar event は自動作成しない。Calendar作成は `next_meeting.create_calendar=true` の明示入力時だけ。

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
  source_kinds        TEXT,                                -- 'notion' | 'gmail' | 'notion+gmail' | 'dialogue' | 'upcoming' | 'upcoming_tentative' | 'none'

  source_hash         TEXT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_model  TEXT,                                -- 例: 'gemini-2.5-flash' / NULL (none)

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: anon, authenticated とも SELECT 可 (PWA は anon key で読む)
-- 書き込みは service_role 経由 (GAS supa_upsert)
```

添付資料は migration 097 で別テーブル + private Storage bucket に分離し、migration 134 でDrive保存先 metadata列を追加する。

```sql
CREATE TABLE meeting_assets (
  asset_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        TEXT NOT NULL REFERENCES project_meeting_summaries(meeting_id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  storage_bucket    TEXT NOT NULL DEFAULT 'meeting-assets',
  storage_path      TEXT NOT NULL UNIQUE,
  drive_file_id     TEXT,
  project_drive_folder_id TEXT,
  drive_folder_id   TEXT,
  drive_folder_name TEXT,
  drive_folder_web_view_link TEXT,
  web_view_link     TEXT,
  folder_display_path TEXT,
  file_name         TEXT NOT NULL,
  media_type        TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL DEFAULT 0,
  asset_kind        TEXT NOT NULL DEFAULT 'upload',
  caption           TEXT,
  extracted_text    TEXT,
  source_url        TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
| [pwa/src/components/cockpit/CockpitMeetingSummary.tsx](../src/components/cockpit/CockpitMeetingSummary.tsx) | 一覧 UI (行クリックで `CockpitMeetingDetailModal` を開く) |
| [pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx](../src/components/cockpit/CockpitMeetingDetailModal.tsx) | **詳細モーダル (2026-05-23 新設)**。`@base-ui/react` Dialog を `!max-w-[1100px] w-[92vw] max-h-[88vh]` で開く。summary_short / decided / progress / next_actions / risks を `MarkdownView` で描画 |
| [pwa/src/app/api/meeting-prep/route.ts](../src/app/api/meeting-prep/route.ts) | **予定MTG準備 API (2026-05-25 新設)**。`source_kinds='upcoming'` row を upsert |
| [pwa/src/app/api/meeting-prep/calendar-sync/route.ts](../src/app/api/meeting-prep/calendar-sync/route.ts) | **future Calendar sync API (2026-05-27 新設)**。H-1が読んだ未来Calendar eventから `source_kinds='upcoming'` row を deterministic upsert |
| [pwa/src/app/api/meeting-summary/manual-update/route.ts](../src/app/api/meeting-summary/manual-update/route.ts) | **議事録手動修正 API (2026-05-27 新設)**。通常MTG / dialogue row の表示用フィールドを上書きする。`source_hash` は変更しない |
| [pwa/src/app/api/meeting-workflow/finalize/route.ts](../src/app/api/meeting-workflow/finalize/route.ts) | **会議後 workflow API (2026-05-26 新設)**。routine 生成済み議事録から次MTGカード / Calendar / action item / Slack nudge 予約を作る。LLM 呼び出しなし |
| [pwa/src/app/api/meeting-workflow/actions/[actionId]/complete/route.ts](../src/app/api/meeting-workflow/actions/[actionId]/complete/route.ts) | **準備action完了 API (2026-05-26 新設)**。Slackボタン / OS UI / webhook から action を done にし、prep_status を ready/nudging に更新。LLM 呼び出しなし |
| [pwa/src/components/cockpit/MarkdownView.tsx](../src/components/cockpit/MarkdownView.tsx) | **共通 Markdown renderer (2026-05-23 新設)**。`react-markdown` + `remark-gfm` ベース。`tone: 'light' \| 'hud'` で配色切替。GFM table / 見出し / リスト / コード / 引用 / リンク をサポート |
| [pwa/src/components/hud/HudCockpitMeetingSummary.tsx](../src/components/hud/HudCockpitMeetingSummary.tsx) | HUD 版一覧 UI (= 同じパターンで `HudCockpitMeetingDetailModal` を開く) |
| [pwa/src/components/hud/HudCockpitMeetingDetailModal.tsx](../src/components/hud/HudCockpitMeetingDetailModal.tsx) | **HUD 詳細モーダル (2026-05-23 新設)**。cyber 配色版 (cyan/slate/grid)。中身は `MarkdownView tone='hud'` |

### UI 仕様 (2026-05-23 更新)

- 月でグルーピング、`meeting_date DESC` 降順
- 直近 1 年デフォルト + 「▼ それより前を表示」トグル
- **行クリックで詳細モーダル展開** (= 旧アコーディオン折り畳みは廃止)
- 行クリック時は URL を `/project/[projectId]/cockpit?meeting=<meeting_id>` に更新する。共有された同 URL で開くと該当 MTG 詳細モーダルを auto-open し、直近 1 年に無い row は older load で探す。閉じると `meeting` query だけを外す。`ym` / `step` と同時に来た場合は MTG 詳細を優先し、月次系モーダルとの二重起動は避ける。
- `source_kinds='upcoming'` は月別議事録より上の「予定MTG / 準備中」に出し、詳細モーダルでは初見ブリーフとして表示する
- 一覧カードの本文は `summary_short` を line-clamp 2 で表示する。詳細モーダルは `narrative_md` があれば本文として優先表示し、`narrative_md` が無い場合だけ `summary_short` + raw 配列を表示する。`narrative_md` は「そのMTGに参加していなかったメンバーでも会議の流れを理解できる文章」とし、`## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の固定順で書く。箇条書き・チェックボックス・配列項目の貼り付けを本文にしない。
- モーダル内: ヘッダ (日時 + title + notion link + source_kinds chip) → サマリ / narrative → 決まったこと → 進んだこと → 次やること → リスク を縦並び。各 item は `MarkdownView` で markdown 描画 (= 表/見出し/リスト/コード/引用 OK)。編集 mode では表示している section が同じ位置で textarea になる
- 議事録なしマーカー行は `summary_short` だけ "議事録なし" が出る (decided/progress/... は空なので非表示、`Notion で開く` リンクは notion_url があれば出る)
- 通常MTG / dialogue は詳細モーダルの「表示内容を編集」から、表示中の `narrative_md` または raw section (`summary_short / decided / progress / next_actions / risks`) を更新できる。保存先は `POST /api/meeting-summary/manual-update`。MTG 詳細モーダルには「つくよみに修正依頼」を置かず、LLM 再解釈ではなく手動編集を正本にする。
- jsonb 配列 (decided / progress / next_actions / risks) の各要素には **GFM table を含む長文 markdown を保存する運用** に変更 (= 提案前の論点整理セッションの議事録のように、L表/U表/L×U マトリクスを各要素に埋め込んで詳細解説する用途)。表は `<div className="overflow-x-auto">` で横スクロール対応

---

## 既知の制約・運用上の注意

- **議事録ページ未作成回**: `cron_createMinutesFromCalendar` で対象外 (allDay / `+`prefix / `EXCLUDE` alias) になった calendar event は議事録ページが無いので Phase 2 cron では拾えない。これは仕様 (= MTG ではないと判定された)
- **古い議事録 / 手動議事録 (eventId プロパティなし)**: 現行の MMO automation は `eventId` 欠損だけでは skip しない。title + event date + attendees + Gemini/Drive/Gmail URL で fallback し、採用した Notion page には可能なら Calendar event id を追記する。追記できない場合も Gmail / Drive / Slack / Calendar 本文で抽出を続ける。旧GAS履歴上の `skipped_no_event_id` は現行仕様では禁止。
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

## M-1 monthly_reports automation との関係

R313 (AMD-Report GAS) は旧経路で、定期 trigger は置かない。月次レポート生成は M-1 Codex automation `AMD OS M-1 月次報告抽出` が担当し、MTG サマリは Supabase L2 snapshot の primary input として月次 draft に使う。5 生データは L2 coverage が薄いときの gap check / backfill fallback。

```
M-1 automation:
  Supabase L2 snapshot (project_meeting_summaries / strategy / XRL / registry / protocols / knowledge / MS)
    + Gmail / Drive / Calendar / Slack / Notion gap check fallback
      ↓ Sonnet で集約
    amd-os-ms/outbox.monthlyReports
      ↓ LaunchAgent + non-LLM applier
    monthly_reports.draft_content を更新
```

R313 を会議サマリ集約方式に書き換える TODO は廃止。必要な改善は `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md` に入れる。

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
| **2026-05-09** | **alias map 統合** (gas/079 NameAliasMap 新設): `members.member_name` + email から動的に正規化マップ生成。姓・フルネーム・ローマ字表記を `members.code_name` へ寄せる block を 074 / 155 双方の LLM プロンプトに渡す | 72293f4 |
| **2026-05-09** | **MTGサマリ feedback 対応** (gas/074 v4_alias_feedback): `_l2_loadFeedbackBlock_("meeting_summary", projectId, meetingId)` で過去依頼を取得 → userPrompt に追加。saved>0 で `_l2_recordFeedbackApplied_` で applied_count++。source_hash に active feedback hash を混ぜる → 修正依頼追加で自動再抽出。`POST /api/notifications/feedback` 末尾で **即 force 再抽出を fire-and-forget** | ac23ec1 |
| **2026-05-29** | **コックピット MTGサマリ修正導線を手動編集へ一本化**: `CockpitMeetingDetailModal` から「つくよみに修正依頼」ブロックを撤去し、「議事録を手動修正」→ `POST /api/meeting-summary/manual-update` を主導線に変更。既存の historical `l2_feedbacks` は routine 側で読めるが、コックピット詳細から新規作成しない。 | 本セッション |
| **2026-05-29** | **MTGサマリ narrative の箇条書き禁止を明文化**: H-1 routine / dialogue narrate は、欠席メンバーが背景から次の一手まで追える文章 narrative を生成する。`decided` 等の配列は検索・通知用の補助で、議事録本文を箇条書きに戻さない。 | 本セッション |
| **2026-05-29** | **議事録本文の5見出し固定順を正本化**: 開催済みMTGの `narrative_md` は `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順に固定。表記ゆれや順序違いは品質 gate で保存しない。 | 本セッション |
| **2026-05-29** | **weekly recurring 予定MTGを次回1件に制限**: `calendar-sync` は同じ weekly series の future occurrences を次回以外 skip し、`CockpitMeetingSummary` も既存DB行を series ごとに次回1件だけ表示する。複数 weekly series が同じPJにある場合はそれぞれ1件ずつ残す。 | 本セッション |
| **2026-05-09** | **debug_meeting_inspectBlocks(pageId)** 新設 (gas/158): 任意ページの blocks 構造を JSON で返す常設 debug 関数 | fbeabb5 |
| TBD | Phase 2.1: reportEmails の整備 + CircleBack / GMeet 議事録メールの経路確認 | |
| TBD | Phase 2.5: AMD-Report GAS の R313 を会議サマリ集約に書き換え (別セッション) | |
