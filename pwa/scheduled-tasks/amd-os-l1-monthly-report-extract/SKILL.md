---
name: amd-os-l1-monthly-report-extract
description: AMD OS L2 ① monthly_reports 抽出 automation。active / sales PJ の当月・前月を対象に、Gmail / Drive / Calendar / Slack / Notion の 5 生データから月次報告 draft を subscription 内 Codex automation で作成し、/Users/masa/.codex/automations/amd-os-ms/outbox の monthlyReports JSON 経由で Supabase に反映する。R313 / PWA report route / Anthropic API など従量課金LLM経路は定期実行に使わない。
---

# AMD OS L2 ① monthly_reports 抽出

## 目的

L2 ① `monthly_reports` は、MS 進捗、PJ ナレッジ、XRL 根拠、月次FIXの前提になる一次 L2。  
5 生データから、PJ ごとの月次断面を「OS が使える形」にする。

この automation は **定額 subscription 内で動く Codex automation** が writer。DB 反映は既存の非LLM helper が行う。

## 絶対ルール

- Gmail / Drive / Calendar / Slack / Notion の **5 生データ全部**を確認する。
- `source_cache` だけを見て「データなし」と決めない。source_cache は証跡キャッシュであって、生データの全量ではない。
- R313 / `api_generateMonthlyReport` / PWA `/api/report/generate` / PWA `/api/cron/monthly-reports-backfill` を定期実行しない。
- Anthropic / OpenAI / Gemini の従量課金 API を直接呼ばない。LLM 生成はこの Codex automation 自身の model だけで行う。
- 既存 `final_content` がある `monthly_reports` は `force: true` が明示されない限り上書きしない。
- メール全文・議事録全文・Slack全文を row に保存しない。保存するのは draft、短い source refs / snippet / hash、collection summary。
- 未完成でも、確認済み事実があるなら no-data テンプレのまま放置しない。小さくても使える月次断面を積む。

## 必ず読む正本

1. `pwa/manual/3-2-data-and-extraction.md`
2. `pwa/manual/8-3-l2-extraction-routines-spec.md`
3. `pwa/design/L2_DATA.md`
4. `pwa/design/db_schema.md`
5. `pwa/design/ms_progress.md`
6. `pwa/design/progress_estimation.md`
7. `pwa/scripts/ms_progress_review_tool.mjs` の `upsertMonthlyReports`

## 対象

- `projects.status in ('active', 'sales')` を基本対象にする。
- 対象月は JST の当月と前月。
- `projects.start_ym` より前でも、提案・契約前調整・キックオフなど PJ 形成に意味がある 5 生データがある月は `monthly_reports` 作成対象にする。
- 優先順:
  1. `monthly_reports` が存在しない project_id + ym
  2. no-data / placeholder / 100文字未満など、後続L2の入力として弱い draft
  3. `generated_at` が古く、5 生データ側に新しい evidence がある draft
  4. `collection_summary_json.source_counts` が薄い draft

## 入力収集

各 project_id + ym について、次を確認する。

- Gmail: report_emails / 関係先ドメイン / PJ 名 / PJ コード / 既知固有語で検索
- Drive: PJ folder、月次・議事録・提案・契約・実験・試算表・発表資料
- Calendar: 対象月の MTG event、attendees、description、Notion/Drive URL
- Slack: PJ channel、関連 thread、資料共有、進捗報告
- Notion: 議事録 DB、PJ page、設計 docs、会議ページ
- OS snapshot: `source_cache`、`project_meeting_summaries`、`member_activities`、`member_ms_activities`、既存 `monthly_reports`、`value_milestones`

5 生データ connector が使えない場合は、その connector 名と理由を `collection_summary_json.missing_connectors` と notes に残す。使えない connector があるだけで「データなし」とは書かない。

## draft_content 方針

月次報告は、読み手が「その月に何が進んだか」「次に何を判断するか」を理解できる粒度で書く。

推奨構成:

```markdown
## 概要

## 今月進んだこと

## 重要な判断・合意

## 顧客・共同研究・外部関係者の動き

## 技術・知財・実験・資料

## リスク・未確定事項

## 来月の焦点

## 根拠
```

- 根拠セクションには source name / date / title / sender / short snippet 程度だけを載せる。
- 事実と推測を混ぜない。推測は「推定」「未確認」と明示する。
- 何も確認できない場合でも、どの 5 生データをどう探したかを collection summary に残す。

## outbox 形式

保存先:

`/Users/masa/.codex/automations/amd-os-ms/outbox/<YYYYMMDD-HHmmss>-monthly-report-extract.json`

top-level:

```json
{
  "generatedAt": "ISO8601",
  "ym": "YYYYMM",
  "source": "codex-automation-l2-monthly-report",
  "monthlyReports": [],
  "sourceCache": [],
  "notifications": [],
  "notes": []
}
```

`monthlyReports[]`:

```json
{
  "project_id": "p25",
  "ym": "202605",
  "draft_content": "markdown",
  "status": "draft",
  "collection_summary_json": {
    "source": "codex-automation-l2-monthly-report",
    "source_counts": {
      "gmail": 0,
      "drive": 0,
      "calendar": 0,
      "slack": 0,
      "notion": 0,
      "os_snapshot": 0
    },
    "source_refs": [],
    "missing_connectors": [],
    "quality_flags": []
  }
}
```

必要に応じて `sourceCache[]` に短い snippet / refs を入れる。既存 helper は `sourceCache` と `monthlyReports` を同じ outbox から処理できる。

## 通知

次のときは `notifications[]` も作る。

- 5 生データの現物はあるが、PJ 台帳の report_emails / slack_channel / drive_folder が不足していて継続抽出が不安定
- no-data draft を暫定更新したが、人間確認が必要
- connector 不足で重要 source を見られなかった
- final_content があり、自動追記せず追加候補に止めた

通知は「何を判断するか」が分かる題名にする。`raw_data_gap` や `source_cache` など内部語だけで説明しない。

## run summary

最後に次を短く出す。

- 対象 project_id + ym
- 5 生データ別の確認件数
- 作成 / 更新 / skip final / no-data / connector missing
- outbox path
- 次回へ残した対象

## 禁止

- R313 trigger を作成・復活する
- PWA / GAS / Vercel から従量課金 LLM route を定期実行する
- `final_content` を暗黙上書きする
- 5 生データを見ずに既存 monthly_reports だけを要約し直す
- no-data の理由を確認せず「活動なし」と断定する
