---
name: amd-os-l10-textbook-insight-extract
description: AMD OS L2 ⑩ Textbook Insights / Before Zero 知見抽出の repo 正本。Supabase 内の既存 L2 / OS データから BZM 教科書へ追記すべき候補を作り、`textbookInsights` outbox JSON を `/Users/masa/.codex/automations/amd-os-ms/outbox/` に出す。候補は通知承認後、local applier が `pwa/bzm/*.md` へ追記する。PWA/Vercel runtime から git 管理ファイルを直接編集しない。
---

# AMD OS L2 ⑩ Textbook Insights 抽出 automation

## 設計の要点

- 入力は Supabase 内の既存 L2 / OS データを primary にする。
- `source_cache` は証跡補助。source_cache だけで no-data 判定しない。
- 出力は `textbookInsights` outbox。LaunchAgent / helper が `textbook_insight_candidates` と `l2_notifications(l2_kind='textbook_insight')` に反映する。
- まさ/管理者が `/notifications` で「はい」を押すと `status='approved'` になる。
- 実際の `pwa/bzm/*.md` 追記は `node pwa/scripts/apply_approved_textbook_insights.mjs --apply` で local worker が行い、commit/push する。
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

1. `before_zero_knowhow`: Before Zero の PJを進める上でのノウハウ・経営判断・分岐点・失敗回避。
2. `cross_project_pattern`: 複数PJや AMD Protocol から見える横断傾向。
3. `case_study`: 教科書のケーススタディとして有効な PJ 固有情報。
4. `theory_evidence`: BZM / AMD Score / ERS / Protocol の既存理論を裏付ける観測。

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
      "body_md": "教科書へ追記する候補本文。事実と推測を分ける。",
      "evidence_refs": [
        {
          "table": "project_strategy_signals",
          "row_id": "uuid",
          "date": "2026-05-31",
          "title": "根拠行タイトル",
          "snippet": "200字以内の短い根拠",
          "hash": "sha256..."
        }
      ],
      "source_tables": ["project_strategy_signals", "project_xrl_evidence"],
      "source_hash": "sha256..."
    }
  ],
  "notes": []
}
```

## 追記先 slug の選び方

- BZM の運用知見: `8-1-amd-os-operations`
- retrofit / case study: `6-1-retrofit-verification`
- XRL / readiness の裏付け: `3-1-xrl-group`
- FRL の裏付け: `4-1-frl-founder-readiness`
- AMD Score / 律速判断: `5-1-amd-score-integration`
- ERS: `7-1-ers-ecosystem-readiness`

新章を勝手に作らない。既存章に入れにくい場合は `target_bzm_slug='8-1-amd-os-operations'`、`proposed_section='未分類の実務知見'` として候補化し、通知で判断を仰ぐ。

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
