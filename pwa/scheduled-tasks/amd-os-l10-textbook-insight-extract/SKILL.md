---
name: amd-os-l10-textbook-insight-extract
description: AMD OS L2 ⑩ Textbook Insights / Before Zero 実践テキスト知見抽出の repo 正本。Supabase 内の既存 L2 / OS データから Before Zero 実践テキストへ追記すべき候補を作り、`textbookInsights` outbox JSON を `/Users/masa/.codex/automations/amd-os-ms/outbox/` に出す。候補は通知承認後、local applier が confidentiality / BZM review gate を通して `pwa/bzm/*.md` へ追記する。PWA/Vercel runtime から git 管理ファイルを直接編集しない。
---

# AMD OS L2 ⑩ Textbook Insights 抽出 automation

## 設計の要点

- 入力は Supabase 内の既存 L2 / OS データを primary にする。
- `source_cache` は証跡補助。source_cache だけで no-data 判定しない。
- 出力は `textbookInsights` outbox。LaunchAgent / helper が `textbook_insight_candidates` と `l2_notifications(l2_kind='textbook_insight')` に反映する。
- まさ/管理者が `/notifications` で「はい」を押すと `status='approved'` になる。
- 実際の `pwa/bzm/*.md` 追記は `node pwa/scripts/apply_approved_textbook_insights.mjs --apply` で local worker が行い、confidentiality / BZM review gate を通したものだけ commit/push する。
- Vercel runtime / PWA API から repo file を編集・commit しない。

## 必ず読む正本

1. `pwa/spec/3-13-l2-textbook-insights-current-spec.md`
2. `pwa/spec/3-1-l2-data-extraction-current-spec.md`
3. `pwa/spec/3-7-notifications-current-spec.md`
4. `pwa/spec/5-3-automation-responsibility-current-spec.md`
5. `pwa/design/db_schema.md`
6. `pwa/bzm/` の章構成と `pwa/src/app/(app)/bzm/bzm-chapters.ts`
7. `pwa/scripts/ms_progress_review_tool.mjs` の `upsertTextbookInsights`
8. `pwa/scripts/apply_approved_textbook_insights.mjs`

## 抽出優先度

Textbook は「BZM理論書」だけではなく、Before Zero の現場で再利用する実践テキストとして扱う。

1. `decision_branch`: Before Zero の GO/NO-GO、設立タイミング、律速判断、経営判断の分岐。
2. `failure_learning`: 失敗・未達・手戻りから得た、次回PJで回避可能な学習。
3. `cross_project_pattern`: 複数PJや AMD Protocol から見える横断傾向。
4. `reusable_question`: 次回PJで使える問い・チェックリスト。
5. `relationship_playbook`: PI / 候補CEO / VC / 企業 / 大学との関係構築プレイブック。
6. `field_transition`: 研究現場から事業化・会社化へ移る局面の実務。
7. `theory_case`: BZM / AMD Score / ERS / Protocol の理論に関わるケース。

従来互換の `insight_type` は次の4分類を使う:

- `before_zero_knowhow`
- `cross_project_pattern`
- `case_study`
- `theory_evidence`

`priority` は 1 が最重要、4 が保留。迷ったら重要度を下げ、本文に未確認点を残す。

## 入力収集

Supabase snapshot で最低限見るテーブル:

- `monthly_reports`
- `project_meeting_summaries`
- `project_strategy_signals`
- `protocols`
- `protocol_examples`
- `protocol_result_observations`
- `project_knowledge`
- `member_knowledge`
- `project_registry_diffs`
- `project_xrl_evidence`
- `amd_score_inputs`
- `project_ventures`
- `projects`
- `source_cache` (補助証跡のみ)

候補の判断軸:

- Before Zero のGO/NO-GO、設立タイミング、TRL/BRL/GRL/SRL/HRL/FRL の律速判断に関係するか。
- AMD Protocol の「分岐点 / 判断材料 / アクション / 結果」に展開できるか。
- 単なる事実ではなく、教科書の読者が再利用できる知見になっているか。
- 既存 BZM 章の数式・rubric・定義を勝手に変えず、補足・ケース・運用知見として追記できるか。

根拠条件:

- evidence は table / row id / date / title / 200字以内 snippet / hash / confidentiality 程度に留める。
- raw メール全文・議事録全文・Slack全文は保存しない。
- `source_cache` だけを根拠にしない。具体的な L2 row または OS 構造データと結びつける。
- `confidentiality='publishable'` は外部公開可能な根拠がある場合だけ。迷ったら `sanitized` または `internal_only`。

Good:

- 「TRL未達だが政策・顧客追い風が強い時、設立ではなく実証設計を優先した」という判断分岐を、根拠 row と短い snippet で残す。
- 複数PJで同じ関係者詰まりが出たため、候補CEO/PI との合意形成質問として抽象化する。

Bad:

- 「SXでMTGした」のような単純事実だけを Textbook Insight にする。
- 社名・個人名・未公開契約条件を `publishable` として本文へ入れる。
- BZM の式や重みを、review なしで本文中に「変更すべき」と断定する。

## 出力 JSON

`/Users/masa/.codex/automations/amd-os-ms/outbox/<YYYYMMDD-HHmmss>-textbook-insights.json`

```json
{
  "generatedAt": "ISO8601",
  "source": "codex-automation-l10-textbook-insight",
  "textbookInsights": [
    {
      "target_id": "p00",
      "ym": null,
      "scope_key": "textbook:<source_hash 12 chars>",
      "topic": "Before Zero GO判断",
      "title": "TRLゲート未達時はマクロ追い風だけで設立を急がない",
      "proposed_section": "実務ケース",
      "target_bzm_slug": "8-1-amd-os-operations",
      "insight_type": "before_zero_knowhow",
      "priority": 1,
      "metadata_json": {
        "practice_kind": "decision_branch"
      },
      "confidentiality": "sanitized",
      "bzm_review_required": false,
      "bzm_review_status": "not_required",
      "theory_change_scope": "none",
      "body_md": "教科書へ追記する候補本文。事実と推測を分ける。",
      "evidence_refs": [
        {
          "table": "project_strategy_signals",
          "row_id": "uuid",
          "date": "2026-05-31",
          "title": "根拠行タイトル",
          "snippet": "200字以内の短い根拠",
          "hash": "sha256...",
          "confidentiality": "sanitized"
        }
      ],
      "source_tables": ["project_strategy_signals", "project_xrl_evidence"],
      "source_hash": "sha256..."
    }
  ],
  "notes": []
}
```

`metadata_json.practice_kind` の値:

- `decision_branch`
- `failure_learning`
- `cross_project_pattern`
- `theory_case`
- `reusable_question`
- `relationship_playbook`
- `field_transition`

`theory_edge_case` / `theory_update_candidate` は独立 `practice_kind` にしない。必ず:

```json
{
  "metadata_json": {
    "practice_kind": "theory_case",
    "theory_case_kind": "edge_case"
  },
  "bzm_review_required": true,
  "bzm_review_status": "pending",
  "theory_change_scope": "axis_definition"
}
```

`theory_case_kind` は `edge_case` / `update_candidate`。unknown `practice_kind` は helper が勝手に丸めず、`metadata_json.validation_warnings` に残す。

## 追記先 slug の選び方

- `decision_branch`: `8-2-field-decisions-and-branches`
- `failure_learning`: `8-3-failures-pivots-and-revisions`
- `relationship_playbook`: `8-4-relationship-playbook`
- `reusable_question`: `8-5-before-zero-checkpoints`
- `field_transition`: `8-5-before-zero-checkpoints`
- `cross_project_pattern`: default は `8-1-amd-os-operations`。明確な retrofit / case validation の形で第6部に置くべき場合だけ、抽出側が `target_bzm_slug='6-1-retrofit-verification'` を明示する。
- `theory_case`: default は `6-1-retrofit-verification`。BZM / AMD Score / ERS / Protocol の式・rubric・定義は変更せず、BZM review 承認前提のケースとして候補に残す。

既存の理論章へ明確に置ける候補は `target_bzm_slug` を明示してよい。

- XRL / readiness の裏付け: `3-1-xrl-group`
- FRL の裏付け: `4-1-frl-founder-readiness`
- AMD Score / 律速判断: `5-1-amd-score-integration`
- ERS: `7-1-ers-ecosystem-readiness`

新章を勝手に作らない。既存章に入れにくい場合、または新章が main にまだ無い場合は `target_bzm_slug='8-1-amd-os-operations'`、`proposed_section='未分類の実務知見'` として候補化し、`metadata_json.validation_warnings` に routing fallback を残す。unknown `practice_kind` は helper が勝手に丸めず、fallback slug と warning のまま候補DBへ残す。

## BZM review / confidentiality gate

local applier は次を満たさない候補を skip する。

- `confidentiality` が `sanitized` または `publishable`
- `bzm_review_required=true` の場合、`bzm_review_status='approved'`
- `theory_change_scope!='none'` の場合、`bzm_review_status='approved'`

`confidentiality`:

- `internal_only`: 候補DB・通知・review には使えるが、BZM file には追記しない。
- `sanitized`: 個人名・未公開社名・契約条件等をぼかした本文。通常の追記候補。
- `publishable`: 社外公開可能と判断できる本文。強い根拠がある場合だけ。

`theory_change_scope`:

- `none`
- `terminology`
- `axis_definition`
- `rubric`
- `formula`
- `weight`
- `chapter_structure`

## 実行後 summary

- 対象 project_id / ym / table 件数
- insight_type 別件数
- priority=1 の候補タイトル
- outbox path
- no-data / skipped の理由
- 未確認点

## 禁止

- raw メール全文・議事録全文・Slack全文を `body_md` や `evidence_refs` に保存しない。
- 承認前に `pwa/bzm/*.md` へ追記しない。
- PWA / GAS / Vercel から従量課金 LLM cron を追加しない。
- 既存 BZM の数式・rubric・定義を、候補抽出のついでに変更しない。
- 単なる PJ 事実を教科書知見として水増ししない。単純事実は `project_knowledge` に寄せる。
- 本番DBに migration を適用しない。L10 metadata migration の prod apply は OS司令塔レビュー後。
