# D-2 MS Progress 仕様

> **この章は何か**: D-2 `milestone_monthly_progress` / `ms_progress_revisions` / `project_monthly_notes` / `progress_estimate_state` を、現在の writer で再構築するための確定仕様。月次モーダルでの使い方は `/manual/4-8-ms-progress-monthly-report-revision-spec` と `/manual/2-3-pj-cockpit` に置く。
>
> **2026-06-12 全面改訂 (schedule_default_revision_v3)**: LLM がMS進捗を直接書き込む方式を廃止。「スケジュール按分のデフォルト月割り値が常に有効、L2データからのズレ検知は revision 提案 → まさ確認後に初めて正本反映」アーキテクチャへ移行。
>
> **2026-06-12 追補 (アンカー方式 + 計画遅延通知)**: デフォルト按分の起点を「最新のまさ確定値 (= アンカー)」にする A 案と、target_ym 超過で 100% 未達の MS を毎日通知する C 案を導入。確定アンカーがある MS は target_ym を過ぎても勝手に 100% に飛ばない。

## 基本契約 (まさ確定 2026-06-12)

1. **デフォルト月割り (アンカー方式)**: N か月で完了する計画の MS は 1 か月あたり 100/N % の累積進捗がデフォルトで自動的に入る。**その月より前に PM 確定行 (アンカー) があれば、按分の起点はアンカー値**: `デフォルト(m) = min(100, アンカー% + (100/N) × アンカーからの経過月数)`。例: 3か月MSで 202605 確定 15% なら 202606 デフォルト = 15 + 33.3 = 48.3%。アンカーが無い MS は従来按分 (最終月 100%)。計画開始前のアンカーは `period_start_ym` の直前月に丸め、開始月が一気に 100% へ飛ばないようにする。計算正本は `pwa/src/lib/ms-schedule-shared.ts` の `anchoredExpectedCumPctForYm` (アンカー無し時は `expectedCumPctForYm` に一致)。
2. **AI は提案のみ**: LLM 推定は `milestone_monthly_progress` を直接書かない。デフォルトとの乖離が ±10pt 以上のときだけ `ms_progress_revisions` (status='pending') に提案を積み、`l2_notifications` (l2_kind='ms_progress_revision') で通知する。
3. **まさが認めない限りデフォルト通り**: revision が confirm されるまで、表示も報酬計算もデフォルト月割り値が有効。
4. **巻き戻りは設計上起きない**: 累積進捗は非減少。報酬計算は cumulative max 方式で「巻き戻り→再上昇」の二重払いを構造的に排除する。
5. **target_ym 超過は通知で知らせ、自動では完了させない**: アンカーがある MS は target_ym を過ぎても確定アンカーからの月割りで淡々と積む (100 で cap)。期限超過なのに 100% 未達の MS は毎日の cron が「計画遅延」通知 (l2_kind='ms_schedule_delay') を出す。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | D-2 MS進捗 |
| **デフォルト進捗 writer (正)** | Vercel cron `/api/cron/ms-schedule-progress` 毎日 02:30 JST (非LLM) |
| デフォルト進捗ロジック | `progress-estimator.ts` の `applyScheduleDefaultsForProject(projectId, ym)` → `applyScheduleAutoProgress` (アンカー方式) |
| 計画遅延通知 (C案) | 同 cron が当月分の `delayed[]` を `l2_notifications` (l2_kind='ms_schedule_delay', ラベル "D-2 MS計画遅延") へ upsert / 解消 delete |
| 表示 API のデフォルト | `/api/progress/ms-schedule` も同じ `anchoredExpectedCumPctForYm` で expectedCumPct を返す (writer と一致) |
| LLM 乖離検知 (提案のみ) | Windows MMO PC の Codex Desktop automation `amd-os-l3-ms-progress-extract` + `/api/progress/estimate` (手動再推定) |
| repo skill | `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` |
| PWA fallback | `/api/cron/hourly-estimate` は残すが `ALLOW_PWA_LLM_CRONS=1` なしで disabled |
| GAS fallback | `gas/154_PwaCronCaller.js` は disabled。定期復活禁止 |
| revision confirm 経路 | (1) 月次モーダル `/api/progress/revisions` PATCH (confirm/discard)、(2) 通知「はい/いいえ」 `/api/notifications/feedback` (l2_kind='ms_progress_revision') |
| manual UI write | `/api/progress/estimate`, `/api/progress/confirm`, `/api/progress/revisions`, `/api/progress/batch-save` |
| cockpit display | `CockpitMonthlyModal`, `CockpitGoalsCompact`, `CockpitMonthlyList` |
| ESTIMATOR_LOGIC_VERSION | `schedule_default_revision_v3` |

## source 契約 (milestone_monthly_progress.source)

正本: `pwa/src/lib/ms-schedule-shared.ts` の `PM_LOCKED_PROGRESS_SOURCES`。

| source | 書き手 | PM locked | 意味 |
|---|---|---|---|
| `routine_auto` | `/api/cron/ms-schedule-progress` ほか自動処理 | ✗ | スケジュール按分のデフォルト月割り値。自動処理が毎回再計算・上書きする |
| `pm_manual` | 月次モーダル手動保存 | ✅ | まさの手動入力 |
| `pm_confirmed` | `/api/progress/confirm` | ✅ | まさの確定 |
| `pm_rejected` | `/api/progress/confirm` (却下) | ✅ | まさの却下 (値ごと確定) |
| `criteria_toggle` | 成功条件トグル | ✅ | サブ項目達成トグル由来 |
| `tsukuyomi_revision` | revision confirm (モーダル PATCH / 通知 yes) | ✅ | つくよみ提案をまさが承認した値 |
| (廃止) `tsukuyomi_estimate` / `l2_routine` | 旧 LLM 直接書き込み | ✗ | **新規に書かれることはない**。残存行は `routine_auto` 上書きで自然修復される |

- PM locked = ✅ の行は自動処理 (デフォルト按分 / LLM) が**絶対に上書きしない**。
- PM locked = ✗ の行は `applyScheduleAutoProgress` が毎回スケジュール按分値で上書きする → 野良 source は自然消滅する。

## Target / Category Contract

| rule | value |
|---|---|
| active projects | `projects.status='active'` |
| ym list | JST 当月と前月 |
| MS対象 category | `projects.project_category in ('dtsu','ecosystem','new_business')` |
| MS対象外 | `advisor` など。MS進捗を作らず `project_monthly_notes` に月次ノートを保存 |
| processing order (LLM側) | `progress_estimate_state.last_processed_at` 古い順 |
| maxItems (LLM側) | 14 targets / run |

## デフォルト進捗 Path (非LLM・毎日)

`applyScheduleDefaultsForProject(projectId, ym)` の処理順:

1. `value_plan_cycles` / `value_milestones` (is_active=true) を読み、各 MS の期間 (`period_start_ym`〜`target_ym`、欠損は cycle 期間で補完 = `milestonePeriod`) を確定
2. 各 MS × 各月について `anchoredExpectedCumPctForYm(rowYm, startYm, endYm, anchor)` を計算。anchor = その行の月より**厳密に前 (<)** にある最新の PM locked 行 `{ym, pct}`。anchor 無し = 従来按分 (開始前=0 / 最終月以降=100 / 途中=経過月数比、小数1桁)。anchor あり = `min(100, アンカー% + (100/N) × 経過月数)`。anchor の `ym` が `period_start_ym` より前なら、経過月数の起点だけ `period_start_ym` の直前月に丸める。**anchor がある MS は target_ym を過ぎても当月まで書き続ける** (lastIndex = 当月)。anchor 無し MS は従来通り target_ym で打ち止め
3. `milestone_monthly_progress` の既存行が PM locked なら skip、それ以外 (無い/`routine_auto`/旧 source) は `source='routine_auto'` で upsert (note にアンカー起点を明記)
4. `ms_progress_revisions.status='confirmed'` がある MS は `tsukuyomi_revision` として再適用 (修復)
5. 開始前 MS の非確定値は 0% に補正 (`applyBeforeStartProgressGuard`)
6. 進捗が変わった PJ は `syncRewardSummaryForCycle` で報酬キャッシュ再同期
7. **計画遅延検知 (C案)**: `target_ym` が当月より前なのに有効進捗 (revision lock 適用後) が 100% 未満の MS を `delayed[]` として返す。cron は当月 (baseYm) 分のみ `l2_notifications` に upsert (l2_kind='ms_schedule_delay', scope_key=`${ym}:delay:${milestoneId}`, importance=2, metadata_json={milestone_id, ym, target_ym, current_pct})。期限後の当月行が存在しない場合は、その月以前の最新 `milestone_monthly_progress` を current_pct として使い、target_ym 月で100%済みのMSを0%遅延扱いしない。100% 到達などで遅延が解消した MS の同 scope_key 通知は delete で自動解消

## LLM 乖離検知 Path (提案のみ)

`estimateProgress` (automation / `/api/progress/estimate`):

| step | rule |
|---|---|
| 入力 | `monthly_reports` (status!='invalid') + `project_meeting_summaries` (limit 20)。`source_hash` 未変更なら LLM call なし |
| 高進捗ガード | 80%以上は success_criteria 直結の完成/提出/確定/承認証拠が必要。無ければ按分基準へ補正 |
| PM locked skip | locked 行には提案を出さない |
| 乖離判定 | `abs(LLM推定累積 - アンカー方式デフォルト)` < **10pt** なら提案しない (デフォルトが有効のまま)。基準は `anchoredExpectedCumPctForYm` (writer と同一)、プロンプトにもアンカー起点を明示、`source_hash` にも anchor を含める (アンカー確定で再評価が走る) |
| 重複抑止 | 同値の pending は再提案しない。同値の discarded も再提案しない (まさの「いいえ」を尊重) |
| 提案 | `ms_progress_revisions` upsert (status='pending', requested_by='system:tsukuyomi-estimate') + `ms_revision_messages` (sender_kind='tsukuyomi') |
| 通知 | `l2_notifications` upsert (l2_kind='ms_progress_revision', scope_key=`${ym}:${milestone_key}`, metadata_json={revision_id, milestone_id, ym, revised_pct, expected_pct}, onConflict='l2_kind,target_id,scope_key') |

**LLM は `milestone_monthly_progress` を一切書かない。**

## revision confirm / discard

confirm (= モーダル PATCH action='confirm' / 通知「はい」) は同一処理:

1. `ms_progress_revisions` を id で select (pending のみ対象)
2. `value_milestones.points` → `consumed_pt = round(points × revised_pct / 100, 2)`
3. `milestone_monthly_progress` upsert: `{milestone_key, ym, progress_pct, consumed_pt, source:'tsukuyomi_revision', confirmed_at, note}` (onConflict='milestone_key,ym')
4. revision を status='confirmed' + confirmed_by/at
5. `tsukuyomi_learnings` insert (scope='msActivity', source='ms_revision_confirmed')
6. `milestone_responsibility` の各担当へ `member_ms_activities.learned_addendum` 追記 (onConflict='member_id,milestone_id,ym')
7. `syncRewardSummaryForCycle` で報酬キャッシュ再同期

discard (= モーダル PATCH action='discard' / 通知「いいえ」): revision を status='discarded' + confirmed_by/at のみ。`milestone_monthly_progress` は触らない (= デフォルト月割りが有効のまま)。

通知経路の実装: `/api/notifications/feedback` の `confirmMsProgressRevision` / `discardMsProgressRevision`。revision 特定は metadata_json.revision_id が第一、フォールバックは scope_key の `${ym}:${milestone_key}` から pending を検索。service client (RLS 跨ぎ) で書く。

## 報酬計算との接続 (reward-summary.ts)

| rule | detail |
|---|---|
| 参照する進捗 | **PM locked 行 (consumed_pt、null なら progress_pct×points/100) と、コード計算のアンカー方式デフォルトのみ**。DB の非確定行 (`routine_auto` 含む) は参照しない |
| 非 locked 月のデフォルト | `anchoredExpectedCumPctForYm(m, startYm, endYm, anchorBefore(m))`。anchorBefore(m) = m より前の最新 locked 行 (pct は consumed_pt/points×100 優先、points=0 なら progress_pct)。writer と同一基準なので表示と支払いが一致する |
| cumulative max | `payableCum(ms, ym) = max over m≤ym of effectiveCumAt(ms, m)`。巻き戻り→再上昇の差分二重払いを構造的に排除。過去月のデフォルトを未来アンカーで cap しないが、cumulative max が二重払いを防ぐ |
| is_active guard | `project_members.is_active=false` のメンバーは share 0。残メンバーで share 合計 1 に renormalize、合計 0 なら支払いなし |
| 正本 | `pwa/src/lib/reward-summary.ts` の `buildPayableCumMap` / `filterActiveAndRenormalize` |

## Output Contract

### `milestone_monthly_progress`

| column | contract |
|---|---|
| `milestone_key` | `value_milestones.milestone_id` |
| `ym` | `YYYYMM` |
| `progress_pct` | 対象月時点の**累積**進捗率 0-100。今月増分ではない |
| `consumed_pt` | `points * progress_pct / 100` |
| `source` | 上の source 契約に従う。**自動処理は `routine_auto` のみ、確定は `tsukuyomi_revision` 等の PM locked のみ** |
| `confirmed_at` | PM locked 行のみ set |
| `note` | 根拠 500 字以内 |

### `ms_progress_revisions`

| column | contract |
|---|---|
| `project_id`, `milestone_id`, `ym` | 提案対象 |
| `current_pct` / `current_note` | 現在有効な値とデフォルト按分基準の説明 |
| `revised_pct` / `revised_note` | 提案値と根拠 |
| `status` | `pending` → `confirmed` / `discarded` |
| `requested_by` | `system:tsukuyomi-estimate` (自動) / user email (モーダル依頼) |
| `confirmed_by` / `confirmed_at` | confirm/discard 時に set |

### `project_monthly_notes` / `progress_estimate_state`

(変更なし — MS対象外PJの月次ノートと run state。列契約は従来通り: `project_id`+`ym` key、`source_hash`、`saved_count`/`skipped_count`/`total_count`、`llm_model`、`message`、`last_processed_at`)

## Failure Mode

| failure | behavior |
|---|---|
| PWA `/api/cron/hourly-estimate` hit | `ALLOW_PWA_LLM_CRONS=1` なしなら disabled response |
| GAS 154 hit | disabled。復活させない |
| cycle missing | 通知せず `project_monthly_notes` path |
| report/summaries empty | デフォルト按分は走る (非LLM)。LLM 側は state に `no_input` 相当を残して skip |
| source_hash unchanged | LLM call なし。デフォルト按分は毎日走る |
| PM locked 行あり | 自動処理は skip |
| LLM output overclaims high pct | success criteria 直結証拠がなければ提案しない |
| 乖離 < 10pt | 提案しない (デフォルトが有効) |
| 同値の discarded 提案 | 再提案しない |
| 旧 source 行 (`l2_routine` 等) 残存 | 翌日の cron が `routine_auto` で上書き修復 |
| target_ym 超過 + アンカーあり | 100% に自動ジャンプしない。アンカーからの月割りを継続 (100 で cap) + `ms_schedule_delay` 通知 |
| target_ym 超過 + アンカー無し | 従来通り最終月 100% (月割りの自然な帰結)。遅延通知の対象にならない |
| 遅延が解消 (100% 到達 / target_ym 変更) | cron が同 scope_key の `ms_schedule_delay` 通知を delete |

## Validation

1. `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` と本章を照合する。
2. `pwa/design/db_schema.md` で `milestone_monthly_progress`, `ms_progress_revisions`, `ms_revision_messages`, `project_monthly_notes`, `progress_estimate_state`, `value_milestones`, `value_plan_cycles` の列を確認する。
3. `/api/cron/ms-schedule-progress?ym=YYYYMM` (Bearer CRON_SECRET) で `savedTotal` / `failed` を確認する。
4. PM locked 行 (`source in PM_LOCKED_PROGRESS_SOURCES`) が自動処理後も変更されていないことを spot check する。
5. cockpit `/project/<projectId>/cockpit?ym=<YYYYMM>` で月次モーダルの進捗タブに反映されること。
6. 通知 `/notifications` で「D-2 MS進捗修正提案」カードの はい/いいえ が revision confirm/discard に落ちること。
7. 確定アンカーがある MS (例: p21 事業計画策定 202605=15%) の翌月デフォルトが `アンカー% + 100/N` になっていること (3か月MSなら 48.3%)。target_ym 超過月でも 100% に飛んでいないこと。
8. target_ym 超過 + 100% 未達の MS について `/notifications` に「D-2 MS計画遅延」カードが出ること。100% 確定後の cron 実行で同カードが消えること。

## この章だけで再構築できること

D-2 の source 契約、アンカー方式デフォルト按分 cron、計画遅延通知 (ms_schedule_delay)、LLM 提案化の判定基準、revision confirm/discard の全経路、報酬計算との接続 (cumulative max / is_active guard / anchored デフォルト)、DB出力、disabled fallback、cockpit反映を再構築できる。

## まだ再構築できないこと

MMO PC 側の automation 登録状態と直近 run log は repo 外なので、この章だけでは確認できない。

## 確認したcurrent truth

- `pwa/src/lib/ms-schedule-shared.ts` / `pwa/src/lib/progress-estimator.ts` / `pwa/src/lib/reward-summary.ts`
- `pwa/src/app/api/cron/ms-schedule-progress/route.ts`
- `pwa/src/app/api/progress/revisions/route.ts` / `pwa/src/app/api/notifications/feedback/route.ts`
- `pwa/design/db_schema.md`

## 次に見る実装ファイル

- `pwa/src/lib/progress-estimator.ts` (`applyScheduleAutoProgress` / `estimateProgress`)
- `pwa/src/lib/reward-summary.ts` (`buildPayableCumMap` / `filterActiveAndRenormalize`)
- `pwa/src/app/api/cron/ms-schedule-progress/route.ts`
- `pwa/src/app/api/notifications/feedback/route.ts`
