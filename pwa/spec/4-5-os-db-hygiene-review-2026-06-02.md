# OS/DB hygiene review - BZM FRL/PRS source conflicts

作成日: 2026-06-02 JST
Owner: OS/DB hygiene review worker
Scope: BZM `frl_cap_amd DB hygiene handoff` と JOYCLE support end gap を、OS/DB 側で read-only 再確認した結果。

この文書は review / handoff のみ。DB write、DDL、migration apply、deploy、score 再計算、PRS 正式採用、0-9 score table、R_net 値付け、現行 7 軸 AMD Score 置換は行わない。

## Read-only sources

- `origin/codex/frl-cap-amd-db-hygiene-handoff:pwa/bzm/runs/2026-06-02-frl-cap-amd-db-hygiene-handoff.md`
- `origin/codex/joycle-support-end-review:pwa/bzm/runs/2026-06-02-joycle-amd-support-end-current-truth-review.md`
- `origin/codex/joycle-damage-source-split:pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v4.md`
- `origin/codex/frl-cap-amd-timeline-date-source-lookup:pwa/bzm/runs/2026-06-02-frl-cap-amd-timeline-date-source-lookup.md`
- `origin/codex/frl-cap-amd-timeline-row-source-pack:pwa/bzm/runs/2026-06-02-frl-cap-amd-timeline-row-source-pack.md`
- `origin/codex/yd-founded-at-current-truth-review:pwa/bzm/runs/2026-06-02-yd-founded-at-current-truth-review.md`
- `pwa/design/db_schema.md`
- `pwa/src/app/api/cron/sync-pj-facts/route.ts`
- live Supabase read-only SELECT for `projects`, `project_ventures`, `project_knowledge`, `project_xrl_log`, `source_cache`, `billing_cycles`, `project_founding_members`, `amd_score_inputs`

Private raw source bodies, narrative bodies, exact private source text, private URLs, and secret values are intentionally not copied here.

## OS/DB current truth

### Schema / sync facts

- `project_ventures.founded_at`, `amd_support_started_at`, `amd_support_ended_at` are `date` columns. There is no precision/source/status column for these normalized dates.
- `project_knowledge` has `category`, `entity_name`, `fact_text`, `confidence`, `source`, `status`, but no dedicated `source_conflict` column.
- `/api/cron/sync-pj-facts` deletes all `project_knowledge` rows with `source='pj_basic_facts_sync'` per project, then reinserts basic facts from `project_ventures`.
- Therefore `project_knowledge` rows from `pj_basic_facts_sync` are derived facts, not independent sources. Fixing them directly without fixing `project_ventures` will be overwritten or reintroduced by sync.
- `project_xrl_log` uses `observed_at`, XRL axes, `milestone_label`, `source`, `source_note`; p18 2019 rows are manual rows with no source note.
- `billing_cycles` is AMD billing/cash timing infrastructure. It is not SU-native gross margin / R_net proof.

### Live rows rechecked

| PJ | live OS/DB observation | hygiene interpretation |
|---|---|---|
| p18 YD | `projects.status='ended'`, `start_ym=202505`, `end_ym=202509`; `project_ventures.founded_at=2019-01-01`; derived `project_knowledge.法人設立日=2019-01-01`; `source_cache` count 0; p18 XRL has manual 2019 milestone rows | founded_at conflicts with official company date candidate; derived knowledge is not independent; XRL 2019 is separate unknown-origin timeline issue |
| p11 BWE | `projects.start_ym=202404`; `project_ventures.founded_at=2019-04-01`; `amd_support_started_at=2026-02-01`; derived knowledge repeats both | founded_at correction candidate is strong; support start is internal month anchor conflict and needs precision/source policy |
| p06 CTB | `projects.start_ym=202306`; `project_ventures.founded_at=2023-04-01`; `amd_support_started_at=2023-06-01`; derived knowledge repeats both; latest p06 `amd_score_inputs` row has `frl_cap=3`, `frl_cap_amd=0`, notes from migration 112 | founded_at correction candidate is separate from CTB current FRL correction; do not touch FRL current row |
| p09 JOYCLE | `projects.status='ended'`, `end_ym=202603`; `project_ventures.amd_support_started_at=2025-11-01`, `amd_support_ended_at=NULL`; narrative/master text are support-ended-side; derived knowledge repeats start date; p09 billing rows show AMD billing/cash timing only | start date is upstream normalized conflict, not only derived knowledge; support end normalized column is stale/null; billing rows stay PRS-excluded |

## Issue decisions

### p18 YD founded_at

Decision: DB correction candidate.

If `project_ventures.founded_at` is defined as official/legal company founded date, update p18 from `2019-01-01` to `2023-08-04`.

Follow-up:

- Rerun or verify `pj_basic_facts_sync` so `project_knowledge(category='basic_fact', entity_name='法人設立日', source='pj_basic_facts_sync')` no longer carries `2019-01-01`.
- Do not use the derived knowledge row as a second source.

### p18 YD XRL 2019 milestone

Decision: separate source investigation, no correction in this package.

The p18 `project_xrl_log` 2019 milestone is manual and source-note-less. It should not block founded_at correction, but it can reintroduce the unsupported 2019 date in XRL displays. Cut a separate read-only XRL source lookup before editing or archiving that row.

### p11 BWE founded_at

Decision: DB correction candidate.

If `project_ventures.founded_at` is official/legal company founded date, update p11 from `2019-04-01` to `2025-04-28`. BZM source confidence is high because public/internal sources align.

Follow-up:

- Verify `pj_basic_facts_sync` for `法人設立日`.
- Keep BWE founding date separate from SIP/AMD support start, representative transition, and support end / transfer dates.

### p11 BWE amd_support_started_at

Decision: correction candidate, but needs month-precision policy before write.

The current DB value `2026-02-01` conflicts with `projects.start_ym=202404` and internal source anchor `2024-04`. However `2024-04-01` is an internal month anchor, not a primary exact support-start date.

Recommended gate:

- If OS accepts month anchors in date columns, write `2024-04-01` only with an explicit note in the control task that day precision is not claimed.
- If OS requires primary exact dates in `amd_support_started_at`, do not write `2024-04-01`; set the field to null/pending only after a controlled task, and keep `2024-04` as source note in the review artifact until a precision field exists.

### p06 CTB founded_at

Decision: DB correction candidate.

If `project_ventures.founded_at` is official/legal company founded date, update p06 from `2023-04-01` to `2021-12-09`.

Guard:

- Do not alter `amd_support_started_at=2023-06-01` in this package.
- Do not alter `amd_score_inputs` current correction. The latest p06 score input still carries `frl_cap=3`, `frl_cap_amd=0`, matching migration 112.
- Do not turn AMED/light-support facts into current AMD F_cap contribution.

### p09 JOYCLE AMD start fact

Decision: source conflict / upstream basic fact issue, no replacement exact date.

The conflict is not only `project_knowledge`. Live DB shows `project_ventures.amd_support_started_at=2025-11-01`; `project_knowledge.AMD 参画開始日=2025-11-01` is a derived `pj_basic_facts_sync` row.

Recommended action:

- Do not replace with `2023-12-01`, `2024-01-01`, or `2025-11-01` as an exact AMD relationship start.
- First decide whether `amd_support_started_at` can hold internal/month-level anchors. If exact-only, make the upstream `project_ventures.amd_support_started_at` null/pending in a controlled DB task, then rerun sync so the derived row disappears.
- If a month-anchor policy is accepted, write an approved month anchor only after identifying whether the field should mean OS project start, deep pivot start, or AMD support relationship start.

### p09 JOYCLE normalized support end

Decision: DB correction candidate, with month-precision caveat.

`projects.status='ended'`, `projects.end_ym='202603'`, and project_ventures narrative/master text all point to AMD support ending in 2026-03. The only normalized-column gap is `project_ventures.amd_support_ended_at=NULL`.

Recommended gate:

- If OS accepts month anchors in date columns, update `amd_support_ended_at` to `2026-03-01` as a month-level sentinel. The control task must state this is `2026-03` precision, not proof of an exact March 1 end.
- If OS requires exact dates, defer the update and draft a precision/source schema change such as `amd_support_ended_precision` or a separate support-period facts table.
- Keep `billing_cycles` as AMD billing/cash timing only. Do not use it for JOYCLE gross margin, damage value, reinvestment, or PRS formal values.

## Cross-cutting decisions

### 1. Meaning of `project_ventures.founded_at`

Recommendation: define it as official/legal company founded date for all SU/PJ venture rows.

Reason: UI and PL/monthly surfaces treat it as "SU 設立"; basic facts sync names it `法人設立日`; public/company source conflicts are currently contaminating derived knowledge and timeline reasoning.

### 2. Meaning of `project_ventures.amd_support_started_at`

Recommendation: do not silently mix exact dates and month anchors.

Short-term control task can allow `YYYY-MM-01` month sentinels only when:

- the artifact explicitly says `precision=month`;
- the value is not used as exact contract/email/appointment date;
- follow-up schema/metadata design is queued.

Longer-term draft: add precision/source metadata for normalized support dates, or move support periods into a small history table.

### 3. `project_knowledge` source conflict handling

Recommendation: fix upstream sync first.

`project_knowledge.status='needs_review'` / `source_conflict` is tempting, but current notification/spec surfaces mainly use `active`, `candidate`, `rejected`, and `archived` style states. Introducing new statuses without UI/API support risks hiding rows without solving the upstream sync. For derived basic facts, the safer first move is:

1. correct or null the upstream `project_ventures` value;
2. rerun `/api/cron/sync-pj-facts`;
3. verify no stale `pj_basic_facts_sync` row remains.

Only use a `needs_review` / `source_conflict` status after a dedicated status taxonomy decision.

### 4. Month-only dates in `date` columns

Recommendation: immediate company-founded corrections can proceed when exact public dates exist; support start/end month anchors need an explicit policy.

Potential policy options:

- Option A: allow `YYYY-MM-01` sentinel values, with doc/control-task precision notes and no exact-day claims.
- Option B: keep date columns exact-only, null conflicting support dates, and create `*_ym` / `*_precision` fields or a support period table before normalization.

For p09 JOYCLE support end, Option A is operationally useful because multiple OS sources already agree on `2026-03`, but it must be labeled month precision.

## Candidate SQL draft - do not execute

```sql
-- Candidate only. Do not execute from this review.
-- Requires DB owner approval and a controlled migration/task.

-- Exact official/legal company founded date corrections.
update project_ventures
   set founded_at = date '2023-08-04',
       updated_at = now()
 where project_id = 'p18'
   and founded_at = date '2019-01-01';

update project_ventures
   set founded_at = date '2025-04-28',
       updated_at = now()
 where project_id = 'p11'
   and founded_at = date '2019-04-01';

update project_ventures
   set founded_at = date '2021-12-09',
       updated_at = now()
 where project_id = 'p06'
   and founded_at = date '2023-04-01';

-- Month-anchor corrections. Execute only if OS accepts YYYY-MM-01
-- as a month-precision sentinel for support dates.
update project_ventures
   set amd_support_started_at = date '2024-04-01',
       updated_at = now()
 where project_id = 'p11'
   and amd_support_started_at = date '2026-02-01';

update project_ventures
   set amd_support_ended_at = date '2026-03-01',
       updated_at = now()
 where project_id = 'p09'
   and amd_support_ended_at is null;

-- If exact-only support dates are required, prefer a controlled null/pending
-- correction for conflicting upstream p09 start instead of guessing:
-- update project_ventures
--    set amd_support_started_at = null,
--        updated_at = now()
--  where project_id = 'p09'
--    and amd_support_started_at = date '2025-11-01';

-- After any project_ventures correction, rerun/verify:
-- GET /api/cron/sync-pj-facts with CRON_SECRET
-- Then SELECT project_knowledge where source='pj_basic_facts_sync'
-- for affected project_id/entity_name rows.
```

## Migration / design draft if precision is required

Do not apply in this review. This is only a design candidate.

```sql
-- Draft only: support date precision metadata.
alter table project_ventures
  add column if not exists amd_support_started_precision text,
  add column if not exists amd_support_ended_precision text,
  add column if not exists amd_support_date_source text;

comment on column project_ventures.amd_support_started_precision
  is 'Precision for amd_support_started_at: exact, month, year, pending. YYYY-MM-01 may be used only with precision=month.';

comment on column project_ventures.amd_support_ended_precision
  is 'Precision for amd_support_ended_at: exact, month, year, pending. YYYY-MM-01 may be used only with precision=month.';
```

## Required sync verification after approved DB correction

For each approved `project_ventures` update:

1. Verify affected upstream row in `project_ventures`.
2. Run or manually verify `/api/cron/sync-pj-facts`.
3. Select `project_knowledge` where `project_id in ('p18','p11','p06','p09')` and `source='pj_basic_facts_sync'`.
4. Confirm stale rows are gone:
   - p18 `法人設立日=2019-01-01`
   - p11 `法人設立日=2019-04-01`
   - p11 `AMD 参画開始日=2026-02-01`
   - p06 `法人設立日=2023-04-01`
   - p09 `AMD 参画開始日=2025-11-01` if upstream is nulled or corrected
5. Confirm p06 latest `amd_score_inputs` still has `frl_cap=3`, `frl_cap_amd=0`.

## Next worker candidates

1. `os-db-company-founded-at-correction-control-task`
   - Prepare a reviewed migration/control task for p18/p11/p06 exact founded_at corrections.
   - Include sync verification. No PRS/score changes.

2. `os-db-support-date-precision-policy`
   - Decide whether `amd_support_started_at` / `amd_support_ended_at` can use `YYYY-MM-01` month sentinels.
   - If not, draft precision columns or support-period table migration.

3. `p18-xrl-2019-source-investigation`
   - Read-only lookup for p18 manual XRL 2019 milestone.
   - Decide preserve / relabel / archive after source review.

4. `p09-joycle-support-period-normalization`
   - Resolve p09 `amd_support_ended_at` and conflicting `amd_support_started_at`.
   - Keep support end date separate from oral-history damage reasons and PRS formal scoring.

## Closeout

- DB write / DDL / migration apply: not performed.
- Deploy / score recalculation: not performed.
- Private raw source text: not copied.
- Candidate SQL: documentation only.
