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
- `sourceChecklist` が 0 のままでも connector で現物が取れた場合は、`raw_data_gap` だけで終えず source refs / L2 候補へ寄せる。

## 生成対象ガード (writer 共通)

month report を新規生成する writer (Codex automation / `monthly-reports-backfill` cron) は、以下 3 ガードを必ず通す。生成元データ (`billing_cycles` 等) は請求ライフサイクルで動くため、ガード無しだと「報告書を書く意味がない月」を LLM が捏造する (2026-06-02〜03 事故)。

| # | ガード | 規則 | 理由 |
|---|---|---|---|
| 1 | **no-activity** | 当月の 5 生データ集約 (`source_cache`) が 0 件なら LLM を呼ばず「進捗なし」テンプレを置く。本文は「活動・成果物は検出されていません」と**断定せず**記述し、`collection_summary_json` に `sourceChecklist` / `noActivity:true` を残す | source が薄いだけで実は活動があった可能性 (extraction 不完全) を否定しないため、断定しない。推測本文で投資家向け資料整備等を捏造する事故 (`raw-route-zero` 通知の根本原因) を防ぐ |
| 2 | **未来月** | 当月 (JST) より後の ym は生成しない | `billing_cycles` に請求予定の未来 ym があり、ガード無しだと未来の月報を先回り捏造する |
| 3 | **PJ期間外** | `projects.start_ym` 前は生成しない。`end_ym` 超過は **`projects.status='ended'` のときだけ**除外する | active PJ は `end_ym` が更新されず古いまま残ることがある (例: LST p07 は `end_ym=202507` だが `status='active'` で継続中)。`end_ym` だけで切ると継続中 PJ の実データ月報まで誤除外する |

補足:
- ガード 3 の「開始前は生成しない」は、上の上書きルール「キックオフ等で意味がある月は作成対象にしてよい」と両立する。**自動 backfill は開始前を作らない**が、意味のある開始前コンテキストが既にある row は残す / 手動で作ってよい (例: KUTE p25 / 202604 のキックオフ月)。
- これらは新規生成時のガード。**既存 row は対象外** (backfill は missing = DB に無い月だけを作る) なので、過去に生成済みの捏造 draft は cron では直らない。誤判定リスクを避け、個別にまさ判断で cleanup する。
- 実装: `pwa/src/app/api/cron/monthly-reports-backfill/route.ts` の missing 抽出フィルタ (`inProjectRange` / `currentYm`) と `generateOne` の `sourceItemCount===0` 分岐。

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
