# L2⑤ Member Knowledge 仕様

> **この章は何か**: L2 ⑤ `member_knowledge` を現在の writer で再構築するための確定仕様。メンバーの見せ方ではなく、抽出器・DB・通知・採否の実装契約を書く。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | ⑤ メンバーナレッジ |
| table | `member_knowledge` |
| primary writer | Claude routine `amd-os-l2-consolidated-evidence` Phase D-4 |
| schedule | daily 08:30 JST |
| repo skill | `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` |
| old writer | `gas/155_L2KnowledgeExtractor.js` の `nav_member_knowledge_pollAll` |
| old writer status | kill switch 停止。復活禁止 |
| state table | `l2_extract_state(l2_kind='member_knowledge')` |
| notification kind | `l2_notifications.l2_kind='member_knowledge'` |

## Input Contract

| section | source | contract |
|---|---|---|
| C 公式役割分担 | `milestone_responsibility` -> `value_milestones` -> `value_plan_cycles` | `share>0` の公式担当範囲。skills / work_style の最重要根拠 |
| A 本人活動ログ | `member_activities` | `member_id`, 直近90日, order `extracted_at desc`, limit 200 |
| B 関連PJ会議 | `project_members` -> `project_meeting_summaries` | active PJ、直近60日、`source_kinds!='none'`, limit 80。本人主体とは限らない |
| alias map | `members` | code_name / email local part。inactive は歴史的記録用として区別 |
| feedback | `l2_feedbacks` | `l2_kind='member_knowledge'`, `target_id=code_name`, `scope_key='global'`, `status='active'` |

`source_hash = sha256(JSON.stringify({ cn: codeName, mid: memberId, pv: "v3_with_aliases", acts, roles, sums }))`。一致時は LLM を呼ばず state touch。

## Extraction Categories

| category | 意味 |
|---|---|
| `skills` | 技術スキル / 業務スキル |
| `personality` | 性格・人柄 |
| `communication_style` | コミュニケーションスタイル |
| `growth_areas` | 成長領域・挑戦中の課題 |
| `work_style` | 働き方の特徴 |
| `interests` | 興味・関心 |
| `episodes` | 印象的なエピソード |

出力は `categories[] = { category, summary }`。summary は 100 字以内の自然文。code_name を本文に含めない。

## Output Contract

### `member_knowledge`

`db_schema.md` confirmed columns:

| column | contract |
|---|---|
| `code_name` | `members.code_name`。URL や UI の member_id とは分ける |
| `category` | 上記 7 category |
| `summary` | 100 字以内を基本。保存時は 500 字上限で truncate |
| `source` | automation 由来は `l2_hourly_extract` |
| `status` | 新規/更新候補は `candidate`。採否後 `active` / `rejected` |
| `source_hash` | input hash |
| `last_processed_at` | writer 実行時刻 |
| `updated_at` | row 更新時刻 |

Unique key は `(code_name, category)`。同一カテゴリは upsert で最新候補に置き換える。

### State / Notification

| table | key | contract |
|---|---|---|
| `l2_extract_state` | `(member_knowledge, code_name, global)` | source_hash / saved_count / total_count / llm_model / message |
| `l2_notifications` | `(member_knowledge, code_name, global)` | saved>0 のとき通知。summary は category 名 |
| `l2_feedbacks` | feedback_id | 反映したものは `applied_count` と `last_applied_at` を更新 |

## Attribution Guard

| guard | behavior |
|---|---|
| Section C | 公式担当範囲。skills / work_style の ground truth |
| Section A | 本人活動なので自由抽出可 |
| Section B | PJ全体会議。本人名が明示され、かつ Section C と整合する場合のみ抽出 |
| C 空 + A 空 + B のみ | 原則 `categories=[]` |
| code_name in summary | 禁止。別カラムで管理 |
| role outside scope | 本人スキルにしない |
| 推測 | 禁止 |

## Failure Mode

| failure | behavior |
|---|---|
| active member 0 | run summary に 0、DB write なし |
| A/B/C 全入力なし | `no_input` state、通知なし |
| source_hash unchanged | LLM call なし |
| B だけで本人名なし | 抽出しない |
| feedback ignored risk | active feedback を prompt に入れる |
| GAS path requested | 使わない。MMO automation を正とする |

## Validation

1. `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` とこの章の input 3 section / category / payload が一致すること。
2. `pwa/design/db_schema.md` で `member_knowledge`, `member_activities`, `milestone_responsibility`, `value_milestones`, `value_plan_cycles`, `project_meeting_summaries`, `l2_extract_state`, `l2_notifications`, `l2_feedbacks` の列を確認すること。
3. Section B だけの会議要約で本人名が無い場合、出力が空になること。
4. 同一 `code_name + category` の再実行で row が増えず upsert されること。
5. `/notifications` で candidate を `active` / `rejected` にできること。

## この章だけで再構築できること

L2⑤の active member selection、3 section input、alias/feedback、7 category、attribution guard、DB upsert、通知、採否、旧 GAS 停止境界を再構築できる。

## まだ再構築できないこと

MMO PC の automation 登録 UI / 実行ログは repo 外。members に本名列が無いため、alias map は現状 code_name と email local part 中心。

## 確認したcurrent truth

- `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md`
- `pwa/design/member_knowledge.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`

## 未確認 / inferred

- `members.member_name` がない前提で alias map が薄い。将来 DB に本名/姓が追加されたら alias block を拡張する。

## 次に見る実装ファイル

- `gas/155_L2KnowledgeExtractor.js` 行 56-381
- `gas/079_NameAliasMap.js`
- `pwa/src/components/notifications/NotificationsClient.tsx`
