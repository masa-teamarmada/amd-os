---
name: amd-os-l2-all-extract
description: AMD OS M/W/D/H L2 全 9 種を 1 routine / automation 群で順次抽出する集約版 (= claude.ai Cloud routines daily run cap 15/day 対策、2026-05-26 採用、2026-05-29 M-1を正式対象に訂正)。daily 08:00 JST 発火、Phase 0 で env 準備後、M-1/H-1/D-1/D-3/D-4/D-5/M-2/D-6/D-2 の順 (= monthly_reports と議事録を先、MS 進捗を最後) で各 L2 の SKILL を inline 実行 → Supabase / outbox helper で反映 + 通知。
---

# AMD OS M/W/D/H L2 集約抽出 routine (= subscription automation、daily 1 回、cap 対策)

> **履歴扱い**: 2026-05-29 以降の current writer は、M-1 = Codex automation、D-1〜H-1 = Windows MMO Codex Desktop automation、D-5M-2D-6 = Codex automation + outbox/applier。新規復旧・MMO反映ではこの集約版を主導線にせず、個別 SKILL と `pwa/manual/8-3-l2-extraction-routines-spec.md` の現行 writer 表を正本にする。

## 設計の要点 (2026-05-26 まさ集約案 確定)

- **背景**: 個別 routine で運用しようとしたが claude.ai daily run cap 15/day に抵触 (= 毎時 routine 2 個で 14 cap 消費)。1 routine / day に集約。
- **2026-05-29 訂正**: M-1 `monthly_reports` も「定額 subscription automation で安定抽出する L2」の対象。R313 は旧有料API経路であり、定期 trigger は置かない。
- **発火**: daily 08:00 JST (= M-1 monthly_reports の 05:30 automation 後)
- **実行環境**: claude.ai Cloud routines (= Anthropic-managed sandbox VM、Pro/Max sub 内、Sonnet 4.6)
- **入力**: AMD OS repo (= masa-teamarmada/amd-os) を sandbox に auto-clone、Connector (Supabase / Calendar / Notion / Gmail / Drive / Slack) を直接利用
- **出力**: Supabase 各 L2 テーブル + l2_notifications / meeting_notifications

## 実行順序 (= 依存関係考慮)

1. **M-1 monthly_reports** (= Supabase L2 snapshot を primary input に月次断面を作る。5 生データは gap check / backfill fallback)
2. **H-1 MTG サマリ** (= 議事録、後段の入力源、毎時取りこぼし対応で daily まとめ取り)
3. **D-1 AMD プロトコル** (= 議事録依存、決定/分岐点を構造化)
4. **D-3 PJ ナレッジ** (= 議事録 + monthly_reports 依存)
5. **D-4 メンバーナレッジ** (= member_activities + 議事録 依存)
6. **D-5 OS 台帳差分** (= 5 生データ vs OS 台帳、独立)
7. **M-2 XRL 根拠** (= 5 生データ + 既存 L2 依存、後段)
8. **D-6 経営ハイライト** (= 5 生データ + OS snapshot + 既存 L2 依存、最後段)
9. **D-2 MS 進捗** (= monthly_reports + meeting_summaries 依存、旧 PWA hourly-estimate は停止済み。入力依存上最後に実行)

## 【絶対】 動く前に必ず Read

1. `pwa/manual/8-3-l2-extraction-routines-spec.md` (= M/W/D/H L2 subscription automation 統一仕様)
2. `pwa/design/L2_DATA.md` §「L2 データ 9 種」
3. `pwa/design/db_schema.md` (= 列名は想像で書かない、必ず grep)
4. 各 L2 個別 SKILL (= 詳細手順):
   - `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l7-registry-diff-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md`
   - `pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md`

═══════════════════════════════════════════════════
Phase 0: 環境セットアップ + active PJ 取得
═══════════════════════════════════════════════════

- Cloud routine では `.env.local` 読み込み不要 (= 環境変数は connector 経由)
- Supabase MCP connector の `execute_sql` / `list_tables` でテーブルスキーマ確認
- `projects?status=eq.active` で active PJ 一覧取得 (= 5-10 PJ)
- ymList = [当月 (= YYYYMM JST), 前月]
- maxItems 制限なし (= daily 1 回なので全部 process)

═══════════════════════════════════════════════════
Phase A: M-1 monthly_reports 抽出 (= 当月 / 前月)
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md` の手順を実行。ただし:
- 入力: active / sales PJ × {当月, 前月} の Supabase L2 snapshot primary + 5 生データ gap check fallback
- 出力: `monthly_reports` draft。Cloud routine 直書きが使えない環境では `/Users/masa/.codex/automations/amd-os-ms/outbox/` の `monthlyReports` 経由で非LLM helper が反映する
- 既存 `final_content` は force 明示なしで上書きしない
- R313 / PWA report route / Anthropic API は呼ばない

═══════════════════════════════════════════════════
Phase B: H-1 MTG サマリ抽出 (= 過去 24h 終了 events)
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` の Phase A-D を実行。ただし:
- 「過去 60-180 分終了」window → **「過去 24 時間終了」window** に拡張 (= daily 集約)
- 各 event について Calendar/Notion/Gmail/Drive/Slack MCP で context 取得 → source_kinds 判定 → LLM 抽出 → `project_meeting_summaries` + `meeting_notifications` upsert
- `l2_feedbacks` (l2_kind='meeting_summary') 反映
- `source_kinds != "none"` の開催済みMTGは `narrative_md` 必須。`summary_short` と配列だけの直書き、または箇条書き優勢の narrative で既存高品質議事録を上書きすることは禁止。L6 SKILL の品質 gate に従い、低品質なら保存せず run summary に `blocked_low_quality_narrative` / `skipped_preserve_existing_narrative` と書く。

═══════════════════════════════════════════════════
Phase C: D-1 AMD プロトコル抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` の Phase A-D を実行。
- 入力: 各 active PJ × {当月, 前月} の `project_meeting_summaries` (decided 中心)
- LLM prompt = `llm_prompts.protocol.extract` (= Supabase 取得、コード hardcode 禁止)
- 出力: `protocols` (status='candidate')
- `l2_feedbacks` (l2_kind='protocols') 反映

═══════════════════════════════════════════════════
Phase D: D-3 PJ ナレッジ抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` の手順実行。
- 入力: `monthly_reports` + `project_meeting_summaries` (直近 30 日)
- 出力: `project_knowledge` (status='candidate')
- 汚染防御 v4_meta_strict 継承 (= 他 PJ の話題混入禁止)

═══════════════════════════════════════════════════
Phase E: D-4 メンバーナレッジ抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` の手順実行。
- 入力: `member_activities` (直近 90 日) + 関連 PJ の `project_meeting_summaries` (直近 60 日) + `milestone_responsibility`
- 出力: `member_knowledge` (UNIQUE code_name+category)
- `status` / `source_hash` / `last_processed_at` は migration 091 で追加済み。列名は `pwa/design/db_schema.md` を確認してから使う

═══════════════════════════════════════════════════
Phase F: D-5 OS 台帳差分抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l7-registry-diff-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS 台帳 (`project_members` / `projects.report_emails` / `project_partners`)
- 出力: `project_registry_diffs` (status='pending')

═══════════════════════════════════════════════════
Phase G: M-2 XRL 根拠抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + 既存 L2 (= monthly_reports / meeting_summaries / member_knowledge)
- 出力: `project_xrl_evidence` (status='candidate')
- 関連メンバー (HRL ベース): `project_founding_members.category in ('amd','startup','university')` のみ算入

═══════════════════════════════════════════════════
Phase H: D-6 経営ハイライト抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS snapshot
- 出力: `project_strategy_signals` (status='candidate')
- 「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26)
- 修正依頼ループは対話型 (= `/api/notifications/feedback/dialog/*`) と接続予定

═══════════════════════════════════════════════════
Phase I: D-2 MS 進捗推定
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` の手順実行。
- 入力: monthly_reports + project_meeting_summaries
- 出力: `milestone_monthly_progress` (= MS あり PJ) または `project_monthly_notes` (= MS 不在月)
- `progress_estimate_state.source_hash` で差分検知
- `confirmed_at` set 済の `milestone_monthly_progress` 行は上書き禁止
- 旧 PWA hourly-estimate は停止済み。定期抽出は本 routine / subscription automation 側を primary とする

═══════════════════════════════════════════════════
Phase J: run summary
═══════════════════════════════════════════════════

各 Phase の saved_count / unchanged / skipped / errors を集計し、まさへの 1 行 summary を返す:

```
🚀 L2 全抽出 routine daily 08:00 完了:
  - M-1 monthly_reports: <N> reports saved, <M> skipped final
  - H-1 MTG サマリ: <N> events saved (notion+gmail=X, drive=Y, slack=Z, none=W)
  - D-1 プロトコル: <N> protocols saved
  - D-3 PJ ナレッジ: <N> rows saved (people=X, tech=Y, ...)
  - D-4 メンバーナレッジ: <N> rows saved
  - D-5 OS 台帳差分: <N> diffs pending
  - M-2 XRL 根拠: <N> evidence saved
  - D-6 経営ハイライト: <N> signals candidate
  - D-2 MS 進捗: <N> progress saved, <M> monthly_notes saved, <L> unchanged
  経過時間: <minutes> 分
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- ハードコード prompt fallback (= 必ず DB の `llm_prompts.<key>` を取得、空なら skip + state.message 記録)
- R313 / PWA report route / Anthropic API を M-1の定期抽出に使う
- 列名想像 (= `pwa/design/db_schema.md` で grep してから upsert)
- `member_knowledge` に存在しない `status` / `source_hash` 列を書く
- `protocols` の「はい」を `active` にしない (= 正本は `confirmed`)
- raw Gmail / raw Notion 本文を L2 row に保存 (= source refs + short snippet + hash のみ)
- confirmed_at set 済の `milestone_monthly_progress` 上書き
- 各 L2 phase で **同じ source_hash の row 再抽出** (= 差分検知 skip 必須、cap & subscription credit 節約)

═══════════════════════════════════════════════════
【execution time 配慮】
═══════════════════════════════════════════════════

claude.ai Cloud routines の session time limit は明示されてないが、長時間 (= 1 時間以上) の session は途中切断リスクあり。各 Phase の LLM 抽出は **差分検知でほぼ skip** することを前提とし、書き込み発生時のみ LLM call が走る設計。

万一 timeout した場合、`l2_extract_state.last_processed_at` が記録されてるので、明日朝の next run で続行可能 (= idempotent)。
