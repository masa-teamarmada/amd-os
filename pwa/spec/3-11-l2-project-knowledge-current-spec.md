# D-3 Project Knowledge 仕様

> **この章は何か**: D-3 `project_knowledge` を現在の writer で再構築するための確定仕様。PJ利用者向けの読み方ではなく、抽出器・DB・通知・採否の実装契約を書く。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | D-3 PJナレッジ |
| table | `project_knowledge` |
| primary writer | Windows MMO PC の Codex Desktop automation `amd-os-l4-project-knowledge-extract` |
| schedule | daily 08:15 JST |
| repo skill | `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` |
| old writer | `gas/155_L2KnowledgeExtractor.js` の `nav_project_knowledge_pollAll` |
| old writer status | kill switch 停止。復活禁止 |
| state table | `l2_extract_state(l2_kind='project_knowledge')` |
| notification kind | `l2_notifications.l2_kind='project_knowledge'` |

## Input Contract

| input | query / rule |
|---|---|
| active PJ | `projects.status='active'` |
| ym list | JST 当月と前月 |
| monthly report | `monthly_reports` where `project_id`, `ym`, `status!='invalid'`; `final_content || draft_content`, max 12000 chars |
| meeting summaries | `project_meeting_summaries` where `project_id`, `ym`, `source_kinds!='none'`, order `meeting_date desc`, limit 30 |
| feedback | `l2_feedbacks` where `l2_kind='project_knowledge'`, `target_id=projectId`, `status='active'`, `scope_key=ym` |
| metadata guard | prompt 先頭に `projectId`, `projectName`, `ym` を置く |

`source_hash = sha256(JSON.stringify({ p: projectId, ym, pv: "v4_meta_strict", rb, sums }))`。一致時は LLM を呼ばず state touch。

## Extraction Categories

| category | 意味 |
|---|---|
| `people` | 人物・役職 |
| `tech` | 技術・手法 |
| `ip` | 知財・特許・論文 |
| `org` | 組織・体制 |
| `funding` | 資金・予算・調達 |
| `market` | 市場・顧客 |
| `competitor` | 競合 |
| `strategy` | 戦略・方針 |
| `term` | 用語・専門ワード |

LLM output は `items[] = { category, entity_name, fact_text, confidence }`。入力に書かれている事実だけを書く。推測で fact_text を補わない。

## Output Contract

### `project_knowledge`

`db_schema.md` confirmed columns:

| column | contract |
|---|---|
| `project_id` | target PJ |
| `category` | 上記 9 category のいずれか |
| `entity_name` | 固有名詞 / 組織 / 技術名。重複判定 key の一部 |
| `fact_text` | 事実説明。入力にある内容だけ |
| `confidence` | `high / medium / low` |
| `source` | automation 由来は `l2_hourly_extract` |
| `status` | 新規/更新候補は `candidate`。採否後 `active` / `rejected` |
| `updated_at` | upsert 時刻 |

`project_knowledge` には unique 制約が無い。重複回避は writer が `project_id + category + entity_name` で SELECT し、既存があれば PATCH、なければ INSERT する。

### State / Notification

| table | key | contract |
|---|---|---|
| `l2_extract_state` | `(project_knowledge, project_id, ym)` | source_hash / saved_count / total_count / llm_model / message |
| `l2_notifications` | `(project_knowledge, project_id, ym)` | saved>0 のとき通知。summary は上位3件の `category:entity_name` |
| `l2_feedbacks` | feedback_id | 反映したものは `applied_count` と `last_applied_at` を更新 |

## Pollution Guard

2026-05-09 の SE PJ 汚染事故を受け、`v4_meta_strict` を維持する。

| guard | behavior |
|---|---|
| project_meta と無関係な固有名詞 | 汚染データの可能性が高いので抽出しない |
| monthly report が他PJ内容 | `items: []` |
| `monthly_reports.status='invalid'` | 入力対象外 |
| 事実が曖昧 | `confidence='low'` または出力しない |
| source refs | 全文ではなく短い根拠だけ保存 |

## Failure Mode

| failure | behavior |
|---|---|
| report + summaries 0 件 | state に `no_input`、通知なし |
| source_hash unchanged | LLM call なし |
| DB unique なし | 必ず SELECT -> PATCH/INSERT。blind insert しない |
| feedback ignored risk | active feedback を prompt に入れる |
| GAS path requested | 使わない。MMO automation を正とする |

## Validation

1. `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` とこの章の categories / payload が一致すること。
2. `pwa/design/db_schema.md` で `project_knowledge`, `l2_extract_state`, `l2_notifications`, `l2_feedbacks` の列を確認すること。
3. 汚染防御 test として、対象 `projectName` と無関係な固有名詞だけの入力で `items=[]` になること。
4. 同一 `project_id + category + entity_name` の再実行で行数が増えず PATCH されること。
5. `/notifications` で candidate を `active` / `rejected` にできること。

## この章だけで再構築できること

D-3の target selection、source_hash、9 category、pollution guard、DB upsert、通知、採否、旧 GAS 停止境界を再構築できる。

## まだ再構築できないこと

MMO PC の automation 登録 UI / 実行ログは repo 外。5生データ直結ではなく、現行は `monthly_reports` + `project_meeting_summaries` の二次集約が primary input。

## 確認したcurrent truth

- `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md`
- `pwa/design/project_knowledge.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`

## 未確認 / inferred

- `project_knowledge.status` の全運用値は DB CHECK ではなく convention。`candidate / active / rejected` を現行採否 loop として扱う。

## 次に見る実装ファイル

- `gas/155_L2KnowledgeExtractor.js` 行 387-606
- `pwa/src/components/notifications/NotificationsClient.tsx`
