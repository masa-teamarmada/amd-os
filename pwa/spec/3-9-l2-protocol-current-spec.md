# D-1 AMD Protocol 仕様

> **この章は何か**: D-1 `protocols` / `protocol_examples` / `protocol_result_observations` を、現在の writer で再構築するための確定仕様。設計思想の背景は `/manual/4-1-atlas-protocol-score-macrotrend` と `/design/amd_protocol.md`、運用者向けの入口は `/manual/8-3-l2-extraction-routines-spec` に置く。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | D-1 AMD Protocol |
| 目的 | AMD の経営判断を「分岐点 / 判断材料 / アクション / 結果観測」に分解し、PJ横断で再利用できる意思決定知財にする |
| primary writer | Windows MMO PC の Codex Desktop automation `amd-os-l2-protocol-extract` |
| schedule | daily 08:00 JST |
| repo skill | `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` |
| 旧 writer | `gas/155_L2KnowledgeExtractor.js` の `nav_protocol_pollAll` / `nav_protocol_extractOneForYm_` |
| 現行旧 writer 状態 | GAS 155 は kill switch のまま。定期復活禁止 |
| prompt authority | Supabase `llm_prompts.prompt_key='protocol.extract' AND is_active=true`。空なら抽出 skip。コード hardcode fallback 禁止 |
| notification kind | `l2_notifications.l2_kind='protocols'` |
| review gate | `/notifications` または admin UI で candidate を `confirmed` / `rejected` / `archived` にする |

## Input Contract

### Target Selection

| step | query / rule |
|---|---|
| active PJ | `projects.status='active'` から `project_id`, `project_name` を取る |
| ym list | JST の当月と前月 |
| processing order | `l2_extract_state(l2_kind='protocols')` の `last_processed_at` が古い順。1 run の `maxItems` は 4 |

### Evidence

| source | query | 用途 |
|---|---|---|
| meeting summaries | `project_meeting_summaries` where `project_id`, `ym`, `source_kinds!='none'`, order `meeting_date desc`, limit 50 | `decided`, `risks`, `next_actions`, `summary_short` から判断候補を作る |
| monthly reports | SKILL description 上は入力候補。現行設計 md は meeting summaries 主入力 | meeting summary が薄いときの補助。使う場合も全文保存しない |
| l2 feedbacks | `l2_feedbacks` where `l2_kind='protocols'`, `target_id=project_id`, `status='active'` | scope_key が `ym` または `ym:protocol:*` の修正依頼を prompt へ入れる |
| alias map | `members` 由来の code_name / email local part | 人名表記ゆれを code_name に寄せる |

`source_hash` は `JSON.stringify({ p: projectId, ym, pv: "v4_protocol_result_blank", sums })` を sha256 する。既存 `l2_extract_state.source_hash` と一致すれば LLM を呼ばず `last_processed_at` だけ更新する。

## Output Contract

### `protocols`

`db_schema.md` confirmed columns:

| column | contract |
|---|---|
| `protocol_id` | unique。現行 skill の例では新規生成 ID。`design/amd_protocol.md` の普遍化運用では `p4u-{sha12(title)}` を使う |
| `project_id` | universal pattern なら `NULL`。旧 / skill payload では PJ 固有 row として `project_id` を持つことがある。復旧時は既存 row の `kind` / `is_universal` を見て揃える |
| `title` | 固有名詞を避けた 20-40 字の意思決定パターン名 |
| `content` | 分岐点 / 判断材料 / アクションを Markdown で持つ。結果欄を自動推測で埋めない |
| `status` | `candidate` 初期。採否で `confirmed` / `rejected` / `archived` |
| `importance` | 1=軽微、2=中、3=重大 |
| `source` | automation 由来は `l2_hourly_extract` 相当 |
| `kind` | 普遍プロトコルは `pattern`、旧固有形式は `legacy_specific` |
| `is_universal` | 普遍プロトコルは `true` |

### `protocol_examples`

具体事例は `protocol_examples` に置く。`protocol_id`, `project_id`, `occurred_on` が同じものは同一事例として upsert する。

| column | contract |
|---|---|
| `summary` | 事例固有の 50-150 字要約 |
| `branch_point` | その PJ での分岐点 |
| `criteria` | その PJ で見た判断材料 |
| `action_taken` | 実際に採った方針 |
| `result` | 自動抽出では `NULL`。後追い観測だけを書く |
| `source_meeting_id` / `source_url` | 根拠 summary への短い参照 |

### `protocol_result_observations`

結果は append-only で `protocol_result_observations` に積む。単一の「最終結果」で上書きしない。

| column | contract |
|---|---|
| `observed_on` | 観測日 |
| `horizon` | `immediate / 1m / 3m / 6m / 12m / 24m / long_term` |
| `valence` | `positive / negative / mixed / neutral / unknown` |
| `confidence` | `low / medium / high` |
| `summary` | 実際に起きたこと。一般論や学習要約は禁止 |

### `/admin/protocols` outcome ledger read UI

P0 retrofit では `/admin/protocols` の server page が `protocol_result_observations` を read-only で取得し、`AdminProtocolsClient` の各 protocol 展開領域に outcome ledger として表示する。

表示する列は `observed_on`, `horizon`, `valence`, `confidence`, `summary`, `project_id`, `evidence_source_type`, `evidence_source_id` まで。`evidence_url`、source permalink、実本文、prompt全文、few-shot、score weight / threshold / calibration は取得・表示しない。

同一 `horizon` 内に複数の `valence` が存在する場合だけ、該当 protocol に `矛盾観測` chip を出す。P0 は write UI を持たず、既存観測の更新・上書き・DDL適用は行わない。

## Dedup / Status / Feedback

| concern | rule |
|---|---|
| protocol duplicate | universal 形式では title hash 由来の `protocol_id` で PJ 横断重複を避ける |
| example duplicate | `UNIQUE(protocol_id, project_id, occurred_on)` |
| state duplicate | `l2_extract_state` primary key = `(l2_kind, target_id, scope_key)` |
| notification duplicate | `l2_notifications` unique = `(l2_kind, target_id, scope_key)` |
| feedback apply | 反映した `l2_feedbacks` は `applied_count += 1`, `last_applied_at=now()` |
| yes | `protocols.status='confirmed'` |
| no | `protocols.status='rejected'` |

## Failure Mode

| failure | behavior |
|---|---|
| `llm_prompts.protocol.extract` が無い | 抽出 skip。`l2_extract_state.message='missing llm_prompts.protocol.extract'` 相当を残す |
| summaries 0 件 | `no_input` として state touch。空候補を作らない |
| source_hash unchanged | LLM call なし。state の `last_processed_at` だけ更新 |
| result を自動生成しそう | 保存しない。`result=NULL` |
| 固有事実を protocol 化しそう | `project_knowledge.basic_fact` へ寄せ、protocol にはしない |
| GAS 155 を復活させたくなる | 復活禁止。現行 writer は MMO automation |

## Validation

1. `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` とこの章の input/output が一致すること。
2. `pwa/design/db_schema.md` で `protocols`, `protocol_examples`, `protocol_result_observations`, `l2_extract_state`, `l2_notifications`, `l2_feedbacks` の列名を grep すること。
3. 1 run の dry summary に `processed / saved / unchanged / errors` を出すこと。
4. 候補が出た場合、`/notifications` で `l2_kind='protocols'` の採否が可能なこと。
5. `result` が自動抽出で埋まっていないことを spot check すること。

## この章だけで再構築できること

D-1の target selection、input evidence、prompt authority、dedupe、DB出力、通知、採否、結果観測 ledger、停止済み GAS との境界を再構築できる。

## まだ再構築できないこと

MMO PC 側の automation 登録 UI / 実行履歴そのものは repo 外状態なので、この章だけでは再登録できない。復旧時は MMO 側 Codex Desktop automation `amd-os-l2-protocol-extract` の登録状態を確認する。

## 確認したcurrent truth

- `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md`
- `pwa/design/amd_protocol.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`

## 未確認 / inferred

- `protocol_id` の現行 automation payload は SKILL と `design/amd_protocol.md` で差がある。復旧実装時は既存 DB row の `kind` / `is_universal` を見て universal 形式へ寄せる。
- MMO PC の実 schedule は repo 外のため、ここでは `L2_DATA.md` / SKILL の current truth を採用している。

## 次に見る実装ファイル

- `gas/155_L2KnowledgeExtractor.js` 行 608-820
- `pwa/src/app/(app)/admin/protocols/page.tsx`
- `pwa/src/components/admin/AdminProtocolsClient.tsx`
- `pwa/src/components/notifications/NotificationsClient.tsx`
