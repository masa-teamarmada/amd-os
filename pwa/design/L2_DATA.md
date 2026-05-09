# L2 データ ＋ レポート — AMD OS の中核データ正本 ⭐⭐⭐

**最重要**: AMD OS の中核データ。すべての Claude / Codex / GPT セッションは作業前にここを読む。

---

## L1 / L2 の定義 (まさの正本)

```
[ 5 つの社内生データ ]                        [ L1 ]                       [ L2 ]
Gmail / Drive / Calendar / Slack / Notion  →  汎用ピックアップ  →  欲しい情報の形に抽出した正本
```

- **L1** = 5 生データから「あとで使えそうな素材」をピックアップしただけのもの (例: 過去の `source_cache`、現在は廃止)
- **L2** = 5 生データから直接「**欲しい情報の形**」で抽出した、AMD OS が中核に持つべきデータ

L1 を経由する構成は廃止された ([progress_estimation.md](progress_estimation.md) の「データフローの現状」参照)。
**現在は 5 生データ → L2 直接抽出**が正本フロー。

---

## L2 データ 6 種 (正本リスト)

| L2 | 意味 | テーブル | cron / 書き込み元 | 場所 | 状態 |
|---|---|---|---|---|---|
| ① **monthly report** | PJ 月次レポート本文 | `monthly_reports` | `R313_MonthlyReport_Cron` (05:00 daily) | AMD-Report GAS (別 clasp) | ✅ 稼働 (58 行) |
| ② **AMDプロトコル** ⭐ | 経営判断の構造化記録 (分岐点 / 判断材料 / アクション / 結果・学習)。**AMD の最重要知財** ([amd_os_vision.md](../../../knowledge/amd_os_vision.md)) | `protocols` | (本来 cron で蓄積すべき) 現在は `/admin/protocols` 画面の手動 insert のみ | PWA `AdminProtocolsClient.tsx` | ❌ **未稼働 (0 行)**。スプシ復活 + UI 復活が必要 (TODO) |
| ③ **MS進捗** | マイルストーン進捗% | `milestone_monthly_progress` | **Phase 4** = 本体GAS 毎時 trigger (`nav_pwa_pingHourlyEstimate` / 154) → PWA `cron/hourly-estimate` を curl → `progress_estimate_state.source_hash` 差分検知 | PWA `app/api/cron/hourly-estimate` + `lib/progress-estimator.ts` + 本体GAS `154_PwaCronCaller.js` | ✅ **Phase 4 稼働 (毎時 polling、Hobby 制約により GAS 経由)**。詳細 [ms_progress.md](ms_progress.md) |
| ④ **PJナレッジ** | PJ にまつわる事実・人物・組織・進行中事項 | `project_knowledge` | **書き込み元不明 (2024 行ある)**。今後は AMD-Report GAS の新機能として実装予定 | (TBD: AMD-Report GAS) | ⚠️ データはあるが流入元不明 |
| ⑤ **メンバーナレッジ** | メンバーごとの強み・スキル・関心 | `member_knowledge` | (本来 cron で蓄積すべき) | (TBD) | ❌ **未稼働 (0 行)** |
| ⑥ **MTGサマリ** | calendar event 1 回ごとの decided/progress/nextActions/risks (PK = calendar event id) | **Phase 3** = 毎時 0 分 polling cron (本体GAS `153_MeetingHourlyTrigger.js` `nav_meeting_pollRecentlyEndedEvents`、過去 60-180 分に終わった events をスキャン) + **Phase 2 fallback** = `nav_cronMonthlyExtractAt3` (本体GAS, 03:00 daily) | 本体GAS `152_NavigatorCron.js` + `153_MeetingHourlyTrigger.js` + `074_MeetingSummaryRepo.js` | ✅ **Phase 3 稼働** (Notion + Gmail 結合)。拾えれば iOS APNs 通知用 `meeting_notifications` テーブル (PK=meeting_id) に upsert (Swift 側受信は別セッション、[ios/HANDOFF_meeting_notifications.md](../../ios/HANDOFF_meeting_notifications.md))。議事録なしマーカー / 抽出空 区別表示。詳細 [meeting_summaries.md](meeting_summaries.md) |

**重要**: 5 生データから抽出した結果 = L2 だけ。Atlas / VC ニュース / マクロ index は外部ソース由来なので **L2 ではなく「レポート関連」**カテゴリ。

---

## レポート関連 (L2 とは別。外部ソース or 派生)

| レポート | テーブル | cron | 場所 |
|---|---|---|---|
| **Atlas 日次** | `atlas_stories` 等 | `cron/atlas-daily` (06:00 daily) | PWA |
| **Atlas 週次** | 同上 | `cron/atlas-weekly` (fri 17:00) | PWA |
| **Atlas 月次** | 同上 | `cron/atlas-monthly` (毎月 1 日 07:00) | PWA |
| **Atlas マクロ収集** | `atlas_signals`, `macro_index_log` | `cron/atlas-collect` (08:00 daily) | PWA |
| **Atlas 政策シグナル** | `atlas_policy_signals` | `cron/atlas-collect-policy` (07:00 daily) | PWA |
| **Atlas divergence** | テーマ単位 | `cron/atlas-divergence` (sun 06:00) | PWA |
| **macro lane weights 再学習** | macro index 関連 | `cron/relearn-lane-weights` (03:30 daily) | PWA |
| **macro バックフィル** | `macro_index_log` (過去) | `cron/macro-backfill-historical` (sun 12:00) | PWA |
| **VC ニュース** | `vc_news` | `cron/vc-news-ingest` (09:00 daily) | PWA |
| **AMD Score L2 リフレッシュ** | `amd_score_inputs` | `cron/amd-score-l2-refresh` (mon 03:00) | PWA |
| **PJ 沿革リフレッシュ** | `project_ventures.narrative_text` | `cron/venture-narrative-refresh` (03:45 daily) | PWA |
| **PJ XRL リフレッシュ** | `project_xrl_log` (llm_proposal) | `cron/venture-xrl-refresh` (03:15 daily) | PWA |
| **メンバー活動推論** | `member_activities` | `cron/member-activities` (04:00 daily) | PWA |

---

## cron 一覧 (時系列)

JST タイムライン (毎日 / 週次 / 月次 / 不定):

| 時刻 | cron | 目的 | 場所 |
|---|---|---|---|
| **毎時 0 分** | `nav_meeting_pollRecentlyEndedEvents` | **MTGサマリ Phase 3 毎時 polling** (過去 60-180 分終了 events を 1 event 抽出 + iOS 通知 upsert) | 本体GAS (153_MeetingHourlyTrigger.js) |
| **03:00** | `nav_cronMonthlyExtractAt3` | MTGサマリ Phase 2 月単位 fallback (L2 ⑥) + 既存 navigator monthly extract | 本体GAS |
| **毎時 0 分** | `nav_pwa_pingHourlyEstimate` → `cron/hourly-estimate` | MS進捗推定 (L2 ③, **Phase 4**, GAS trigger → PWA route) | 本体GAS (154) + PWA |
| **03:15** | `cron/venture-xrl-refresh` | PJ XRL llm_proposal | PWA |
| **03:30** | `cron/relearn-lane-weights` | macro lane weights 再学習 | PWA |
| **03:45** | `cron/venture-narrative-refresh` | PJ 沿革再生成 | PWA |
| **04:00** | `cron/member-activities` | member_activities 推論 | PWA |
| **05:00** | `R313_MonthlyReport_Cron` | monthly_reports 生成 (L2 ①) | AMD-Report GAS |
| **05:30** | `313_MsProgressSummary_Cron` | DB_BillingCycle.msProgressSummaryJson 更新 | 本体GAS |
| **06:00** | `cron/atlas-daily` | atlas 日次レポート | PWA |
| **07:00** | `cron/atlas-collect-policy` | 政府方針シグナル | PWA |
| **08:00** | `cron/atlas-collect` | マクロニュース | PWA |
| **09:00** | `cron/vc-news-ingest` | VC ニュース | PWA |
| **mon 03:00** | `cron/amd-score-l2-refresh` | AMD Score L2 リフレッシュ | PWA |
| **fri 17:00** | `cron/atlas-weekly` | atlas 週次 | PWA |
| **sun 06:00** | `cron/atlas-divergence` | テーマ divergence 再生成 | PWA |
| **sun 12:00** | `cron/macro-backfill-historical` | macro index バックフィル | PWA |
| **月初 07:00** | `cron/atlas-monthly` | atlas 月次 | PWA |

---

## 🚨 次セッションで実装: L2 全データ毎時 polling 化 (Phase 4)

⭐ **2026-05-09 まさ方針確定**: 「全部の L2 データ取得を 60 分ごとに」

Phase 3 (MTGサマリ) で確立した「毎時 polling + source_hash 差分検知」パターンを **L2 6 種すべて** に横展開する。

**メリット (まさの想定)**:
- リアルタイム性: 「いますっごい貴重なやり取りしてるけど、L2 として抽出されるかな」→ 1 時間以内に確認できる (= 「明日確認しよう→忘れた」問題解消)
- 軽量化: 1 回の cron が小さくなる (1 PJ × 1 ms / 1 メンバー単位の処理)
- タイムアウト減: GAS 6 分 / Vercel Hobby 5 分の制限を回避しやすい
- 差分検知前提: 何度走らせても同じ source_hash ならスキップ、無駄ゼロ

**改修優先順位** (推奨):

| L2 | 現状 | 改修内容 | 優先度 |
|---|---|---|---|
| ③ MS進捗 | ✅ **Phase 4 完了 2026-05-09** | `cron/hourly-estimate` 毎時 + `progress_estimate_state.source_hash` 差分検知 + maxItems 14 打ち切り。詳細 [ms_progress.md](ms_progress.md) | (済) |
| ⑤ メンバーナレッジ | ❌ 未稼働 | 新規 cron + 抽出ロジック (5 生データ → Sonnet → member_knowledge upsert)。最初から毎時 polling で実装 | ⭐⭐⭐ 2 |
| ④ PJナレッジ | ⚠️ 流入元不明 (2024 行はある) | 流入元を新規実装 (5 生データ → Sonnet → project_knowledge upsert)、毎時 polling | ⭐⭐⭐ 2 |
| ② AMDプロトコル | ❌ 未稼働 (UI も削除済) | UI 復活 + 自動抽出 cron 設計 (毎時 polling)。スプシ復活も並行 | ⭐⭐ 3 |
| ⑥ MTGサマリ | ✅ Phase 3 で毎時化済 | (済) | - |
| ① monthly_report | R313 05:00 daily (AMD-Report GAS) | 集計性が強いので毎時化の意味は薄い。代わりに Phase 2.5 (会議サマリ集約方式に書き換え) で実質リアルタイム化 | ⭐ 後 |

**設計パターン (Phase 3 から流用)**:
- 毎時 0 分の time-based trigger 1 個 (GAS or Vercel cron)
- 過去 60-180 分に「変更があった対象」だけスキャン (ソース別)
- source_hash で差分検知 → 変わってれば LLM call → upsert
- GAS 6 分 / Vercel 5 分制限を超えそうなら maxItems で打ち切り、次回 cron で残りを処理

**実装上の注意**:
- Vercel cron の毎時化は Hobby plan で動くか要確認 (= cron 数の上限)
- GAS time-trigger 上限 (1 script 20-100 個) に注意 (本体GAS 既に 17+ 個、cron_invoiceSendNudge_ 4 重複の整理が先)
- Schema 変更が必要なケース (last_processed_at 列追加など) は migration を都度切る
- 各 L2 の「ソース 〜 抽出ロジック 〜 ストレージ」の正本仕様 md を `pwa/design/<L2_name>.md` に必ず残す

詳細実装は次セッションの spawn task に渡す (= L2 全データ毎時 polling 化)。

---

## L2 で「動いてない」もの (TODO)

| L2 | 問題 | 対応予定 |
|---|---|---|
| ② AMDプロトコル | テーブル空、UI も削除されてる (元はトップメニューの atlas 左) | 別タスク: スプシから掘り起こし + UI 復活 |
| ④ PJナレッジ | 書き込み元不明 (2024 行はあるが) | 別タスク: AMD-Report GAS の新 cron として実装 |
| ⑤ メンバーナレッジ | 完全未稼働 | 別タスク: AMD-Report GAS の新 cron として実装 |

---

## 関連 md (詳細仕様への入口)

- ① monthly report の生成詳細 → AMD-Report GAS の R313 系 (このリポにはソース無し、別 clasp)
- ② AMDプロトコルの設計思想 → [`knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) の「AMDプロトコルの 4 要素」
- ③ MS進捗推定 → [`ms_progress.md`](ms_progress.md) ⭐ (Phase 4 正本) / 旧経緯は [`progress_estimation.md`](progress_estimation.md)
- ⑥ MTGサマリ → [`meeting_summaries.md`](meeting_summaries.md)
- 全体的な PWA 仕様 → [`SPEC_pwa.md`](SPEC_pwa.md)

---

## このドキュメントを編集するときのルール

- L2 6 種の定義は**まさの正本**。勝手に増やしたり統合したりしない
- 新規 L2 を追加するときは必ずまさに確認
- cron を追加 / 削除 / 移動したら必ずこの md を更新する
- データ流入が止まった / 復活した変更があれば「状態」列を更新する
- レポート関連と L2 の区別 (「5 生データから直接抽出か」「外部ソース由来か」) を厳守

---

## 改訂履歴

| 日付 | 変更 |
|---|---|
| 2026-05-09 | 初版。MTGサマリ追加で L2 が 5 → 6 になったタイミングで正本化。AMDプロトコル / メンバーナレッジ未稼働を可視化、PJナレッジ流入元不明を可視化 |
| 2026-05-09 | MTGサマリ Phase 2 移行 (Notion 本文 + Gmail 議事録メール 結合、calendar event id を PK に)。状態列を Phase 2 稼働に更新 |
| 2026-05-09 | MTGサマリ Phase 3 移行 (会議終了 +60 分 ad-hoc trigger + iOS APNs 通知用 meeting_notifications)。03:00 daily は scheduling + 拾い漏れ救済 fallback の二役に |
| 2026-05-09 | Phase 3 設計 (毎時 polling + source_hash 差分検知) を **L2 全データに横展開する方針** をまさが確定。次セッションで Phase 4 として一気に実装予定 (③→⑤④→②→①) |
| 2026-05-09 | **Phase 4 ③ MS進捗 完了**: `cron/daily-estimate` (03:00 daily) → `cron/hourly-estimate` (毎時 0 分) にリネーム + `progress_estimate_state` テーブル新設 (migration 029) で source_hash 差分検知 + maxItems 14 打ち切り。仕様正本: [ms_progress.md](ms_progress.md) |
| 2026-05-09 | Vercel Hobby plan の "daily 1 回まで" cron 制約 (deploy 時に reject される) のため、vercel.json から `/api/cron/hourly-estimate` を外して **本体GAS 毎時 trigger (`gas/154_PwaCronCaller.js` `nav_pwa_pingHourlyEstimate`)** から curl で叩く構成に切替。Pro 移行後は vercel.json に戻すだけで切替可能 |
