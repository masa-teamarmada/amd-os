# L2③ MS Progress 仕様

> **この章は何か**: L2 ③ `milestone_monthly_progress` / `project_monthly_notes` / `progress_estimate_state` を、現在の writer で再構築するための確定仕様。月次モーダルでの使い方は `/manual/4-8-ms-progress-monthly-report-revision-spec` と `/manual/2-3-pj-cockpit` に置く。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | ③ MS進捗 |
| primary writer | Windows MMO PC の Codex Desktop automation `amd-os-l3-ms-progress-extract` |
| schedule | 毎時 0 分 |
| repo skill | `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` |
| PWA fallback | `/api/cron/hourly-estimate` は残すが `ALLOW_PWA_LLM_CRONS=1` なしで disabled |
| GAS fallback | `gas/154_PwaCronCaller.js` は disabled。定期復活禁止 |
| manual UI write | `/api/progress/estimate`, `/api/progress/confirm`, `/api/progress/revisions`, `/api/progress/batch-save` |
| cockpit display | `CockpitMonthlyModal`, `CockpitGoalsCompact`, `CockpitMonthlyList` |

## Target / Category Contract

| rule | value |
|---|---|
| active projects | `projects.status='active'` |
| ym list | JST 当月と前月 |
| MS対象 category | `projects.project_category in ('dtsu','ecosystem','new_business')` |
| MS対象外 | `advisor` など。MS進捗を作らず `project_monthly_notes` に月次ノートを保存 |
| processing order | `progress_estimate_state.last_processed_at` 古い順 |
| maxItems | 14 targets / run |

## Input Contract

### MS Progress Path

| input | query / rule |
|---|---|
| plan cycle | `value_plan_cycles` where `project_id`, `status in ('active','confirmed','fixed','draft')`, and `ym` が `period_start_ym`〜`period_end_ym` |
| milestones | `value_milestones` where `plan_cycle_id`, `is_active=true`; `milestone_id`, `title`, `points`, `goal_level`, `success_criteria`, `period_start_ym`, `target_ym` を使う |
| sub items | `milestone_sub_items` where `milestone_id in (...)`; `title`, `weight`, `status`, `assignee` |
| monthly report | `monthly_reports` where `project_id`, `ym`, `status!='invalid'`; `final_content || draft_content` |
| meeting summaries | `project_meeting_summaries` where `project_id`, `ym`, `source_kinds!='none'`, limit 20 |
| confirmed progress | `milestone_monthly_progress.confirmed_at IS NOT NULL` は上書き禁止 |
| confirmed revisions | `ms_progress_revisions.status='confirmed'` がある MS は上書き禁止 |

`source_hash` は MS key、report hash、meeting summaries hash を含める。未変更なら LLM call なし。

### Monthly Notes Path

MS対象外、cycle が無い、または active milestones が 0 のときは `monthly_reports` + `project_meeting_summaries` を集約し、`project_monthly_notes` に保存する。旧 `missing_ms_plan` / `missing_ms_items` 通知は出さない。

## Output Contract

### `milestone_monthly_progress`

`db_schema.md` confirmed columns:

| column | contract |
|---|---|
| `milestone_key` | `value_milestones.milestone_id` |
| `ym` | `YYYYMM` |
| `progress_pct` | 対象月時点の累積進捗率 0-100。今月増分ではない |
| `consumed_pt` | `points * progress_pct / 100` |
| `source` | automation 由来は `tsukuyomi_estimate` / routine 移植由来の値。手動確定系は上書きしない |
| `confirmed_at` | set 済みなら writer は skip |
| `note` | 根拠 500 字以内。成功条件に対応する短い理由 |

### `project_monthly_notes`

| column | contract |
|---|---|
| `project_id`, `ym` | unique key |
| `body` | MSが無い月の月次進捗。LLMで推測しすぎず、report/meeting にある事実をまとめる |
| `updated_by` | automation なら routine 名、手動なら user email/code_name |

### `progress_estimate_state`

| column | contract |
|---|---|
| `project_id`, `ym` | primary key |
| `source_hash` | input hash |
| `saved_count` / `skipped_count` / `total_count` | run summary |
| `llm_model` | subscription automation の model id |
| `message` | `no_input`, error reason など |
| `last_processed_at` | unchanged でも touch |

## Progress Rules

| rule | detail |
|---|---|
| base line | MS個別期間の月割り按分を基準にする |
| start before | `ym < period_start_ym` は 0%。周辺作業を開始前 MS の進捗にしない |
| high progress | 80%以上は `success_criteria` に直結する完成/提出/確定/承認/レビュー可能な証拠が必要 |
| no overwrite | `confirmed_at` set、`pm_manual`, `pm_confirmed`, `criteria_toggle`, `tsukuyomi_revision` など人間確定系は下げない |
| routine MS | `tag='routine'` は月割り自動補完側へ寄せる |
| evidence | `monthly_reports` と `project_meeting_summaries` から見えるものだけ。source_cache だけで no-data 判定しない |

## Failure Mode

| failure | behavior |
|---|---|
| PWA `/api/cron/hourly-estimate` hit | `ALLOW_PWA_LLM_CRONS=1` なしなら disabled response |
| GAS 154 hit | disabled。復活させない |
| cycle missing | 通知せず `project_monthly_notes` path |
| report/summaries empty | state に `no_input` 相当を残して skip |
| source_hash unchanged | LLM call なし |
| confirmed progress exists | skip |
| LLM output overclaims high pct | success criteria 直結証拠がなければ保存しない |

## Validation

1. `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` と `pwa/design/ms_progress.md` を照合する。
2. `pwa/design/db_schema.md` で `milestone_monthly_progress`, `project_monthly_notes`, `progress_estimate_state`, `value_milestones`, `value_plan_cycles`, `project_meeting_summaries`, `monthly_reports` の列を確認する。
3. dry run summary に `targets / processed / llmCalls / unchanged / errors / hasMore` を出す。
4. `confirmed_at` 付き row が変更されていないことを spot check する。
5. cockpit `/project/<projectId>/cockpit?ym=<YYYYMM>` で月次モーダルの進捗タブに反映されること。

## この章だけで再構築できること

L2③の target selection、MS対象/非対象分岐、input evidence、progress calculation guard、DB出力、state、disabled fallback、cockpit反映を再構築できる。

## まだ再構築できないこと

MMO PC 側の automation 登録状態と直近 run log は repo 外なので、この章だけでは確認できない。

## 確認したcurrent truth

- `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md`
- `pwa/design/ms_progress.md`
- `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- `pwa/src/app/api/progress/*/route.ts`
- `pwa/design/db_schema.md`

## 未確認 / inferred

- `source` 値の完全な enum は DB CHECK ではなく運用 convention。実装時は既存 row を見て揃える。
- subscription automation の実 model id は run 環境側で変わる可能性がある。

## 次に見る実装ファイル

- `pwa/src/lib/progress-estimator.ts`
- `pwa/src/app/api/cron/hourly-estimate/route.ts`
- `pwa/src/app/api/progress/estimate/route.ts`
- `pwa/src/app/api/project/monthly-note/route.ts`
