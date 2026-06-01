# YD founded_at current truth review

作成日: 2026-06-02 JST
作成者: BZM司令塔配下worker
ステータス: OS/DB worker handoff candidate

## 0. この成果物の扱い

このファイルは、p18 Yellow Duck / YD の公式設立日 `2023-08-04` と DB `2019-01-01` の衝突を、DB補正前の current truth / source hygiene brief として整理したもの。

- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- DB補正SQLは候補としてのみ記載する。実行は禁止。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸AMD Score置換、過去score再計算は行っていない。
- 公式設立日、DB current value、AMD関与期間、Yellow Duck法人の活動継続を混ぜずに扱う。

確認した主資料:

- `/Users/masa/projects/AGENTS.common.md`
- `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`
- `pwa/AGENTS.md`, `pwa/CLAUDE.md`, `pwa/HANDOFF_pwa_rebuild.md`
- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v12.md`
- `pwa/bzm/runs/2026-06-02-yd-ue-lcoe-source-join.md`
- `/Users/masa/projects/knowledge/yd.md`
- `pwa/design/db_schema.md`, `pwa/design/amd_score.md`
- Supabase read-only: `projects`, `project_ventures`, `project_knowledge`, `source_cache`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`; 補助確認として `project_xrl_log`, `project_xrl_evidence`
- 公開source: Yellow Duck公式company page / official news page

## 1. Executive summary

`official_founded_at_source`: Yellow Duck公式company page。2026-06-02 JST live checkで、会社概要の設立は `2023年8月4日`。同ページのCEO略歴は、2011年に未利用再エネ研究開始、2022年NEDO賞、2023年にYellow Duck株式会社設立という時系列を分けている。

`db_founded_at_current_value`: Supabase `project_ventures.project_id='p18'` の `founded_at='2019-01-01'`。`project_knowledge` の `法人設立日=2019-01-01` は `source='pj_basic_facts_sync'` 由来で、独立sourceではなく `project_ventures.founded_at` から同期された派生factと見るのが安全。

`conflict_classification`: `official_company_founded_at_conflicts_with_db_current_value`; DB側の `2019-01-01` は `unknown_db_origin`。今回確認できた範囲では、2019が法人設立日、研究開始日、活動開始日、旧屋号日、仮置き日のどれかを示す一次sourceは見つからない。

`recommended_os_db_action`: OS/DB workerへ、`project_ventures.founded_at` を公式sourceに合わせて `2023-08-04` へ補正する候補として渡す。同時に、`project_knowledge.basic_fact` は `pj_basic_facts_sync` の派生なので、補正後に同期routeまたは同等の派生fact更新を確認する。実行前にDB ownerが「法人設立日フィールドは公式法人設立日を保持する」でよいかだけ確認する。

`do_not_infer`: `2019-01-01` を研究開始・個人活動開始・PoC開始・法人設立前活動として推測補完しない。AMD関与期間 `202505-202509` をYellow Duck法人設立日や法人活動停止日と混ぜない。Yellow Duck公式news上の活動継続を商用UE成立、販売成立、粗利成立として扱わない。

## 2. Source hygiene table

| item | source | observed value | hygiene classification | note |
|---|---|---:|---|---|
| Official founded_at | `https://yellow-duck.jp/company/` live checked 2026-06-02 JST | `2023-08-04` | `official_public_company_profile` | 会社概要の設立日。法人設立日sourceとして最優先。 |
| Official company timeline | `https://yellow-duck.jp/company/` live checked 2026-06-02 JST | 2011 research start / 2022 NEDO award / 2023 company setup | `official_public_bio_timeline` | 2011研究開始と2023設立が分離されている。2019の説明にはならない。 |
| Official activity status | `https://yellow-duck.jp/` live checked 2026-06-02 JST | 2026-05-14 不動テトラ実証関連、2026-03〜05 登壇/受賞/掲載 | `official_public_activity_continuation` | AMD関与終了後も会社・開発活動は継続。ただし商用UE sourceではない。 |
| DB project | Supabase `projects?project_id=eq.p18` read-only | `status=ended`, `start_ym=202505`, `end_ym=202509` | `amd_relationship_period` | AMD OS上の関与期間。Yellow Duck法人の設立日・活動停止日ではない。 |
| DB venture | Supabase `project_ventures?project_id=eq.p18` read-only | `founded_at=2019-01-01` | `db_current_value_conflicts_with_official` | 公式設立日と衝突。source columnは無く、由来不明。 |
| DB knowledge | Supabase `project_knowledge?project_id=eq.p18` read-only | `法人設立日=2019-01-01`, `source=pj_basic_facts_sync` | `derived_basic_fact_not_independent_source` | `project_ventures` 由来の派生fact。二重根拠として扱わない。 |
| DB source cache | Supabase `source_cache?project_id=eq.p18` read-only | no rows | `still_missing` | p18 join済みraw sourceなし。 |
| DB monthly reports | Supabase `monthly_reports?project_id=eq.p18` read-only | no rows | `still_missing` | 月次sourceなし。 |
| DB meeting summaries | Supabase `project_meeting_summaries?project_id=eq.p18` read-only | no rows | `still_missing` | MTG summary sourceなし。 |
| DB strategy signals | Supabase `project_strategy_signals?project_id=eq.p18` read-only | no rows | `still_missing` | strategy signal sourceなし。 |
| Supplemental XRL timeline | Supabase `project_xrl_log?project_id=eq.p18` read-only | `2019-01-01` milestone label includes 設立 / TRL4 | `manual_timeline_repeats_unknown_origin` | `source=manual`, `source_note=null`。2019の一次sourceではない。 |
| Supplemental XRL evidence | Supabase `project_xrl_evidence?project_id=eq.p18` read-only | no rows | `still_missing` | XRL evidenceなし。 |
| Internal knowledge | `/Users/masa/projects/knowledge/yd.md` | `設立=不明`; AMD関与は2025-06〜2025-09 | `internal_note_not_founded_at_source` | 公式設立日の補強にはならないが、2019を公式設立日としない方向とは整合。 |

## 3. Current truth

### 3.1 official_founded_at_source

```yaml
official_founded_at_source:
  value: "2023-08-04"
  display_value: "2023年8月4日"
  source_url: "https://yellow-duck.jp/company/"
  source_type: "official_company_page"
  checked_at: "2026-06-02 JST"
  source_summary:
    - "会社概要に設立 2023年8月4日と記載。"
    - "CEO略歴では2011年研究開始、2022年NEDO賞、2023年Yellow Duck株式会社設立が分けて書かれている。"
  confidence: "high"
```

### 3.2 db_founded_at_current_value

```yaml
db_founded_at_current_value:
  table: "project_ventures"
  project_id: "p18"
  value: "2019-01-01"
  read_at: "2026-06-02 JST"
  related_derived_fact:
    table: "project_knowledge"
    category: "basic_fact"
    entity_name: "法人設立日"
    fact_text: "2019-01-01"
    source: "pj_basic_facts_sync"
    updated_at: "2026-06-01T19:03:30.299042+00:00"
  derived_fact_interpretation: "project_ventures.founded_atから同期された派生fact。独立sourceとして扱わない。"
```

### 3.3 AMD relationship period

```yaml
amd_relationship_period:
  table: "projects"
  project_id: "p18"
  project_name: "YD"
  status: "ended"
  start_ym: "202505"
  end_ym: "202509"
  interpretation: "AMD関与期間。Yellow Duck法人の設立日・活動停止日・商用終了日ではない。"
  source_hygiene: "keep_separate_from_company_founded_at"
```

## 4. Conflict classification

```yaml
conflict_classification:
  class: "official_company_founded_at_conflicts_with_db_current_value"
  official_value: "2023-08-04"
  db_value: "2019-01-01"
  db_origin_status: "unknown_db_origin"
  severity: "high_for_source_hygiene; low_for_runtime_if_only_display"
  why:
    - "公式company pageが法人設立日を明示している。"
    - "DB側にはsource columnがなく、project_knowledgeもpj_basic_facts_sync由来で独立根拠ではない。"
    - "manual XRL timelineにも2019-01-01があるがsource_note=nullで、一次sourceではない。"
    - "公式ページ上の研究開始は2011年、NEDO賞は2022年、会社設立は2023年で、2019を説明する記述は確認できない。"
```

2019が何の日かは、今回確認したsource hygieneでは判定不可。

- 法人設立日: 公式sourceと衝突するため不採用。
- 研究開始: 公式sourceは2011年研究開始とするため不採用。
- 活動開始 / 試作開始 / 仮置き: 一次sourceなし。`unknown_db_origin` のまま扱う。
- XRL上の初期TRL4時点: manual timeline上は存在するが、source_noteなし。公式sourceと整合しないので法人設立日補正の反証にはならない。

## 5. Recommended OS/DB action

`recommended_os_db_action`:

1. OS/DB workerで `project_ventures.founded_at` の補正候補をレビューする。
2. DB owner判断が「`project_ventures.founded_at` は公式法人設立日を保持する」であれば、`p18` を `2023-08-04` へ更新する。
3. `project_knowledge.basic_fact` の法人設立日は `pj_basic_facts_sync` 派生なので、補正後に `cron/sync-pj-facts` 相当の同期結果を確認する。同期routeを使わない場合でも、派生factが古い `2019-01-01` のまま残らないことを確認する。
4. `project_xrl_log` の `2019-01-01` manual timelineは、法人設立日補正とは別論点に分離する。XRL timelineを直す場合は、TRL/PoC年表のsource再調査として別タスク化する。

### Candidate SQL only - do not execute in this worker

```sql
-- Candidate only. Do not execute from this BZM worker.
-- Purpose: align Yellow Duck official company founded_at with official company page.

update project_ventures
set
  founded_at = date '2023-08-04',
  updated_at = now()
where project_id = 'p18'
  and founded_at = date '2019-01-01';

-- After the update, rerun or verify the basic facts sync so that
-- project_knowledge(category='basic_fact', entity_name='法人設立日')
-- no longer carries the old derived value.
```

## 6. Do not infer

`do_not_infer`:

- Do not infer `2019-01-01` as Yellow Duck法人設立日.
- Do not infer `2019-01-01` as research start; official source points to 2011 research start.
- Do not infer `2019-01-01` as activity start, prototype start, old company registration, or placeholder unless a source is found.
- Do not treat `project_knowledge` 2019 as a second independent source; it is `pj_basic_facts_sync`.
- Do not mix AMD relationship period `start_ym=202505`, `end_ym=202509`, `status=ended` with Yellow Duck法人設立日.
- Do not read AMD `ended` as Yellow Duck法人/開発活動停止. Official news indicates activity after AMD support.
- Do not use official activity continuation, awards, demos, or media exposure as commercial UE, sales, invoice, payment, COGS, or gross margin source.
- Do not let this founded_at correction change PRS, P/R_net values, 0-9 scores, current 7-axis AMD Score, or historical score recalculation.

## 7. safe_v13_or_os_handoff_fields

```yaml
safe_v13_or_os_handoff_fields:
  p18_company_founded_at_official:
    value: "2023-08-04"
    source_url: "https://yellow-duck.jp/company/"
    source_type: "official_company_page"
    checked_at: "2026-06-02 JST"
    confidence: "high"

  p18_company_founded_at_db_current:
    value: "2019-01-01"
    source_tables:
      - "project_ventures.founded_at"
      - "project_knowledge basic_fact 法人設立日 (derived from pj_basic_facts_sync)"
    origin_status: "unknown_db_origin"

  p18_company_founded_at_conflict_status:
    value: "official_2023_08_04_conflicts_with_db_2019_01_01"
    action: "os_db_review_for_correction"

  p18_company_founded_at_recommended_db_value:
    value: "2023-08-04"
    action_scope: "candidate_only_not_executed"

  p18_db_basic_fact_sync_note:
    value: "project_knowledge法人設立日はpj_basic_facts_sync由来。project_ventures補正後に同期確認が必要。"

  p18_amd_relationship_period:
    status: "ended"
    start_ym: "202505"
    end_ym: "202509"
    guard: "do_not_mix_with_company_founded_at_or_company_activity_status"

  p18_company_activity_status:
    value: "official_activity_continues_after_amd_relationship"
    source_url: "https://yellow-duck.jp/"
    guard: "activity_continuation_not_commercial_ue_or_gross_margin"

  p18_2019_date_status:
    value: "unknown_db_origin"
    guard: "do_not_infer_research_start_activity_start_or_placeholder"

  p18_xrl_timeline_note:
    value: "project_xrl_log repeats 2019-01-01 as manual timeline with source_note null; keep separate from official founded_at correction"
```

## 8. Open questions for commander / OS DB

1. `project_ventures.founded_at` は公式法人設立日だけを入れるフィールドとして固定してよいか。
2. p18の `project_xrl_log` 2019 milestoneは、公式設立日補正後も「manual XRL timeline」として残すか、別workerでsource再調査するか。
3. `pj_basic_facts_sync` は次回自動で `project_knowledge` を更新するか、OS/DB workerで同期routeを手動確認するか。

## 9. Verification

- 公式company page / official news pageをlive確認した。
- Supabaseはservice role RESTでread-only queryのみ実行した。
- `projects`, `project_ventures`, `project_knowledge`, `source_cache`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals` のp18関係を確認した。
- 補助として `project_xrl_log`, `project_xrl_evidence` も確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 新規成果物はこのファイルのみ。
