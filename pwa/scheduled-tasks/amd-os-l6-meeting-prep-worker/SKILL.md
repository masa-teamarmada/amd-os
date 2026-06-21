---
name: amd-os-l6-meeting-prep-worker
description: AMD OS H-1 MTG Prep Worker。1 MTG = 1 run の専属 Codex Cloud automation。spawner が動的に登録した worker run として発火し、対象 MTG の文脈をすべてロード、過去同シリーズの流れを踏まえた着地点 draft、Drive 資料 draft、Notion 議事録 draft (アジェンダ草案入り)、readiness score を生成して `project_meeting_summaries` の prep_* 列に upsert する。最後に prep_worker_status='ready' へ遷移して待機。まさが Codex Cloud session に入ってきた瞬間に「背景はこうで、過去◯件の流れだとこの着地点で、資料は drive に置いた。これでいい?」から対話を始められる状態を作る。
---

# AMD OS H-1 MTG Prep Worker

まさが「明日 MTG あるけど準備してない、codex を毎回開いて『背景はこうで…』と説明するのがだるい」と言った問題への OS 側回答。spawner が翌48h の MTG ごとに 1 つこの worker を Codex Cloud で動的 spawn する。**1 MTG = 1 run = 1 session**。

## 設計の核

- **1 MTG 専属**: 引数で `meeting_id` / `project_id` を受け取り、その MTG だけに集中する。複数 MTG をまとめて扱わない (= context 汚染回避)。
- **過去の流れを踏まえる**: 同シリーズの過去 `narrative_md` 全件 read。着地点は「前回の宿題 + 直近 dialogue + project_strategy_signals + project_knowledge」から推定。
- **draft は draft 置き場にしか書かない**: Drive は `PJfolder/YYMMDD_MTG名_prep/`、Notion は新規ページ (本ページではない)、Calendar の本 event は書き換えない。
- **status 遷移**: `spawning` (= spawner upsert 直後) → `preparing` (= worker 起動 phase 1) → `ready` (= 全部 upsert 完了) → 待機。途中で fatal → `failed`。
- **session 終了しない**: 全部 upsert 完了したら、Codex Cloud 上で idle session として待機。まさが入ってきたら `prep_draft_md` を文脈として対話継続。

## 【絶対】 動く前に必ず Read

1. `pwa/spec/3-3-meeting-flow-current-spec.md` の「MTG Prep Worker」節 (= 仕様正本)
2. `pwa/manual/2-3-pj-cockpit.md` の「MTG Prep Worker」節 (= ユーザー視点)
3. `pwa/manual/8-3-l2-extraction-routines-spec.md` の H-1 章 (= 既存 H-1 抽出との境界)
4. `pwa/design/db_schema.md` の `project_meeting_summaries` (= **列名は想像で書かない、必ず grep**)
5. `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` (= 既存 H-1 抽出の流儀、文脈ロード手順を流用)

## 入力 (= spawner からの引数)

| 引数 | 型 | 説明 |
|---|---|---|
| `meeting_id` | text | `project_meeting_summaries.meeting_id` (例: `upcoming:cal-event-abc123`) |
| `project_id` | text | `projects.project_id` (例: `p07`, `p19`) |

これだけ。他はすべて DB / Calendar / Notion / Drive / Gmail から worker が自分で引く。

═══════════════════════════════════════════════════
Phase 0: env と対象 MTG の読み込み
═══════════════════════════════════════════════════

1. cwd を `/Users/masa/projects/AMD/amd-os` に固定
2. `pwa/.env.local` から SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY をロード
3. `prep_worker_status='preparing'` に upsert (= UI 側の chip が「準備中」になる)
4. 対象 MTG を読み込み:
   ```
   GET /rest/v1/project_meeting_summaries
       ?meeting_id=eq.{meeting_id}
       &select=*
   ```
   - `meeting_start_at`, `title`, `source_kinds`, `calendar_event_id`, `notion_url`, `notion_page_id`, `gmail_thread_ids` を取得
   - `source_kinds` に `upcoming` token が無い場合は `failed` upsert して exit (= 既に開催済み or canceled)
5. PJ コンテキスト読み込み:
   - `projects` (`project_name`, `lane`, `status`, `drive_folder_id`, `facilitator_member_id`, `report_emails`)
   - `project_members` (= active members + role)
   - `projects.status NOT IN ('active', 'sales')` なら `failed` upsert して exit

═══════════════════════════════════════════════════
Phase 1: 過去同シリーズの議事録を全 read (= 流れを踏まえる)
═══════════════════════════════════════════════════

1. `calendar_event_id` から `recurring_event_id` を推定 (= 既存 H-1 routine と同じロジック、または title の token match)
2. 同 series の過去 `project_meeting_summaries` を時系列降順で read:
   ```
   GET /rest/v1/project_meeting_summaries
       ?project_id=eq.{project_id}
       &source_kinds=not.like.%upcoming%
       &order=meeting_date.desc
       &limit=10
   ```
   - title token 一致 (= 「定例」「KUTE」「pHydrogen」等のタイトル token) で series filter
3. 各回の `narrative_md` / `decided` / `next_actions` を全文 read
4. 直近 next_actions の消化状況を `tasks` table と照合 (= readiness 計算用)

═══════════════════════════════════════════════════
Phase 2: PJ 全体文脈の read
═══════════════════════════════════════════════════

並列で:
- `monthly_reports` 直近3件
- `project_knowledge` (status='active')
- `project_strategy_signals` (status IN ('candidate', 'confirmed'), 直近30日)
- `project_xrl_evidence` 直近3件
- `tsukuyomi_nudge_queue` (PJ 関連、未消化)
- `value_milestones` + `milestone_monthly_progress` (= MS context)
- 直近の `project_meeting_summaries` (source_kinds='dialogue', = まさえいMTG)

═══════════════════════════════════════════════════
Phase 3: 外部 source の read
═══════════════════════════════════════════════════

並列で:
- Calendar event detail (= attendees, location, description, conference data)
- Notion: 既存 `notion_page_id` があれば本文 read。無ければ skip
- Gmail: `projects.report_emails` 配下の直近30日 thread。相手側メールのやり取り抜き出し
- Drive: PJ folder 直下 + 直近 modified 上位10件のファイル metadata
- Calendar freebusy: 対象 facilitator + まさ の翌48h busy window

═══════════════════════════════════════════════════
Phase 4: 着地点 / 想定質問 / 持参物 draft 生成
═══════════════════════════════════════════════════

LLM (= Codex automation 内 GPT-5.5 high reasoning) で `prep_draft_md` を生成。フォーマット:

```md
# {MTG タイトル} prep draft

## 🎯 着地点 (= 推定)
{2-3 文。過去の流れと直近 dialogue / signals から推定した「このMTGで決めるべきこと / 持ち帰るべきこと」}

## 📊 背景 (= 過去同シリーズの流れ)
{2-4 段落。前回までの議論と決定事項、PJ の現在の状況 (= MS 進捗 / XRL / 経営シグナル) から、なぜこの MTG が必要かを記述}

## 🔍 想定質問 (= 相手側 / 自分側)
- 相手から来そうな質問: {3-5 項目}
- 自分から聞きたいこと: {3-5 項目}

## 📦 持参物 / 準備物
- {資料 draft (作成済): [Drive link]}
- {確認が必要な数字: ...}
- {持っていく印刷物: ...}

## ⚠️ 留意点
{過去の議事録から「次回気をつけるべき」と書かれた残課題、相手側の機嫌・関係性の留意、過去 missed deadline 等}

## 🗂 参照済みソース
- 過去同シリーズ {N}件: {meeting_date list}
- 関連 monthly_reports: {ym list}
- 関連 strategy_signals: {N件}
- Notion: {URL or 「未連携」}
- Gmail thread: {N件}
- Drive 既存資料: {N件}
```

**プロンプト方針** (= worker LLM call の中身):
- 「あなたは AMD OS の MTG 準備 worker。対象 MTG の着地点と背景を、過去同シリーズの議事録の流れを踏まえて draft する」
- 「決定済みのことを推定で書かない (= 過去の `decided` に無いものは『推定』『提案』として書く)」
- 「相手側の言い分・温度感は Gmail thread と過去議事録から読み取れる範囲だけで」
- 「持参物は実際に存在する Drive ファイルだけを link する。架空の資料を書かない」

═══════════════════════════════════════════════════
Phase 5: Drive 資料 draft 生成
═══════════════════════════════════════════════════

1. `projects.drive_folder_id` 直下に `YYMMDD_<MTG名サニタイズ>_prep/` folder を作成 (= 既存があれば再利用)
2. LLM が「このMTGで使いそうな資料 draft」を判定:
   - 着地点に応じて: 簡易提案書 / 試算表 / アジェンダ slide / 確認事項チェックリスト
   - 過去同シリーズの資料スタイルを踏襲 (= 過去の Drive 資料 metadata から判定)
3. 生成可能な形式 (= text/Markdown/Google Docs/Slides/Sheets) のみ自動生成。それ以外 (= 画像/PDF/動画) は draft 生成せず `prep_draft_md` の「⚠️ 留意点」に「{形式} 資料は手動作成が必要」と書く
4. 生成した Drive file ID を `prep_drive_asset_id` に保存

**禁止**:
- 本資料 (= MTG 本資料 folder) には書き込まない。必ず `_prep/` folder に置く
- 既存ファイルを上書きしない。新規ファイルとして残す
- 前提データが足りない (= 過去 narrative も Gmail も Drive も薄い) のに「それっぽい」draft を作らない

═══════════════════════════════════════════════════
Phase 6: Notion 議事録ページ draft 作成
═══════════════════════════════════════════════════

1. 既存 `notion_page_id` がある場合は skip (= 既存ページを書き換えない)
2. 既存が無い場合のみ:
   - Notion 議事録 DB に新規ページを作成
   - title = MTG タイトル
   - eventId = calendar_event_id
   - body = Phase 4 で生成した `prep_draft_md` をアジェンダ草案として貼り付け
   - 冒頭に `## 📋 準備情報 (worker draft, {生成時刻})` toggle を入れる
3. 作成した page ID を `prep_notion_page_id` に保存
4. PWA の cockpit が `notion_url` 未連携 MTG でこの prep notion page を表示できるよう、`project_meeting_summaries.notion_url` も併せて upsert (= ただし既存 `notion_url` がある場合は上書きしない)

═══════════════════════════════════════════════════
Phase 7: Readiness Score 計算
═══════════════════════════════════════════════════

5 要素を deterministic に算出:

| 要素 | 重み | 判定 |
|---|---|---|
| アジェンダ存在 | 30 | (Notion本文文字数 + Calendar description文字数) が 100↑ で 30、50-99 で 15、<50 で 5 |
| 持参資料 | 25 | `project_documents` + `meeting_assets` + 今回 Worker が生成した `prep_drive_asset_id` の合計件数。3↑で 25、1-2 で 12、0 で 0 |
| 前回 next_actions 消化 | 20 | 同シリーズ前回 `next_actions[]` のうち `tasks.status='done'` 比率 × 20 (= 100% で 20、50% で 10) |
| 相手側コンテキスト | 15 | 直近30日 Gmail 往復 + 関連 Notion ページの合計件数。3↑で 15、1-2 で 8、0 で 0 |
| アサイン明確 | 10 | `projects.facilitator_member_id` が NOT NULL かつ Calendar attendees に含まれていれば 10、片方欠けで 5、両方欠けで 0 |

合計 = `prep_readiness_score`。内訳を `prep_readiness_reasons` jsonb に:
```json
{
  "agenda":   {"score":25,"max":30,"note":"Notion本文 320字 + Calendar desc 80字"},
  "docs":     {"score":18,"max":25,"note":"既存3件 + worker draft 1件 = 4件","items":["..."]},
  "prev_actions": {"score":12,"max":20,"note":"前回 5件中 3件 done"},
  "counterpart": {"score":15,"max":15,"note":"Gmail 4往復 (直近21日)"},
  "assignment": {"score":10,"max":10,"note":"facilitator=みつき, Calendar attendees整合"}
}
```

═══════════════════════════════════════════════════
Phase 8: DB upsert + status='ready' へ遷移
═══════════════════════════════════════════════════

```
PATCH /rest/v1/project_meeting_summaries?meeting_id=eq.{meeting_id}
{
  "prep_readiness_score": ...,
  "prep_readiness_reasons": {...},
  "prep_draft_md": "...",
  "prep_drive_asset_id": "...",
  "prep_notion_page_id": "...",
  "prep_worker_status": "ready",
  "prep_worker_ready_at": "{now ISO}"
}
```

`prep_worker_session_id` / `prep_worker_session_url` / `prep_worker_spawned_at` は spawner 側で先に書かれているので touch しない。

═══════════════════════════════════════════════════
Phase 9: session を待機状態で保持
═══════════════════════════════════════════════════

- worker LLM session は終了しない。Codex Cloud 上で idle として残る
- まさが session に入ってきた瞬間に第一声として `prep_draft_md` の「🎯 着地点」を読み上げ、対話を始める準備をする
- まさが「合ってる」「ここ修正」「資料追加して」等を返したら、対話で詰めていく
- 対話の結果として `prep_draft_md` / Drive draft / Notion アジェンダ草案を更新するのは、まさの指示に応じて。自動更新しない

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| `meeting_id` not found | `prep_worker_status='failed'` upsert + run summary に `reason='meeting_not_found'` |
| `projects.status NOT IN ('active','sales')` | `prep_worker_status='failed'` upsert + `reason='project_not_active'` |
| 過去同シリーズ 0件 (= 完全初回 MTG) | 続行。Phase 1 は skip、Phase 4 で「過去同類MTG無し、相手側 Gmail と PJ context のみから推定」と明記 |
| Drive 書き込み失敗 | `prep_drive_asset_id=null` のまま続行、Phase 4 の「持参物」に「Drive 書き込み失敗、手動で資料作成必要」 |
| Notion 作成失敗 | `prep_notion_page_id=null` のまま続行、`prep_readiness_reasons.agenda.note` に「Notion未連携」 |
| LLM 呼び失敗 | リトライ 1回、再失敗で `prep_worker_status='failed'` + `reason='llm_error'` |

## 禁止事項

- 本 MTG の `narrative_md` / `decided` / `progress` / `next_actions` / `risks` (= H-1 抽出 routine の責務) を書き換えない
- 本資料フォルダに書き込まない (= `_prep/` 専用)
- 既存 Notion ページを書き換えない
- Calendar event の description / attendees を変更しない
- Gmail を本送信しない (= draft 止まりすら作らない、worker は Gmail 触らない)
- まさへ直接 nudge しない (= nudge は別 SKILL `amd-os-l6-meeting-prep-nudge` の責務)
