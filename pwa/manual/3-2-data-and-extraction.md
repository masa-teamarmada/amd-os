# データと抽出

AMD OS の **裏側**。「このデータはどこから来るか」「どう抽出されてるか」「用語と実装の対応」を扱う。

> 実装者向けの確定仕様は [/spec/3-1-l2-data-extraction-current-spec](/spec/3-1-l2-data-extraction-current-spec) へ移行開始済み。この章は、運用者が流れを掴むための説明も兼ねる。迷う内容は移行完了まで両方に置く。

## この章の読み方

この章は開発者向けの情報が多いので、先に言葉の地図を置く。ここを読まずに下の表へ進むと、`L2` / `writer` / `outbox` / `source_cache` がただの内部語に見えてしまう。

| 用語 | この章での意味 |
|---|---|
| **生データ** | OS に取り込む前の一次情報。Gmail / Drive / Calendar / Slack / Notion の 5 種類。 |
| **L2** | 生データから「OS が使える形」に抽出した構造化データ。単なる要約ではなく、Supabase の正本テーブルに入る候補または確定データ。 |
| **抽出** | 生データを読んで、MS 進捗・MTG サマリ・経営ハイライトなど、目的別の L2 に変換すること。 |
| **正本** | あとから判断・実装・運用の基準にする正式な情報。ここでは主に Supabase の各テーブルと、このマニュアル本文。 |
| **candidate / pending** | 抽出されたが、まだ人間が確認していない候補。通知で「はい」されるまで正本扱いしない。 |
| **source refs / snippet / hash** | 元データを全文保存せず、根拠を辿るために残す短い参照・抜粋・照合用 fingerprint。 |
| **source_cache** | L2 抽出に必要な根拠キャッシュ。旧 L1 正本ではなく、元データ全文の保管庫でもない。 |
| **writer** | その L2 を実際に作成・更新する処理。例: Codex automation、Claude routine、GAS、PWA API。 |
| **cron / routine / automation** | 定期実行ジョブ。Vercel は cron、Claude は routine、Codex は automation と呼ぶ。 |
| **outbox / LaunchAgent** | LLM が JSON 候補をファイルに出し、別のローカル helper が Supabase / API に反映する中継経路。 |
| **ghost** | UI やテーブルは残っているが、writer が止まっていて新規データが増えない状態。 |

読む順番は、まず「生データ → L2 → 通知で確認 → Supabase 正本へ反映」という大きな流れを掴み、その後に各 L2 の writer と稼働状況を見る。

## 生データの取り込みフロー

### ソース
| ソース | 取り込み元 | 主な内容 |
|---|---|---|
| **Slack** | `team-armada` ワークスペース | 議事録投稿 / メンバー間チャット / 長文報告 |
| **Notion** | チームアルマダ Workspace | 議事録 / 設計ドキュメント |
| **Calendar** | Google Workspace | MTG イベント |
| **Drive** | チームアルマダ Drive | 議事録 docs / 試算表 / 提案資料 PDF |
| **Gmail** | AMD 関係者の受信箱 / 会社アカウント | 外部関係者連絡 |

### 🚨 現状 (= 2026-05-29 正本訂正)

**正本方針**: M/W/D/H L2 の全データは、Gmail / Drive / Calendar / Slack / Notion の 5 生データ、または Supabase 内の既存 L2 / OS データから **定額 subscription automation** で安定抽出する。M-1 `monthly_reports` も例外ではない。

**先にここだけ読む: M/W/D/H L2 の抽出ルート**

この表では、処理IDだけでなく **実行場所 / 課金ルート / 止まった時に見る場所** までをセットで読む。旧 GAS / PWA / Vercel cron は、明示的に「旧経路」と書かれていない限り復旧対象にしない。

| L2 | 実行場所 | 現行処理 | 課金ルート | 止まった時に見る場所 |
|---|---|---|---|---|
| M-1 月次レポート | Codex automation + outbox applier | `AMD OS M-1 月次報告抽出` / SKILL `amd-os-l1-monthly-report-extract` | subscription automation 枠。R313 / PWA report route は定期使用しない | `amd-os-l2` automation 履歴、`~/.codex/automations/amd-os-ms/outbox/`、LaunchAgent applier |
| D-1 AMD プロトコル | MMOマシン Codex Desktop automation | `amd-os-l2-protocol-extract` | subscription automation 枠。旧 GAS 155 ではない | MMOマシン側の automation 履歴・ログ、`pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` |
| D-2 MS 進捗 | MMOマシン Codex Desktop automation | `amd-os-l3-ms-progress-extract` | subscription automation 枠。旧 PWA/GAS hourly ではない | MMOマシン側の automation 履歴・ログ、`pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` |
| D-3 PJ ナレッジ | MMOマシン Codex Desktop automation | `amd-os-l4-project-knowledge-extract` | subscription automation 枠。旧 GAS 155 ではない | MMOマシン側の automation 履歴・ログ、`pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` |
| D-4 メンバーナレッジ | MMOマシン Codex Desktop automation | `amd-os-l5-member-knowledge-extract` | subscription automation 枠。旧 GAS 155 ではない | MMOマシン側の automation 履歴・ログ、`pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` |
| H-1 MTG サマリ + MTG フロー | MMOマシン Codex Desktop automation | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | subscription automation 枠。旧 GAS 153/074 ではない | MMOマシン側の automation 履歴・ログ、`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` |
| D-5 OS 台帳差分 | Codex automation + outbox applier | `amd-os-ms` / SKILL `amd-os-l7-registry-diff-extract` | subscription automation 枠。PWA/GAS LLM cron ではない | `amd-os-ms` automation 履歴、`outbox.registryDiffs`、LaunchAgent applier |
| M-2 XRL 根拠 | Codex automation + outbox applier | `amd-os-ms` / SKILL `amd-os-l8-xrl-evidence-extract` | subscription automation 枠。PWA/GAS LLM cron ではない | `amd-os-ms` automation 履歴、`outbox.xrlEvidence`、LaunchAgent applier |
| D-6 経営ハイライト | Codex automation + outbox applier | `amd-os` / SKILL `amd-os-l9-strategy-signal-extract` | subscription automation 枠。PWA/GAS LLM cron ではない | `amd-os` automation 履歴、strategy-signals outbox、LaunchAgent applier |
| D-7 Textbook Insights | Codex automation / local worker + outbox applier + local BZM applier | SKILL `amd-os-l10-textbook-insight-extract` / `apply_approved_textbook_insights.mjs` | subscription automation 枠。承認後も Vercel runtime から git file は直接編集しない | `amd-os-ms` outbox `textbookInsights`、`textbook_insight_candidates`、local BZM applier |

**M-1の primary writer**: Codex automation `AMD OS M-1 月次報告抽出`。実行手順の正本は [`pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`](../scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md)。automation は Supabase 内の既存 L2 snapshot を primary input にし、L2 coverage が薄い場合だけ 5 生データを gap check / backfill fallback として読み、`/Users/masa/.codex/automations/amd-os-ms/outbox/` に `monthlyReports` JSON を出す。既存 LaunchAgent + `ms_progress_review_tool.mjs` が非LLMで Supabase `monthly_reports` に反映する。

**R313 の扱い**: AMD-Report GAS R313 は旧経路。現物では `R313_MonthlyReport_Cron.js` が未生成レポートや差分ありレポートで `api_generateMonthlyReport` / `mr_generateDraftUpdate_` を呼び、`R303_MonthlyReport_Generator.js` が Anthropic Claude API を呼ぶ。したがって R313 trigger を有効化すると token 課金が発生しうる。R313 はバックアップ/手動確認用に残すが、定期 M-1 writer ではない。

**2026-05-29 実画面確認**: `Report-AMD_OS` Apps Script の trigger 一覧は 5 件で、`run_monthlyReportCron` / `run_L2CronDaily` は存在しない。つまり、確認時点では R313 の日次 trigger による M-1 token 課金は走っていない。

PWA `/api/report/generate` と `/api/cron/monthly-reports-backfill` は手動復旧用の重い route。実行すれば token 課金が発生しうるため、定期実行には使わない。月次報告モーダルの手動修正は、人間が明示的に押したときだけの編集経路。

2026-05-22 に「LLM 課金が発生する定期抽出 cron を全廃止」した経緯と、5/25 判明した後継処理のカバー範囲誤認の詳細は **[9-1 章 5.1 cron 廃止経緯](9-1-decisions-and-history.md#51-cron-廃止経緯)** + **[9-1 章 5.7](9-1-decisions-and-history.md#57-l2-D-1D-3D-4H-1-ghost-化と-claude-routine-4-個新設計画--2026-05-25)** 参照。

| L2 | 何を生成 | 旧 writer (停止/移管対象) | 現行 writer (= 実行場所 + automation) | 頻度 | 状態 (2026-05-29) |
|---|---|---|---|---|---|
| M-1 monthly_reports | PJ 月次レポート | AMD-Report GAS R313 / PWA report route | Codex automation `AMD OS M-1 月次報告抽出` + outbox applier | daily 05:30 JST | ✅ 正式対象。Supabase L2-first、5生データは gap check fallback。R313 trigger は置かない。PWA heavy route は手動復旧のみ |
| D-1 AMD プロトコル | `protocols` | ~~GAS 155~~ ⛔ 5/22 停止 | **MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract`** | daily 08:00 JST | ✅ MMOマシン側へ移管。復旧時は MMO 側 automation 履歴を見る |
| D-2 MS 進捗 | `milestone_monthly_progress` | ~~PWA `/api/cron/hourly-estimate` (= GAS 154 → 毎時 ping)~~ ⛔ **2026-05-29 再停止** | **MMOマシン automation `amd-os-l3-ms-progress-extract`** | 毎時 0 分 | ✅ **MMOマシン側へ移管**。PWA/GAS hourly は `ALLOW_PWA_LLM_CRONS=1` を明示しない限り disabled response のみ返す |
| D-3 PJ ナレッジ | `project_knowledge` | ~~GAS 155~~ ⛔ 5/22 停止 | **MMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract`** | daily 08:15 JST | ✅ MMOマシン側へ移管。復旧時は MMO 側 automation 履歴を見る |
| D-4 メンバーナレッジ | `member_knowledge` | ~~GAS 155~~ ⛔ 5/22 停止 | **MMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract`** | daily 08:30 JST | ✅ MMOマシン側へ移管。`status` / `source_hash` / `last_processed_at` は migration 091 + `db_schema.md` に反映済み |
| H-1 MTG サマリ | `project_meeting_summaries` | ~~GAS 153 (毎時 polling)~~ ⛔ 5/22 停止 | **MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow`** (= SKILL `amd-os-l6-meeting-extract`) | 毎日 09:00-21:00 毎時 0 分 | ✅ MMOマシン側へ移管。該当 event 0 件なら早期 exit |
| D-5 OS 台帳差分 | `project_registry_diffs` | 旧 Codex automation `amd-os-ms` の部分機能 | Codex automation `amd-os-ms` + SKILL `amd-os-l7-registry-diff-extract` | 6h ごと | ✅ subscription automation 枠。`outbox.registryDiffs` と applier を見る |
| M-2 XRL 根拠 | `project_xrl_evidence` | 旧 Codex automation `amd-os-ms` の部分機能 | Codex automation `amd-os-ms` + SKILL `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 と 15 分ずらし) | ✅ subscription automation 枠。`outbox.xrlEvidence` と applier を見る |
| D-6 経営ハイライト | `project_strategy_signals` | 旧 Codex automation `amd-os` の部分機能 | Codex automation `amd-os` + SKILL `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | ✅ subscription automation 枠。strategy-signals outbox と applier を見る |

### ⚠️ 2026-05-26 fact 補足 (= 稼働信頼性)

**2026-05-26 履歴**: Mac の Claude Desktop scheduled task は **「app open + 非スリープ中」のみ発火**。MacBook Air がスリープ / 蓋閉じ中だと cron 時刻でも発火しない (= 「次回起動時に追いつき」仕様)。このため、現行の復旧主導線は上の M/W/D/H L2 抽出ルート表に移した。

実際の発火履歴 (5/26 朝時点):
- L3 (毎時 0 分): 5/25 16:01 JST に 1 回発火、それ以降未発火 (スリープ疑い)
- L6 (毎時 0 分、旧 amd-os-meeting-extract): 5/25 03:07 JST に 1 回発火、それ以降未発火
- L2/L4/L5/L7/L8/L9: 未発火 (= cron 時刻のうち多くは Mac スリープ中)

→ この時点では **Windows MMO PC / Mac sleep OFF / Anthropic Cloud routine** を候補として比較していた。現在の判断は、D-1〜H-1は MMOマシン Codex Desktop automation、M-1D-5M-2D-6D-7は Codex automation + outbox/applier を見る。

当時の fact (= ghost 状態の row、5/26 朝時点):
- `protocols`: 2026-05-22 が最後の created_at
- `project_knowledge`: 2026-05-23 が最後の updated_at (残留分)
- `member_knowledge`: 2026-05-22 が最後の updated_at
- `project_meeting_summaries`: 5/22 以降 created の自動取り込みは事実上ゼロ (= dialogue 手動投入分と manual_eimi のみ)

### 取り込み path 一覧

```
✅ M-1 monthly_reports
   [Codex automation `AMD OS M-1 月次報告抽出`] (= daily 05:30 JST、subscription 内 LLM)
     ↓ monthlyReports JSON
   [~/.codex/automations/amd-os-ms/outbox/]
     ↓ LaunchAgent + non-LLM helper
   [Supabase] (= `monthly_reports`)
   ※ AMD-Report GAS R313 の日次 trigger はなし (2026-05-29 実画面確認)。PWA heavy route は手動復旧のみ

✅ D-2 MS 進捗 (= primary writer)
   [MMOマシン automation `amd-os-l3-ms-progress-extract`] (= subscription 内 LLM)
     ↓ source_hash 差分検知
   [Supabase] (= `milestone_monthly_progress`, `progress_estimate_state`, `l2_notifications`)

✅ D-1D-3D-4 ナレッジ/プロトコル
   [MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract` / `amd-os-l4-project-knowledge-extract` / `amd-os-l5-member-knowledge-extract`]
     ↓ source_hash 差分検知 + l2_feedbacks 反映
   [Supabase] (= `protocols`, `project_knowledge`, `member_knowledge`, `l2_notifications`)

✅ H-1 MTG サマリ + MTG フロー
   [Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow`]
     ↓ Phase A 早期 exit + meeting flow
   [Supabase / Calendar / Drive / Gmail draft] (= `project_meeting_summaries`, cockpit TODO, 作業枠, 資料 draft)

⛔ 旧 fallback
   [GAS 154 `nav_pwa_pingHourlyEstimate`] → [PWA `/api/cron/hourly-estimate`]
   2026-05-29 再停止。`ALLOW_PWA_LLM_CRONS=1` を明示しない限り LLM を呼ばない

✅ D-2 MS 進捗レビュー / D-5 OS 台帳差分 / M-2 XRL 根拠
   [Codex automation `amd-os-ms`] (= 6h ごと、subscription 内 LLM)
     ↓ outbox JSON
   [~/.codex/automations/amd-os-ms/outbox/]
     ↓ 5 分ごと polling
   [LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier`]
     ↓ pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir
   [Supabase] (= `ms_progress_revisions` / D-5 / M-2)

✅ D-6 経営ハイライト (= D-6)
   [Codex automation `amd-os`] (= daily 03:20 JST)
     ↓ outbox JSON
   [~/.codex/automations/amd-os/strategy-signals-outbox/]   ← 監視先修復済 2026-05-25
     ↓ 5 分ごと polling
   [LaunchAgent applier (同上)]
     ↓ apply-outbox-dir --dir <そこ>
   [Supabase] (= D-6)
```

D-1D-3D-4H-1の復旧/移管状況は [8-3 章](8-3-l2-extraction-routines-spec.md) と [`pwa/scheduled-tasks/README.md`](../scheduled-tasks/README.md) を正本にする。古い ghost 記述だけで現状判断しない。

→ 全責務分担は **[9-1 章 5.4 責務分担マトリクス](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)** に正本表あり (= 上記マトリクスとの整合チェックは 5.4 を真とする)

→ 抽出 automation の SKILL 正本は **[`pwa/scheduled-tasks/`](../scheduled-tasks/README.md)**。設計議論の履歴は **[`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)**。

→ なぜ 5/22 cron 廃止したかの背景は **[9-1 章 5.1 cron 廃止経緯](9-1-decisions-and-history.md#51-cron-廃止経緯)**

---

## M/W/D/H L2の正本

| L2 # | テーブル | 用途 | 主な入力ソース | 主な writer | 状態 |
|---|---|---|---|---|---|
| M-1 | `monthly_reports` | PJ 月次レポート | Supabase L2 snapshot primary + 5 ソース gap check fallback | Codex automation `AMD OS M-1 月次報告抽出` (= daily 05:30 JST) → `amd-os-ms/outbox.monthlyReports` → LaunchAgent applier。PWA `/api/cron/monthly-reports-backfill` / `/api/report/generate` と AMD-Report GAS R313 は手動復旧/旧経路 | ✅ 正式稼働対象。2026-05-29 実画面確認では `run_monthlyReportCron` / `run_L2CronDaily` trigger なし |
| D-1 | `protocols` | AMD プロトコル (= 経営判断の構造化記録) | 議事録の二次集約 | **MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract`**。旧 GAS 155 は停止済み | ✅ MMOマシン側へ移管 |
| D-2 | `milestone_monthly_progress` + 進捗系 | MS 達成度 | 月次報告書 + MTGサマリ + OS snapshot | **MMOマシン automation `amd-os-l3-ms-progress-extract`** (= primary writer) + Codex automation `amd-os-ms` (= 6h ごとの修正候補 `outbox.revisions`)。PWA `/api/cron/hourly-estimate` は停止済 fallback | ✅ 稼働 |
| D-3 | `project_knowledge` | PJ 知識ナレッジ | `monthly_reports` + 議事録 二次集約 | **MMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract`**。旧 GAS 155 は停止済み | ✅ MMOマシン側へ移管 |
| D-4 | `member_knowledge` | メンバー個人のナレッジ | `member_activities` + 議事録 二次集約 | **MMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract`**。旧 GAS 155 は停止済み | ✅ MMOマシン側へ移管。migration 091 の `status` / `source_hash` / `last_processed_at` 前提 |
| H-1 | `project_meeting_summaries` + `meeting_assets` + cockpit TODO + Calendar 作業枠 + Drive 資料 + Gmail draft | MTG サマリ + **MTG 全フロー** (= 2026-05-27 拡張)。Meet/Gmail 議事録に落ちないスクショ・表・画面共有資料は PWA から `meeting_assets` に手動添付し、`narrative_md` に Markdown 画像/リンクとして挿入できる | Calendar + Notion 議事録 + Slack + Drive Docs + Gmail + PWA 添付資料 | ~~GAS 153~~ ⛔ → ✅ **Codex Desktop automation `amd-os-l6-meeting-flow`** (= Windows MMO PC、 平日土日 09:00-21:00 毎時 0 分発火、 gpt-5.5 high reasoning)。議事録抽出だけでなく次 MTG カード生成 / Slack nudge / TODO→cockpit / Calendar 作業枠 (+<PJ> prefix) / 資料即生成 / ファシリ役メール下書きまで自動。dialogue (= 提案前の論点整理セッション) は POST `/api/dialogue-meeting` で稼働。PWA `POST /api/meeting-assets` はアップロード/挿入だけで、従量課金 LLM は呼ばない | ✅ 稼働 (Phase A 早期 exit 付き、 該当 event 0 件なら即終了) |
| D-5 | `project_registry_diffs` (= 通知 nudge) | OS 台帳差分 | OS snapshot vs 5 ソース | Codex automation `amd-os-ms` (= `outbox.registryDiffs`) + SKILL `amd-os-l7-registry-diff-extract` | ✅ subscription automation 枠で稼働 |
| M-2 | `project_xrl_evidence` | XRL 根拠 | 5 ソース + OS snapshot | Codex automation `amd-os-ms` (= `outbox.xrlEvidence`) + SKILL `amd-os-l8-xrl-evidence-extract` | ✅ subscription automation 枠で稼働 |
| D-6 | `project_strategy_signals` | **経営ハイライト** | 5 ソース + OS snapshot | Codex automation `amd-os` (= daily 03:20) + SKILL `amd-os-l9-strategy-signal-extract` + dialogue API (= 提案前の論点整理セッション) | ✅ subscription automation 枠で稼働。修正依頼ループは対話型と接続予定 |
| D-7 | `textbook_insight_candidates` | **Textbook Insights** | Supabase 内の既存 L2 / OS データ primary。必要なら 5 ソースは gap check | Codex automation / local worker `amd-os-l10-textbook-insight-extract` → `outbox.textbookInsights` → 通知 yes で approved → local BZM applier が `pwa/bzm/*.md` へ追記 | 🟡 partial。DB/API/outbox/local applier の最小導線を追加。実 schedule は未確定 |

**📊 別 L2** (= `member_activities`、メンバー活動ログ): `cron/member-weekly-activities` の legacy GET synthesis は Anthropic 経路を持つため 2026-05-29 に Vercel active cron から退避。2026-07-08 以降の D-10 定期生成は、Codex automation が `GET ?mode=evidence` で証拠を読み、活動文を合成して `POST activities[]` で保存する。

### H-1 予定MTGカード同期

H-1は、終了済みMTGの議事録抽出とは別に、今日0:00 JSTから60日先までの確定Calendar予定を `POST /api/meeting-prep/calendar-sync` へ渡す。`calendar-sync` は `source_kinds='upcoming'` の予定MTGカードを `project_meeting_summaries` に upsert し、同日中なら開始済み予定もDrive資料・URL補強の対象にする。ただし recurring MTG は series ごとに次回1件だけ同期・表示し、それ以降の future occurrence はノイズとして扱う。Google Calendar の `recurring_event_id` が無い場合でも、title に `定例` / `月次` / `毎月` / `weekly` / `monthly` 等が含まれる予定は曜日を外して series 推定する。それ以外は weekly cadence が推定できる series だけ同じ扱いにする。

PJに `drive_folder_id` がある場合、automation側でDrive root直下と会議日/title token に合う1階層サブフォルダを探し、Docs / Slides / Sheets / PDF / Office files の metadata を `drive_files` として渡す。PWA route はDriveを直接読まず、渡された metadata を `narrative_md` の `関連Drive資料` に載せる。Drive資料は補助根拠であり、資料に書かれているだけで当日決定事項とは扱わない。

### H-1 タスク化と担当者 nudge

MTGカード / 議事録 / Gmail TODO / Slack TODO から次アクションが出たら、H-1 は `POST /api/task-calendar/register-tasks` で `tasks` に自動登録し、担当者本人へ Slack DM nudge を送る。admin が全件 review する `/admin/calendar-review` は使わない。Calendar 作業枠候補が必要な場合だけ `/api/task-calendar/schedule-plan` の dry-run で `calendar_writes` を作るが、PWA route は Calendar / Gmail / 外部招待を実writeしない。

### H-1 Notion 文字起こし導線

PWA の MTGサマリ / 予定MTGカードは、L6 が読む Notion メモをまさが会議前・会議中に開きやすくする入口を持つ。`project_meeting_summaries.notion_url` があれば `Notion文字起こし` CTA で Notion ページを別タブ表示する。`notion_url` が無い予定MTGでは、`source_url` の Calendar 予定を開く導線を出し、Notion 側の録音/文字起こし開始に移れるようにする。どちらも無い場合は `Notion未連携` と表示する。

この導線は UI 補助であり、AMD OS から Notion の録音開始 API を呼んだり、DB write / DDL を伴って Notion ページを自動作成したりしない。L6 automation が後から Notion page を見つけて `notion_url` / `eventId` を補完した場合は、PWA の `メモ再読込` で `project_meeting_summaries` を読み直して反映する。

### H-1 Notion eventId fallback

Notion 議事録ページの `eventId` / 相当プロパティを埋められるのは、Calendar event と Notion page の両方を同時に見ている MMO automation だけ。`amd-os-l6-meeting-flow` は Calendar event から該当 Notion page を見つけたら、可能な範囲で Calendar event id を Notion page に追記する。追記に失敗しても議事録抽出は止めず、run summary に `notion_event_id_backfill_failed` と page id / reason を残す。

Notion page に `eventId` が無いことだけを理由に skip しない。必ず title + event date + attendees + Gemini/Drive/Gmail URL で fallback 検索し、Notion が取れなければ Gmail / Drive / Slack / Calendar 本文だけでも `source_kinds` を判定する。`eventId` 欠損だけで `source_kinds='none'` や `skip_no_notion_event_id` にしない。

### H-1 開催済みソース guard

準備カード (`meeting_id='upcoming:<calendar_event_id>'`) は会議前の考えとして残し、実施後ソースがある場合は開催済み row (`meeting_id='<calendar_event_id>'`) を別に作る。既存 upcoming row があるなら `prep_source_meeting_id` で紐付ける。

Calendar event に Gemini / Google Meet notes Doc 添付がある、Notion の `eventId` が空でも title + 日付 + 参加者 + PJ 文脈で fallback match できる、または `projects.report_emails` が空でも Gemini notes / follow-up Gmail が event 文脈で hit する場合は、upcoming だけで完了扱いにしない。fallback は `confidence` / `needs_review` を残し、`report_emails` の不足は自動更新せず registry diff / 通知候補へ寄せる。

再発防止 guard は `pwa/scripts/l6_meeting_held_source_guard.cjs`。`cd pwa && npm run test:l6-held-source-guard` で、飯野さんケース相当の fixture から開催済み候補が出ることを検査する。

→ 仕様詳細は [`pwa/design/L2_DATA.md`](../design/L2_DATA.md) と [8-3 章](8-3-l2-extraction-routines-spec.md)。
→ 旧 ghost 4 種の復旧経緯は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)。

---

## 🎨 カレンダー色 → PJ 判定 (恒久仕様・削除禁止)

> 🚨 **この判定ロジックは AMD OS の恒久仕様**。MTG サマリ抽出 (H-1) で「どの Calendar イベントがどの PJ のものか」を決める**第一の軸**。**どの抽出ランナー (Claude routine / Codex Desktop automation / 将来の後継) でも必ず実装する**。移植・リファクタ・「inline 移植版」と称する書き換えで**削除・簡略化しないこと**。2026-05-29 に、#71 の Claude routine 移植時にこの色判定が誤って削除され `project_name` の substring match だけに簡略化されていた事故が発覚 (= まさ未承認の機能削除)。再発防止のためここに正本化する。

### 仕組み: 「色優先」で PJ を決める

まさは Google Calendar の各 MTG を **イベント色 (colorId 1–11)** で PJ ごとに塗り分けて運用している。OS はその色を読んで PJ を自動判定する。

2026-06-01 以降、Google Calendar connector が `get_colors` / raw `event.colorId` を返さない場合は、connector 再認証待ちで止めず、PWA 側の read-only helper `pwa/scripts/l6_calendar_color_diagnostic.mjs` で Calendar API v3 を直接読む。PWA 側 Google env が無い環境では、GAS Advanced Calendar Service の `gas/188_L6CalendarColorDiagnostic.js` (`l6_calendar_color_diagnostic`) を `pwaApi runFunc` から呼ぶ。どちらも対象 window の `event_id` / `calendar_id` / `summary` / `start` / `end` / 明示 `colorId` / `calendar_default.colorId` を JSON で返す。GAS helper は CFG_PJAlias が読める場合だけ、alias 値を出さずに high-confidence 候補の有無も返す。DB、outbox、Calendar、Notion、Gmail、Drive、Slack への書き込みは禁止。

**正本データ** = 外部スプレッドシート **`CalendarRepo_AMD_OS`**
(fileId は env `COLOR_PJ_CONFIG_SPREADSHEET_ID` = `1s3HfM2…`、まさが直接メンテする。抽出ランナーは Google Drive 連携 (Drive MCP `read_file_content` 等) で読む):

| タブ | ヘッダ | 役割 |
|---|---|---|
| **`CFG_ColorPJHistory`** | `colorId \| startDate \| pjCode \| note` | colorId → pjCode の**履歴**。同じ colorId を時期で別 PJ に振り直せる |
| **`CFG_PJAlias`** | `alias \| pjCode \| priority \| matchType \| note` | タイトル文字列 → pjCode。色で取れない時の補完。`EXCLUDE` は議事録対象外 |

### 解決順 (= GAS 153 `pickPJByColorHistory_` 由来)

1. **色 (第一軸)**: イベントの `colorId` について、`CFG_ColorPJHistory` から `startDate <= イベント開始日` の行のうち **startDate 最大** の `pjCode` を採用。
   - 例: colorId 6 は `2024-01-01→JC`、`2026-05-28→VSX`。2026-05-28 以降の colorId 6 イベントは **VSX**。過去の JC 予定は JC のまま (履歴方式)。
   - connector から明示 `event.colorId` が取れない event は color route では止める。`calendar_default.colorId` は診断・設定確認には残すが、Live write 候補を作るための代替色として自動採用しない。
2. **title エイリアス (第二軸)**: `(title+description+location)` を `CFG_PJAlias` に matchType で照合し priority 最大の pjCode。`EXCLUDE` なら skip。
   - 明示 `event.colorId` が無い event を Live 候補へ上げてよいのは、CFG_PJAlias の `matchType=exact` / `matchType=regex` / bracketed title alias / ASCII whole-token title alias が high confidence で当たり、`EXCLUDE` / `AMD` でなく、duplicate guard と既存良質サマリ保護を通る場合だけ。
3. **substring フォールバック (最終手段)**: 色も alias も取れない時のみ、`project_name` / `project_id` / `client_name` の substring match。これは diagnostic / review 用で、Live write target にはしない。
4. **pjCode → project_id**: `lower(project_name)==lower(pjCode)` 優先。一致しない code は既知マップで解決 (例: **VSX → VasculaX = p26**)。

### 色の割当を変えるとき (= まさの運用)

`CFG_ColorPJHistory` に**履歴行を1行足すだけ**。例「今日から JC の色 (colorId 6) を VSX に」→ `6 | <今日> | VSX | note` を追加。過去の予定は影響を受けない。実装正本は [8-3 章 L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) の H-1 と、ランナー SKILL の Phase A PJ 判定。

---

## 抽出パイプライン

### Codex automation
- 場所: `~/.codex/automations/{name}/automation.toml`
- 主要 automation:
  - **`AMD OS M-1 月次報告抽出`** (= daily 05:30 JST) — Supabase L2 snapshot primary + 5 生データ gap check fallback で `monthly_reports` draft を作り、`amd-os-ms/outbox.monthlyReports` に書き出す。R313 / PWA heavy route は使わない
  - **MMOマシン automation `amd-os-l3-ms-progress-extract`** (= 毎時 0 分) — MS 進捗の primary writer。`milestone_monthly_progress` / `progress_estimate_state` を更新する
  - **`amd-os-ms`** (= 6h ごと) — MS 進捗の修正候補 / D-5 OS 台帳差分 / M-2 XRL 根拠を outbox 書き出し。MS 進捗の primary writer ではない。PWA `/api/cron/hourly-estimate` は停止済 fallback。D-1D-3D-4H-1 は生成しない (= 2026-05-25 ghost 化の原因、[9-1 章 5.7](9-1-decisions-and-history.md#57-l2-D-1D-3D-4H-1-ghost-化と-claude-routine-4-個新設計画--2026-05-25) 参照)
  - **`amd-os`** (= daily 03:20 JST) — D-6 経営ハイライト抽出 + outbox 書き出し
  - **`amd-os-l10-textbook-insight-extract`** (= TBD / manual start) — D-7 Textbook Insights 候補を `outbox.textbookInsights` に書き出す。approved 後の BZM 追記は local applier
  - **`amd-atlas-2`** (= daily 08:10 JST) — 外部マクロ Atlas 抽出
  - **`amd-macrotrend-evidence-review`** (= weekly Mon 07:30) — UN SDGs / WEF Global Risks 整理
- それぞれ outbox に JSON を吐くだけ、Supabase 直接書き込みはしない
- prompt は `automation.toml` 内に記述 (= 将来 DB 化予定、現状は file)

### LaunchAgent applier
- 場所: `~/Library/LaunchAgents/jp.teamarmada.amd-os-ms-outbox-applier.plist`
- 実行スクリプト: `/Users/masa/projects/AMD/amd-os/scripts/run-ms-outbox-applier.sh`
- 5 分ごとに起動
- 監視 dir:
  - `~/.codex/automations/amd-os-ms/outbox/` ✅
  - `~/.codex/automations/amd-os/strategy-signals-outbox/` ✅ (= 2026-05-25 監視先修復済)
  - `~/.codex/automations/amd-atlas/outbox/` ✅
- apply ツール:
  - `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir [--dir <path>]`
  - `pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir`

### Subscription automation / MMOマシン automation
- SKILL 正本: `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`
- 旧 Mac Local routine (`~/.claude/scheduled-tasks/{name}/SKILL.md`) は履歴/同期先であり、現行の復旧主導線ではない
- 主要 automation (= 2026-05-29 時点):
  - ✅ **`amd-os-management-dialogue-prep`** (= daily 07:00 JST、 Mac Local) — 提案前 dialogue の議題プリペア
  - 🚚 **D-1D-3D-4H-1 は Windows MMO PC の Codex Desktop automation に集約済** (= 2026-05-26 移行、 詳細は [8-3 章 L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) § H-1 MTG サマリ + フロー)
    - `amd-os-l2-protocol-extract` (= daily 08:00) — D-1 AMD プロトコル抽出
    - `amd-os-l4-project-knowledge-extract` (= daily 08:15) — D-3 PJ ナレッジ抽出
    - `amd-os-l5-member-knowledge-extract` (= daily 08:30) — D-4 メンバーナレッジ抽出
    - `amd-os-l6-meeting-flow` (= **平日土日 09:00-21:00 毎時 0 分**、 Phase A 早期 exit 付き) — H-1 **MTG 全フロー** (議事録 / 次 MTG カード / Slack nudge / TODO→cockpit / Calendar 作業枠 (+<PJ>) / 資料即生成 / ファシリ役メール下書き)
  - 各 automation の prompt / 手順は [`pwa/scheduled-tasks/`](../scheduled-tasks/README.md) の SKILL を正本にする
- 実装/登録/DB upsert の詳細は **[8-3 章 L2 Extraction Routines](8-3-l2-extraction-routines-spec.md)** を正本にする
- **🚨 重要**: 処理IDだけで現行 writer を判断しない。MMOマシン / Codex automation / outbox applier のどこで動くかまでセットで確認する

### PWA cron (= Vercel)
- 場所: `pwa/vercel.json` の `crons` 配列
- 残ってる cron (= LLM 非依存の運用系のみ):
  - `freee-payment-sync` (= 入金同期)
  - `payment-confirm-nudges` (= 入金確認通知)
  - `payout-reward-cache-refresh`
  - `payout-notice-prebuild`
  - `papers-quarterly-ingest`
  - `sync-pj-facts`
  - `macro-aggregate-indicators`
  - `management-score-raw-data`
  - `management-score-calculate`
- **LLM 課金が発生する定期抽出 cron は全停止** (= `vercel.disabled-crons.json` に退避)

---

## つくよみ修正依頼 → 学習ループ

### つくよみとは
- AMD OS 内の LLM 抽出担当キャラ
- 通常の会話支援AIとは別人格 (= おっとり女子、月モチーフ、バッチ型担当)
- 普段「そうかなあ…」「別にいいよお〜」、満月の夜は神モード「人の子よ」

### 修正依頼フロー
```
[レビュー担当が cockpit でシグナル / 議事録の誤抽出を見つける]
   │
   │ 「⚠️ つくよみに修正依頼」ボタン → textarea に修正コメント
   │
   ▼
[POST /api/notifications/feedback]
   ├ l2_kind / target_id / scope_key / feedback_text
   ├ Supabase `l2_feedbacks` に INSERT
   └ Supabase `tsukuyomi_learnings` にも INSERT (= 学習リスト)
   │
   ▼
[次回 Codex automation 実行時]
   ├ prompt に「過去の修正依頼」を含める (= `_l2_loadFeedbackBlock_` 相当)
   ├ 抽出結果が改善
   └ `applied_count` を increment
```

### ⚠️ 2026-05-25 時点のギャップ (= 履歴)

**当初の認識** (= 2026-05-24 時点): 「経営ハイライト (= D-6) だけ修正依頼ループ未実装、他 L2 は GAS 155 / 074 で動いてる」
**実態 (= 2026-05-25 判明)**: **他 L2 (= D-1D-3D-4H-1) も GAS 155 / 153 kill switch で停止しており、修正依頼ループも実は止まってる**。このギャップは 2026-05-29 時点で subscription automation 側の SKILL に移して再構築する扱い。

| L2 | 修正依頼読込実装 | 現状 |
|---|---|---|
| D-1 AMD プロトコル | (旧) GAS 155 line 730 で `_l2_loadFeedbackBlock_("protocols", ...)` 実装あり | ⛔ GAS 155 kill switch で動作停止 |
| D-3 PJ ナレッジ | (旧) GAS 155 line 523 で同上 | ⛔ 同上 |
| D-4 メンバーナレッジ | (旧) GAS 155 line 321 で同上 | ⛔ 同上 |
| H-1 MTG サマリ | (旧) GAS 074 line 1155 で同上 | ⛔ GAS 153 kill switch で動作停止 → GAS 074 helper が呼ばれない |
| D-6 経営ハイライト | Codex automation `amd-os` の prompt に未実装 | 抽出は動いてるが修正依頼が反映されない |

### 復旧/改善方針

- **D-1D-3D-4H-1**: MMOマシン Codex Desktop automation の SKILL に `l2_feedbacks` 読み込み手順を組み込む
- **D-6 経営ハイライト**: `amd-os` automation の prompt に `l2_feedbacks` 読み込み手順を追加 (= 別 task)
- **UI 側**: CockpitStrategySignals 等の各 L2 表示部に「過去の修正依頼」セクション追加 (= 修正依頼の形跡が残らない問題への対処、別 task)

---

## 用語と実装の対応 ⭐

**ここは「変数名と UI 表記と実態の食い違い」を必ず参照する場所**。新セッションの開発担当も必ず読む。

### foundingProposal / project_founding_members
- **変数名から想像する意味**: founder だけのリスト
- **実態**: **HRL 評価のベースになる関連メンバー台帳** (= SU 創業・経営・技術に直接コミットする人 + AMD 伴走メンバー + 大学キーパーソン)
- LLM が monthly reports / MTG サマリ / project knowledge / SU 基本情報から抽出する
- VC / 顧客 / 行政 / 産業パートナーは HRL 根拠外として入れない、または `invalid` 化する
- **マニュアルでは「関連メンバー (= LLM 抽出)」と呼ぶ**
- リネーム候補: `relatedMembersProposal` / `project_related_members` (= 別 task)

### 「メンバー」「関連メンバー」「事業会社」「VC」の使い分け
| UI / コード上の表記 | 実態 | 例 |
|---|---|---|
| 「メンバー」(= cockpit 上のボタン) / `project_members` | **AMD 内部メンバー**で、この PJ に伴走 | PJ を担当する AMD メンバー |
| 「関連メンバー」 (= 上記 foundingProposal の実態) / `project_founding_members` (misleading) | **HRL 評価のベースになる人物台帳** | SU 創業候補 + AMD 伴走 + 大学キーパーソン |
| 「事業会社」 (= 🤝 ボタン) / `project_partners` | 興味事業会社 (= 法人レベル) | ファインケム / ダイキアクシス / 三浦工業 |
| 「VC」 / `vcs` テーブル | ベンチャーキャピタル (= 法人レベル) | JAFCO / DG ダイワ |
| 「投資家」 | 個人投資家 + VC 担当者 | (= 個人と法人で別管理) |

関連メンバーの category / role / HRL / FRL ロジックは **[4-4 章 FRL / 関連メンバー / HRL 詳細仕様](4-4-frl-related-members-score-spec.md)** を正本にする。

### signal_type
| signal_type (= DB 値) | 日本語表記 (= UI 表示) | 該当カテゴリ |
|---|---|---|
| `management_decision` | 方針決定 | 経営全般 |
| `business_progress` | 事業進捗 | 事業開発 |
| `strategic_pivot` | 戦略転換 | 経営全般 |
| `commercial_progress` | 商談/売上 | 事業開発 |
| `partnership` | 提携 | 事業開発 |
| `funding` | 資金 | 経営全般 |
| `ip_regulatory` | 外部規制 (= 他国規制動向 / 競合知財動向) | 外部環境 |
| `tech_progress` | 自社知財/技術 (= 自社特許出願 / 技術スタック進捗) | 技術開発 |
| `risk` | リスク | 外部環境 |
| `next_move` | 次の一手 | 経営全般 (= ただし「未了」系は経営ハイライト対象外) |

### decision_state / status / impact_level / polarity の 4 軸
シグナルカードに表示される情報は紛らわしいため、整理:
| 軸 | 値 | UI 上の見た目 |
|---|---|---|
| **status** | `candidate` / `confirmed` / `rejected` / `archived` | candidate のみ「⚠️ 未確認」注釈、それ以外は表示なし |
| **decision_state** | `observed` / `proposed` / `decided` / `executing` / `revised` | **撤廃予定** (= done のみ書く運用なので不要) |
| **impact_level** | `low` / `medium` / `high` / `critical` | chip 表示 |
| **polarity** (= 新規) | `breakthrough` (🎉) / `forward` (✨) / `pivot` (🔄) / `risk` (⚠️) | カード左端のアイコン |

---

## 関連
- 設計議論: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md), [`pwa/design/strategy_signals_redesign.md`](../design/strategy_signals_redesign.md), [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- 経緯: **[9-1 章 5.1 cron 廃止経緯](9-1-decisions-and-history.md#51-cron-廃止経緯)**
