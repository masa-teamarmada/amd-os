# データと抽出

AMD OS の **裏側**。「このデータはどこから来るか」「どう抽出されてるか」「用語と実装の対応」を扱う。

## 生データの取り込みフロー

### ソース
| ソース | 取り込み元 | 主な内容 |
|---|---|---|
| **Slack** | `team-armada` ワークスペース | 議事録投稿 / メンバー間チャット / 長文報告 |
| **Notion** | チームアルマダ Workspace | 議事録 / 設計ドキュメント |
| **Calendar** | Google Workspace | MTG イベント |
| **Drive** | チームアルマダ Drive | 議事録 docs / 試算表 / 提案資料 PDF |
| **Gmail** | AMD 関係者の受信箱 / 会社アカウント | 外部関係者連絡 |

### 🚨 現状 (= 2026-05-26 fact)

**2026-05-25 #71 確定方針**: L2 ②〜⑨ の **全 8 routine を Claude routine に統一**。① monthly_reports だけは別 GAS R313 (= LLM 不使用) のまま。

2026-05-22 に「LLM 課金が発生する定期抽出 cron を全廃止」した経緯と、5/25 判明した後継処理のカバー範囲誤認の詳細は **[9-1 章 5.1 cron 廃止経緯](9-1-decisions-and-history.md#51-cron-廃止経緯)** + **[9-1 章 5.7](9-1-decisions-and-history.md#57-l2-②④⑤⑥-ghost-化と-claude-routine-4-個新設計画--2026-05-25)** 参照。

| L2 | 何を生成 | 旧 writer (停止/移管対象) | 新 writer (= Claude routine) | 頻度 | 状態 (2026-05-26) |
|---|---|---|---|---|---|
| ① monthly_reports | PJ 月次レポート | AMD-Report GAS R313 | (対象外 = R313 のまま) | daily 05:00 JST | ✅ 稼働 |
| ② AMD プロトコル | `protocols` | ~~GAS 155~~ ⛔ 5/22 停止 | `amd-os-l2-protocol-extract` | daily 08:00 JST | ✅ **Mac 登録済 (5/25)**、🚧 実 DB write 観察中 |
| ③ MS 進捗 | `milestone_monthly_progress` | ~~PWA `/api/cron/hourly-estimate` (= GAS 154 → 毎時 ping)~~ ⛔ **2026-05-29 再停止** | `amd-os-l3-ms-progress-extract` | 毎時 0 分 | ✅ **MMO/Codex automation 側へ移管**。PWA/GAS hourly は `ALLOW_PWA_LLM_CRONS=1` を明示しない限り disabled response のみ返す |
| ④ PJ ナレッジ | `project_knowledge` | ~~GAS 155~~ ⛔ 5/22 停止 | `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | ✅ **Mac 登録済 (5/25)**、🚧 実 DB write 観察中 |
| ⑤ メンバーナレッジ | `member_knowledge` | ~~GAS 155~~ ⛔ 5/22 停止 | `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | ✅ **Mac 登録済 (5/25)**、🚧 `member_knowledge` に `status` / `source_hash` 列無し schema gap、🚧 実 DB write 観察中 |
| ⑥ MTG サマリ | `project_meeting_summaries` | ~~GAS 153 (毎時 polling)~~ ⛔ 5/22 停止 | `amd-os-l6-meeting-extract` | 毎時 0 分 | ✅ **Mac 登録済 (5/25)**、🚧 実 DB write 観察中 |
| ⑦ OS 台帳差分 | `project_registry_diffs` | (並行) Codex automation `amd-os-ms` (6h ごと、outbox.registryDiffs) | `amd-os-l7-registry-diff-extract` | 6h ごと | ✅ **Mac 登録済 (5/25)、並行稼働** |
| ⑧ XRL 根拠 | `project_xrl_evidence` | (並行) Codex automation `amd-os-ms` (6h ごと、outbox.xrlEvidence) | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 と 15 分ずらし) | ✅ **Mac 登録済 (5/25)、並行稼働** |
| ⑨ 経営ハイライト | `project_strategy_signals` | (並行) Codex automation `amd-os` (daily 03:20) | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | ✅ **Mac 登録済 (5/25)、並行稼働**。修正依頼ループは対話型 (= `feedback_dialog.md`) と接続予定 |

### ⚠️ 2026-05-26 fact 補足 (= 稼働信頼性)

Mac の Claude Desktop scheduled task は **「app open + 非スリープ中」のみ発火**。MacBook Air がスリープ / 蓋閉じ中だと cron 時刻でも発火しない (= 「次回起動時に追いつき」仕様)。

実際の発火履歴 (5/26 朝時点):
- L3 (毎時 0 分): 5/25 16:01 JST に 1 回発火、それ以降未発火 (スリープ疑い)
- L6 (毎時 0 分、旧 amd-os-meeting-extract): 5/25 03:07 JST に 1 回発火、それ以降未発火
- L2/L4/L5/L7/L8/L9: 未発火 (= cron 時刻のうち多くは Mac スリープ中)

→ **稼働環境を Mac から常時稼働マシンへ移行作業中** (= 2026-05-26 セッション)。候補:
- **(A) Windows MMO PC** (= 常時起動デスクトップ) への移行: SKILL/repo/.env コピー完了、Claude Desktop ログイン済、scheduled task 8 個登録待ち
- **(B) Mac の sleep 完全 OFF**: シンプルだが MacBook Air を常時起動デスクトップ化、運用面の負担
- **(C) Anthropic クラウド routine** (= `RemoteTrigger` API, `/v1/code/triggers`): スリープ無関係、要調査 (β機能 / org UUID 取得問題)

実 fact (= ghost 状態の row、5/26 朝時点):
- `protocols`: 2026-05-22 が最後の created_at
- `project_knowledge`: 2026-05-23 が最後の updated_at (残留分)
- `member_knowledge`: 2026-05-22 が最後の updated_at
- `project_meeting_summaries`: 5/22 以降 created の自動取り込みは事実上ゼロ (= dialogue 手動投入分と manual_eimi のみ)

### 取り込み path 一覧 (= 稼働中 path だけ)

```
✅ ① monthly_reports
   AMD-Report GAS R313_MonthlyReport_Cron (05:00 daily) → Supabase

✅ ③ MS 進捗 (= primary writer)
   [MMO/Codex automation `amd-os-l3-ms-progress-extract`] (= subscription 内 LLM)
     ↓ source_hash 差分検知
   [Supabase] (= `milestone_monthly_progress`, `progress_estimate_state`, `l2_notifications`)

⛔ 旧 fallback
   [GAS 154 `nav_pwa_pingHourlyEstimate`] → [PWA `/api/cron/hourly-estimate`]
   2026-05-29 再停止。`ALLOW_PWA_LLM_CRONS=1` を明示しない限り LLM を呼ばない

✅ ③ MS 進捗レビュー / ⑦ OS 台帳差分 / ⑧ XRL 根拠
   [Codex automation `amd-os-ms`] (= 6h ごと、subscription 内 LLM)
     ↓ outbox JSON
   [~/.codex/automations/amd-os-ms/outbox/]
     ↓ 5 分ごと polling
   [LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier`]
     ↓ pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir
   [Supabase] (= `ms_progress_revisions` / L2 ⑦ / L2 ⑧)

✅ ⑨ 経営ハイライト (= L2 ⑨)
   [Codex automation `amd-os`] (= daily 03:20 JST)
     ↓ outbox JSON
   [~/.codex/automations/amd-os/strategy-signals-outbox/]   ← 監視先修復済 2026-05-25
     ↓ 5 分ごと polling
   [LaunchAgent applier (同上)]
     ↓ apply-outbox-dir --dir <そこ>
   [Supabase] (= L2 ⑨)
```

⛔ **②④⑤⑥ には現状 path 無し**。

→ 全責務分担は **[9-1 章 5.4 責務分担マトリクス](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)** に正本表あり (= 上記マトリクスとの整合チェックは 5.4 を真とする)

→ 復旧計画は **[`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)** (= Claude routine 4 個新設、2026-05-25 採用方針)

→ なぜ 5/22 cron 廃止したかの背景は **[9-1 章 5.1 cron 廃止経緯](9-1-decisions-and-history.md#51-cron-廃止経緯)**

---

## L2 9 種の正本

| L2 # | テーブル | 用途 | 主な入力ソース | 主な writer | 状態 |
|---|---|---|---|---|---|
| ① | `monthly_reports` | PJ 月次レポート | 5 ソース全部 | AMD-Report GAS `R313_MonthlyReport_Cron` (= 別 clasp、05:00 daily) | ✅ 稼働 |
| ② | `protocols` | AMD プロトコル (= 経営判断の構造化記録) | 議事録の二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-protocol-extract` 新設予定 | ⛔ ghost |
| ③ | `milestone_monthly_progress` + 進捗系 | MS 達成度 | 月次報告書 + MTGサマリ + OS snapshot | MMO/Codex automation `amd-os-l3-ms-progress-extract` (= primary writer) + Codex automation `amd-os-ms` (= 6h ごとの修正候補 `outbox.revisions`)。PWA `/api/cron/hourly-estimate` は停止済 fallback | ✅ 稼働 |
| ④ | `project_knowledge` | PJ 知識ナレッジ | `monthly_reports` + 議事録 二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-project-knowledge-extract` 新設予定 | ⛔ ghost |
| ⑤ | `member_knowledge` | メンバー個人のナレッジ | `member_activities` + 議事録 二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-member-knowledge-extract` 新設予定 | ⛔ ghost |
| ⑥ | `project_meeting_summaries` + `meeting_assets` + cockpit TODO + Calendar 作業枠 + Drive 資料 + Gmail draft | MTG サマリ + **MTG 全フロー** (= 2026-05-27 拡張)。Meet/Gmail 議事録に落ちないスクショ・表・画面共有資料は PWA から `meeting_assets` に手動添付し、`narrative_md` に Markdown 画像/リンクとして挿入できる | Calendar + Notion 議事録 + Slack + Drive Docs + Gmail + PWA 添付資料 | ~~GAS 153~~ ⛔ → ✅ **Codex Desktop automation `amd-os-l6-meeting-flow`** (= Windows MMO PC、 平日土日 09:00-21:00 毎時 0 分発火、 gpt-5.5 high reasoning)。議事録抽出だけでなく次 MTG カード生成 / Slack nudge / TODO→cockpit / Calendar 作業枠 (+<PJ> prefix) / 資料即生成 / ファシリ役メール下書きまで自動。dialogue (= 提案前の論点整理セッション) は POST `/api/dialogue-meeting` で稼働。PWA `POST /api/meeting-assets` はアップロード/挿入だけで、従量課金 LLM は呼ばない | ✅ 稼働 (Phase A 早期 exit 付き、 該当 event 0 件なら即終了) |
| ⑦ | `project_registry_diffs` (= 通知 nudge) | OS 台帳差分 | OS snapshot vs 5 ソース | Codex automation `amd-os-ms` (= `outbox.registryDiffs`) | ✅ 稼働 |
| ⑧ | `project_xrl_evidence` | XRL 根拠 | 5 ソース + OS snapshot | Codex automation `amd-os-ms` (= `outbox.xrlEvidence`) | ✅ 稼働 |
| ⑨ | `project_strategy_signals` | **経営ハイライト** | 5 ソース + OS snapshot | Codex automation `amd-os` (= daily 03:20) + dialogue API (= 提案前の論点整理セッション)、applier 監視先修復済 2026-05-25 | ✅ 稼働 (修正依頼ループ未実装) |

**📊 別 L2** (= `member_activities`、メンバー活動ログ): `cron/member-weekly-activities` は Anthropic 経路を持つため 2026-05-29 に Vercel active cron から退避。定期生成する場合は subscription 内 automation 側で実行する。

### L2 ⑥ 予定MTGカード同期

L2 ⑥は、終了済みMTGの議事録抽出とは別に、今日0:00 JSTから60日先までの確定Calendar予定を `POST /api/meeting-prep/calendar-sync` へ渡す。`calendar-sync` は `source_kinds='upcoming'` の予定MTGカードを `project_meeting_summaries` に upsert し、同日中なら開始済み予定もDrive資料・URL補強の対象にする。

PJに `drive_folder_id` がある場合、routine側でDrive root直下と会議日/title token に合う1階層サブフォルダを探し、Docs / Slides / Sheets / PDF / Office files の metadata を `drive_files` として渡す。PWA route はDriveを直接読まず、渡された metadata を `narrative_md` の `関連Drive資料` に載せる。Drive資料は補助根拠であり、資料に書かれているだけで当日決定事項とは扱わない。

→ 仕様詳細は [`pwa/design/L2_DATA.md`](../design/L2_DATA.md) (= 古い writer 記述あり、随時訂正中)。
→ ghost 4 種の復旧計画は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)

---

## 抽出パイプライン

### Codex automation
- 場所: `~/.codex/automations/{name}/automation.toml`
- 主要 automation:
  - **`amd-os-ms`** (= 6h ごと) — MS 進捗の修正候補 / L2 ⑦ OS 台帳差分 / L2 ⑧ XRL 根拠を outbox 書き出し。MS 進捗の primary writer は `amd-os-l3-ms-progress-extract`。PWA `/api/cron/hourly-estimate` は停止済 fallback。L2 ②④⑤⑥ は生成しない (= 2026-05-25 ghost 化の原因、[9-1 章 5.7](9-1-decisions-and-history.md#57-l2-②④⑤⑥-ghost-化と-claude-routine-4-個新設計画--2026-05-25) 参照)
  - **`amd-os`** (= daily 03:20 JST) — L2 ⑨ 経営ハイライト抽出 + outbox 書き出し
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

### Claude routine (= scheduled task)
- 場所: `~/.claude/scheduled-tasks/{name}/SKILL.md`
- 登録: `mcp__scheduled-tasks__create_scheduled_task` (= ローカル時刻で cron 式)
- LaunchAgent と違い、Claude Code app が動いてる時に発火 (= app 閉じてた時は次回起動時に追いつき)
- 主要 routine (= 2026-05-27 時点):
  - ✅ **`amd-os-management-dialogue-prep`** (= daily 07:00 JST、 Mac Local) — 提案前 dialogue の議題プリペア
  - 🚚 **L2 ②④⑤⑥ は Windows MMO PC の Codex Desktop automation に集約済** (= 2026-05-26 移行、 詳細は [8-3 章 L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) § ⑥ MTG サマリ + フロー)
    - `amd-os-l2-protocol` (= daily 08:00) — L2 ② AMD プロトコル抽出
    - `amd-os-l4-project-knowledge` (= daily 08:15) — L2 ④ PJ ナレッジ抽出
    - `amd-os-l5-member-knowledge` (= daily 08:30) — L2 ⑤ メンバーナレッジ抽出
    - `amd-os-l6-meeting-flow` (= **平日土日 09:00-21:00 毎時 0 分**、 Phase A 早期 exit 付き) — L2 ⑥ **MTG 全フロー** (議事録 / 次 MTG カード / Slack nudge / TODO→cockpit / Calendar 作業枠 (+<PJ>) / 資料即生成 / ファシリ役メール下書き)
- 各 routine の prompt は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md) で議論中
- 実装/登録/DB upsert の詳細は **[8-3 章 L2 Extraction Routines](8-3-l2-extraction-routines-spec.md)** を正本にする。2026-05-25 #68 時点では `amd-os-meeting-extract` の SKILL と GAS dryRun は ready、scheduled task 登録待ち。
- **🚨 重要**: routine 内では Codex automation outbox path を経由せず **直接 Supabase REST に upsert** する設計 (= subscription 帯域節約 + 冪等性は source_hash + 通知連携は `l2_notifications` / `meeting_notifications`)

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

### ⚠️ 現状ギャップ (= 2026-05-25 fact 訂正)

**当初の認識** (= 2026-05-24 時点): 「経営ハイライト (= L2 ⑨) だけ修正依頼ループ未実装、他 L2 は GAS 155 / 074 で動いてる」
**実態 (= 2026-05-25 判明)**: **他 L2 (= ②④⑤⑥) も GAS 155 / 153 kill switch で停止しており、修正依頼ループも実は止まってる**。L2 全種で再構築が必要。

| L2 | 修正依頼読込実装 | 現状 |
|---|---|---|
| ② AMD プロトコル | (旧) GAS 155 line 730 で `_l2_loadFeedbackBlock_("protocols", ...)` 実装あり | ⛔ GAS 155 kill switch で動作停止 |
| ④ PJ ナレッジ | (旧) GAS 155 line 523 で同上 | ⛔ 同上 |
| ⑤ メンバーナレッジ | (旧) GAS 155 line 321 で同上 | ⛔ 同上 |
| ⑥ MTG サマリ | (旧) GAS 074 line 1155 で同上 | ⛔ GAS 153 kill switch で動作停止 → GAS 074 helper が呼ばれない |
| ⑨ 経営ハイライト | Codex automation `amd-os` の prompt に未実装 | 抽出は動いてるが修正依頼が反映されない |

### 復旧計画

- **L2 ②④⑤⑥**: 新設 Claude routine 4 個 (= [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)) の prompt に `l2_feedbacks` 読み込み手順を最初から組み込む
- **L2 ⑨ 経営ハイライト**: `amd-os` automation の prompt に `l2_feedbacks` 読み込み手順を追加 (= 別 task)
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
