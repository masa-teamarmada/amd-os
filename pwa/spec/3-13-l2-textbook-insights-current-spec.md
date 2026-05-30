# L2⑩ Textbook Insights 仕様

> **この章は何か**: Before Zero Model (BZM) 教科書へ追記すべき AMD の実務知見を、Supabase 内の既存 L2 / OS データから候補化し、通知承認後に安全な local applier で `pwa/bzm/*.md` へ反映するための current spec。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | ⑩ Textbook Insights |
| table | `textbook_insight_candidates` |
| notification kind | `l2_notifications.l2_kind='textbook_insight'` |
| primary writer | Codex automation / local worker `amd-os-l10-textbook-insight-extract` |
| apply | `textbookInsights` outbox → `textbook_insight_candidates` + notification → `/notifications` yes/no → approved/rejected → local applier が `pwa/bzm/*.md` へ追記 |
| 禁止 | Vercel runtime / PWA API から git 管理ファイルを直接編集・commit しない |

## 目的と優先順位

抽出対象は「テキストブックに入れるべき実務知見」。優先順位はデータモデルの `insight_type` と `priority` に反映する。

| priority | insight_type | 意味 |
|---|---|---|
| 1 | `before_zero_knowhow` | Before Zero の PJ を進めるためのノウハウ、経営判断、分岐点、失敗回避 |
| 2 | `cross_project_pattern` | これまでの PJ 情報や AMD Protocol から総合的に見える横断傾向 |
| 3 | `case_study` | 各 PJ の中でケーススタディとして有効な情報 |
| 3 | `theory_evidence` | BZM / AMD Score / ERS / Protocol の既存理論を裏付ける観測 |

`priority=4` は弱い候補・保留候補。通知には出せるが、本文追記より再抽出・補強を優先する。

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
| `status` | `candidate` → yes で `approved`、no で `rejected`、applier 後 `applied` |
| `applied_file` / `applied_commit` | local applier が追記後に記録する。commit hash は commit 後に補完可 |

## Notification / Approval

`textbookInsights` outbox を `pwa/scripts/ms_progress_review_tool.mjs apply-outbox` が処理し、候補 row と `l2_notifications` を作る。

`/notifications` の挙動:

| action | effect |
|---|---|
| comment | `l2_feedbacks` と `tsukuyomi_learnings` に残す。候補 status は変えない |
| yes | `textbook_insight_candidates.status='candidate'` を `approved` にする |
| no | `textbook_insight_candidates.status='candidate'` を `rejected` にする |

「yes」は DB 候補の承認であり、この瞬間に Vercel runtime が `pwa/bzm/*.md` を編集するわけではない。実ファイル追記は local applier が行う。

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
- 追記後は `status='applied'`, `applied_file`, `applied_at`, `applied_by` を更新する。
- git commit / push は local worker が行う。Vercel runtime は git commit しない。

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
      "body_md": "Markdown本文",
      "evidence_refs": [
        { "table": "project_strategy_signals", "row_id": "...", "snippet": "...", "hash": "..." }
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
| Vercel runtime から git 追記したくなる | 禁止。local applier / PR / commit 経路へ戻す |

## Validation

1. `pwa/design/db_schema.md` で `textbook_insight_candidates`, `l2_notifications`, `l2_feedbacks` の列を確認する。
2. `node pwa/scripts/ms_progress_review_tool.mjs apply-outbox --file <fixture>` で `textbookInsights` が候補 + 通知に反映される。
3. `/notifications` で `textbook_insight` が展開表示でき、yes/no/comment が通る。
4. `node pwa/scripts/apply_approved_textbook_insights.mjs` dry-run が approved 候補だけを列挙する。
5. `git diff --check`、conflict marker scan、`npx tsc --noEmit`、`npm run build` を実行する。

## 未確認 / Partial

- MMO / Codex automation の実 schedule 登録は repo 外状態。現時点の repo は SKILL と outbox/applier contract までを正本化する。
- 章の大規模再編はしない。初期は既存章 `8-1-amd-os-operations` / `6-1-retrofit-verification` / 関連理論章へ候補単位で追記する。
- `applied_commit` は local applier 実行時点の HEAD を入れるため、厳密な追記 commit hash は commit 後に別途補完する運用が残る。
