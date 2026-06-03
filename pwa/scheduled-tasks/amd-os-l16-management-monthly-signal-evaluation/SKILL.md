---
name: amd-os-l16-management-monthly-signal-evaluation
description: AMD OS L2 ⑯ Management Monthly Signal Evaluation の月末17:00 JST抽出automation正本。Management Score、月次試算表、入金確認、支払通知、billing/payout/freee PL、L2⑨⑭⑮を読み、数字再掲ではなく経営状態の評価を company_management_signal_reviews へ保存する reviewable payload を作る。PWA/Vercel background LLM cron は使わない。
---

# AMD OS L2 ⑯ Management Monthly Signal Evaluation

## 目的

毎月末日 17:00 JST に、会社の月末経営状態を L2 データとして保存する。

これは予実表の数字をもう一度並べる処理ではない。まさが一読して「今いい状態なのか、注意なのか、何を判断すべきか」が分かるように、数字と根拠を経営評価へ変換する。

## 必ず読む正本

1. `pwa/design/management_score.md` の L2⑯ section
2. `pwa/spec/3-0-l2-data-list-current-spec.md`
3. `pwa/spec/3-1-l2-data-extraction-current-spec.md`
4. `pwa/manual/8-3-l2-extraction-routines-spec.md`
5. `pwa/design/db_schema.md` の `company_management_signal_reviews`
6. `pwa/src/app/(app)/management-score/page.tsx` の経営シグナル評価UI
7. `pwa/scripts/migrations/124_management_signal_reviews_l2_schema.sql`

## 入力

Primary:

- `amd_management_score_snapshots`
- `amd_management_score_evidence`
- `company_budget_actual_monthly`
- `company_budget_variance_notes`
- `company_management_signal_reviews` の過去ログ

Finance / operations evidence:

- `billing_cycles`
- `billing_log`
- `payout_notices`
- `company_actual_monthly`
- `company_finance_recurring_items`
- `company_finance_receipt_events`

L2 evidence:

- L2⑨ `project_strategy_signals`
- L2⑭ Finance Ops Evidence
- L2⑮ VC News / Funding Signals

`company_budget_variance_notes` は短文差分メモ専用。月末評価全文の正本として使わない。

## 出力先

`company_management_signal_reviews`

必須payload:

```json
{
  "ym": "YYYYMM",
  "version": 1,
  "status_label": "概ね良好 | 注意して進める | 要介入 | 評価候補/中立",
  "status_tone": "good | watch | danger | neutral",
  "status_icon": "good | watch | danger | neutral",
  "headline": "まさが一読で温度感を掴める自然文評価",
  "summary": "追加判断コメント",
  "sections_json": [
    {
      "title": "先3か月の温度感",
      "body": "判断コメント",
      "items": ["判断材料1", "判断材料2"],
      "tone": "good | watch | danger | neutral"
    }
  ],
  "source_refs_json": [
    {
      "table": "company_budget_actual_monthly",
      "row_id": "optional",
      "ym": "YYYYMM",
      "label": "短い根拠名",
      "hash": "optional"
    }
  ],
  "source_confidence": 0.8,
  "payload_json": {
    "evaluation_logic_version": "l2-16-v1",
    "omitted_numbers_policy": "do_not_repeat_budget_table_numbers"
  },
  "generated_at": "ISO8601",
  "reviewed_at": null,
  "codex_thread_id": "optional",
  "automation_id": "amd-os-l16-management-monthly-signal-evaluation"
}
```

標準section:

- `先3か月の温度感`
- `費用の見方`
- `次の営業判断`
- `乖離の読み方`
- `今すぐ見ること`

## 評価ロジック

状態ラベルは、数字そのものではなく「次の経営判断」を中心に決める。

- `概ね良好`: 先3か月の資金の谷が遠く、通常月収支が大きく崩れておらず、入金予定の確度も許容範囲。
- `注意して進める`: 足元は回っているが、通常月収支が薄い、単発入金依存が強い、入金タイミングに不安がある、新規案件の厚みが不足している。
- `要介入`: 今月中に入金前倒し、新規案件上積み、支出調整のどれかを決めたい状態。
- `評価候補/中立`: raw/calc、freee、billing/payout、source refs が不足し、月末評価として未確定。

必ず見る観点:

- 先3か月の最低cashと資金の谷
- 通常月CFと単発入金依存
- 予実差分が発生月ズレか、実際の入出金ズレか
- 未入金、入金済み未反映、未請求、支払通知未反映
- 新規案件や入金前倒しの必要度
- L2⑨/⑭/⑮から見える経営・finance・funding signal

## 文体ルール

Good:

- 「まあ悪くない。ただ、通常月の収支が少し薄いので、もう1本新規案件か入金前倒しがあるとかなり安心。」
- 「足元の数字だけ見ると回っているけど、先の資金の谷が近い。今月中に入金前倒し or 新規案件の上積みを決めたい。」

Bad:

- 「売上はX円、費用はY円、差分はZ円」の羅列。
- スコア軸の数字だけを並べる。
- 「総合的に判断すると」だけで何をすべきか分からないAI文。

数字は必要な場合だけ「約201万円くらい」のように、判断コメントの補足として最小限使う。

## 実行・反映

- cadence: 毎月末日 17:00 JST
- runner: Codex / subscription automation
- PWA/Vercel background LLM cron は使わない
- 生成するのは reviewable payload。DB write は service role / local applier / 管理された apply path に寄せる
- 同月に再生成する場合は `version` を増やし、旧 `is_current=true` を `false`、`superseded_at=now()` 相当にする
- `/management-score` UI は最新評価だけ展開し、古い評価を過去ログとして折りたたむ

## 実行後 summary

- 対象 `ym`
- status_label / status_tone
- headline
- section count
- source_refs count
- source_confidence
- 保存先または outbox path
- 未確認点

## 禁止

- raw メール本文、freee明細全文、Slack全文、議事録全文を保存しない
- 予実表を別形式で再掲しない
- `company_budget_variance_notes` に月末評価全文を保存しない
- PWA/Vercel active cron で LLM を呼ばない
