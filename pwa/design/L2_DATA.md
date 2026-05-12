# L2 データ ＋ レポート — AMD OS の中核データ正本 ⭐⭐⭐

**最重要**: AMD OS の中核データ。すべての Claude / Codex / GPT セッションは作業前にここを読む。

---

## 🚨 社内生データは **5 種類** (絶対忘れない)

```
┌─────────────────────────────────────────────────────────────┐
│  生データ 5 種類 (= 全部から L2 を抽出する)                          │
├─────────────────────────────────────────────────────────────┤
│  1. Gmail       (= メール、添付ファイル)                          │
│  2. Drive       (= Docs / Slides / Sheets / xlsx / 議事録ファイル) │
│  3. Calendar    (= イベント本文、attendees、Notion AI ページ紐付け) │
│  4. Slack       (= channel メッセージ / threads / files)        │
│  5. Notion      (= 議事録 DB、PJ DB、各種 page 本文)             │
└─────────────────────────────────────────────────────────────┘
```

**🚨 えいみへの絶対ルール (= 2026-05-11 まさ 2 度繰り返し指摘)**:
- backfill / 抽出 cron を実装 / 改修するとき、**必ず 5 種類全部** に対して対応漏れ無いか自己確認する
- ハンドオフに「Drive/Calendar backfill」とだけ書いて **Gmail** を忘れる、のような事故をしない
- 「対応した生データ」のチェックリストを HANDOFF に明示する

### 生データ別 backfill / 抽出 cron の現状

| 生データ | 既存 cron / 関数 | 状態 | 次セッション課題 |
|---|---|---|---|
| **Gmail** | 074 (Notion + Gmail 結合の議事録メール抽出) / R307 (月次レポート用) / **074e (新規)** | ✅ skeleton 動作確認済 (= 3 PJ × 1 ym で 3 件 saved) | subject フィルタ拡張 + bot 判定強化 |
| **Drive** | 074 (Notion AI 議事録ページの fallback) / **074c (新規)** | 🟡 skeleton 稼働、folder 直下 only scan (= サブフォルダ未対応) | 再帰 scan + 試算表 Excel 抽出 cron 別途 |
| **Calendar** | 074 (event 紐付け) / 153 (event 終了 polling) / **074d (新規)** | 🟡 skeleton 稼働、ただし description 薄い event は chitchat 判定で saved=0 | chitchat 判定緩和 + Notion AI 議事録 page との連結 |
| **Slack** | 074b (threads → meeting summary) | ✅ form-encoded 解決、backfill 動作中 (= 3 ヶ月 13 件 saved) | monthsBack=6 で残り月分 backfill |
| **Notion** | 074 (議事録 DB / AI ページ) | ✅ Phase 4 cron 稼働 | alias resolver 強化 (= `_meeting_resolveProjectIdFromPage_`) |

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
| ② **AMDプロトコル** ⭐ | 経営判断の構造化記録 (分岐点 / 判断材料 / アクション / 結果・学習)。**AMD の最重要知財** ([amd_os_vision.md](../../../knowledge/amd_os_vision.md)) | `protocols` | **Phase 4** = 本体GAS 毎時 trigger (`nav_protocol_pollAll` / 155) → `project_meeting_summaries` 二次集約 → Gemini → `protocols` (status='candidate') upsert | 本体GAS `155_L2KnowledgeExtractor.js` + PWA `AdminProtocolsClient.tsx` (UI 既存) | ✅ **Phase 4 稼働 (毎時 polling、二次集約)**。詳細 [amd_protocol.md](amd_protocol.md) |
| ③ **MS進捗** | マイルストーン進捗% | `milestone_monthly_progress` | **Phase 4** = 本体GAS 毎時 trigger (`nav_pwa_pingHourlyEstimate` / 154) → PWA `cron/hourly-estimate` を curl → `progress_estimate_state.source_hash` 差分検知 | PWA `app/api/cron/hourly-estimate` + `lib/progress-estimator.ts` + 本体GAS `154_PwaCronCaller.js` | ✅ **Phase 4 稼働 (毎時 polling、Hobby 制約により GAS 経由)**。詳細 [ms_progress.md](ms_progress.md) |
| ④ **PJナレッジ** | PJ にまつわる事実・人物・組織・進行中事項 | `project_knowledge` | **Phase 4** = 本体GAS 毎時 trigger (`nav_project_knowledge_pollAll` / 155) → `monthly_reports` + `project_meeting_summaries` 二次集約 → Gemini → SELECT/INSERT/PATCH (既存 2024 行を破壊しない) | 本体GAS `155_L2KnowledgeExtractor.js` | ✅ **Phase 4 稼働 (毎時 polling、二次集約)**。詳細 [project_knowledge.md](project_knowledge.md) |
| ⑤ **メンバーナレッジ** | メンバーごとの強み・スキル・関心 | `member_knowledge` | **Phase 4** = 本体GAS 毎時 trigger (`nav_member_knowledge_pollAll` / 155) → `member_activities` + `project_meeting_summaries` 二次集約 → Gemini → 7 category upsert | 本体GAS `155_L2KnowledgeExtractor.js` | ✅ **Phase 4 稼働 (毎時 polling、二次集約)**。詳細 [member_knowledge.md](member_knowledge.md) |
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
| **ASPI lane 推定** (Phase 2-B) | `lane_suggestions` | `cron/lane-suggest` (mon 04:00 JST、GAS 154 から curl) | PWA |
| **研究費 I_R 観測** (Phase 2-C) | `observation_log` key=I_R | `cron/kaken-ingest` (mon 04:00 JST、GAS 154 から curl) | PWA |
| **公募予算 B 観測** (Phase 2-D) | `observation_log` key=B | `cron/grant-ingest` (mon 05:00 JST、GAS 154 から curl) | PWA |
| **VC 投資 V 観測** (Phase 2-E) | `observation_log` key=V | `cron/vc-investment-ingest` (mon 05:00 JST、GAS 154 から curl) | PWA |
| **Triple Helix 隠れ状態推定** (Phase 3) | `triple_helix_state_log` | `cron/triple-helix-recompute` (mon 04:30 JST、GAS 154 から curl 想定) | PWA |

---

## cron 一覧 (時系列)

JST タイムライン (毎日 / 週次 / 月次 / 不定):

| 時刻 | cron | 目的 | 場所 |
|---|---|---|---|
| **毎時 0 分** | `nav_meeting_pollRecentlyEndedEvents` | **MTGサマリ Phase 3 毎時 polling** (過去 60-180 分終了 events を 1 event 抽出 + iOS 通知 upsert) | 本体GAS (153_MeetingHourlyTrigger.js) |
| **03:00** | `nav_cronMonthlyExtractAt3` | MTGサマリ Phase 2 月単位 fallback (L2 ⑥) + 既存 navigator monthly extract | 本体GAS |
| **毎時 0 分** | `nav_pwa_pingHourlyEstimate` → `cron/hourly-estimate` | MS進捗推定 (L2 ③, **Phase 4**, GAS trigger → PWA route) | 本体GAS (154) + PWA |
| **毎時** | `nav_member_knowledge_pollAll` | メンバーナレッジ抽出 (L2 ⑤, **Phase 4**) | 本体GAS (155) |
| **毎時** | `nav_project_knowledge_pollAll` | PJナレッジ抽出 (L2 ④, **Phase 4**) | 本体GAS (155) |
| **毎時** | `nav_protocol_pollAll` | AMDプロトコル抽出 (L2 ②, **Phase 4**) | 本体GAS (155) |
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
| **mon 04:30** | `cron/triple-helix-recompute` | BVAR Kalman smoother で μ_A/I/G 推定 (Phase 3) | PWA |
| **daily 04:00 (未 cron 化、手動キック)** | `cron/sync-pj-facts` | project_ventures → project_knowledge.basic_fact 同期 (founded_at / outcome_pattern / amd_support_*) | PWA |
| **daily 04:30 (未 cron 化、手動キック)** | `cron/freeze-period-backfill` | 休止期間 PJ の reports + meetings を Sonnet 統合 → freeze_period_backfills | PWA |
| **手動キック (GAS curl)** | `nav_meeting_backfillSlackAllActive_` | 全 active PJ × 過去 N ヶ月の Slack スレッド → project_meeting_summaries (source_kinds=slack) | 本体GAS (074b_MeetingSummarySlack.js) |
| **手動キック (GAS curl、2026-05-12 新規)** | `nav_meeting_backfillDriveAllActive_` | 全 active PJ × 過去 N ヶ月の Drive Docs (議事録キーワード) → project_meeting_summaries (source_kinds=drive)。prompt = `llm_prompts.meeting_extract.drive` | 本体GAS (074c_MeetingSummaryDrive.js) |
| **手動キック (GAS curl、2026-05-12 新規)** | `nav_meeting_backfillCalendarAllActive_` | 全 active PJ × 過去 N ヶ月の Calendar event (PJ name 含む title) → project_meeting_summaries (source_kinds=calendar)。prompt = `llm_prompts.meeting_extract.calendar` | 本体GAS (074d_MeetingSummaryCalendar.js) |
| **手動キック (GAS curl、2026-05-12 新規)** | `nav_meeting_backfillGmailAllActive_` | 全 active PJ × 過去 N ヶ月の Gmail 議事録メール (subject 系キーワード) → project_meeting_summaries (source_kinds=gmail)。prompt = `llm_prompts.meeting_extract.gmail` | 本体GAS (074e_MeetingSummaryGmail.js) |
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
| ⑤ メンバーナレッジ | ✅ **Phase 4 完了 2026-05-09** | GAS 155 で毎時 polling + l2_extract_state 差分検知 + 二次集約 (member_activities + meeting_summaries → Gemini → 7 category)。詳細 [member_knowledge.md](member_knowledge.md) | (済) |
| ④ PJナレッジ | ✅ **Phase 4 完了 2026-05-09** | GAS 155 で毎時 polling + 差分検知 + 二次集約 (monthly_reports + meeting_summaries → Gemini → SELECT/INSERT/PATCH、既存 2024 行を破壊しない)。詳細 [project_knowledge.md](project_knowledge.md) | (済) |
| ② AMDプロトコル | ✅ **Phase 4 完了 2026-05-09** | GAS 155 で毎時 polling + 差分検知 + 二次集約 (project_meeting_summaries → Gemini → status='candidate' で upsert、UI で confirmed 昇格運用)。詳細 [amd_protocol.md](amd_protocol.md) | (済) |
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

## L2 候補 (Phase 2 で追加検討中、まさ確認待ち)

| 候補 L2 | 状態 | データ流入 |
|---|---|---|
| ⑦ **創業メンバー** | 🟡 雛形実装済 (2026-05-10、affectionate-easley-9b52b8) | PWA `cron/founding-members-extract` 毎週月曜 03:30 JST。L2 の 5 種 (monthly_reports + project_meeting_summaries + project_knowledge) を入力に LLM (Sonnet 4.5) で **PJ 創業メンバー (AMD 内外含む全員)** を抽出 → `project_founding_members` テーブル + `l2_notifications` (kind='founding_members')。HRL 推定の主要根拠。L2 ⑦ として正式採用するかはまさの判断待ち。詳細仕様は [`amd_score.md`](amd_score.md) 「Triple Helix 観測モデル」+ migration 040 |

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
| 2026-05-09 | **Phase 4 ⑤ メンバーナレッジ + ④ PJナレッジ + ② AMDプロトコル 一括完了**: `gas/155_L2KnowledgeExtractor.js` 新規 + `l2_extract_state` テーブル (migration 030) で 3 L2 共通の差分検知。本体GAS の毎時 trigger 3 個 (member 0分 / project 15分 / protocol 30分 を狙うが GAS は分指定不可なので分散発火) で稼働。Phase 4 初版は **既存 L2 を二次集約** する設計 (5 生データ直結は Phase 4.x 改善案)。仕様正本: [member_knowledge.md](member_knowledge.md) / [project_knowledge.md](project_knowledge.md) / [amd_protocol.md](amd_protocol.md) |
| 2026-05-09 | **Phase 4 全 4 L2 (③⑤④②) を Swift APNs 通知に接続**: `l2_notifications` テーブル (migration 031, ⑥ `meeting_notifications` の姉妹) + GAS 155 / PWA progress-estimator から `saved>0` のとき upsert + `saved_count` 変化で `notified_at=NULL` に戻る再通知トリガ。iOS Swift 受信は別セッション ([ios/HANDOFF_l2_notifications.md](../../ios/HANDOFF_l2_notifications.md)) |
| 2026-05-09 | iOS Swift 受信実装 完了 (masaiPhone install + launch 確認、起動時 + foreground 復帰時 polling) |
| 2026-05-09 | **修正依頼ループ (l2_feedbacks)**: 通知の誤抽出に対してまさが「つくよみに修正依頼」を出せる仕組み。PWA `/notifications` ページ + POST `/api/notifications/feedback` + migration 032 (`l2_feedbacks` テーブル) + GAS 155 の 3 extractor で過去 feedback を LLM プロンプトに含めて再抽出。仕様正本: [notifications.md](notifications.md) |
| 2026-05-09 | **MTGサマリ Notion AI 議事録ページ対応** (gas/074): `_meeting_fetchAiNotesBody_` 新設で `transcription` block → `summary_block_id` + `notes_block_id` 配下の標準 block を再帰取得。BWE 株主総会で採決 4 件まで完全抽出成功。`gas/CalendarToNotionMinutes.js` (`run_createMinutes_apply`) は cron テンプレ生成停止 (DEPRECATED)、Notion AI 一本化。仕様正本: [meeting_summaries.md](meeting_summaries.md) |
| 2026-05-09 | **名前正規化マップ** (gas/079 `nameAlias_buildBlock`): `members.member_name` + email から動的生成。「山田氏=りょー」「山地=まさ」「chiko=ちこ」等を 074 / 155 の LLM プロンプトに渡して code_name に正規化 |
| 2026-05-09 | **MTGサマリ feedback 連携** (gas/074): `_l2_loadFeedbackBlock_("meeting_summary", ...)` + applied 記録 + source_hash に active feedback hash 混ぜる + POST `/api/notifications/feedback` 末尾で **即 force 再抽出 fire-and-forget** |
| 2026-05-09 | **PJナレッジ抽出の汚染防御 v4_meta_strict** (gas/155): `=== project_meta ===` セクション + 「他 PJ 内容で汚染されているケースは items: [] を返せ」 + `monthly_reports.status=neq.invalid` フィルタ。p10/202604 (CX 内容で SE PJ に保存) の事故対応 |
| 2026-05-09 | **DB schema reference 自動生成** (`pwa/design/db_schema.md` + `pwa/scripts/dump_schema.py`): 88 テーブル / 948 列。「列名は想像で書かない」運用ルールを `pwa/CLAUDE.md` に追加。member_activities 列名 4 つ間違い事故への根本対策 |
| 2026-05-09 | **通知 UI 改善**: `/notifications` の既読は折りたたみトグル (default closed)、開いた瞬間 `notified_at = now()` PATCH (即既読化)、グループ分けは server 値固定で開いてもセッション内は未読セクションに残る (= 中身読める)。GlobalNav に 📬 ベル + 未読バッジ、Dashboard に通知バナー |
| 2026-05-11 | **Slack backfill 074b form-encoded 化** (gas/074b): `slack_callApi` の JSON body で `conversations.replies` が `invalid_arguments` を返す問題が真因。074b 専用 `_meeting_slack_callForm_` で form-encoded helper を新規、history / replies 両方をこれ経由に。3 PJ × 過去 3 ヶ月で saved=13 達成。`project_meeting_summaries.source_url` 列追加 (migration 052) |
| 2026-05-12 | **5 生データ backfill skeleton 完成** (074c/074d/074e): `meeting_extract.{drive,calendar,gmail}` を migration 054 で seed + 各 GAS ファイルに backfill 関数。GAS v1462 deploy 済。動作確認: Drive folder_id 取得 OK / Calendar events 1-12 件取得 (saved 0 = chitchat 判定) / Gmail 3 件 saved ✅ |
| 2026-05-12 | **「📑 全 PJ 紹介資料作成」機能完成** (3 ラウンド試行錯誤後): 雛形 `AMD_allPJ_introduction.html` の 04 CHALLENERGY section を Chrome MCP + POST server で抽出 → template literal で一字一句コピー + Sonnet 4.5 で 1 PJ ごと JSON 集約 (= migration 055 で `exec_summary.extract` seed)。`/api/admin/pj-introduction-html` + `src/lib/exec_summary/template.{html,css}` + `next.config.ts outputFileTracingIncludes` |
| 2026-05-12 | **進捗イベント抽出ロジック見直し** が次セッションの最重要課題に: 「先手力」表示は復活したが、そもそも events が 0 件の PJ-月が多い (= EventsSection で「イベントデータなし」)。`progress_events` 系の cron / 抽出ロジック側の再点検が必要 |
