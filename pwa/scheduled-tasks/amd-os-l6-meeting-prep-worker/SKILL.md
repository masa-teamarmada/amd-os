---
name: amd-os-l6-meeting-prep-worker
description: AMD OS H-1 MTG Prep Worker prompt (= H-1 内 Phase P が `codex exec` で spawn する新規 session の中で読まれる prompt)。1 MTG = 1 session = 1 worker。文脈ロード→着地点draft→Drive資料draft→Notion議事録draft→readiness 計算→`project_meeting_summaries` の prep_* 列 upsert を完遂し、まさが codex desktop で session に入ってきたら対話継続できる状態で待機する。cron では走らない (= H-1 自身が cron、worker は H-1 から spawn される)。
---

# AMD OS H-1 MTG Prep Worker

> **位置づけ**: これは **`codex exec` で起動された新規 session の中で読まれる prompt** であり、独立 cron では走らない。spawner は既存 H-1 automation (`amd-os-l6-meeting-flow`、name は「H-1」) の **Phase P** が担う。worker (= この prompt) は spawn 後の session の中で prep 本体を完遂する役。

## 設計の核 (2026-06-22 まさ確定)

- **1 MTG = 1 専属 session**。複数 MTG をまとめた俯瞰 session は作らない (= context 汚染回避)。
- **過去同類 MTG の議事録全 read を前提**。着地点は「過去の流れを踏まえて」推定する。
- **session 終了しない**。Phase 1-10 完遂後も codex session は idle で待機。まさが codex desktop で SESSION_ID から開いてきたら、`prep_draft_md` を文脈に対話継続。
- **draft は draft 置き場にしか書かない**: Drive は `PJfolder/YYMMDD_MTG名_prep/`、Notion は新規 draft ページ (本ページではない)、Calendar の本 event は書き換えない。
- **claude code は使わない** (= まさ確定で codex 一本化)。
- **定額外トークン課金経路を使わない** (= worker は codex session 内で動くため自動的にサブスク枠)。

## 【絶対】 動く前に必ず Read

1. `pwa/spec/3-3-meeting-flow-current-spec.md` の「H-1 MTG Prep セッション自動立ち上げ」節 (= 仕様正本、2026-06-22 修正版)
2. `pwa/manual/2-3-pj-cockpit.md` の「MTG Prep セッション自動立ち上げ」節 (= ユーザー視点)
3. `pwa/manual/8-3-l2-extraction-routines-spec.md` の「H-1 内 Phase P」節 (= 既存 H-1 抽出との境界)
4. `pwa/design/db_schema.md` の `project_meeting_summaries` (= **列名は想像で書かない、必ず grep**)
5. `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` (= 既存 H-1 抽出と Phase P の関係)
6. `pwa/scripts/l6_prep_notion_context_gate.cjs` (= Notion AI Meeting Notes 事前コンテキストが実際に入ったかの ready gate)

## 入力 (= H-1 Phase P から渡される引数)

| 引数 | 型 | 説明 |
|---|---|---|
| `meeting_id` | text | `project_meeting_summaries.meeting_id` (例: `upcoming:cal-event-abc123`) |
| `project_id` | text | `projects.project_id` (例: `p07`, `p19`) |

これだけ。他はすべて DB / Calendar / Notion / Drive / Gmail から worker が自分で引く。

═══════════════════════════════════════════════════
Phase 1: env と対象 MTG の読み込み
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
   - `meeting_start_at`, `title`, `source_kinds`, `calendar_event_id`, `notion_url`, `notion_page_id`, `gmail_thread_ids`, `prep_calendar_event_id` を取得
   - `source_kinds` に `upcoming` token が無い場合は `failed` upsert して exit (= 既に開催済み or canceled)
5. PJ コンテキスト読み込み:
   - `projects` (`project_name`, `lane`, `status`, `drive_folder_id`, `report_emails`)。**`projects.facilitator_member_id` は現状 DB に存在しない** (2026-06-24 確認) ので参照しない。ファシリ役は `project_meeting_summaries.facilitator_member_id` (= MTG 行単位) を見る。null 許容で続行
   - `project_members` (= active members + role)
   - `projects.status NOT IN ('active', 'sales')` なら `failed` upsert して exit

═══════════════════════════════════════════════════
Phase 2: 過去同シリーズの議事録を全 read (= 流れを踏まえる)
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
Phase 3: PJ 全体文脈の read
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
Phase 4: 外部 source の read
═══════════════════════════════════════════════════

並列で (= codex に組み込みの Calendar / Notion / Gmail / Drive MCP 経由):
- Calendar event detail (= attendees, location, description, conference data)
- Notion: 既存 `notion_page_id` があれば本文 read。無ければ skip
- Gmail: `projects.report_emails` 配下の直近30日 thread。相手側メールのやり取り抜き出し
- Drive: PJ folder 直下 + 直近 modified 上位10件のファイル metadata

═══════════════════════════════════════════════════
Phase 5: 着地点 / 想定質問 / 持参物 draft 生成
═══════════════════════════════════════════════════

`prep_draft_md` を生成。フォーマット:

```md
# {MTG タイトル} prep draft

## ✅ まさに確認したいこと
{以下3点を完了したうえで、短く結論を書く。会議冒頭でそのまま読むセリフ案にはしない}

## 🎯 着地点 (= 推定)
{2-3 文。過去の流れと直近 dialogue / signals から推定した「このMTGで決めるべきこと / 持ち帰るべきこと」}

## 📊 背景 (= 過去同シリーズの流れ)
{2-4 段落。前回までの議論と決定事項、PJ の現在の状況 (= MS 進捗 / XRL / 経営シグナル) から、なぜこの MTG が必要かを記述}

## 🧭 今回の位置づけ
{このMTGがPJ全体のどの局面にあるか。例: 初回整理、意思決定前の論点合わせ、相手の温度確認、提案の商談化、実証条件の合意など}

## 🏃 まさがやるべきこと (= 推定)
- {着地点に到達するため、まさが会議前/会議中にやるべきこと 3-5 項目}
- {相手に聞くべきこと、切るべき判断、持ち帰ってはいけない曖昧さを含める}

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

**生成方針**:
- 「決定済み」と推定で書かない (= 過去の `decided` に無いものは『推定』『提案』として書く)
- 相手側の言い分・温度感は Gmail thread と過去議事録から読み取れる範囲だけで
- 持参物は実際に存在する Drive ファイルだけを link する。架空の資料を書かない
- まさがスレッドを開いた時の開始点は、会議冒頭のセリフ案ではなく、以下3点の完了報告にする:
  1. これまでのMTGの流れを把握した結果
  2. 今回のMTGの位置づけと、推定した着地点
  3. その着地点に到達するためにまさがやるべきこと
- 最後は必ず「これであってる？どうする？」で止め、まさの判断を待つ。長い演説や断定的な会議冒頭トークを書かない

═══════════════════════════════════════════════════
Phase 5.5: Notion AI Meeting Notes 事前コンテキスト注入 gate
═══════════════════════════════════════════════════

目的は「固有名詞・略称・今日拾うべき論点」を Notion AI Meeting Notes のメモ欄へ先に入れ、当日の文字起こし/議事録生成で誤字を減らすこと。`prep_draft_md` に手動貼り付け用 context を残しただけでは完了扱いにしない。

1. `prep_draft_md` から、AI Meeting Notes 用の短い `context_md` を作る:
   - PJ固有名詞、相手名、会社名、略称、表記揺れしやすい語
   - 今日の会議で拾うべき論点、前回からの持ち越し、確認したい決定事項
   - raw Gmail / raw Slack / raw Notion / raw Drive 本文は入れない。要約済み・短文化済みの context だけにする
2. Notion MCP で、対象 MTG の AI Meeting Notes page を探す:
   - eventId / calendar_event_id exact を最優先
   - fallback は title + meeting date + attendees
   - 既存 `prep_notion_page_id` があっても、それが別日/別MTGなら使わない
3. `/tmp/l6-prep-notion-context-gate-{meeting_id_hash}.json` を作り、以下の sanitized payload を入れる:
   - `meeting`: `meeting_id`, `calendar_event_id`, `title`, `meeting_start_at`, `attendees`, `prep_notion_page_id`
   - `notionPages`: 候補 page の `id`, `url`, `title`, `eventId`, `date`, `has_meeting_notes`, marker 確認に必要な短い本文だけ
   - `context_md`: 1 の context
   - `now`: 現在時刻
4. `node pwa/scripts/l6_prep_notion_context_gate.cjs --fixture /tmp/l6-prep-notion-context-gate-{meeting_id_hash}.json --json` を実行する。
5. gate 結果が `needs_insert` の場合:
   - `insert_plan.page_id` に対して Notion MCP `insert_content` / append-only で marker + `context_md` を追記する
   - 同じ page を再fetchし、`write_attempted=true` で gate payload を作り直して再実行する
   - 再実行後も `needs_insert` のままなら `prep_worker_status='ready'` にしてはいけない。`write_failed` または `not_found` 等の完了状態に落とし、手動貼り付け用 context を `prep_draft_md` に残す
6. `prep_readiness_reasons.notion_ai_context` に gate 結果を保存する:
   - 正常: `injected` / `already_present`
   - 完了扱いの失敗: `not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting`
   - 中間状態: `needs_insert` は保存して ready に進めない

**ready 条件**:
- `needs_insert` が残っている間は `prep_worker_status='ready'` 禁止
- `prep_notion_page_id` が過去 page を指す場合は `wrong_page` として保存し、当日 page への自動挿入をやり直す。過去 page へ追記しない
- Notion page が見つからない/書けない場合でも prep 全体は failure にしない。ただし `prep_readiness_reasons.notion_ai_context.status` と `prep_draft_md` の手動貼り付け用 context には必ず残す

═══════════════════════════════════════════════════
Phase 6: Drive 資料 draft 生成
═══════════════════════════════════════════════════

1. `projects.drive_folder_id` 直下に `YYMMDD_<MTG名サニタイズ>_prep/` folder を作成 (= 既存があれば再利用)
2. 着地点に応じて Drive 資料 draft を生成する。ただし、共有フォルダに置く prep 資料の主成果物は **必ず HTML** に統一する:
   - 簡易提案書 / 試算表 / アジェンダ / 確認事項チェックリスト / 1枚サマリは、すべて `.html` として作る
   - Google Docs / Markdown / Slides / Sheets を主成果物として作らない。表や計算も HTML 内の table / section / callout で表現する
   - ファイル名は `YYMMDD_<MTG名サニタイズ>_<用途>.html` にする
   - 複数資料が必要な場合も、用途ごとに HTML を分けるか、1つの HTML 内に section としてまとめる
3. HTML は AMD OS のデザインコードに従う:
   - まず `/Users/masa/projects/AMD/amd-os/pwa/src/lib/exec_summary/template.css` と `/Users/masa/projects/AMD/amd-os/pwa/src/lib/exec_summary/template_section.html` を参照する
   - 視覚言語は `/Users/masa/projects/AMD/amd-os/pwa/design/cyber_hud_design_code.md` と `/Users/masa/projects/AMD/amd-os/pwa/design/hud_visual_language.md` の原則に寄せる
   - 原則として単体で開ける self-contained HTML にし、必要な CSS は `<style>` に埋め込む。外部URL、secret、raw本文は入れない
   - 既存の共有資料スタイルがある場合も、形式は HTML に統一し、色・余白・情報密度だけ参考にする
4. 生成できない形式 (= 画像/PDF/動画など HTML 以外が本質になるもの) は無理に別形式で作らず、HTML 内に「手動作成が必要」と明記し、`prep_draft_md` の「⚠️ 留意点」にも残す
5. 生成した HTML file ID を `prep_drive_asset_id` に保存する。複数HTMLを作った場合は主資料の file ID を入れ、他の HTML は `prep_readiness_reasons.drive_assets` に metadata として残す

**禁止**:
- 本資料 (= MTG 本資料 folder) には書き込まない。必ず `_prep/` folder に置く
- 既存ファイルを上書きしない。新規ファイルとして残す
- 前提データが足りない (= 過去 narrative も Gmail も Drive も薄い) のに「それっぽい」draft を作らない
- Google Docs / Markdown / Slides / Sheets を prep 資料の主成果物として作らない

═══════════════════════════════════════════════════
Phase 7: Notion 議事録ページ draft 作成
═══════════════════════════════════════════════════

1. 既存 `notion_page_id` がある場合は skip (= 既存ページを書き換えない)
2. 既存が無い場合のみ:
   - Notion 議事録 DB に新規ページを作成
   - title = MTG タイトル
   - eventId = calendar_event_id
   - body = Phase 5 で生成した `prep_draft_md` をアジェンダ草案として貼り付け
   - 冒頭に `## 📋 準備情報 (worker draft, {生成時刻})` toggle を入れる
3. 作成した page ID を `prep_notion_page_id` に保存
4. PWA の cockpit が `notion_url` 未連携 MTG でこの prep notion page を表示できるよう、`project_meeting_summaries.notion_url` も併せて upsert (= ただし既存 `notion_url` がある場合は上書きしない)

═══════════════════════════════════════════════════
Phase 8: Readiness Score 計算
═══════════════════════════════════════════════════

5 要素を deterministic に算出:

| 要素 | 重み | 判定 |
|---|---|---|
| アジェンダ存在 | 30 | (Notion本文文字数 + Calendar description文字数) が 100↑ で 30、50-99 で 15、<50 で 5 |
| 持参資料 | 25 | `project_documents` + `meeting_assets` + 今回 Worker が生成した `prep_drive_asset_id` の合計件数。3↑で 25、1-2 で 12、0 で 0 |
| 前回 next_actions 消化 | 20 | 同シリーズ前回 `next_actions[]` のうち `tasks.status='done'` 比率 × 20 (= 100% で 20、50% で 10) |
| 相手側コンテキスト | 15 | 直近30日 Gmail 往復 + 関連 Notion ページの合計件数。3↑で 15、1-2 で 8、0 で 0 |
| アサイン明確 | 10 | `project_meeting_summaries.facilitator_member_id` (この MTG 行) が NOT NULL かつ対応 `members.email` が Calendar attendees に含まれていれば 10、片方欠けで 5、両方欠けで 0。`projects.facilitator_member_id` 列は存在しないので参照しない (2026-06-24 確認) |

合計 = `prep_readiness_score`。内訳を `prep_readiness_reasons` jsonb に保存。

═══════════════════════════════════════════════════
Phase 9: DB upsert + status='ready' へ遷移
═══════════════════════════════════════════════════

```
PATCH /rest/v1/project_meeting_summaries?meeting_id=eq.{meeting_id}
{
  "prep_readiness_score": ...,
  "prep_readiness_reasons": {...},
  "prep_draft_md": "...",
  "prep_drive_asset_id": "...",
  "prep_notion_page_id": "...",
  "prep_readiness_reasons": {
    "...": "...",
    "notion_ai_context": {
      "status": "injected|already_present|not_found|write_failed|ambiguous|wrong_page|skipped_after_meeting",
      "marker": "amd-os:notion-ai-context:{meeting_id}:{digest}",
      "target_page_id": "..."
    }
  },
  "prep_worker_status": "ready",
  "prep_worker_ready_at": "{now ISO}"
}
```

`prep_readiness_reasons.notion_ai_context.status='needs_insert'` のまま `ready` にするのは禁止。

`prep_worker_session_id` / `prep_calendar_event_id` / `prep_worker_spawned_at` は Phase P 側で先に書かれているので touch しない。

═══════════════════════════════════════════════════
Phase 10: session を待機状態で保持
═══════════════════════════════════════════════════

- worker session は終了しない。session は disk に persist され (`~/.codex/archived_sessions/rollout-...jsonl`)、まさが codex desktop から SESSION_ID で開ける状態のまま残る
- まさが入ってきた瞬間の第一声は、会議冒頭のセリフ案ではなく、`prep_draft_md` の要点を使って次の3点を短く報告する:
  1. これまでのMTGの流れ
  2. 今回のMTGの位置づけと推定着地点
  3. 着地点に到達するためにまさがやるべきこと
- 第一声の末尾は必ず「これであってる？どうする？」にする
- まさが「合ってる」「ここ修正」「資料追加して」等を返したら、対話で詰めていく
- 対話の結果として `prep_draft_md` / Drive draft / Notion アジェンダ草案を更新するのは、まさの指示に応じて。自動更新しない

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| `meeting_id` not found | `prep_worker_status='failed'` upsert + run summary に `reason='meeting_not_found'` |
| `projects.status NOT IN ('active','sales')` | `prep_worker_status='failed'` upsert + `reason='project_not_active'` |
| 過去同シリーズ 0件 (= 完全初回 MTG) | 続行。Phase 2 は skip、Phase 5 で「過去同類MTG無し、相手側 Gmail と PJ context のみから推定」と明記 |
| Drive 書き込み失敗 | `prep_drive_asset_id=null` のまま続行、Phase 5 の「持参物」に「Drive 書き込み失敗、手動で資料作成必要」 |
| Notion 作成失敗 | `prep_notion_page_id=null` のまま続行、`prep_readiness_reasons.agenda.note` に「Notion未連携」 |
| Notion AI Meeting Notes page に context 未挿入 | `needs_insert` の間は `ready` 禁止。insert-only 後に再fetchし、`injected` / `already_present` か、`not_found` / `write_failed` / `ambiguous` / `wrong_page` の完了状態を保存 |
| MCP 呼び失敗 | リトライ 1回、再失敗で `prep_worker_status='failed'` + `reason='mcp_error:<which>'` |

## 禁止事項

- 本 MTG の `narrative_md` / `decided` / `progress` / `next_actions` / `risks` (= H-1 抽出 routine の責務) を書き換えない
- 本資料フォルダに書き込まない (= `_prep/` 専用)
- 既存 Notion ページを書き換えない
- Calendar event の description / attendees を変更しない
- Gmail を本送信しない (= 既存 H-1 と同じ、worker は Gmail draft 含めて書き出さない)
- まさへ直接 nudge しない (= nudge は H-1 Phase P の末尾で deterministic に Slack DM 送信される)
- 定額外トークン課金経路 (= OpenAI API key / Anthropic API key) を使わない (= codex session 内で動くため自動的にサブスク枠だが、prompt 内で別の課金 API を呼ばないこと)
