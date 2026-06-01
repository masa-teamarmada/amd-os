# L2① Monthly Reports 仕様

> **この章は何か**: `monthly_reports` の writer、上書き禁止、source refs、outbox 反映、旧 R313 / PWA route の扱いを固定する章。運用者向けの説明は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも残す。

## 正本テーブル

| table | 用途 |
|---|---|
| `monthly_reports` | PJ × ym の月次レポート本文。`draft_content` と `final_content` を持つ |
| `source_cache` | Gmail / Slack などの source refs / short snippet / hash 証跡。no-data 判定の正本ではない |

`monthly_reports` は後続 L2 の一次入力になるため、完全版を待たず、確認済み事実だけでも draft を積む。

## 現行 writer

| 項目 | 値 |
|---|---|
| primary writer | Codex automation `AMD OS L2① 月次報告抽出` |
| schedule | daily 05:30 JST |
| input | Gmail / Drive / Calendar / Slack / Notion 5 生データ + OS snapshot |
| output | `~/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` |
| applier | LaunchAgent + `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` |

## 上書きルール

- 既存 `final_content` がある row は、`force:true` が明示されない限り上書きしない。
- no-data テンプレや未作成 row は、確認済み source refs があれば `draft_content` を暫定更新してよい。
- `projects.start_ym` より前でも、キックオフ / 提案 / 契約前調整など PJ 形成に意味がある月は作成対象にしてよい。
- `projects.status='ended'` かつ `projects.end_ym` より後の `monthly_reports.status='draft'` row は、future-like draft / テンプレート由来の可能性があるため、終了済PJの継続支援 current truth には使わない。必要なら source refs を追加確認し、確定活動がない限り補助資料扱いに留める。
- `sourceChecklist` が 0 のままでも connector で現物が取れた場合は、`raw_data_gap` だけで終えず source refs / L2 候補へ寄せる。

## 禁止経路

| 経路 | 扱い |
|---|---|
| AMD-Report GAS R313 | 旧経路。定期 trigger を置かない |
| `api_generateMonthlyReport` | L2① automation の定期経路として使わない |
| PWA `/api/report/generate` | 手動復旧用。定期 writer にしない |
| PWA `/api/cron/monthly-reports-backfill` | 重い手動 backfill route。定期 writer にしない |
| paid external LLM API direct call | automation 外で新規に使わない |

## 5 生データ確認

月次レポート抽出では、`source_cache` だけで「データなし」と判定しない。Gmail / Drive / Calendar / Slack / Notion の 5 connector を全部確認する。

| source | 見るもの |
|---|---|
| Gmail | 外部連絡、議事録メール、添付、請求/契約前後の文脈 |
| Drive | 提案資料、議事録 docs、試算表、PDF / Office file |
| Calendar | MTG event、attendees、description、色→PJ判定 |
| Slack | channel / thread / file / 長文報告 |
| Notion | 議事録 DB、PJ DB、page 本文 |

## 出力検証

- `monthlyReports` 配列が空のときは、5 生データを確認した範囲と no-data 理由を残す。
- `final_content` 既存行への変更がないことを確認する。
- outbox file は `applied/` / `failed/` のどちらへ移ったか確認する。
- helper failure は `AggregateError` / `EPERM` / `transient_network` など failure type を分けて記録する。
