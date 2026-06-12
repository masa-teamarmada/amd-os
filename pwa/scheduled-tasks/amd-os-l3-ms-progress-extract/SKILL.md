---
name: amd-os-l3-ms-progress-extract
description: AMD OS D-2 MS進捗の repo 正本。2026-06-12 schedule_default_revision_v3 以降、進捗 % の writer は Vercel cron `/api/cron/ms-schedule-progress` (= 非LLM、スケジュール按分デフォルト)。この automation (= Windows MMO PC Codex Desktop、毎時0分) は L2 データから累積進捗を推定し、デフォルト按分との乖離 ±10pt 以上のときだけ `ms_progress_revisions` (pending) + `l2_notifications` (l2_kind='ms_progress_revision') を積む。**LLM は milestone_monthly_progress を一切書かない**。advisor PJ / MS 不在月の `project_monthly_notes` 更新と `progress_estimate_state` 管理は従来通り。
---

# AMD OS D-2 MS 進捗 — ズレ検知 → revision 提案 (schedule_default_revision_v3)

## 🚨 2026-06-12 全面改訂 — まず source 契約

**LLM は `milestone_monthly_progress` を書かない。** 進捗 % の writer は 2 系統:

| writer | source | 内容 |
|---|---|---|
| Vercel cron `/api/cron/ms-schedule-progress` (02:30 JST、非LLM) | `routine_auto` | 全MSにスケジュール按分の累積 % をデフォルト upsert。PM locked 以外を毎回上書き |
| 人間確定 (revision confirm / PM 操作) | `pm_manual` / `pm_confirmed` / `pm_rejected` / `criteria_toggle` / `tsukuyomi_revision` | PM locked。自動上書き禁止 |

旧 `tsukuyomi_estimate` / `l2_routine` (= AI 直接書き込み) は **廃止**。残存行は cron が `routine_auto` で自然修復する。

この automation の役割は **ズレ検知と提案だけ**:
1. L2 データ (monthly_reports + project_meeting_summaries) から累積進捗を推定
2. デフォルト按分 (`expectedCumPctForYm`) との乖離が **±10pt 以上** のときだけ `ms_progress_revisions` (pending) を upsert + 通知
3. まさが通知「はい」or revision PATCH で confirm するまで、進捗はデフォルト月割りのまま

## 設計の要点
- 現 = Windows MMO Codex Desktop automation が毎時0分に実行 (= GAS / PWA hourly cron 完全 bypass)
- PWA/GAS hourly は 2026-05-29 に再停止。PWA route は `ALLOW_PWA_LLM_CRONS=1` なしでは disabled response のみ返す。
- **MS 管理対象**: `project_category in ('dtsu','ecosystem','new_business')` (= 2026-05-25 #56 new_business 追加)
  - `advisor` は MS 進捗対象外 → 月次モーダル `project_monthly_notes` に保存
- **MS 不在月**: 対象月を覆う MS が無い場合 → `monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存 (= MS 設定 nudge は出さない)
- LLM 推定は対象月時点の**累積進捗率**。MS個別期間の按分を基本値にして、遅れ/先行を判断する。
- MS個別期間の開始前は期待進捗0% (= 提案も出さない)。
- `success_criteria` / `milestone_sub_items` は必ず入力に含める。高進捗は「MS名に近い活動」ではなく、成功条件に書かれた成果物へ直結する証拠で判断する。
- LLM 呼びは subscription 内 Codex automation
- Supabase REST 直叩き

## 【絶対】 動く前に必ず Read
1. `pwa/spec/3-10-l2-ms-progress-current-spec.md` (= D-2 確定仕様正本、source 契約 / revision フロー)
2. `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md` (= 運用マニュアル)
3. `pwa/src/lib/progress-estimator.ts` (= revision 提案ロジック本体、`maybeProposeRevision` 周辺)
4. `pwa/src/lib/ms-schedule-shared.ts` (= PM_LOCKED_PROGRESS_SOURCES / expectedCumPctForYm の正本)
5. `pwa/design/db_schema.md` (= ms_progress_revisions / l2_notifications / milestone_monthly_progress / progress_estimate_state / value_milestones / value_plan_cycles 列名)

═══════════════════════════════════════════════════
Phase 0: env + active projects + ymList
═══════════════════════════════════════════════════

```bash
ENV=pwa/.env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)
```

- `projects?status=eq.active&select=project_id,project_name,project_category`
- ymList = [当月 (= YYYYMM JST), 前月]
- targets = projects × ymList
- `progress_estimate_state?project_id=in.(...)&ym=in.(...)&select=project_id,ym,last_processed_at` で last_processed_at 古い順 sort
- maxItems = 14 / run (= 超えたら hasMore=true で打ち切り、翌時持ち越し)

═══════════════════════════════════════════════════
Phase A: 各 (projectId, ym) について推定実行
═══════════════════════════════════════════════════

### A-1: project_category 判定
- `category in ('dtsu','ecosystem','new_business')` → MS 管理対象 → ズレ検知 path (A-2)
- `category == 'advisor'` → MS 不在月扱い → project_monthly_notes path (A-3)

### A-2: ズレ検知 path (= revision 提案のみ、milestone_monthly_progress は書かない)
1. `value_plan_cycles?project_id=eq.<projectId>&status=in.(active,confirmed,fixed,draft)&order=period_start_ym.desc` で対象 ym を覆う cycle 取得
2. cycle 無し → A-3 へ fallback
3. `value_milestones?plan_cycle_id=eq.<cycleId>&is_active=eq.true&select=milestone_id,title,points,goal_level,success_criteria,period_start_ym,target_ym` で MS 一覧 + 対象 ym の MS フィルタ
   - 続けて `milestone_sub_items?milestone_id=in.(...)&select=milestone_id,title,weight,status,assignee` を取得し、各MSの入力に含める
4. MS 0 件 → A-3 へ fallback
5. 各 MS について `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&select=final_content,draft_content,status` (= status≠invalid) + `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=20` を入力に累積進捗を推定
6. **source_hash 差分検知**: hashInput = JSON.stringify({ p, ym, ms_keys: [...], report: report_hash, sums: sums_hash }) → sha256
   - `progress_estimate_state?project_id=eq.<projectId>&ym=eq.<ym>&select=source_hash` と一致なら **skipped_unchanged**
7. LLM 推定 (= 私自身):
   - input: 各 MS の title / goal_level / success_criteria / sub_items + report + summaries
   - output: `{ "milestones": [ { "milestone_id": "<id>", "estimated_pct": 0-100の累積値, "note": "<根拠 50 字、日本語>" }, ... ] }`
   - `80%` 以上や `100%` は、`success_criteria` またはMS名に直結する成果物が「完成/完了/確定/提出/作成済/策定済/承認済/レビュー可能」になった同一文脈の証拠がある場合だけ許可
   - JAFCO/VC が前向き、DD開始、面談実施、資料作成予定、準備、着手、進行中だけでは、事業計画・資本政策・知財戦略などの成果物MSを高進捗にしない
   - 資本政策MSは、資本政策表・調達方針・持分方針・EXITまでの道筋の実物またはレビュー可能なドラフトが確認できる場合だけ高進捗にする
8. **revision 提案判定** (各 MS、progress-estimator の `REVISION_PROPOSAL_MIN_DEVIATION_PCT=10` と同一契約):
   - `milestone_monthly_progress` の該当 (milestone_key, ym) 行が **PM locked** (`source in ('pm_manual','pm_confirmed','pm_rejected','criteria_toggle','tsukuyomi_revision')`) → **skip** (提案も出さない)
   - expected = スケジュール按分の累積 % (= `expectedCumPctForYm` と同じ式: 開始前0 / 最終月以降100 / 途中は経過月数比)
   - `|estimated_pct - expected| < 10` → **skip** (デフォルト有効)
   - 同 (project, milestone, ym) に同値の `status='discarded'` revision あり → **skip** (再提案抑止)
   - 同 (project, milestone, ym) に `status='pending'` revision あり → 同値なら skip、異値なら revised_pct/revised_note 更新
   - 提案する場合:
     ```
     POST $SUPABASE_URL/rest/v1/ms_progress_revisions
     body: { project_id, milestone_id, ym, current_pct: <expected>, revised_pct: <estimated_pct>,
             revised_note: "<根拠、日本語>", status: "pending", requested_by: "system:tsukuyomi-estimate" }
     ```
     続けて `ms_revision_messages` に sender_kind='tsukuyomi' で根拠メッセージ INSERT、
     `l2_notifications?on_conflict=l2_kind,target_id,scope_key` に upsert:
     ```
     body: { l2_kind: "ms_progress_revision", target_id: "<projectId>", scope_key: "<ym>:<milestone_key>",
             title: "<MS名> の進捗修正提案 (<ym>)", summary: "デフォルト<expected>% → 提案<estimated_pct>%。<根拠>",
             status: "pending", metadata_json: { revision_id, milestone_id, ym, revised_pct, expected_pct } }
     ```
     title / summary は**日本語**で書く。
9. **milestone_monthly_progress には何も書かない** (= 旧 step 8 の upsert は廃止)

### A-3: project_monthly_notes path (= MS 不在 / advisor)
1. `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&select=final_content,draft_content,status&limit=1` + `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none` を取得
2. 結合テキストを `project_monthly_notes` に upsert (= UNIQUE project_id+ym):
   ```
   POST $SUPABASE_URL/rest/v1/project_monthly_notes?on_conflict=project_id,ym
   body: { project_id, ym, narrative_md: "<集約>", source: "l3_routine", updated_at: <ISO now> }
   ```

═══════════════════════════════════════════════════
Phase B: progress_estimate_state upsert
═══════════════════════════════════════════════════

### B-1: progress_estimate_state upsert
```
POST $SUPABASE_URL/rest/v1/progress_estimate_state?on_conflict=project_id,ym
body: {
  "project_id": "<projectId>",
  "ym": "<ym>",
  "source_hash": "<newHash>",
  "saved_count": <proposedN>,
  "last_processed_at": "<ISO now>",
  "llm_model": "anthropic:claude-sonnet-4-7@claude-routine"
}
```

### B-2: 通知
revision 提案時の `l2_notifications` upsert (A-2 step 8) で完結。それ以外の通知は出さない。

═══════════════════════════════════════════════════
Phase C: run summary
═══════════════════════════════════════════════════

- targets 数 / processed / llmCalls / unchanged / proposed / errors / hasMore
- まさへの 1 行サマリ:
  `🎯 MS 進捗 routine HH:MM 完了: N (PJ × ym) チェック、M revision 提案、L unchanged`

【禁止】
- **`milestone_monthly_progress` への INSERT / UPDATE / upsert (= LLM 直接書き込みは全面廃止。書くのは ms_progress_revisions + l2_notifications + project_monthly_notes + progress_estimate_state のみ)**
- PM locked (`pm_manual` / `pm_confirmed` / `pm_rejected` / `criteria_toggle` / `tsukuyomi_revision`) の月への提案
- `source='tsukuyomi_estimate'` / `'l2_routine'` の新規書き込み (= 廃止 source)
- 列名想像 (= db_schema.md grep)
- 旧 missing_ms_plan / missing_ms_items 通知 (= 2026-05-22 廃止)
- estimated_pct を今月の追加分として扱わない。必ず対象月時点の累積値として扱う

【参考】
- 提案判定ロジックの正本は PWA `progress-estimator.ts` (`REVISION_PROPOSAL_MIN_DEVIATION_PCT` 周辺) を Read で確認しながら実装
- デフォルト按分の式の正本は `pwa/src/lib/ms-schedule-shared.ts` の `expectedCumPctForYm`
- 旧 PWA cron `/api/cron/hourly-estimate` は 2026-05-29 に停止済み。`ALLOW_PWA_LLM_CRONS=1` なしでは disabled response のみ返す
