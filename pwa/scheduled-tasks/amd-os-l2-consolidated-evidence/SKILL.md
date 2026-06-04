---
name: amd-os-l2-consolidated-evidence
description: AMD OS daily L2 evidence 抽出を 1 本の claude routine に束ねる本命 routine (= D-1〜D-10)。daily 08:00 JST 発火、claude.ai/code/routines (cloud / Anthropic-managed infrastructure、Pro/Max/Team サブスク定額枠、Sonnet 4.6) で実行。Phase 0 で env / active PJ 準備後、D-1 protocols → D-2 MS進捗 → D-3 PJナレッジ → D-4 メンバーナレッジ → D-5 OS台帳差分 → D-6 経営ハイライト → D-7 Textbook Insights → D-8 Atlas Signals → D-9 Macrotrend Evidence → D-10 Member Weekly Activities の順に inline 実行 → Supabase / outbox helper で反映 + 通知。月末専用 (M-1 monthly / M-2 XRL / M-3 Management Signal) は別 routine `amd-os-l2-monthend-evidence`、毎時 (H-1 MTGフロー) は MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow`。
---

# AMD OS Daily L2 Consolidated Evidence routine (D-1〜D-10)

> **これは何か**: 毎日抽出すべき L2 evidence を **1 本の claude routine** に束ねたもの。
> claude routine の **daily run cap** を最小化する (= 1 routine / 日) ための集約設計。
> 2026-06-04 まさ確定の新ナンバリング (cadence ベース: D = daily / M = month-end / H = hourly)。

## 🚨 登録事故の current truth (2026-06-04)

- このリポの `pwa/scheduled-tasks/.../SKILL.md` は **素材であって、claude routine が登録済みである証拠ではない**。
- **claude routine** と呼べるのは、`claude.ai/code/routines` (= Claude Routines UI) 上に存在し、`ACTIVE` / `next run` / `last run` を確認できるものだけ。
- 過去に Mac の `~/.claude/scheduled-tasks/` (= Local / Desktop scheduled task) に置いた 8 個 SKILL は **マシン依存** (app open + 非スリープ中のみ発火) で、全 disabled・2026-05-29 以降未実行のまま L2 取り込みが止まっていた。これが事故の核心。
- **claude routine (cloud) はマシン非依存**。`claude.ai/code/routines` / CLI `/schedule` / Desktop app のどこから登録しても同じ claude.ai アカウントに入り、Anthropic クラウドで発火する。laptop を閉じても・どのマシンが OFF でも動く。
  > "Routines execute on Anthropic-managed cloud infrastructure, so they keep working when your laptop is closed." (code.claude.com/docs/en/routines)

## 設計の要点 (2026-06-04 まさ確定)

- **背景**: 個別 routine を毎時で回そうとすると claude routine の daily run cap に抵触する。**最小 1 時間間隔**制約もある (= 毎時より細かい cron は拒否)。→ **同じ cadence の L2 を 1 routine に束ねる**。
- **このルーティンの守備範囲 = daily cadence の L2 だけ** (D-1〜D-10)。
  - 月末 cadence (M-1 monthly_reports / M-2 XRL / M-3 Management Signal) は **別 routine** `amd-os-l2-monthend-evidence`。
  - 毎時 cadence (H-1 MTGフロー = 旧 L2⑥) は **MMOマシン Codex Desktop automation** `amd-os-l6-meeting-flow` を維持。claude routine 化しない。
- **発火**: daily 08:00 JST。cron `0 8 * * *` (= claude routine は最小 1h 間隔 OK)。
- **実行環境**: claude.ai/code/routines (= cloud sandbox VM、Pro/Max/Team サブスク内、Sonnet 4.6、追加 LLM 課金なし)。
- **run 消費**: 平常日 +1/日 のみ。daily run cap には全く触れない。
- **入力**: AMD OS repo (= masa-teamarmada/amd-os) を sandbox に auto-clone、Connector (Supabase / Calendar / Notion / Gmail / Drive / Slack / GitHub) を直接利用。
- **出力**: Supabase 各 L2 テーブル + l2_notifications。

## 新ナンバリング ↔ 旧 L2 番号 対応

| 新 | 旧 L2 | 名称 | table | 既存個別 SKILL (= Phase 詳細) |
|---|---|---|---|---|
| D-1 | ② | AMD Protocol | `protocols` | `amd-os-l2-protocol-extract/SKILL.md` |
| D-2 | ③ | MS進捗 | `milestone_monthly_progress` / `project_monthly_notes` | `amd-os-l3-ms-progress-extract/SKILL.md` |
| D-3 | ④ | PJナレッジ | `project_knowledge` | `amd-os-l4-project-knowledge-extract/SKILL.md` |
| D-4 | ⑤ | メンバーナレッジ | `member_knowledge` | `amd-os-l5-member-knowledge-extract/SKILL.md` |
| D-5 | ⑦ | OS台帳差分 | `project_registry_diffs` | `amd-os-l7-registry-diff-extract/SKILL.md` |
| D-6 | ⑨ | 経営ハイライト | `project_strategy_signals` | `amd-os-l9-strategy-signal-extract/SKILL.md` |
| D-7 | ⑩ | Textbook Insights | `textbook_insight_candidates` | `amd-os-l10-textbook-insight-extract/SKILL.md` |
| D-8 | ⑪ | Atlas Signals | `atlas_signals` | (個別 SKILL なし。本 SKILL Phase H に inline) |
| D-9 | ⑫ | Macrotrend Evidence | `observation_log` / `macro_index_log` | (個別 SKILL なし。本 SKILL Phase I に inline) |
| D-10 | ⑬ | Member Weekly Activities | `member_activities(source='member_weekly')` | (個別 SKILL なし。本 SKILL Phase J に inline) |

## 【絶対】 動く前に必ず Read

1. `pwa/spec/5-3-automation-responsibility-current-spec.md` (= L2 writer 責務分担 current truth)
2. `pwa/manual/8-3-l2-extraction-routines-spec.md` (= 実行環境別の登録・復旧仕様)
3. `pwa/design/L2_DATA.md` §「L2 データ」(= 中核データ正本)
4. `pwa/design/db_schema.md` (= 列名は想像で書かない、必ず grep)
5. 各 D-n の既存個別 SKILL (= 上表、詳細手順)

═══════════════════════════════════════════════════
Phase 0: 環境セットアップ + active PJ 取得
═══════════════════════════════════════════════════

- cloud routine では `.env.local` 読み込み不要 (= 環境変数は connector / 環境 secret 経由)。
- Supabase connector の `execute_sql` / `list_tables` でスキーマ確認。列名は `pwa/design/db_schema.md` を grep してから使う。
- `projects?status=eq.active` で active PJ 一覧取得 (= 5-10 PJ)。
- ymList = [当月 (= YYYYMM JST), 前月]。
- maxItems 制限なし (= daily 1 回なので差分があるものは全部 process)。
- 各 Phase は `l2_extract_state.source_hash` で差分検知し、**変化が無ければ LLM call せず skip** (= サブスク credit & 実行時間節約)。

═══════════════════════════════════════════════════
Phase A: D-1 ② AMD Protocol 抽出
═══════════════════════════════════════════════════

`amd-os-l2-protocol-extract/SKILL.md` の Phase A-D を実行。
- 入力: 各 active PJ × {当月, 前月} の `project_meeting_summaries` (decided 中心)。
- LLM prompt = `llm_prompts.protocol.extract` (= Supabase 取得、コード hardcode 禁止)。
- 出力: `protocols` (status='candidate')。yes は `confirmed` (= `active` ではない)。
- `l2_feedbacks` (l2_kind='protocols') を prompt に反映。

═══════════════════════════════════════════════════
Phase B: D-3 ④ PJ ナレッジ抽出
═══════════════════════════════════════════════════

`amd-os-l4-project-knowledge-extract/SKILL.md` の手順実行。
- 入力: `monthly_reports` + `project_meeting_summaries` (直近 30 日)。
- 出力: `project_knowledge` (status='candidate' → yes で active)。
- category: people / tech / ip / org / funding / market / competitor / strategy / term。
- 汚染防御 v4_meta_strict 継承 (= 他 PJ の話題混入禁止、`(project_id, category, entity_name)` で SELECT してから更新/追加)。

═══════════════════════════════════════════════════
Phase C: D-4 ⑤ メンバーナレッジ抽出
═══════════════════════════════════════════════════

`amd-os-l5-member-knowledge-extract/SKILL.md` の手順実行。
- 入力: `member_activities` (直近 90 日) + 関連 PJ の `project_meeting_summaries` (直近 60 日) + `milestone_responsibility`。
- 出力: `member_knowledge` (UNIQUE code_name+category)。
- `status` / `source_hash` / `last_processed_at` は migration 091 で追加済み。列名は `db_schema.md` を確認してから使う。
- 採否: 新規は `status='candidate'`、yes で `active`、no で `rejected`、古いものは `archived`。

═══════════════════════════════════════════════════
Phase D: D-5 ⑦ OS 台帳差分抽出
═══════════════════════════════════════════════════

`amd-os-l7-registry-diff-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS 台帳 (`project_members` / `projects.report_emails` / `project_partners`)。
- 出力: `project_registry_diffs` (status='pending') + `l2_notifications(l2_kind='project_registry_diff')`。
- 採否: yes で allowlist 済みの安全な DB 更新、no で `status='rejected'`。
- mojibake guard: 日本語 multibyte が `?{3,}` に化けたら保存せず run summary に記録 (= BUGS.md 2026-06-02)。

═══════════════════════════════════════════════════
Phase E: D-6 ⑨ 経営ハイライト抽出
═══════════════════════════════════════════════════

`amd-os-l9-strategy-signal-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS snapshot (= `amd_management_score_*` / `billing_cycles` 等)。
- 出力: `project_strategy_signals` (status='candidate') + `l2_notifications(l2_kind='project_strategy_signal')`。
- ルール: 「進んだこと・起きたこと」 (= done のみ、未了は除外、まさ #26)。impact_level / signal_type / polarity 等で記録。
- 修正依頼ループは対話型 (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI) と接続。

═══════════════════════════════════════════════════
Phase F: D-7 ⑩ Textbook Insights 抽出
═══════════════════════════════════════════════════

`amd-os-l10-textbook-insight-extract/SKILL.md` の手順実行。
- 入力: Supabase 内の既存 L2 / OS データ (= `monthly_reports` / `project_meeting_summaries` / `project_strategy_signals` / `protocols` / `protocol_examples` / `project_knowledge` / `member_knowledge` / `project_registry_diffs` / `project_xrl_evidence` / `amd_score_inputs` / `project_ventures` / `projects`)。`source_cache` は補助証跡、これだけで no-data 判定しない。
- 出力: `textbook_insight_candidates` (status='candidate') + `l2_notifications(l2_kind='textbook_insight')`。
- 優先度: before_zero_knowhow > cross_project_pattern > case_study / theory_evidence。
- 採否: yes で `approved` → **local worker** `node pwa/scripts/apply_approved_textbook_insights.mjs --apply` が `pwa/bzm/*.md` へ追記し git commit/push。**cloud routine から git file を直接編集・commit しない** (= 候補化と通知まで)。

═══════════════════════════════════════════════════
Phase G: D-2 ③ MS 進捗推定
═══════════════════════════════════════════════════

`amd-os-l3-ms-progress-extract/SKILL.md` の手順実行。
- daily 化 (= 2026-06-04 まさ確定。旧 hourly + 旧 PWA hourly-estimate は停止済み、定期抽出は本 routine が primary)。
- 入力: active PJ × {当月, 前月} の `monthly_reports` + `project_meeting_summaries`。
- 出力: `milestone_monthly_progress` (= MS あり PJ) または `project_monthly_notes` (= MS 不在月 / 非MS管理PJ)。
- `progress_estimate_state.source_hash` (UNIQUE project_id, ym) で差分検知。
- `confirmed_at` set 済の `milestone_monthly_progress` 行は **上書き禁止**。

═══════════════════════════════════════════════════
Phase H: D-8 ⑪ Atlas Signals 抽出
═══════════════════════════════════════════════════

旧 Codex automation `AMD Atlas外部シグナルレビュー` の収集部分を inline 実行。
- 入力: 外部政策・産業・市場の公開シグナル (= web / 外部 source)。Connector / web_search で当日分を収集。
- 抽出: 各 signal を `{title, content (short snippet), source_url, source_type?, domain?, importance?}` に正規化 (= 全文保存しない)。
- 反映経路: **PWA route `POST /api/atlas/signals-ingest`** に `{signals: [...]}` を POST (= `Authorization: Bearer ${ATLAS_INGEST_SECRET}`)。route 側が Haiku で自動タグ付け + `attachStory()` で story_id 付与 → `atlas_signals` upsert。route 実装: `pwa/src/app/api/atlas/signals-ingest/route.ts`。
- cloud から直接 ingest できない環境では `/Users/masa/.codex/automations/amd-atlas/outbox/` 経由で非LLM applier に渡す。
- **派生 `atlas_stories` / `atlas_reports` は別系統** (= `cron/atlas-daily|weekly|monthly` 等の PWA 集計)。本 Phase は signals 観測の取り込みだけを担う。

═══════════════════════════════════════════════════
Phase I: D-9 ⑫ Macrotrend Evidence / Index 抽出
═══════════════════════════════════════════════════

**役割分担に注意 (= 重要)**:
- `macro_index_log` の **集計本体は LLM 非依存** (= `pwa/src/app/api/cron/macro-aggregate-indicators/route.ts` の `aggregate()`)。これは **PWA non-LLM cron** で回す。本 routine では集計をやり直さない。
- 本 Phase が担うのは **observation 収集 (= evidence origin)** のうち、外部 source 由来で LLM/web_search が要る部分:
  - `observation_log` の `observation_key='I_R'` (研究費 / KAKEN)、`='B'` (公募予算 / grant)、`='V'` (VC 投資) を当日/当月分について不足があれば収集。route 実装: `cron/kaken-ingest` / `cron/grant-ingest` / `cron/vc-investment-ingest`。
  - 出力: `observation_log` (`lane` / `observed_at` / `observation_key` / `value` / `source`)。列名は `db_schema.md` 確認。
- 収集して `observation_log` が増えたら、`macro_index_log` の再集計は PWA non-LLM cron `macro-aggregate-indicators` (= 月初 04:00 JST) に任せる。本 routine では呼ばない。
- 当日分の外部 observation に差分が無ければ skip。

═══════════════════════════════════════════════════
Phase J: D-10 ⑬ Member Weekly Activities 抽出
═══════════════════════════════════════════════════

旧 PWA route `cron/member-weekly-activities` のロジックを inline 実行 (= 2026-06-04 まさ確定で **daily** 化。weekly ではなく daily pickup)。route 実装: `pwa/src/app/api/cron/member-weekly-activities/route.ts`。
- 入力 (4 集約): ① `source_cache` (Gmail/Calendar キャッシュ) ② Gmail (sent/draft のみ) ③ Calendar (organizer/attended のみ) ④ `project_meeting_summaries`。member email はメンバー特定だけに使い、PJ 判定は PJ 専用/関係先 email・PJ名・client名で行う。
- 抽出: evidence を (projectId, memberId, sourceAnchor) でグループ化 → Sonnet 4.6 で activity title / contentPreview / confidence を合成。
- 出力: `member_activities` (`source='member_weekly'`、UNIQUE (member_id, project_id, source, source_item_id))。`/mypage` の「今週やったこと」と既存 member_activities 入力 L2 (= D-4 メンバーナレッジ) の入力になる。
- 既存週次行は delete してから upsert (= 当日断面で再構築)。

═══════════════════════════════════════════════════
Phase K: run summary
═══════════════════════════════════════════════════

各 Phase の saved / unchanged / skipped / errors を集計し、まさへ 1 行 summary を返す:

```
🚀 L2 daily consolidated evidence (D-1〜D-10) 08:00 完了:
  - D-1 ② プロトコル: <N> candidate
  - D-2 ③ MS進捗: <N> progress, <M> monthly_notes, <L> unchanged
  - D-3 ④ PJナレッジ: <N> rows
  - D-4 ⑤ メンバーナレッジ: <N> rows
  - D-5 ⑦ OS台帳差分: <N> pending
  - D-6 ⑨ 経営ハイライト: <N> candidate
  - D-7 ⑩ Textbook Insights: <N> candidate
  - D-8 ⑪ Atlas Signals: <N> ingested
  - D-9 ⑫ Macrotrend observation: <N> observation_log rows (index 集計は PWA non-LLM cron)
  - D-10 ⑬ Member Weekly: <N> activities
  経過時間: <minutes> 分
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- ハードコード prompt fallback (= 必ず DB `llm_prompts.<key>` 取得、空なら skip + state.message 記録。inline prompt の D-8/D-9/D-10 は既存 route 実装に準拠)。
- R313 / PWA report route / Anthropic 従量課金 API を定期抽出に使う。
- 列名想像 (= `pwa/design/db_schema.md` で grep してから upsert)。
- `member_knowledge` に存在しない列を書く。
- `protocols` の「はい」を `active` にする (= 正本は `confirmed`)。
- raw Gmail / raw Notion / raw Slack 本文を L2 row に保存 (= source refs + short snippet + hash のみ)。
- confirmed_at set 済の `milestone_monthly_progress` 上書き。
- 同じ source_hash の row 再抽出 (= 差分検知 skip 必須、cap & credit 節約)。
- D-9 で `macro_index_log` を本 routine で再集計する (= PWA non-LLM cron `macro-aggregate-indicators` の責務)。
- cloud routine から `pwa/bzm/*.md` を直接 git commit (= D-7 は候補化 + 通知まで、追記は local applier)。
- 月末専用 (M-1/M-2/M-3) と毎時 (H-1) を本 routine に混ぜる (= 別 routine / MMO automation)。

═══════════════════════════════════════════════════
【execution time 配慮】
═══════════════════════════════════════════════════

- cloud routine の session 1 時間超は途中切断リスク。各 Phase は差分検知でほぼ skip し、書き込み発生時のみ LLM call が走る設計。
- timeout しても `l2_extract_state.last_processed_at` が記録されるので翌朝 next run で続行可能 (= idempotent)。
- D-8/D-9 の外部収集が重い日は、D-1〜D-7 (= 内部 L2、OS の中核) を先に確実に終わらせる順序になっている。
