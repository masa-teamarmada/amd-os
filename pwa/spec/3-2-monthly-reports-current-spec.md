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

## 生成対象ガード (writer 共通) — 正本原則 (2026-06-03 まさ確定)

**月次サマリを生成するかは「PJ状態」ではなく「その月に実進捗があるか」で決める。** 生成元 (`billing_cycles`) は請求ライフサイクルで動き状態と一致しないため、状態だけで切ると誤生成・誤除外が起きる (2026-06-02〜03 事故)。

| 当月の実進捗 | PJ状態 | 月次サマリ |
|---|---|---|
| **あり** (5生データ / MTGサマリ / メンバー活動のどれかに痕跡) | active / ended / frozen いずれも | **生成する** (中身に実進捗を書く。ended でも清算・株主総会等の進捗は残す) |
| **なし** | active | **生成する** =「進捗なし」テンプレ |
| **なし** | ended / frozen | **生成しない** (捏造の温床) |

実進捗判定 (`hasActivity`) は 3 経路で見る: `source_cache` (5生データ集約) / `project_meeting_summaries` (L2⑥) / `member_activities`。`source_cache` 単独で no-data 判定しない (extraction 不完全で薄いだけのことがある)。

frozen 判定は `projects.status='frozen'` **または** (`projects.freeze_from_ym` があって当月 ym ≥ `freeze_from_ym`) の両方を見る (例: CTB p06 は `status='active'` だが `freeze_from_ym=202605`)。

加えて2つの境界ガード:

| ガード | 規則 | 理由 |
|---|---|---|
| **未来月** | 当月 (JST) より後の ym は生成しない | `billing_cycles` に請求予定の未来 ym があり、無いと未来月を先回り捏造する |
| **開始前** | `projects.start_ym` 前は自動 backfill しない | キックオフ等で意味がある開始前月は手動で作る / 既存 row は残す (例: KUTE p25 / 202604) |

補足:
- **`end_ym` で機械的に切らない**。active PJ は `end_ym` が更新されず古いまま残ることがある (例: LST p07 は `end_ym=202507` だが `status='active'` で継続中・実進捗あり)。`end_ym` 超過でも active なら進捗ありは生成、進捗なしは「進捗なし」テンプレ。
- 進捗なしテンプレの本文は「活動・成果物は検出されていません」と**断定せず**記述し、`collection_summary_json` に `sourceChecklist` / `mtgCount` / `memberActivityCount` / `noActivity:true` を残す。
- これは新規生成 (missing = DB に無い月) のガード。既存 row は対象外なので、過去の捏造 draft は個別にまさ判断で cleanup する。
- この原則は L2① 月報だけでなく **L2⑥ MTGサマリ生成にも適用する** (ended/frozen で進捗ゼロなら MTGサマリも作らない)。
- 実装: `pwa/src/app/api/cron/monthly-reports-backfill/route.ts` の missing 抽出フィルタ (`currentYm` / `start_ym` / `projMeta`) と `generateOne` の `hasActivity` 判定 + frozen/ended スキップ分岐。

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
