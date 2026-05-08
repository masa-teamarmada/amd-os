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
| ③ **MS進捗** | マイルストーン進捗% | `milestone_monthly_progress` | `cron/daily-estimate` (PWA, 03:00 daily) | PWA `app/api/cron/daily-estimate` | ✅ 稼働 (158 行) |
| ④ **PJナレッジ** | PJ にまつわる事実・人物・組織・進行中事項 | `project_knowledge` | **書き込み元不明 (2024 行ある)**。今後は AMD-Report GAS の新機能として実装予定 | (TBD: AMD-Report GAS) | ⚠️ データはあるが流入元不明 |
| ⑤ **メンバーナレッジ** | メンバーごとの強み・スキル・関心 | `member_knowledge` | (本来 cron で蓄積すべき) | (TBD) | ❌ **未稼働 (0 行)** |
| ⑥ **MTGサマリ** | calendar event 1 回ごとの decided/progress/nextActions/risks (PK = calendar event id) | `project_meeting_summaries` | `nav_cronMonthlyExtractAt3` (本体GAS, 03:00 daily) | 本体GAS `152_NavigatorCron.js` + `074_MeetingSummaryRepo.js` | ✅ **Phase 2 稼働** (Notion 本文 + Gmail reportEmails ±1日 結合)。議事録なし MTG はマーカー行 (summary_short="議事録なし") で残す ([meeting_summaries.md](meeting_summaries.md))。reportEmails 整備は Phase 2.1 で対応予定 |

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
| **03:00** | `nav_cronMonthlyExtractAt3` | MTGサマリ抽出 (L2 ⑥) + 既存 navigator monthly extract | 本体GAS |
| **03:00** | `cron/daily-estimate` | MS進捗推定 (L2 ③) | PWA |
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
- ③ MS進捗推定 → [`progress_estimation.md`](progress_estimation.md)
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
