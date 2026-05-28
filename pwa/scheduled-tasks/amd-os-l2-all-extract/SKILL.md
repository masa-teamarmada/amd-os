---
name: amd-os-l2-all-extract
description: AMD OS L2 ②〜⑨ 全 8 種を 1 routine で順次抽出する集約版 (= claude.ai Cloud routines daily run cap 15/day 対策、2026-05-26 採用)。daily 08:00 JST 発火、Phase 0 で env 準備後、L2 ②/⑥/④/⑤/⑦/⑧/⑨/③ の順 (= 依存関係上、議事録 + ナレッジ系を先、MS 進捗を最後) で各 L2 の SKILL を inline 実行 → Supabase REST 直接 upsert + 通知。
---

# AMD OS L2 ②〜⑨ 集約抽出 routine (= Cloud / Remote、daily 1 回、cap 対策)

## 設計の要点 (2026-05-26 まさ集約案 確定)

- **背景**: 個別 8 routine で運用しようとしたが claude.ai daily run cap 15/day に抵触 (= 毎時 routine 2 個で 14 cap 消費)。1 routine / day に集約。
- **発火**: daily 08:00 JST (= AMD-Report R313 monthly_reports 完了後)
- **実行環境**: claude.ai Cloud routines (= Anthropic-managed sandbox VM、Pro/Max sub 内、Sonnet 4.6)
- **入力**: AMD OS repo (= masa-teamarmada/amd-os) を sandbox に auto-clone、Connector (Supabase / Calendar / Notion / Gmail / Drive / Slack) を直接利用
- **出力**: Supabase 各 L2 テーブル + l2_notifications / meeting_notifications

## 実行順序 (= 依存関係考慮)

1. **⑥ MTG サマリ** (= 議事録、後段の入力源、毎時取りこぼし対応で daily まとめ取り)
2. **② AMD プロトコル** (= 議事録依存、決定/分岐点を構造化)
3. **④ PJ ナレッジ** (= 議事録 + monthly_reports 依存)
4. **⑤ メンバーナレッジ** (= member_activities + 議事録 依存)
5. **⑦ OS 台帳差分** (= 5 生データ vs OS 台帳、独立)
6. **⑧ XRL 根拠** (= 5 生データ + 既存 L2 依存、後段)
7. **⑨ 経営ハイライト** (= 5 生データ + OS snapshot + 既存 L2 依存、最後段)
8. **③ MS 進捗** (= monthly_reports + meeting_summaries 依存、旧 PWA hourly-estimate は停止済み。入力依存上最後に実行)

## 【絶対】 動く前に必ず Read

1. `pwa/manual/8-3-l2-extraction-routines-spec.md` (= L2 ②〜⑨ Cloud routines 統一仕様)
2. `pwa/design/L2_DATA.md` §「L2 ②〜⑨ Cloud routines 統一」
3. `pwa/design/db_schema.md` (= 列名は想像で書かない、必ず grep)
4. 各 L2 個別 SKILL (= 詳細手順):
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
Phase A: ⑥ MTG サマリ抽出 (= 過去 24h 終了 events)
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` の Phase A-D を実行。ただし:
- 「過去 60-180 分終了」window → **「過去 24 時間終了」window** に拡張 (= daily 集約)
- 各 event について Calendar/Notion/Gmail/Drive/Slack MCP で context 取得 → source_kinds 判定 → LLM 抽出 → `project_meeting_summaries` + `meeting_notifications` upsert
- `l2_feedbacks` (l2_kind='meeting_summary') 反映
- `source_kinds != "none"` の開催済みMTGは `narrative_md` 必須。`summary_short` と配列だけの直書き、または箇条書き優勢の narrative で既存高品質議事録を上書きすることは禁止。L6 SKILL の品質 gate に従い、低品質なら保存せず run summary に `blocked_low_quality_narrative` / `skipped_preserve_existing_narrative` と書く。

═══════════════════════════════════════════════════
Phase B: ② AMD プロトコル抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` の Phase A-D を実行。
- 入力: 各 active PJ × {当月, 前月} の `project_meeting_summaries` (decided 中心)
- LLM prompt = `llm_prompts.protocol.extract` (= Supabase 取得、コード hardcode 禁止)
- 出力: `protocols` (status='candidate')
- `l2_feedbacks` (l2_kind='protocols') 反映

═══════════════════════════════════════════════════
Phase C: ④ PJ ナレッジ抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` の手順実行。
- 入力: `monthly_reports` + `project_meeting_summaries` (直近 30 日)
- 出力: `project_knowledge` (status='candidate')
- 汚染防御 v4_meta_strict 継承 (= 他 PJ の話題混入禁止)

═══════════════════════════════════════════════════
Phase D: ⑤ メンバーナレッジ抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` の手順実行。
- 入力: `member_activities` (直近 90 日) + 関連 PJ の `project_meeting_summaries` (直近 60 日) + `milestone_responsibility`
- 出力: `member_knowledge` (UNIQUE code_name+category)
- schema gap (= status / source_hash 列無し) に注意

═══════════════════════════════════════════════════
Phase E: ⑦ OS 台帳差分抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l7-registry-diff-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS 台帳 (`project_members` / `projects.report_emails` / `project_partners`)
- 出力: `project_registry_diffs` (status='pending')

═══════════════════════════════════════════════════
Phase F: ⑧ XRL 根拠抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + 既存 L2 (= monthly_reports / meeting_summaries / member_knowledge)
- 出力: `project_xrl_evidence` (status='candidate')
- 関連メンバー (HRL ベース): `project_founding_members.category in ('amd','startup','university')` のみ算入

═══════════════════════════════════════════════════
Phase G: ⑨ 経営ハイライト抽出
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md` の手順実行。
- 入力: 5 生データ + OS snapshot
- 出力: `project_strategy_signals` (status='candidate')
- 「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26)
- 修正依頼ループは対話型 (= `/api/notifications/feedback/dialog/*`) と接続予定

═══════════════════════════════════════════════════
Phase H: ③ MS 進捗推定
═══════════════════════════════════════════════════

`pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` の手順実行。
- 入力: monthly_reports + project_meeting_summaries
- 出力: `milestone_monthly_progress` (= MS あり PJ) または `project_monthly_notes` (= MS 不在月)
- `progress_estimate_state.source_hash` で差分検知
- `confirmed_at` set 済の `milestone_monthly_progress` 行は上書き禁止
- 旧 PWA hourly-estimate は停止済み。定期抽出は本 routine / subscription automation 側を primary とする

═══════════════════════════════════════════════════
Phase I: run summary
═══════════════════════════════════════════════════

各 Phase の saved_count / unchanged / skipped / errors を集計し、まさへの 1 行 summary を返す:

```
🚀 L2 全抽出 routine daily 08:00 完了:
  - ⑥ MTG サマリ: <N> events saved (notion+gmail=X, drive=Y, slack=Z, none=W)
  - ② プロトコル: <N> protocols saved
  - ④ PJ ナレッジ: <N> rows saved (people=X, tech=Y, ...)
  - ⑤ メンバーナレッジ: <N> rows saved
  - ⑦ OS 台帳差分: <N> diffs pending
  - ⑧ XRL 根拠: <N> evidence saved
  - ⑨ 経営ハイライト: <N> signals candidate
  - ③ MS 進捗: <N> progress saved, <M> monthly_notes saved, <L> unchanged
  経過時間: <minutes> 分
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- ハードコード prompt fallback (= 必ず DB の `llm_prompts.<key>` を取得、空なら skip + state.message 記録)
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
