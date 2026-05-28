---
name: amd-os-l3-ms-progress-extract
description: AMD OS L2 ③ MS 進捗 (マイルストーン月次進捗) 抽出 routine。毎時 0 分発火、active PJ × {当月, 前月} の monthly_reports + project_meeting_summaries から各 MS の進捗 % をサブスク内 Claude で推定 → Supabase `milestone_monthly_progress` に upsert + project_monthly_notes (= MS 不在月)、progress_estimate_state.source_hash で差分検知。PWA `/api/cron/hourly-estimate` + `estimateProgress` 完全 inline 移植版 (= GAS 154 + PWA hourly-estimate 経路を Claude routine 内に統合、2026-05-25 まさ #71)。既存 PWA hourly-estimate との並行稼働中、動作確認 → fact 比較で OK なら既存停止。
---

# AMD OS L2 ③ MS 進捗推定 (PWA hourly-estimate 完全 inline 移植版)

## 設計の要点
- 既存 = GAS 154 `nav_pwa_pingHourlyEstimate` → PWA `/api/cron/hourly-estimate` → `estimateProgress(projectId, ym, {force:false})`
- 新 = Claude routine が同等ロジックを inline で実行 (= GAS / PWA hourly cron 完全 bypass)
- **MS 管理対象**: `project_category in ('dtsu','ecosystem','new_business')` (= 2026-05-25 #56 new_business 追加)
  - `advisor` は MS 進捗対象外 → 月次モーダル `project_monthly_notes` に保存
- **MS 不在月**: 対象月を覆う MS が無い場合 → `monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存 (= MS 設定 nudge は出さない)
- LLM 抽出は 0/20/40/60/80/100 の粗い候補 (= 保守的)
- `success_criteria` / `milestone_sub_items` は必ず入力に含める。高進捗は「MS名に近い活動」ではなく、成功条件に書かれた成果物へ直結する証拠で判断する。
- LLM 呼びはサブスク内 Claude
- Supabase REST 直叩き

## 並行稼働の慎重さ
**既存 PWA hourly-estimate が稼働中**。本 routine 登録直後は両方走る。
fact 比較 (= milestone_monthly_progress.confirmed_at / source 列で比較) で「Claude routine 出力 = PWA hourly 出力」になったら、PWA `/api/cron/hourly-estimate` を停止 + GAS 154 `nav_pwa_pingHourlyEstimate` を kill switch ON。

## 【絶対】 動く前に必ず Read
1. `pwa/manual/3-2-data-and-extraction.md` §3.1-3.3
2. `pwa/design/ms_progress.md` (= L2 ③ 仕様正本、Phase 4 セクション)
3. `pwa/src/app/api/cron/hourly-estimate/route.ts` (= 既存 PWA cron)
4. `pwa/src/lib/progress-estimator.ts` (= 既存 estimateProgress 本体)
5. `pwa/design/db_schema.md` (= milestone_monthly_progress / progress_estimate_state / project_monthly_notes / value_milestones / value_plan_cycles / monthly_reports / project_meeting_summaries 列名)

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
Phase A: 各 (projectId, ym) について estimate 実行
═══════════════════════════════════════════════════

### A-1: project_category 判定
- `category in ('dtsu','ecosystem','new_business')` → MS 管理対象 → MS 進捗推定 path
- `category == 'advisor'` → MS 不在月扱い → project_monthly_notes path

### A-2: MS 進捗推定 path
1. `value_plan_cycles?project_id=eq.<projectId>&status=in.(active,confirmed,fixed,draft)&order=period_start_ym.desc` で対象 ym を覆う cycle 取得
2. cycle 無し → A-3 へ fallback
3. `value_milestones?plan_cycle_id=eq.<cycleId>&is_active=eq.true&select=milestone_id,title,points,goal_level,success_criteria,period_start_ym,target_ym` で MS 一覧 + 対象 ym の MS フィルタ
   - 続けて `milestone_sub_items?milestone_id=in.(...)&select=milestone_id,title,weight,status,assignee` を取得し、各MSの入力に含める
4. MS 0 件 → A-3 へ fallback
5. 各 MS について `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&select=final_content,draft_content,status` (= status≠invalid) + `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none&order=meeting_date.desc&limit=20` を入力に進捗推定
6. **source_hash 差分検知**: hashInput = JSON.stringify({ p, ym, ms_keys: [...], report: report_hash, sums: sums_hash }) → sha256
   - `progress_estimate_state?project_id=eq.<projectId>&ym=eq.<ym>&select=source_hash` と一致なら **skipped_unchanged**
7. LLM 抽出 (= 私自身):
   - input: 各 MS の title / goal_level / success_criteria / sub_items + report + summaries
   - output: `{ "milestones": [ { "milestone_id": "<id>", "progress_pct": 0|20|40|60|80|100, "consumed_pt": <number>, "note": "<根拠 50 字>" }, ... ] }`
   - ルール: 完了条件に直接対応する証拠がない高進捗は下げる (= 保守的)
   - `80%` 以上、または前回から `+50%` 以上の増分は、`success_criteria` 内の成果物が「完成/完了/確定/提出/作成済/策定済/レビュー可能」になった同一文脈の証拠がある場合だけ許可
   - JAFCO/VC が前向き、DD開始、面談実施、資料作成予定、準備、着手、進行中だけでは、事業計画・資本政策・知財戦略などの成果物MSを高進捗にしない
   - 資本政策MSは、資本政策表・調達方針・持分方針・EXITまでの道筋の実物またはレビュー可能なドラフトが確認できる場合だけ高進捗にする
   - confirmed_at が set されてる milestone_monthly_progress 行、または `ms_progress_revisions.status='confirmed'` がある MS は **上書き禁止** (= まさ手動確定済)
8. 各 MS について `milestone_monthly_progress?on_conflict=milestone_key,ym` で upsert (= confirmed_at 既存は skip)
9. **MS 不在 / 計画なし通知**: 旧 `missing_ms_plan` / `missing_ms_items` 通知は廃止 (= 2026-05-22 確定)、何も通知しない

### A-3: project_monthly_notes path (= MS 不在 / advisor)
1. `monthly_reports?project_id=eq.<projectId>&ym=eq.<ym>&select=final_content,draft_content,status&limit=1` + `project_meeting_summaries?project_id=eq.<projectId>&ym=eq.<ym>&source_kinds=neq.none` を取得
2. 結合テキストを `project_monthly_notes` に upsert (= UNIQUE project_id+ym):
   ```
   POST $SUPABASE_URL/rest/v1/project_monthly_notes?on_conflict=project_id,ym
   body: { project_id, ym, narrative_md: "<集約>", source: "l3_routine", updated_at: <ISO now> }
   ```

═══════════════════════════════════════════════════
Phase B: progress_estimate_state upsert + 通知
═══════════════════════════════════════════════════

### B-1: progress_estimate_state upsert
```
POST $SUPABASE_URL/rest/v1/progress_estimate_state?on_conflict=project_id,ym
body: {
  "project_id": "<projectId>",
  "ym": "<ym>",
  "source_hash": "<newHash>",
  "saved_count": <savedN>,
  "last_processed_at": "<ISO now>",
  "llm_model": "anthropic:claude-sonnet-4-7@claude-routine"
}
```

### B-2: l2_notifications (= 差分検知ヒットで saved>0、L4/L5 と同様)
省略可。MS 進捗は cockpit に毎時表示されるため通知優先度低。

═══════════════════════════════════════════════════
Phase C: run summary
═══════════════════════════════════════════════════

- targets 数 / processed / llmCalls / unchanged / errors / hasMore
- まさへの 1 行サマリ:
  `🎯 MS 進捗 routine HH:MM 完了: N (PJ × ym) チェック、M saved (= MS 進捗 X, monthly_notes Y)、L unchanged`

【禁止】
- confirmed_at が set されてる milestone_monthly_progress を上書き (= まさ手動確定済を破壊禁止)
- 列名想像 (= db_schema.md grep)
- 旧 missing_ms_plan / missing_ms_items 通知 (= 2026-05-22 廃止)
- 進捗 % を 0/20/40/60/80/100 以外の細かい刻みで出す (= 保守的、粗い候補のみ)

【参考】
- 完全 inline 移植のため、複雑な進捗推定ロジックは PWA `progress-estimator.ts` を Read で確認しながら実装
- 既存 PWA cron `/api/cron/hourly-estimate` は当面並行稼働 → fact 比較で OK なら停止
