# L2 Extraction Routines — subscription automation 統一仕様 (L2 ①〜⑯)

この章は、L2 ①〜⑯ を **定額 subscription automation / Codex automation / non-LLM applier** で抽出する仕様をまとめる。処理IDだけでなく、**どの実行環境で、どの課金ルートで、止まった時にどこを見るか** を正本化する。

> 実装者向けの確定仕様は [/spec/3-1-l2-data-extraction-current-spec](/spec/3-1-l2-data-extraction-current-spec) へ移行開始済み。この章は、復旧時に読む運用手順として残す。迷う内容は移行完了まで両方に置く。

**2026-06-03 正本訂正**: 2026-05-25〜26 の Claude routine / Cloud routine 案は履歴として残すが、現行の復旧主導線は下の **現行 writer 表** を見る。L2 ①は月末の Codex / subscription automation、L2 ③⑥は MMOマシン Codex Desktop automation、L2 ②④⑤⑦⑨⑩⑪⑫は daily consolidated evidence、L2 ⑧は月末 L2① 後の XRL checklist audit、L2 ⑬は別 weekly subscription automation 候補、L2 ⑭は finance non-LLM cron / admin review、L2 ⑮は VC weekly subscription automation、L2 ⑯は月末17:00 Management評価automation候補が現行ルート。L2⑯は修正版 `/management-score` UI の方向を正とし、状態ラベル/アイコン + 自然文評価 + 判断コメントを保存済みL2へ正本化する。

**先手力 heartbeat**: `proactive_outbox` は L2 ではなく、L2 と司令塔 / worker をつなぐ control layer。10:15-20:15 JST の毎時15分に `amd-os-proactive-heartbeat` が queued/blocked の due soon を拾い、PJ司令塔へ通知してから `mark-sent` で通知済みを記録する。正本手順は [`pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`](../scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md)。

## 対象 L2

| L2 | テーブル | 役割 | 旧 writer | 現行 writer |
|---|---|---|---|---|
| ① monthly_reports | `monthly_reports` | PJ 月次レポート。後続 L2 の一次入力 | AMD-Report GAS R313 / PWA report route | 月末 Codex / subscription automation `AMD OS L2① 月次報告抽出` |
| ② AMD Protocol | `protocols` / `protocol_examples` | 経営判断を普遍パターンとして残す | GAS 155 (5/22 停止) | daily consolidated evidence `amd-os-l2-consolidated-evidence` |
| ③ MS 進捗 | `milestone_monthly_progress` / `project_monthly_notes` | マイルストーン月次進捗 % | ~~PWA `/api/cron/hourly-estimate` + GAS 154 ping~~ ⛔ 2026-05-29 再停止 | MMOマシン automation `amd-os-l3-ms-progress-extract` |
| ④ PJ ナレッジ | `project_knowledge` | PJ に関する人物 / 技術 / 組織 / 市場 | GAS 155 (5/22 停止) | daily consolidated evidence `amd-os-l2-consolidated-evidence` |
| ⑤ メンバーナレッジ | `member_knowledge` | メンバーごとの強み / スタイル / 関心 | GAS 155 (5/22 停止) | daily consolidated evidence `amd-os-l2-consolidated-evidence` |
| ⑥ MTG サマリ | `project_meeting_summaries` / `meeting_notifications` | Calendar event 単位の議事録要約 | GAS 153 + GAS 074 (5/22 停止) | Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow` |
| ⑦ OS 台帳差分 | `project_registry_diffs` | 5 生データ vs OS 台帳の差分候補 | 旧 Cloud routine 案 / PWA LLM route | daily consolidated evidence `amd-os-l2-consolidated-evidence` + outbox/applier |
| ⑧ XRL checklist audit | `amd_score_inputs.xrl_checklist` / `amd_score_inputs.xrl_notes` / `project_founding_members` / `project_xrl_evidence` | TRL/BRL/GRL/SRL/HRL のチェック項目充足監査 | 旧 Cloud routine 案 / PWA LLM route / 旧 daily XRL evidence 案 | 月末 L2① 後の checklist audit |
| ⑨ 経営ハイライト | `project_strategy_signals` | 経営判断 / 事業進捗 / 戦略転換 等 | 旧 Cloud routine 案 | daily consolidated evidence `amd-os-l2-consolidated-evidence` + outbox/applier |
| ⑩ Textbook Insights | `textbook_insight_candidates` | BZM 教科書へ追記すべき Before Zero 実務知見 | 新規 | daily consolidated evidence `amd-os-l2-consolidated-evidence` + approved 後 local BZM applier |
| ⑪ Atlas Signals | `atlas_signals`, 派生 `atlas_stories`, `atlas_reports` | 外部ニュース / 政策 / 市場 / 技術シグナルの evidence | 旧 Atlas report / collect cron 群 | daily consolidated evidence `amd-os-l2-consolidated-evidence` または Atlas signal collection automation + outbox/applier |
| ⑫ Macrotrend Evidence / Index | `observation_log`, `macro_index_log`, 派生 `macro_lane_weights`, `triple_helix_state_log` | lane / month 単位の外部観測・決定的集計 evidence | 旧 macro / ASPI cron 群 | daily consolidated evidence `amd-os-l2-consolidated-evidence` + PWA non-LLM aggregate |
| ⑬ Member Weekly Activities | `member_activities(source='member_weekly')` | メンバー週次活動 evidence | 旧 PWA `/api/cron/member-weekly-activities` | separate weekly subscription automation candidate + outbox/applier |
| ⑭ Finance Ops Evidence | `company_finance_recurring_items`, `company_finance_receipt_events` | サブスク・継続費・自動振替・領収書イベント evidence | 旧 Finance L2 拡張候補 | PWA non-LLM finance cron + admin review + optional subscription automation |
| ⑮ VC News / Funding Signals | `vc_news`, `vcs`, `vc_funds`, `vc_investments`, `project_vc_relations` | VCニュース・ファンド組成・投資活動・fundraising signal | 旧 PWA `cron/vc-discover` | subscription/Codex automation `amd-os-l2-vc-news-funding-signals`; PWA route は manual/guarded only |
| ⑯ Management Monthly Signal Evaluation | `company_management_signal_reviews` | 月末時点の会社経営状態を、数字再掲ではなく評価文・状態ラベル/アイコン・判断コメント・次に見ることへ変換 | `/management-score` 修正版UIの経営シグナル評価 | month-end 17:00 JST Codex / subscription automation candidate |

L2 ① monthly reports はこの章の対象。R313 は旧経路で、差分あり/未生成時に R303 generator 経由で Claude API を呼びうるため、定期 trigger を置かない。2026-05-29 実画面確認時点では `run_monthlyReportCron` / `run_L2CronDaily` trigger は存在しない。定期 writer は月末最終日の Codex / subscription automation `AMD OS L2① 月次報告抽出` で、正本 SKILL は [`pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`](../scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md)。

## Claude Cloud routine 案の扱い

Claude Cloud routine は 2026-05-25〜26 の移行案として検討・一部登録した履歴。追加API課金を避けるという方針自体は正しいが、現行の復旧主導線としては **3-2 章とこの章の現行 writer 表を優先**する。

古い trigger ID、`claude.ai/code/routines`、`~/.claude/scheduled-tasks/` は履歴調査用。止まった時にまず見るのは、L2ごとの現行 automation 履歴、repo内 SKILL、outbox/applier。

### Cloud routine 案を選んだ当時の理由

claude.ai/code/routines の Cloud routine は **Anthropic-managed cloud infrastructure 上の sandbox VM で実行** されるため:

- ✅ ローカル PC のスリープ / 起動状態に依存しない (= MacBook Air が closed でも明日 03:20 に発火する)
- ✅ subscription (Pro/Max/Team/Enterprise) 内で動く、追加 LLM 課金なし
- ✅ claude.ai の Connectors (= Notion/Gmail/Calendar/Drive/Slack/Supabase/GitHub) が routine 内から直接呼べる
- ✅ 複数 PC からの共有管理 (= 個人アカウントに紐づくが、Mac/Windows 両方から claude.ai/code/routines で見える)

vs ローカル Mac scheduled task の問題:
- ❌ Mac の `~/.claude/scheduled-tasks/` の routine は **「app open かつ非スリープ」中のみ発火** ([code.claude.com/docs](https://code.claude.com/docs/en/desktop-scheduled-tasks))
- ❌ 2026-05-25-26 の観察で、Mac スリープ中の cron は完全 skip → L2 取り込みゼロが継続

公式ドキュ引用:
> "Routines execute on Anthropic-managed cloud infrastructure, so they keep working when your laptop is closed." ([code.claude.com/docs/en/routines](https://code.claude.com/docs/en/routines))

## 現行 automation 一覧 (= 2026-05-29 正本)

| L2 | 実行場所 | automation / SKILL | 頻度 | 止まった時に見る場所 |
|---|---|---|---|---|
| ① monthly_reports | Codex / subscription automation + outbox applier | `AMD OS L2① 月次報告抽出` / `amd-os-l1-monthly-report-extract` | 月末最終日 | `amd-os-l2` automation 履歴、`~/.codex/automations/amd-os-ms/outbox/`、LaunchAgent applier |
| ② AMD Protocol | Daily consolidated evidence | `amd-os-l2-consolidated-evidence` | daily 08:00 JST | consolidated automation 履歴、`pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` |
| ③ MS 進捗 | MMOマシン Codex Desktop automation | `amd-os-l3-ms-progress-extract` | 毎時 0 分 | MMOマシン側 automation 履歴、`pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` |
| ④ PJ ナレッジ | Daily consolidated evidence | `amd-os-l2-consolidated-evidence` | daily 08:00 JST | consolidated automation 履歴、`pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` |
| ⑤ メンバーナレッジ | Daily consolidated evidence | `amd-os-l2-consolidated-evidence` | daily 08:00 JST | consolidated automation 履歴、`pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` |
| ⑥ MTG サマリ + フロー | Windows MMO Codex Desktop automation | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | 毎日 09:00-21:00 毎時 | MMOマシン側 automation 履歴、`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` |
| ⑦ OS 台帳差分 | Daily consolidated evidence + outbox applier | `amd-os-l2-consolidated-evidence` / SKILL `amd-os-l7-registry-diff-extract` | daily 08:00 JST | consolidated automation 履歴、`outbox.registryDiffs`、LaunchAgent applier |
| ⑧ XRL checklist audit | Codex / subscription automation + review | L2① 後の XRL checklist audit | 月末 L2① 後 | `monthly_reports`、Supabase 内L2断面、`xrl-level-definitions.ts`、`amd_score_inputs.xrl_checklist` |
| ⑨ 経営ハイライト | Daily consolidated evidence + outbox applier | `amd-os-l2-consolidated-evidence` / SKILL `amd-os-l9-strategy-signal-extract` | daily 08:00 JST | consolidated automation 履歴、strategy-signals outbox、LaunchAgent applier |
| ⑩ Textbook Insights | Daily consolidated evidence + outbox applier + local BZM applier | `amd-os-l2-consolidated-evidence` / SKILL `amd-os-l10-textbook-insight-extract` | daily 08:00 JST candidate generation | `amd-os-ms` outbox `textbookInsights`、`textbook_insight_candidates`、`apply_approved_textbook_insights.mjs` |
| ⑪ Atlas Signals | Daily consolidated evidence or Atlas collection automation + outbox applier | `amd-os-l2-consolidated-evidence` / Atlas signal collection | daily 08:00 JST evidence review | consolidated automation 履歴、`amd-atlas/outbox`、Atlas ingest/applier |
| ⑫ Macrotrend Evidence / Index | Daily consolidated evidence + deterministic aggregate | `amd-os-l2-consolidated-evidence` / `cron/macro-aggregate-indicators` | daily evidence review / monthly aggregate | consolidated automation 履歴、`observation_log`、`macro_index_log` |
| ⑬ Member Weekly Activities | Separate weekly subscription automation candidate | TBD weekly automation / guarded `/api/cron/member-weekly-activities` | weekly candidate | weekly automation 履歴、`member_activities(source='member_weekly')`、privacy/source-hash review |
| ⑭ Finance Ops Evidence | PWA non-LLM finance cron + admin review | `freee-payment-sync`, payment nudges, receipt/recurring review | daily / monthly finance ops | finance admin, `company_finance_*`, `company_actual_monthly` |
| ⑮ VC News / Funding Signals | Subscription/Codex automation + VC inbox | `amd-os-l2-vc-news-funding-signals` / guarded `/api/cron/vc-discover` | weekly Sat 09:00 JST | VC automation履歴、VC inbox、`vc_news`、`vcs`、`vc_funds` |
| ⑯ Management Monthly Signal Evaluation | Codex / subscription automation candidate + review | `amd-os-l16-management-monthly-signal-evaluation` / SKILL `pwa/scheduled-tasks/amd-os-l16-management-monthly-signal-evaluation` | monthly last day 17:00 JST | Management Score snapshot/evidence、予実表、L2⑨⑭⑮、`company_management_signal_reviews`、`/management-score` 過去ログ |
| control 先手力 heartbeat | Codex automation / worker heartbeat | `amd-os-proactive-heartbeat` | 10:15-20:15 JST 毎時15分 | `proactive_outbox`、`project_commander_threads`、`proactive_loop_tool.mjs heartbeat`、司令塔 thread への通知結果 |

## 各 L2 の入出力仕様

各 routine の SKILL.md (= `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`) に Phase 0-E の詳細手順が書かれている。以下は L2 ごとの入出力サマリ。

### ① monthly_reports

- 入力: active / sales PJ × {当月, 前月} の Supabase L2 snapshot primary。最低でも `project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `project_registry_diffs` / `protocols` / `project_knowledge` / `member_knowledge` / `milestone_monthly_progress` / `progress_estimate_state` / 既存 `monthly_reports` を見る
- fallback: L2 coverage が薄い・古い・source refs 不足・no-data 判定候補・backfill 候補があるときは Gmail / Drive / Calendar / Slack / Notion 5 生データを gap check する。`source_cache` だけで no-data 判定しない
- 抽出: 対象月に起きた進捗、判断、外部関係者の動き、技術/資料、リスク、来月焦点を markdown draft にする
- 出力: `monthly_reports` (`status='draft'`)。既存 `final_content` は force 明示なしで上書きしない
- 反映: `~/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` を LaunchAgent が `ms_progress_review_tool.mjs apply-outbox-dir` で反映
- 後続: 月次報告書の作成後に L2⑧ XRL checklist audit を走らせる
- 禁止: R313 trigger 復活、PWA `/api/report/generate` / `/api/cron/monthly-reports-backfill` の定期実行、従量課金LLM API の直接呼び出し

### ② AMD Protocol

- 入力: 直近 24 時間から増えた `project_meeting_summaries`、必要に応じて当月/前月単位の再集約
- 抽出: 分岐点 / 判断材料 / アクションを普遍化して `protocols.content` に保存
- 結果: 自動抽出では埋めない。後追いの結果観測は `protocol_result_observations`
- status: `candidate -> confirmed / rejected / archived`
- `protocols` の yes は `confirmed`。`active` ではない

### ④ PJ ナレッジ

- 入力: `monthly_reports` + `project_meeting_summaries`
- 出力: `project_knowledge`
- category: `people`, `tech`, `ip`, `org`, `funding`, `market`, `competitor`, `strategy`, `term`
- status: `candidate -> active / rejected`
- 注意: `project_knowledge` に UNIQUE 制約は無い。既存行を壊さず `(project_id, category, entity_name)` で SELECT してから更新/追加する

### ⑤ メンバーナレッジ

- 入力: `member_activities` + `project_meeting_summaries`
- 出力: `member_knowledge`
- category: `skills`, `personality`, `communication_style`, `growth_areas`, `work_style`, `interests`, `episodes`
- 現スキーマ: migration 091 以降、`member_knowledge` は `status` / `source_hash` / `last_processed_at` を持つ。列名は `pwa/design/db_schema.md` を確認してから使う
- 採否: 新規抽出は `status='candidate'`、通知 yes で `active`、no で `rejected`、古いものは `archived`

### ⑥ MTG サマリ + フロー (= 2026-05-27 予定MTG + Drive資料同期まで拡張)

**現在の writer**: Codex Desktop automation `amd-os-l6-meeting-flow` (= Windows MMO PC、毎日 09:00-21:00 毎時 0 分発火 = 13回/日 × 7 = 91回/週、gpt-5.5 high reasoning)。Cloud routine は 2026-05-26 25 時時点で deprecated (= Mac/Cloud 共に問題があり Windows MMO の Codex Desktop に集約)。

**🚨 cron 設計 (= 2026-05-27 00:30 まさ要求で credit 節約)**:
- 元: 毎時 0 分 (= 24回/日 × 7 = 168回/週、深夜も走って無駄)
- 新: **毎日 09:00-21:00 毎時** (= 91回/週、元の 54%) + **Phase A 早期 exit** (= 該当 MTG event 0 件なら Phase B 以降一切実行せず 1 行 summary だけ出して終了)
- 結果: 深夜 (22:00-08:00) は完全不発火、日中も実際に MTG event がある時だけ重い Phase B-J が走る
- 土日 9-21 時も毎時走る (= AMD は柔軟、土日 MTG / 朝晩 MTG も拾う)

**役割**: 議事録抽出を超えて MTG 1 回のライフサイクル全体を自動化 (= Phase A-J、10 機能):

1. (A) 議事録抽出 + 高品質化 narrative_md (= 前後 MTG / PJ 全体 / 関連 MS を踏まえた `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の5見出し構成)
2. (C) 次 MTG カード生成 + Calendar event 登録 + 参加者招待 + Notion DB に「📋 準備情報 / 📝 議事録」toggle
3. (D) 次 MTG までのタスクを Slack nudge (= 担当者 mention + thread)
4. (E) タスク完了検出 → MTG 資料 update
5. (F) 前日までに資料未完成ならファシリに Slack DM
6. (G) 当日 MTG 終了 → MTG カード内に議事録 insert + 準備情報 toggle close
7. **(H) MTG TODO → cockpit + Calendar 作業枠 (= まさ 2026-05-26 23:55 要求)**: TODO を `tsukuyomi_nudge_queue` 等 cockpit テーブルに upsert + 実行者 & PL カレンダーに「+<PJコード> <task>」枠を freebusy 見て空き時間に作成 (= estimated_hours は LLM 推定、典型値: 資料作り 2h / 軽い調査 1h / アポ調整 0.5h)
8. **(I) automation 内で資料即生成 (= まさ要求)**: 「議事録 + monthly_reports + 既存 Drive 資料で前提が揃う」「成果物が text/markdown/Google Docs/Slides/Sheets」と判定したものは Phase I で LLM が本文生成 → Drive 保存 → Calendar 作業枠の description に「📎 資料 draft: <drive_url>」追記
9. **(J) ファシリ役名義で follow-up メール下書き (= まさ要求)**: 当該 MTG の facilitator (= projects.facilitator_member_id) 名義で Gmail draft 作成 (本送信禁止、ファシリが本人 Gmail で確認後送信)。本文構成 = 挨拶 / 本日サマリ / 決まったこと / 次回までの宿題 / 次回 MTG 概要 / 添付資料案内 / 結び。当日シェアした Drive 資料は exportLinks で PDF 化して attach
10. (旧) iOS APNs 通知 (= meeting_notifications upsert)

**入力**: Calendar event (= 過去 60-180 分終了 + 今日0:00 JSTから60日先の確定予定。ただし weekly recurring は series ごとに次回1件のみ) + Notion 議事録 + Gmail (= report_emails スレッド) + Drive Doc/PDF/Office/Sheets + Slack thread + PWA `meeting_assets` (= まさが直接アップロードしたスクショ / PDF / 画面キャプチャ) + `project_meeting_summaries` 過去 3 件 (= 前回比較) + `monthly_reports` 直近 3 件 (= PJ 全体文脈) + `value_milestones` + `milestone_monthly_progress` (= MS context) + Calendar freebusy (= H 用) + `projects.drive_folder_id` + `projects.facilitator_member_id` + `project_members` (= role=PL 特定)

**Calendar color diagnostic helper (= connector 色payload欠落時の前段)**:
- Google Calendar connector が `get_colors` / raw `event.colorId` を返さない場合でも、connector 待ちだけで止めない。
- `pwa/scripts/l6_calendar_color_diagnostic.mjs` は Calendar API v3 の `events.list` / `calendarList.get` を既存 PWA Google env で read-only 実行し、対象 window の `event_id` / `calendar_id` / `summary` / `start` / `end` / 明示 `colorId` / `calendar_default.colorId` だけを返す。
- PWA 側 Google env が無い環境では、GAS Advanced Calendar Service の `gas/188_L6CalendarColorDiagnostic.js` (`l6_calendar_color_diagnostic`) を `pwaApi runFunc` から呼ぶ。GAS manifest は Calendar API v3 advanced service と calendar scope を持つ。
- GAS helper は CFG_PJAlias が読める場合だけ、alias 値を出さずに high-confidence 候補の有無も返す。
- helper は diagnostic 専用で、DB/API/outbox/Calendar/Notion/Gmail/Drive/Slack へ write しない。明示 `event.colorId` が無い event でも、CFG_PJAlias の exact / regex / bracketed / ASCII whole-token title alias が high confidence で当たり、`EXCLUDE` / `AMD` でなく、duplicate guard と既存良質サマリ保護を通る場合だけ Live 候補へ進める。単なる substring は review-only で Live 候補にしない。

**Notion eventId 方針 (= 2026-05-31 incident guard)**:
- MMO automation は Calendar event から Notion 議事録ページを見つけたら、可能な範囲で Notion page の `eventId` / 相当プロパティに Calendar event id を追記する。これは L6 writer 側の責務。
- Notion page に `eventId` が無いことだけを理由に skip しない。eventId 検索で取れない場合は title + event date + attendees + Gemini/Drive/Gmail URL で fallback 検索し、Notion が取れない場合も Gmail / Drive / Slack / Calendar 本文で `source_kinds` を判定する。
- eventId 追記に失敗しても抽出は続け、run summary に `notion_event_id_backfill_failed` と page id / reason を残す。`skip_no_notion_event_id` は現行仕様では禁止。

**held-source guard (= 2026-05-31 飯野さんケース再発防止)**:
- `source_kinds='upcoming'` の準備カードは残しつつ、開催済みソースがある event は `meeting_id=<calendar_event_id>` の別 row 候補へ進める。既存 upcoming row がある場合は `prep_source_meeting_id='upcoming:<calendar_event_id>'` で紐付ける。
- Calendar event に Gemini / Google Meet notes Doc 添付、Notion 議事録ページが title + date + attendees fallback で hit、または `projects.report_emails` が空でも Gemini notes / follow-up Gmail が event 文脈で hit した場合は、準備カードだけで完了扱いにしない。
- repo guard は `pwa/scripts/l6_meeting_held_source_guard.cjs`。`npm run test:l6-held-source-guard` で `Calendar添付Geminiメモ + Notion eventId空 + report_emails空 + 既存upcoming行` から開催済み候補が出ることを検査する。
- fallback 紐付けは `confidence` と `needs_review` を残す。`projects.report_emails` の補完は自動DB更新せず、registry diff / 通知候補として出す。

**議事録本文の固定フォーマット**:
- 開催済みMTGの `narrative_md` は必ず `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順にする。
- 見出し文言・絵文字・順序は固定。`## 🎯 背景` のように絵文字と語の間に空白を入れない。
- 各見出しの本文は、MTGに参加していなかったメンバーが前提から次の動きまで理解できる段落で書く。箇条書き・チェックボックス・raw配列の貼り付けは使わない。
- `## ✅決まったこと` には会議で実際に合意・確認されたことだけを書く。Drive資料や準備資料だけからの推定は `## 📊経緯` または `## ⚠️残課題` に置く。

**予定MTGカード同期 (= LLM不要 / deterministic)**:
- L2⑥ は議事録抽出とは別に、`today 00:00 JST` から `now + 60 days` までの確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡す。
- weekly recurring MTG は series ごとに次回1件だけ同期・表示する。2件目以降の future occurrence は `weekly_recurring_future_occurrence` として skip し、既にDBに残っている future row も cockpit 表示側で非表示にする。
- `title` が `+` / `＋` 始まり、全日予定、start datetime の無い予定は除外する。
- PWA route は `project_id` が渡された場合は強制紐付け、無い場合は `projects.project_name` / `project_id` / `client_name` でPJ判定する。
- `calendar-sync` は同日中なら開始済みの予定も更新対象にする。これにより、今日の取締役会のように開始後にDrive資料を見つけたケースでもカードを補強できる。
- `projects.drive_folder_id` があるPJでは、root直下だけでなく、会議日 token (`YYMMDD` / `YYYYMMDD` / `YYYY-MM-DD`) と title token (`取締役会` / `board` / `キックオフ` / `MTG` 等) で1階層サブフォルダを探す。
- Docs / Slides / Sheets / PDF / Office files を最大8件 `{title,url,mime_type,modified_time,snippet}` に正規化し、`drive_files` として `calendar-sync` に渡す。route自体はDriveを読みに行かない。
- Drive資料は `narrative_md` の `関連Drive資料` と `summary_short` / `progress` / `risks` に反映するが、Drive資料だけで `decided` に「決定済み」とは書かない。

**Notion 文字起こし導線 (= PWA UI補助 / LLM不要)**:
- `CockpitMeetingSummary` は `project_meeting_summaries.notion_url` がある MTG / 予定MTGに `Notion文字起こし` CTA を出す。
- `notion_url` が無い予定MTGは、`source_url` の Calendar 予定へ遷移する `Calendarから開始` CTA を出す。Notionの録音/文字起こし開始は Notion 側で行う。
- `notion_url` も `source_url` も無い場合は `Notion未連携` と表示し、DB write / DDL / Notion page 自動作成はしない。
- L6 automation が後から `notion_url` / `eventId` を補完した場合は、PWA の `メモ再読込` で `project_meeting_summaries` を再取得する。

**出力**:
- `project_meeting_summaries` (PK=`meeting_id`) + `meeting_notifications` (旧)
- `meeting_assets` (= PWA から追加される private Storage 添付。routine は必要に応じて caption / extracted_text を読む)
- `tsukuyomi_nudge_queue` or `project_todos` (= cockpit TODO 反映、H)
- Calendar event (+<PJ> prefix task 枠、H)
- Drive file (= Phase I 生成資料、命名 `<YYYY-MM-DD>_<PJcode>_<task slug>_draft.<ext>`)
- Gmail draft (= Phase J follow-up メール、添付 PDF 含む)
- source_kinds: `notion+gmail+drive+slack` 等 (= 30 chars 閾値)
- 議事録なし event は `source_kinds='none'` のマーカー行を upsert (= 重複判定用)

**禁止事項追加 (= Phase H/I/J 用)**:
- LLM が Calendar / Drive / Gmail に直接書き込み (= 全部 non-LLM helper `apply-outbox` 経由)
- Gmail メール本送信 (= draft 止まり、ファシリ役本人が確認後送信)
- Calendar 既存枠と重複作成 (= freebusy 必ず確認)
- TODO Calendar 枠を「+<PJ>」prefix 無しで作る (= まさルール違反)
- 生成不能タスクを強引に資料生成 (= 前提データ不足なら skip + reason 記録)

### ⑦ OS 台帳差分

- 入力: 5 生データ + OS 台帳 (= `project_members` / `projects.report_emails` / `project_partners` 等)
- 出力: `project_registry_diffs` (= status='pending')
- 判定: 5 生データで言及があるが OS 台帳に無い (or 異なる) 項目を差分候補として抽出
- 通知採否で apply (= 安全な DB 更新) or `status='rejected'`

### ⑧ XRL checklist audit

- 入力: L2① monthly report + Supabase 内L2断面 (= `project_meeting_summaries`, `project_strategy_signals`, `project_founding_members`, `project_knowledge`, `member_knowledge`, MS進捗, 既存 confirmed `project_xrl_evidence` 等)
- チェック項目正本: `pwa/src/lib/xrl-level-definitions.ts`
- 出力: `amd_score_inputs.xrl_checklist` / `amd_score_inputs.xrl_notes` の更新候補。直接 score 値を確定しない
- 反映: まさ確認後に `amd_score_inputs.xrl_checklist` を更新。スコア詳細UIが checklist から `trl` / `brl` / `grl` / `srl` / `hrl` を導出する
- `project_xrl_evidence`: daily 通常出力ではなく、強いイベント根拠や過去 confirmed 根拠を残す例外ログとして扱う
- 関連メンバー (HRL ベース) は `project_founding_members` の `category in ('amd','startup','university')` 対象、VC/顧客/行政は invalid

### ⑨ 経営ハイライト

- 入力: 5 生データ + OS snapshot (= `amd_management_score_*` / `billing_cycles` 等)
- 出力: `project_strategy_signals` (= status='candidate')
- ルール: 「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26)、impact_level / signal_type / polarity 等 4 軸で記録
- 修正依頼は対話型 (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI 拡張) と接続予定

### ⑩ Textbook Insights

- 入力: Supabase 内の既存 L2 / OS データ (= `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `protocols`, `protocol_examples`, `project_knowledge`, `member_knowledge`, `project_registry_diffs`, `project_xrl_evidence`, `amd_score_inputs`, `project_ventures`, `projects`)。`source_cache` は補助証跡であり、これだけで no-data 判定しない
- 出力: `textbook_insight_candidates` (= status='candidate') + `l2_notifications(l2_kind='textbook_insight')`
- 優先度: `before_zero_knowhow` > `cross_project_pattern` > `case_study` / `theory_evidence`
- 採否: 通知 yes で `approved`、no で `rejected`
- 追記: approved 後に local worker が `node pwa/scripts/apply_approved_textbook_insights.mjs --apply` で `pwa/bzm/*.md` へ追記し、git commit/push する。Vercel runtime から git file を直接編集しない
- target routing: `practice_kind` に応じて第8部へ振り分ける。`decision_branch` は `8-2`、`failure_learning` は `8-3`、`relationship_playbook` は `8-4`、`reusable_question` / `field_transition` は `8-5`。`cross_project_pattern` は明確な単一実践章がないため default は `8-1`、具体的な retrofit 検証ケースなら抽出側が `6-1` を明示する。`theory_case` は式・rubric・定義を変えず、BZM review 前提で `6-1` へ候補化する

### ⑯ Management Monthly Signal Evaluation

- 入力: `amd_management_score_snapshots` / `amd_management_score_evidence` / `company_budget_actual_monthly` / `company_budget_variance_notes` / L2⑨経営ハイライト / L2⑭Finance Ops Evidence / L2⑮VC News / billing・pipeline evidence
- 出力: `company_management_signal_reviews`。schemaは `status_label` / `status_tone` / `status_icon` / `headline` / `summary` / `sections[]` / `source_refs_json` / `source_confidence` / `generated_at` / `reviewed_at` / `codex_thread_id` / `automation_id` を中心にする
- cadence: 毎月末日 17:00 JST。raw/calc後の月末断面を読む
- 文体: 数字は上の予実表にあるので再掲しない。「良い状態か、悪い状態か、次にどこを見るべきか」が1分で分かる文章にする
- payload: `ym`, `version`, `status_label`, `status_tone`, `status_icon`, `headline`, `summary`, `sections[]`, `source_refs_json`, `source_confidence`, `payload_json`, `generated_at`, `reviewed_at`, `codex_thread_id`, `automation_id`, `is_current`, `superseded_at`
- status: `概ね良好`, `注意して進める`, `要介入`, `評価候補/中立`
- UI設計: `/management-score` の月次試算表下で最新評価だけ展開。古い評価は月別/版別トグルの過去ログとして閉じる
- 実装状態: 修正版UIは本番確認済み。現UIロジックは暫定だが、UX方向はL2⑯の正本として扱う

## 冪等性と通知

| テーブル | 使い方 |
|---|---|
| `l2_extract_state` | `(l2_kind, target_id, scope_key)` ごとに `source_hash`, `saved_count`, `total_count`, `last_processed_at` を保存 |
| `l2_feedbacks` | レビュー担当の修正依頼。現行 automation は該当 `l2_kind` / `target_id` / `scope_key` の active feedback を prompt に入れる |
| `l2_notifications` | ②④⑤⑦⑨⑩ の承認カード。⑧は checklist 更新候補の review 通知、または例外的な `project_xrl_evidence` 候補だけ通知する |
| `meeting_notifications` | ⑥ MTG サマリの承認/通知カード (= iOS APNs 通知用) |
| `progress_estimate_state` | ③ MS 進捗の `source_hash` 差分検知 (= UNIQUE `project_id, ym`) |

## 実装時の禁止事項

- ローカル Mac scheduled task (= `~/.claude/scheduled-tasks/amd-os-l*`) を現行 writer として復活させない。復旧は現行 automation 表の実行場所から行う
- AMD-Report GAS R313 の `run_monthlyReportCron` / `run_L2CronDaily` trigger 復活 (= L2①の定期 writer は Codex automation)
- GAS 153 / 155 の kill switch を外して LLM cron を復活させない
- PWA / GAS / Vercel route から Anthropic・Gemini・OpenAI の従量課金 API を L2 抽出用途で新規に呼ばない。LLM が必要な抽出・要約・議事録品質改善は repo 内 SKILL と subscription automation 側に寄せる
- L2⑩ の承認を受けて、Vercel runtime から `pwa/bzm/*.md` を直接編集・commit しない。追記は local applier + git commit/push だけ
- L2⑩ の unknown `practice_kind` を helper 側で勝手に既知分類へ丸めない。`metadata_json.validation_warnings` に残し、fallback slug のまま review 対象にする
- raw Gmail / raw Notion 本文を L2 row に丸ごと保存しない (= source refs + short snippet + hash のみ)
- `member_knowledge` の列名を想像で書かない。`status` / `source_hash` / `last_processed_at` は migration 091 + `db_schema.md` 前提で使う
- L6 で Notion `eventId` 欠損だけを理由に議事録抽出を skip しない
- `protocols` の「はい」を `active` にしない。正本は `confirmed`
- 実行場所を曖昧にしない。`amd-os-l3-ms-progress-extract` のような処理IDだけで書かず、MMOマシン / Codex automation / outbox applier まで明記する
- 列名を想像しない。必ず [`pwa/design/db_schema.md`](../design/db_schema.md) を見る

## 残課題

| 優先 | タスク | 備考 |
|---|---|---|
| P0 | 現行 automation 履歴の見方を 3-2 / 8-3 / 6-1 で統一 | 人間が `amd-os-l3-ms-progress-extract` のようなIDだけを見て迷わないようにする |
| P1 | Mac 側 `~/.claude/scheduled-tasks/amd-os-l*` 8 個の扱いを棚卸し | 現行 writer ではない。重複稼働や誤復旧の原因になるなら disable / archive |
| P1 | 旧 `amd-os-meeting-extract` (Mac scheduled task、リネーム済の disabled) を削除 | 整理 |
| P2 | L5 `member_knowledge` の採否 UI 接続確認 | migration 091 の `status` / `source_hash` 前提で MMO automation と通知側の接続を確認 |
| P2 | `/admin/settings` に L2①〜⑯ automation / applier の稼働状態を表示 | MMOマシン側 / Codex automation / outbox applier / local BZM applier / weekly L2⑬ / finance L2⑭ / VC L2⑮ / management月末L2⑯ の状態を分けて表示 |

## 2026-05-26 移行ログ (= 履歴)

- claude.ai/code/routines に 8 個全部 entry 完了 (= §38.3 trigger ID 一覧)
- SKILL 8 個を repo `pwa/scheduled-tasks/` に commit (= `41ef14c`)、Cloud routine の sandbox VM が auto-clone する正本
- 詳細経緯: [`pwa/design_log/sessions_2026-05.md`](../design_log/sessions_2026-05.md) の 2026-05-26 セクション
- 動作テスト: L2 ② を手動 run で Phase 0-A-C まで確認、Sonnet 4.6 / Anthropic サーバー側 sandbox VM で動作証明
- Mac 側 9 routine (= dialogue-prep + amd-os-l*) は依然 enabled (= Cloud 動作確認後に disable 予定)
- UI bug で L5-L9 の Connector 不完全 (= Supabase 必須なのに追加不可)、handoff doc 経由で次セッションへ引き継ぎ
