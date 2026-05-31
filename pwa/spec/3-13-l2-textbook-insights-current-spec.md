# L2⑩ Textbook Insights 仕様

> **この章は何か**: Before Zero 実践テキストへ追記すべき AMD の実務知見を、Supabase 内の既存 L2 / OS データから候補化し、通知承認後に安全な local applier で `pwa/bzm/*.md` へ反映するための current spec。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | ⑩ Textbook Insights |
| table | `textbook_insight_candidates` |
| notification kind | `l2_notifications.l2_kind='textbook_insight'` |
| primary writer | Codex automation / local worker `amd-os-l10-textbook-insight-extract` |
| apply | `textbookInsights` outbox → `textbook_insight_candidates` + notification → `/notifications` yes/no → approved/rejected → local applier が `pwa/bzm/*.md` へ追記 |
| text scope | 「BZM理論書」だけではなく、Before Zero の実務判断・失敗学習・PJ横断パターン・関係者対応・現場移行まで含む実践テキスト |
| metadata gate | `metadata_json.practice_kind` 7分類、`confidentiality`、`bzm_review_required/status`、`theory_change_scope` を候補ごとに持つ |
| 禁止 | Vercel runtime / PWA API から git 管理ファイルを直接編集・commit しない |

2026-05-31 に OS司令塔が migration 116 (`pwa/scripts/migrations/116_textbook_insight_candidate_metadata_gates.sql`) を本番DBへ緊急適用し、`metadata_json` 未存在による DB/code mismatch は解消済み。この schema/docs sync worker は追加DDLを実行せず、適用済み production schema を `python3 -X utf8 scripts/dump_schema.py` で `pwa/design/db_schema.md` へ同期する。

## 目的と優先順位

抽出対象は「Before Zero 実践テキストに入れるべき実務知見」。優先順位は従来互換の `insight_type` / `priority` と、実践分類の `metadata_json.practice_kind` の両方で表現する。

| priority | insight_type | 意味 |
|---|---|---|
| 1 | `before_zero_knowhow` | Before Zero の PJ を進めるためのノウハウ、経営判断、分岐点、失敗回避 |
| 2 | `cross_project_pattern` | これまでの PJ 情報や AMD Protocol から総合的に見える横断傾向 |
| 3 | `case_study` | 各 PJ の中でケーススタディとして有効な情報 |
| 3 | `theory_evidence` | BZM / AMD Score / ERS / Protocol の既存理論を裏付ける観測 |

`priority=4` は弱い候補・保留候補。通知には出せるが、本文追記より再抽出・補強を優先する。

### `metadata_json.practice_kind`

`practice_kind` は DB列ではなく `metadata_json.practice_kind` に入れる。unknown 値は helper 側で `decision_branch` 等へ勝手に丸めず、`metadata_json.validation_warnings` に残す。

| practice_kind | 意味 | 追記方針 |
|---|---|---|
| `decision_branch` | GO/NO-GO、設立タイミング、律速判断などの分岐 | 判断の条件・材料・結果を再利用可能に書く |
| `failure_learning` | 失敗・未達・手戻りから得た学習 | 原因、早期検知、次の回避策を分ける |
| `cross_project_pattern` | 複数PJにまたがる反復パターン | 特定PJだけの偶然と普遍パターンを分ける |
| `theory_case` | BZM/AMD Score/ERS/Protocol 理論に関わるケース | `theory_case_kind` と `theory_change_scope` を必ず明示する |
| `reusable_question` | 次回PJで使える問い・チェックリスト | 質問形またはrubric補助として書く |
| `relationship_playbook` | PI/候補CEO/VC/企業/大学との関係構築 | 相手別の打ち手・注意点・禁じ手を書く |
| `field_transition` | 研究現場から事業化・会社化へ移る局面 | 誰が何をいつ引き受けるかを具体化する |

`theory_edge_case` / `theory_update_candidate` は独立 `practice_kind` にしない。

| metadata | value |
|---|---|
| `practice_kind` | `theory_case` |
| `theory_case_kind` | `edge_case` / `update_candidate` |
| `bzm_review_required` | `true` |
| `theory_change_scope` | `terminology` / `axis_definition` / `rubric` / `formula` / `weight` / `chapter_structure` 等 |

## Input Contract

L2① Monthly Reports と同様に、基本は Supabase 内の既存データを primary input にする。`source_cache` は証跡補助であり、これだけで no-data 判定しない。

| table | 用途 |
|---|---|
| `monthly_reports` | PJ 月次断面。`final_content` は読み取りだけで、上書きしない |
| `project_meeting_summaries` | 経営判断、合意、次アクション、リスクの具体例 |
| `project_strategy_signals` | L2⑨ 経営ハイライト。done の経営判断・進捗 |
| `protocols` / `protocol_examples` / `protocol_result_observations` | AMD Protocol の普遍パターン、具体事例、後追い結果 |
| `project_knowledge` / `member_knowledge` | PJ / メンバーのナレッジ断片 |
| `project_registry_diffs` | OS 台帳差分候補。PJ構造や関係者変化のケース |
| `project_xrl_evidence` / `amd_score_inputs` | XRL / AMD Score の裏付け、律速軸、評価変更 |
| `project_ventures` / `projects` | PJ 基本情報、カテゴリ、開始/終了/凍結状態 |
| `source_cache` | source refs / short snippet / hash の補助証跡 |

## Output Contract

### `textbook_insight_candidates`

| column | contract |
|---|---|
| `candidate_id` | UUID。通知 metadata へ入れて exact update に使う |
| `target_id` | project_id。PJ横断・会社全体の知見は `p00` |
| `ym` | 月次文脈がある場合の `YYYYMM`。横断知見は NULL 可 |
| `scope_key` | 通知・dedupe 用。推奨は `textbook:<source_hash 12桁>` |
| `topic` / `title` | 候補テーマ / 通知見出し |
| `target_bzm_slug` | 追記先の既存 BZM 章 slug。default は `8-1-amd-os-operations` |
| `proposed_section` | 章内の提案セクション名。applier は見出しとして使う |
| `insight_type` | `before_zero_knowhow` / `cross_project_pattern` / `case_study` / `theory_evidence` |
| `priority` | 1 が最重要、4 が保留 |
| `body_md` | 追記候補本文。教科書文体の Markdown。ただし承認前は候補であり git には入らない |
| `evidence_refs` | table / row id / date / title / short snippet / hash。raw全文は禁止 |
| `source_tables` | 入力に使った Supabase table の配列 |
| `metadata_json` | `practice_kind`, `theory_case_kind`, `validation_warnings` 等。JSONB default `{}` |
| `confidentiality` | `internal_only` / `sanitized` / `publishable`。local applier は `internal_only` を BZM file に追記しない |
| `bzm_review_required` | BZM理論・用語・rubric・数式・重み・章構成に触れる場合 `true` |
| `bzm_review_status` | `not_required` / `pending` / `approved` / `changes_requested` / `rejected` |
| `theory_change_scope` | `none` / `terminology` / `axis_definition` / `rubric` / `formula` / `weight` / `chapter_structure` |
| `status` | `candidate` → yes で `approved`、no で `rejected`、applier 後 `applied` |
| `applied_file` / `applied_commit` | local applier が追記後に記録する。commit hash は commit 後に補完可 |

### Evidence Criteria

- `evidence_refs` は table / row id / date / title / short snippet / hash / confidentiality 程度に留める。
- raw メール全文、議事録全文、Slack全文を保存しない。
- `confidentiality='publishable'` は原則まれ。社外公開可能と判断できる根拠がある場合だけ。
- `sanitized` は個人名・未公開社名・契約条件・資金情報などをぼかした本文だけ BZM 追記可能。
- `internal_only` は候補DB・通知・レビュー対象にはできるが、`pwa/bzm/*.md` への自動追記は skip する。

## Notification / Approval

`textbookInsights` outbox を `pwa/scripts/ms_progress_review_tool.mjs apply-outbox` が処理し、候補 row と `l2_notifications` を作る。

`/notifications` の挙動:

| action | effect |
|---|---|
| comment | `l2_feedbacks` と `tsukuyomi_learnings` に残す。候補 status は変えない |
| yes | `textbook_insight_candidates.status='candidate'` を `approved` にする |
| no | `textbook_insight_candidates.status='candidate'` を `rejected` にする |

「yes」は DB 候補の承認であり、この瞬間に Vercel runtime が `pwa/bzm/*.md` を編集するわけではない。実ファイル追記は local applier が行う。

BZM review gate:

- `bzm_review_required=true` かつ `bzm_review_status!='approved'` は local applier が skip する。
- `theory_change_scope!='none'` かつ `bzm_review_status!='approved'` も skip する。
- `practice_kind='theory_case'` かつ `theory_case_kind in ('edge_case','update_candidate')` は review required。
- 「はい」は候補の採用承認であり、理論変更レビューの `approved` と同義ではない。理論・rubric・数式・重み・章構成へ触れる候補は別途 BZM review を通す。

## Textbook Append Path

承認済み候補は local script で反映する。

```bash
cd /Users/masa/projects/AMD/amd-os
node pwa/scripts/apply_approved_textbook_insights.mjs --limit 20
node pwa/scripts/apply_approved_textbook_insights.mjs --apply --limit 20
```

- default は dry-run。`--apply` を付けたときだけ `pwa/bzm/<target_bzm_slug>.md` に追記する。
- 追記対象 slug は `[a-z0-9-]+` かつ既存 file のみ許可する。
- 追記ブロックには `<!-- textbook-insight:<candidate_id> -->` marker を入れて二重追記を防ぐ。
- 追記ブロック header には `practice_kind`, `insight_type`, `priority`, `confidentiality`, `bzm_review_status`, `theory_change_scope` を入れる。
- 追記後は `status='applied'`, `applied_file`, `applied_at`, `applied_by` を更新する。
- git commit / push は local worker が行う。Vercel runtime は git commit しない。

## Target Routing

| practice / scope | default target |
|---|---|
| Before Zero 実務運用・OS化 | `8-1-amd-os-operations` |
| retrofit / case study | `6-1-retrofit-verification` |
| XRL / readiness | `3-1-xrl-group` |
| FRL / founder readiness | `4-1-frl-founder-readiness` |
| AMD Score / 律速判断 | `5-1-amd-score-integration` |
| ERS / research institution readiness | `7-1-ers-ecosystem-readiness` |

新章が main にまだ無い場合は、新章を勝手に作らず `8-1-amd-os-operations` + `proposed_section='未分類の実務知見'` へ fallback し、`metadata_json.validation_warnings` に routing fallback を残す。

## Outbox Format

`/Users/masa/.codex/automations/amd-os-ms/outbox/<timestamp>-textbook-insights.json`

```json
{
  "generatedAt": "ISO8601",
  "source": "codex-automation-l10-textbook-insight",
  "textbookInsights": [
    {
      "target_id": "p00",
      "ym": null,
      "scope_key": "textbook:<hash12>",
      "topic": "Before Zero のGO判断",
      "title": "TRLゲート未達時はマクロ追い風だけで設立を急がない",
      "target_bzm_slug": "8-1-amd-os-operations",
      "proposed_section": "実務ケース",
      "insight_type": "before_zero_knowhow",
      "priority": 1,
      "metadata_json": {
        "practice_kind": "decision_branch"
      },
      "confidentiality": "sanitized",
      "bzm_review_required": false,
      "bzm_review_status": "not_required",
      "theory_change_scope": "none",
      "body_md": "Markdown本文",
      "evidence_refs": [
        { "table": "project_strategy_signals", "row_id": "...", "snippet": "...", "hash": "...", "confidentiality": "sanitized" }
      ],
      "source_tables": ["project_strategy_signals", "project_xrl_evidence"],
      "source_hash": "sha256..."
    }
  ]
}
```

## Failure Mode

| failure | behavior |
|---|---|
| input L2 が薄い | 空候補にせず、未確認として run summary に残す |
| `source_cache` だけがある | no-data 判定に使わない。必要なら 5 生データ gap check へ回す |
| target slug が存在しない | applier は停止し、candidate は `approved` のまま残す |
| approved が二重に apply されそう | marker を検出して skip |
| `practice_kind` が未知 | helper は丸めず、`metadata_json.validation_warnings` に残す |
| `confidentiality` が未知/未定義 | helper/applier は `internal_only` として扱い、BZM file append は skip |
| BZM review が未承認 | local applier は skip し、candidate は `approved` のまま残す |
| Vercel runtime から git 追記したくなる | 禁止。local applier / PR / commit 経路へ戻す |

## Validation

1. `pwa/design/db_schema.md` で `textbook_insight_candidates`, `l2_notifications`, `l2_feedbacks` の列を確認する。
2. `node pwa/scripts/ms_progress_review_tool.mjs apply-outbox --file <fixture>` で `textbookInsights` が候補 + 通知に反映される。
3. `/notifications` で `textbook_insight` が展開表示でき、yes/no/comment が通る。
4. `node pwa/scripts/apply_approved_textbook_insights.mjs` dry-run が approved 候補だけを列挙する。
5. `git diff --check`、conflict marker scan、`npx tsc --noEmit`、`npm run build` を実行する。

## 未確認 / Partial

- MMO / Codex automation の実 schedule 登録は repo 外状態。現時点の repo は SKILL と outbox/applier contract までを正本化する。
- metadata / confidentiality / BZM review gate migration 116 は本番DB適用済み。追加DDLは行わず、schema dump で `db_schema.md` を同期する。
- notifications UI は候補詳細に metadata を表示する最小対応。BZM review status を通知画面から直接変更する運用UIは次worker候補。
- 章の大規模再編はしない。初期は既存章 `8-1-amd-os-operations` / `6-1-retrofit-verification` / 関連理論章へ候補単位で追記する。
- `applied_commit` は local applier 実行時点の HEAD を入れるため、厳密な追記 commit hash は commit 後に別途補完する運用が残る。
