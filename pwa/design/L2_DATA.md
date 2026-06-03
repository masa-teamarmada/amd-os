# L2 データ ＋ レポート — AMD OS の中核データ正本 ⭐⭐⭐

**最重要**: AMD OS の中核データ。すべての Claude / Codex / GPT セッションは作業前にここを読む。

> **manual / spec / bzm 3層分割中**: L2 ①〜⑯、5 生データ / external evidence / hybrid weekly evidence / management judgment evidence、outbox / LaunchAgent、採否ループの確定仕様は `/spec/3-1-l2-data-extraction-current-spec.md` へ移行開始済み。移行完了までは、この `design/L2_DATA.md` も未移行領域の正本として残し、迷う内容は両方に置く。

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
| **Drive** | 074 (Notion AI 議事録ページの fallback) / **074c (新規)** / L2⑥ future Calendar sync | 🟡 skeleton 稼働。旧074c backfill は folder 直下 scan 中心。L2⑥の予定MTGカード同期は会議日/title token で1階層サブフォルダ + Docs/Slides/Sheets/PDF/Office metadata を拾う | 旧 backfill 側の再帰 scan + 試算表 Excel 抽出 cron 別途 |
| **Calendar** | 074 (event 紐付け) / 153 (event 終了 polling) / **074d (新規)** | 🟡 skeleton 稼働、ただし description 薄い event は chitchat 判定で saved=0 | chitchat 判定緩和 + Notion AI 議事録 page との連結 |
| **Slack** | 074b (threads → meeting summary) / PWA `/api/sources/slack/collect` / `ms_progress_review_tool collect-slack` | ✅ source refs 回収まで復旧。active 5 PJ × 202603-202605 を `source_cache(source='slack')` へ backfill 済み | monthsBack=6 自動化 + Slack source refs から各L2抽出への接続強化 |
| **Notion** | 074 (議事録 DB / AI ページ) | ✅ Phase 4 cron 稼働 | alias resolver 強化 (= `_meeting_resolveProjectIdFromPage_`) |

---

## L1 / L2 の定義 (まさの正本)

```
[ 5 つの社内生データ ]                        [ L1 ]                       [ L2 ]
Gmail / Drive / Calendar / Slack / Notion  →  汎用ピックアップ  →  欲しい情報の形に抽出した正本
```

- **L1** = 5 生データから「あとで使えそうな素材」をピックアップしただけのもの (例: 過去の broad `source_cache` 運用、現在は廃止)
- **L2** = 5 生データから直接「**欲しい情報の形**」で抽出した、AMD OS が中核に持つべきデータ

L1 を経由する構成は廃止された ([progress_estimation.md](progress_estimation.md) の「データフローの現状」参照)。
**現在は 5 生データ → L2 直接抽出**が正本フロー。
ただし `source_cache` は、L1正本ではなく **L2抽出に必要な source refs / short snippet / hash の証跡キャッシュ**として使う。Gmail と Slack は PWA API から同じ形で upsert できる。

---

## 現在のデータフロー (2026-06-03 正本)

```text
trusted raw sources
  internal 5生データ: Gmail / Drive / Calendar / Slack / Notion
  external sources: Atlas / public web / policy / macro observations / VC news
  finance sources: freee / Gmail receipts / payment operations / manual finance inputs
        ↓
抽出・取り込み層
  MMO Codex Desktop automation / subscription automation / PWA non-LLM cron / guarded manual route
        ↓
L2データ
  ① monthly_reports
  ② protocols
  ③ milestone_monthly_progress / ms_progress_revisions
  ④ project_knowledge
  ⑤ member_knowledge
  ⑥ project_meeting_summaries
  ⑦ project_registry_diffs
  ⑧ project_xrl_evidence + project_founding_members
  ⑨ project_strategy_signals
  ⑩ textbook_insight_candidates
  ⑪ atlas_signals / atlas_stories / atlas_reports
  ⑫ observation_log / macro_index_log / macro_lane_weights / triple_helix_state_log
  ⑬ member_activities(source='member_weekly')
  ⑭ company_finance_recurring_items / company_finance_receipt_events
  ⑮ vc_news / vcs / vc_funds / vc_investments
  ⑯ amd_management_monthly_signal_evaluations
        ↓
通知
  l2_notifications / meeting_notifications / app_notifications / finance review / VC inbox
        ↓
review UI
  /notifications / score detail / finance admin / VC inbox / monthly modal
        ↓
反映・学習
  Supabase更新 / l2_feedbacks / tsukuyomi_learnings
```

### Finance L2 正式化 (L2⑭, 2026-06-03)

まさ方針: サブスク領収書や自動振替は、月次試算表の中だけでなく admin の経理オペ台帳として慎重に管理する。

| データ | テーブル | 生データ | 使い道 |
|---|---|---|---|
| 継続支払い / サブスク / 自動振替 | `company_finance_recurring_items` | Gmail / freee / 手入力 / GAS月次PL seed | 月額、発生頻度、引落口座、自動振替、budget forward-fill の管理 |
| 領収書イベント | `company_finance_receipt_events` | Gmail 領収書、添付PDF、freee明細 | confirm後に `company_actual_monthly` へ実績同期し、毎月発生しそうなら予算へ forward-fill |

これは L2⑭ **Finance Ops Evidence** として正式に含める。Management Score の `finance` 軸に入る財務系 L2で、実装時はメール全文や領収書全文を保存せず、source ref / hash / short subject / attachment refs と正規化金額だけを保存する。

### 重要な原則

- GAS シートはバックアップ・人間確認用。正本ではない
- 正本は Supabase
- 5生データから直接 internal L2 に抽出する。汎用 L1 経由に戻さない
- 5生データで有効な現物を拾ったら、通知だけで止めず、短い source refs / snippet として Supabase に戻す。
- **2026-05-31 以降の L2①**: 月次報告書は Supabase 内の既存 L2 (`project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `project_registry_diffs` / `protocols` / `project_knowledge` / `member_knowledge` / MS進捗系) を primary input にする。5生データは、L2 coverage が薄い・stale・source refs 不足・no-data 候補のときの gap check / backfill fallback として見る。
- `projects.start_ym` より前の月でも、キックオフ・提案・契約前調整などPJ形成に意味がある生データがあるなら、月次サマリを作ってよい。MS進捗には直接反映しないが、開始前コンテキストとして `monthly_reports` に残す。
- メール全文・議事録全文・Slack全文を L2 や通知に保存しない
- L2 に保存するのは「AMD OS が使う構造化情報」と「短い根拠 snippet / source refs / hash」
- 差分が出たら必ず対応する review UI へ出して、まさが確認できるようにする。L2①は月末一括の月次断面作成が正本で、日々少しずつ `monthly_reports` を更新する運用には戻さない

### 通知からの反映

| 通知 | はい | いいえ | コメント |
|---|---|---|---|
| ③ MS進捗 | 月次モーダル側の revision confirm を使う | revision discard | `l2_feedbacks` / `tsukuyomi_learnings` |
| ⑦ OS台帳差分 | allowlist 済みの安全な DB 更新を実行 (`project_members`, `projects.report_emails`, `project_partners`) | `project_registry_diffs.status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| ⑧ XRL根拠 | `project_xrl_evidence.status='confirmed'` | `project_xrl_evidence.status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| ⑨ 経営ハイライト | `project_strategy_signals.status='confirmed'` | `project_strategy_signals.status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| ⑩ Textbook Insights | `textbook_insight_candidates.status='approved'`。local applier が承認済み候補だけを `pwa/bzm/*.md` へ追記し、commit/push する | `textbook_insight_candidates.status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| ④ PJナレッジ / ⑤ メンバーナレッジ | `status='active'` | `status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| ② AMDプロトコル | `status='active'` | `status='rejected'` | `l2_feedbacks` / `tsukuyomi_learnings` |
| founding members | `status='active'` | `status='invalid'` | `l2_feedbacks` / `tsukuyomi_learnings` |

`raw_data_gap` はこの表の正本反映ゲートとは別枠。これは「はいを押せば raw source がOSへ取り込まれる候補」ではなく、L2化先・backfill経路・helper/UI 対応が未確定なときの抽出経路確認通知。反映可能な候補を作れる場合、Codex automation は `raw_data_gap` で終えず、上表の具体 kind に寄せる。

### Codex automation outbox 反映

Codex cron sandbox は外向きネットワークが落ちることがあるため、LLM automation は DB/API へ直接書き込まない。

- `AMD OS L2① 月次報告抽出` は `/Users/masa/.codex/automations/amd-os-ms/outbox/*.json` に `monthlyReports` を作る
- `AMD OS L2差分レビュー` は `/Users/masa/.codex/automations/amd-os-ms/outbox/*.json` を作る
- `AMD OS 経営ハイライトレビュー` は `/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/*.json` を作る (= 2026-05-25 applier 監視先も修復済)
- `AMD Atlas外部シグナルレビュー` は `/Users/masa/.codex/automations/amd-atlas/outbox/*.json` を作る
- ローカルの非LLM LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が 5 分ごとに outbox を見て、helper 経由で Supabase/PWA API へ反映する
- 成功した file は `applied/`、失敗した file は `failed/` へ移動する
- この反映ジョブは Node helper だけを動かすので、LLM token は使わない
- `raw_data_gap` 通知は反映ジョブがDB現物を自動投入する合図ではない。outbox 作成時は通知タイトル・summary・`metadata_json.review_note` で「直接反映される候補か、抽出/backfill経路の確認だけか」を明記する。
- L2 ⑨ 経営ハイライトの `automation-prepare` は Supabase / PWA API / snapshot refresh を必須 health とし、GAS health はデフォルトで skip する。GAS はこの outbox 抽出経路の必須依存ではない。GAS も含めた診断が必要なときだけ `health` または `automation-prepare --include-gas-health` を使う。

### PJ凍結/再開履歴

`projects.freeze_from_ym` / `restart_expected_ym` は現在状態の表示用キャッシュ。複数回の凍結/再開履歴は `project_freeze_periods` を正本にする。

- `freeze_from_ym`: この ym から凍結
- `restart_ym`: この ym から再開。NULL の active row は現在凍結中
- `status`: `active` / `closed` / `planned`
- 例: CTB は `202501 → 202604` の閉じた凍結期間と、`202605 → NULL` の現在凍結期間を持つ

---

## L2 データ 16 種 (正本リスト)

| L2 | 意味 | テーブル | cron / 書き込み元 | 場所 | 状態 |
|---|---|---|---|---|---|
| ① **monthly report** | PJ 月次レポート本文 | `monthly_reports` | **Codex / subscription automation `AMD OS L2① 月次報告抽出`** (= 月末最終日、Supabase L2 snapshot primary → `amd-os-ms/outbox.monthlyReports` → LaunchAgent applier)。5 生データ gap check は coverage が薄い時の手動/明示 fallback。PWA manual/backfill route と AMD-Report GAS R313 は手動復旧/旧経路 | `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md` + `pwa/scripts/ms_progress_review_tool.mjs` | ✅ 月末の月次断面作成が正式対象。R313 trigger は置かない |
| ② **AMDプロトコル** ⭐ | 経営判断の構造化記録 (分岐点 / 判断材料 / アクション / 結果)。結果はアクション後に実際に起きたことを後追いで入れる欄で、自動抽出では空欄。**AMD の最重要知財** ([amd_os_vision.md](../../../knowledge/amd_os_vision.md)) | `protocols` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **daily consolidated evidence `amd-os-l2-consolidated-evidence`** | `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` + PWA `AdminProtocolsClient.tsx` | ✅ consolidated routine 対象。旧個別automationは履歴扱い |
| ③ **MS進捗** | DTSU PJ / エコシステム構築PJのマイルストーン進捗%。advisorなど非MS管理PJはMS進捗を抽出せず、月次モーダルの月次ノートに毎月の進捗を残す | `milestone_monthly_progress` / `project_monthly_notes` | **MMO/Codex automation** `amd-os-l3-ms-progress-extract`。旧 本体GAS 毎時 trigger (`nav_pwa_pingHourlyEstimate` / 154) → PWA `cron/hourly-estimate` は 2026-05-29 に再停止。PWA route は `ALLOW_PWA_LLM_CRONS=1` を明示しない限り disabled response のみ返す | `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` + PWA `lib/progress-estimator.ts` (ロジック正本/fallback) | ✅ **定期抽出は MMOマシン Codex Desktop automation**。PWA/GAS background LLM cron は停止 |
| ④ **PJナレッジ** | PJ にまつわる事実・人物・組織・進行中事項 | `project_knowledge` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **daily consolidated evidence `amd-os-l2-consolidated-evidence`** | `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` | ✅ consolidated routine 対象 |
| ⑤ **メンバーナレッジ** | メンバーごとの強み・スキル・関心 | `member_knowledge` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **daily consolidated evidence `amd-os-l2-consolidated-evidence`** | `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` | ✅ consolidated routine 対象。`status` / `source_hash` / `last_processed_at` は migration 091 + `db_schema.md` に反映済み |
| ⑥ **MTGサマリ** | calendar event 1 回ごとの decided/progress/nextActions/risks (PK = calendar event id)。開催前/当日の準備ブリーフは `source_kinds='upcoming'` で同じ欄に出す。未来/同日Calendar予定同期では、`today 00:00 JST` から60日先までの確定予定をカード化し、PJ Drive folder の会議日サブフォルダ・議案資料・予実表・招集通知を `関連Drive資料` として載せる。ただし weekly recurring MTG は series ごとに次回1件だけ同期・表示し、それ以降の future occurrence は非表示/skip にする。画面共有・表・スライドなど自動メールに落ちない素材は `meeting_assets` + private Storage `meeting-assets` に添付し、`narrative_md` へ Markdown 画像/リンクとして挿入できる。 | `project_meeting_summaries` + `meeting_assets` | ~~Phase 3 = GAS 153 毎時 polling~~ ⛔ **2026-05-22 停止** → ✅ **Codex Desktop automation `amd-os-l6-meeting-flow` / repo正本 `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`**。議事録抽出は過去60-180分終了events、予定MTGカードは `POST /api/meeting-prep/calendar-sync`、手動/仮置き予定MTG準備は `POST /api/meeting-prep`。`calendar-sync` は `drive_files` metadata と recurring metadata を受け取り、Driveを読みに行かずに予定カードへ反映する。MTG添付は PWA `POST /api/meeting-assets` で admin 手動保存し、LLM 抽出は routine 側の入力に寄せる。設計 [meeting_summaries.md](meeting_summaries.md)、マニュアル [8-3章](../manual/8-3-l2-extraction-routines-spec.md) | (旧) 本体GAS `152_NavigatorCron.js` + `153_MeetingHourlyTrigger.js` + `074_MeetingSummaryRepo.js`。iOS APNs 通知用 `meeting_notifications` テーブル (PK=meeting_id) は新 routine も維持予定 | ✅ 稼働。2026-05-27 に KUTE/CLG の予定カード生成境界と CLG取締役会Drive資料同期を本番検証済み。2026-05-29 に weekly recurring 予定MTGは次回1件だけ表示する guard を追加 |
| ⑦ **OS台帳差分** | 5生データとOS構造データの差分。PJメンバー候補、関係先メール、担当者、契約/期間/スコープ、請求/ステータスなど「OSに反映する?」が必要な候補 | `project_registry_diffs` + `l2_notifications(l2_kind='project_registry_diff')` | daily consolidated evidence `amd-os-l2-consolidated-evidence` + SKILL `amd-os-l7-registry-diff-extract` → `outbox.registryDiffs` → non-LLM applier | Codex automation + LaunchAgent | ✅ consolidated routine 対象。詳細 [project_registry_diffs.md](project_registry_diffs.md) |
| ⑧ **XRLチェックリスト監査** | AMD Score / XRL 算定に使う成熟度監査。月末に L2① 月次報告書と Supabase 内L2断面を見て、`pwa/src/lib/xrl-level-definitions.ts` の TRL/BRL/GRL/SRL/HRL チェック項目が充足されたかを判定する。`project_founding_members` は HRL 評価のベース = **関連メンバー** リストで、`category in ('amd','startup','university')` を HRL 算入対象にする。`project_xrl_evidence` は通常daily出力ではなく、強いイベント根拠・過去confirmed根拠の例外ログとして残す | `amd_score_inputs.xrl_checklist`, `amd_score_inputs.xrl_notes`, `project_founding_members`, `project_xrl_evidence` | L2① 月次報告書作成直後の月末 XRL checklist audit。更新は候補化し、まさ確認後に `amd_score_inputs.xrl_checklist` へ反映 | Codex / subscription automation + review | ✅ daily抽出から除外。XRLは月次・年次で動く成熟度指標として月末監査に寄せる。詳細 [xrl_evidence.md](xrl_evidence.md) / [amd_score.md](amd_score.md) |
| ⑨ **経営ハイライト** | MS進捗より上位の、経営上の重要方針・事業上の進捗・戦略転換・提携・資金・知財/規制・重要リスク・次の一手。PJ cockpit のMSリスト直下に表示する | `project_strategy_signals` + `l2_notifications(l2_kind='project_strategy_signal')` | daily consolidated evidence `amd-os-l2-consolidated-evidence` → strategy-signals outbox → non-LLM applier。初期backfillは `scripts/backfill_strategy_signals_from_activities.mjs` → `ms_progress_review_tool.mjs apply-outbox` | Codex automation / PWA | ✅ consolidated routine 対象。2026-05-23に既存 `member_activities` から40件backfill済み。詳細 [project_strategy_signals.md](project_strategy_signals.md) |
| ⑩ **Textbook Insights** | Before Zero / BZM 教科書に追記すべき実務知見。最重要は Before Zero PJ推進のノウハウ・経営判断、次点でPJ横断傾向、ケーススタディ、既存理論の裏付け。承認前は候補DBだけに保存し、承認後も本番runtimeからgitを直接編集しない | `textbook_insight_candidates` + `l2_notifications(l2_kind='textbook_insight')` | daily consolidated evidence `amd-os-l2-consolidated-evidence` → `outbox.textbookInsights` → non-LLM applier が candidate + notification 作成 → `/notifications` yes で approved → `apply_approved_textbook_insights.mjs` が `pwa/bzm/*.md` へ追記 | Codex automation / local BZM applier | 🟡 candidate generation は consolidated routine 対象。approved 後の BZM 追記は local applier + git commit/push のみ |
| ⑪ **Atlas Signals** | 外部ニュース / 政策 / 市場 / 技術シグナルを、AMD の戦略判断・Atlas story/report・macro interpretation に使える粒度で保持する外部観測 L2。Signal collection を正本 evidence とし、daily/weekly/monthly report は派生レポート扱いにする | `atlas_signals`, 派生 `atlas_stories`, `atlas_reports` | daily consolidated evidence `amd-os-l2-consolidated-evidence` または Atlas signal collection automation → `amd-atlas/outbox` → non-LLM applier / ingest。PWA LLM cron は復活させない | Codex / subscription automation + Atlas outbox/applier | 🟡 expanded taxonomy 採用。signal collection 優先、report prose は後段派生 |
| ⑫ **Macrotrend Evidence / Index** | 研究費・公募・VC投資・政策言及・Atlas signal count 等を lane / month 単位で扱う外部+決定的集計 L2。Atlas narrative signal とは分け、ASPI / Venture Map / score 解釈の根拠にする | `observation_log`, `macro_index_log`, 派生 `macro_lane_weights`, `triple_helix_state_log` | daily consolidated evidence `amd-os-l2-consolidated-evidence` で evidence freshness / interpretation を確認。`cron/macro-aggregate-indicators` は非LLM deterministic aggregate として可。LLM interpretation cron は復活させない | Codex / subscription automation + PWA non-LLM aggregate | 🟡 expanded taxonomy 採用。`observation_log` / `atlas_signals` → `macro_index_log` の境界を維持 |
| ⑬ **Member Weekly Activities** | メンバー単位の週次活動 evidence。`source='member_weekly'` を primary とし、`source='inferred'` は lower-confidence fallback として扱う。mypage / reward / L2⑤ / MS contribution review に接続する | `member_activities(source='member_weekly')` | 週次 subscription automation 候補 → outbox/applier。`/api/cron/member-weekly-activities` は Anthropic 経路を持つため active PWA/Vercel cron に戻さない | Codex / subscription automation + review | 🟡 expanded taxonomy 採用、別weekly候補。raw Gmail / private Calendar 本文は保存しない |
| ⑭ **Finance Ops Evidence** | サブスク・継続費・自動振替・領収書イベントなど、会社財務オペレーションの根拠。月次PLやManagement Score finance軸に使うが、領収書本文や明細全文は保存しない | `company_finance_recurring_items`, `company_finance_receipt_events`, 派生 `company_actual_monthly`, `company_budget_monthly` | freee/payment PWA non-LLM cron、Gmail receipt source refs、admin manual review。LLMが必要な分類は subscription automation / guarded manual route に寄せる | PWA non-LLM + admin review + optional Codex automation | ✅ 正式L2化。Finance候補から昇格 |
| ⑮ **VC News / Funding Signals** | VCニュース、ファンド組成、投資活動、dry powder、資金調達に関わる外部シグナル。VC inboxで確認し、VCリスト・fund情報・PJ fundraising判断に接続する | `vc_news`, `vcs`, `vc_funds`, `vc_investments`, `project_vc_relations` | Codex subscription automation `amd-os-l2-vc-news-funding-signals` → review/outbox → VC inbox。PWA `/api/cron/vc-discover` は LLM/web_search 経路なので active Vercel cron には戻さない | Codex / subscription automation + VC inbox review | ✅ 新L2として復活。PWA LLM cronではなくsubscription automationで週次収集 |
| ⑯ **Management Monthly Signal Evaluation** | `/management-score` 月次試算表下に出す、月末時点の会社経営状態評価。予実表の数字を再掲せず、状態アイコン・短い評価文・判断理由・次に見るべきことへ変換する | 候補: `amd_management_monthly_signal_evaluations`。入力候補は `amd_management_score_snapshots`, `amd_management_score_evidence`, `company_budget_actual_monthly`, `company_budget_variance_notes`, L2⑨⑭⑮ など | 月末最終日 17:00 JST の Codex / subscription automation候補。L2抽出・保存・更新設計が固まるまで、PWA route / DB write / migration / UI本実装は進めない | Codex / subscription automation + management review | 🟡 design-only。現 `/management-score` の経営シグナル評価欄は暫定UI |

**重要**: 2026-06-03 以降の L2 は、①〜⑩の internal OS evidence に加えて、⑪ Atlas Signals / ⑫ Macrotrend Evidence / ⑬ Member Weekly Activities / ⑭ Finance Ops Evidence / ⑮ VC News / ⑯ Management Monthly Signal Evaluation を含む 16 種。⑪⑫⑮は external provenance、⑬は internal hybrid provenance、⑭は finance operations provenance、⑯は management judgment provenance と明示し、5 生データ由来の L2 と混同しない。

**通知反映ルール (2026-05-25 #68 current truth)**: 通知に出る情報は、通知画面で「はい」を押したものだけが正本反映される。
`project_knowledge` は `status='candidate'` → yes で `active`、no で `rejected`。`protocols` は `candidate` → yes で `confirmed`、no で `rejected`、archive は `archived`。`member_knowledge` は migration 091 以降 `status='candidate' -> active / rejected / archived` と `source_hash` を持てる。`project_registry_diff` は候補状態から「はい」で apply する。`project_xrl_evidence` は例外的な根拠ログとして残す場合のみ `candidate -> confirmed/rejected` を使い、通常のL2⑧は月末 checklist audit の確認後に `amd_score_inputs.xrl_checklist` / `xrl_notes` を更新する。

---

## レポート関連 (L2 evidence の派生 or 未昇格の外部ソース)

| レポート | テーブル | cron | 場所 |
|---|---|---|---|
| **Atlas 日次** | `atlas_stories` 等 | L2⑪ `atlas_signals` から派生。`cron/atlas-daily` は PWA LLM cron としては復活させない | PWA / manual synthesis |
| **Atlas 週次** | 同上 | L2⑪ `atlas_signals` から派生。`cron/atlas-weekly` は PWA LLM cron としては復活させない | PWA / manual synthesis |
| **Atlas 月次** | 同上 | L2⑪ `atlas_signals` から派生。`cron/atlas-monthly` は PWA LLM cron としては復活させない | PWA / manual synthesis |
| **Atlas マクロ収集** | `atlas_signals`, `macro_index_log` | L2⑪/⑫ evidence collection。Codex automation `AMD Atlas外部シグナルレビュー` / `amd-os-l2-consolidated-evidence` 側に寄せる。旧 `cron/atlas-collect` は課金回避のため停止済み | Codex automation + PWA ingest |
| **Atlas 政策シグナル** | `atlas_policy_signals` | `cron/atlas-collect-policy` (07:00 daily) | PWA |
| **Atlas divergence** | テーマ単位 | `cron/atlas-divergence` (sun 06:00) | PWA |
| **macro lane weights 再学習** | macro index 関連 | `cron/relearn-lane-weights` (03:30 daily) | PWA |
| **macro バックフィル** | `macro_index_log` (過去) | `cron/macro-backfill-historical` (sun 12:00) | PWA |
| **VC ニュース派生ビュー** | `vc_news` | L2⑮ `VC News / Funding Signals` から派生。PWA `cron/vc-discover` は LLM/web_search 経路のため active Vercel cron には戻さない | VC inbox / PWA |
| **PJ 沿革リフレッシュ** | `project_ventures.narrative_text` | `cron/venture-narrative-refresh` (03:45 daily) | PWA |
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
| ~~毎時 0 分~~ ⛔ | ~~`nav_meeting_pollRecentlyEndedEvents`~~ | ~~MTGサマリ Phase 3 毎時 polling~~ → ⛔ **2026-05-22 停止** | 本体GAS 153 (kill switch) |
| ~~03:00~~ ⛔ | ~~`nav_cronMonthlyExtractAt3`~~ | ~~MTGサマリ Phase 2 月単位 fallback~~ → ⛔ **2026-05-22 停止** | 本体GAS 152 (kill switch) |
| ~~毎時 0 分~~ ⛔ | ~~`nav_pwa_pingHourlyEstimate` → `cron/hourly-estimate`~~ | ~~MS進捗推定 (L2 ③, GAS trigger → PWA route)~~ → ⛔ **2026-05-29 再停止**。定期抽出は `amd-os-l3-ms-progress-extract` | 旧 本体GAS (154) + PWA |
| ~~毎時~~ ⛔ | ~~`nav_member_knowledge_pollAll`~~ | ~~メンバーナレッジ抽出 (L2 ⑤)~~ → ⛔ **2026-05-22 停止** | 本体GAS 155 (kill switch) |
| ~~毎時~~ ⛔ | ~~`nav_project_knowledge_pollAll`~~ | ~~PJナレッジ抽出 (L2 ④)~~ → ⛔ **2026-05-22 停止** | 本体GAS 155 (kill switch) |
| ~~毎時~~ ⛔ | ~~`nav_protocol_pollAll`~~ | ~~AMDプロトコル抽出 (L2 ②)~~ → ⛔ **2026-05-22 停止** | 本体GAS 155 (kill switch) |
| **月末最終日** | `AMD OS L2① 月次報告抽出` (= Codex / subscription automation、repo正本 `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`) | **L2 ① monthly_reports**。Supabase 内L2断面から active / sales PJ の月次 draft を作り、`amd-os-ms/outbox.monthlyReports` 経由で非LLM applier が Supabase に反映。R313 / PWA heavy route は定期実行しない | Codex automation + LaunchAgent |
| **月末 L2① 後** | `L2⑧ XRL checklist audit` | **L2 ⑧ XRLチェックリスト監査**。月次報告書 + Supabase 内L2断面を `xrl-level-definitions.ts` のチェック項目に照合し、`amd_score_inputs.xrl_checklist` / `xrl_notes` 更新候補を作る | Codex / subscription automation + review |
| **毎日 09:00-21:00 毎時** | `amd-os-l6-meeting-flow` (= Windows MMO Codex Desktop automation、repo正本 `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`) | **L2 ⑥ MTG サマリ + MTGフロー**。過去60-180分終了eventsの議事録抽出、今日0:00 JSTから60日先の確定Calendar予定カード同期 (weekly recurring は series ごとに次回1件のみ)、Drive関連資料 metadata 反映、次MTGカード / Slack nudge / TODO→cockpit / Calendar作業枠 / 資料即生成 / Gmail draft | Windows MMO PC Codex Desktop + PWA `calendar-sync` / `meeting-prep` |
| **08:00 daily** | `amd-os-l2-protocol-extract` (= MMOマシン Codex Desktop automation) | **L2 ② AMD プロトコル抽出** (= GAS 155 後継) | Windows MMO PC Codex Desktop + `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` |
| **08:15 daily** | `amd-os-l4-project-knowledge-extract` (= MMOマシン Codex Desktop automation) | **L2 ④ PJ ナレッジ抽出** (= GAS 155 後継) | Windows MMO PC Codex Desktop + `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` |
| **08:30 daily** | `amd-os-l5-member-knowledge-extract` (= MMOマシン Codex Desktop automation) | **L2 ⑤ メンバーナレッジ抽出** (= GAS 155 後継) | Windows MMO PC Codex Desktop + `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` |
| 07:00 daily | `amd-os-management-dialogue-prep` (= Claude routine) | 提案前の論点整理セッション 議題プリペア | `~/.claude/scheduled-tasks/amd-os-management-dialogue-prep/` |
| **03:05** | `cron/payout-reward-cache-refresh` | `/admin/payouts` 高速表示用の `billing_cycles.reward_summary_json` を前月・当月・翌月の支払月で再生成。LLM/GAS非使用 | PWA |
| ~~03:15~~ ⛔ | `cron/venture-xrl-refresh` | XRL根拠 / PJ XRL llm_proposal (L2 ⑧)。Gemini 利用のため schedule 停止中、route は手動検証用に残す | PWA |
| ~~03:30~~ ⛔ | `cron/relearn-lane-weights` | macro lane weights 再学習。Sonnet 利用のため schedule 停止中 | PWA |
| ~~03:45~~ ⛔ | `cron/venture-narrative-refresh` | PJ 沿革再生成。LLM 利用のため schedule 停止中 | PWA |
| ~~04:00~~ ⛔ | `cron/member-activities` | member_activities 推論。LLM 利用のため schedule 停止中 | PWA |
| ~~05:00~~ | `R313_MonthlyReport_Cron` | monthly_reports 生成 (L2 ①) の旧日次 route。R313 現物は Claude API 経路を持つため、trigger 有効化前に課金意図を確認 | AMD-Report GAS。2026-05-29 実画面確認では `run_monthlyReportCron` / `run_L2CronDaily` trigger なし |
| **05:30** | `313_MsProgressSummary_Cron` | DB_BillingCycle.msProgressSummaryJson 更新 | 本体GAS |
| **06:00** | `cron/atlas-daily` | atlas 日次レポート | PWA |
| **07:00** | `cron/atlas-collect-policy` | 政府方針シグナル | PWA |
| **08:00** | `cron/atlas-collect` | **停止済み**。旧マクロニュース収集 | PWA |
| **08:10** | Codex automation `AMD Atlas外部シグナルレビュー` | subscription 枠で外部マクロシグナル収集 → outbox → ローカル非LLM applier → `/api/atlas/signals-ingest` に投入 | Codex automation + PWA |
| ~~18:00 daily~~ ⛔ | ~~`cron/member-weekly-activities`~~ | Anthropic 経路を持つため 2026-05-29 に Vercel active cron から退避。定期化する場合は subscription automation 側 | 旧 PWA |
| **土 09:00** | `amd-os-l2-vc-news-funding-signals` | **L2⑮ VC News / Funding Signals**。VCニュース・ファンド組成・投資活動を subscription/Codex automation で収集し、VC inbox / review outbox に出す。旧 PWA `cron/vc-discover` は LLM/web_search 経路のため active Vercel cron には戻さない | Codex automation |
| **月末最終日 17:00** | `amd-os-l16-management-monthly-signal-evaluation` candidate | **L2⑯ Management Monthly Signal Evaluation**。`/management-score` 月次試算表下の経営評価文を、数字再掲ではなく状態アイコン・1行評価・判断理由・次に見ることへ変換する設計候補。L2抽出設計が固まるまでは、route / DB write / UI本実装なし | Codex / subscription automation candidate + management review |
| ~~mon 03:00~~ ⛔ | `cron/amd-score-l2-refresh` | AMD Score / XRL根拠リフレッシュ (L2 ⑧)。Sonnet 利用のため schedule 停止中、route は手動検証用に残す | PWA |
| ~~月初 03:00 (1日 18:00 UTC)~~ ⛔ | `cron/frl-grit-resilience-extract` | ecosystemを除くactive PJ × 過去 3 ヶ月 monthly_reports + meeting_summaries 集約 → Sonnet 4.6 で frl_grit (Duckworth 2007) / frl_resilience (Markman 2005) を 0-9 推定 → 既存amd_score_inputsをupdate。prompt = `llm_prompts.frl.grit_resilience.extract` (v2、外部創業者優先 / null 厳格化)。Sonnet 利用のため schedule 停止中、手動 route は残す | PWA |
| **月初 04:00 JST (UTC 1日 19:00)** | `cron/macro-aggregate-indicators` | **稼働中のPWA non-LLM cron**。observation_log (kaken/grant → budget_amount, vc/vc_investment → investment_amount) + atlas_signals (ATL domain → ASPI lane mapping → policy_mention_count / raw_signal_count) を lane × month で集計 → `macro_index_log` の P 以外列を update。AMD Score はこの `macro_index_log` を読む。?since=YYYY-MM 指定可、デフォルト過去 36 ヶ月 | PWA |
| **on-demand / weekly candidate** | `cron/triple-helix-recompute` | BVAR Kalman smoother で μ_A/I/G 推定 (Phase 3)。Vercel cron 未登録、手動棚卸し job | PWA |
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

## 🚨 L2 ①〜⑯ subscription automation / Codex automation 統一 (= 2026-06-03 正本訂正)

**📜 経緯** (= 3 段階の方針進化):
1. **2026-05-22**: 「LLM 課金が発生する定期抽出 cron 全廃止」判断 → GAS 153/155/152 kill switch → L2 ②④⑤⑥ ghost 化
2. **2026-05-25 #71**: 「すべて claude routines で抽出する形に変更」確定、L2 ②〜⑨ 全 8 個を Claude routine 統一の方針確定、Mac の `~/.claude/scheduled-tasks/` (= Local routine) で 8 個 SKILL 作成
3. **2026-05-26**: Mac Local routine は **「app open + 非スリープ中のみ発火」** で MacBook Air 運用と相性悪い問題判明 → **claude.ai/code/routines (= Cloud / Remote routine、Anthropic-managed cloud infrastructure 上で実行)** に一本化、8 個全部 entry 完了
4. **2026-05-29**: L2 ① `monthly_reports` も正式対象に訂正。Codex automation `AMD OS L2① 月次報告抽出` が draft を作り、`amd-os-ms/outbox.monthlyReports` 経由で非LLM applier が反映する。R313 は旧有料API経路で trigger 復活しない。2026-05-31 以降は Supabase L2 snapshot primary + 5生データ gap check fallback。
5. **2026-05-29 正本整理**: 人間が復旧できる粒度にするため、現行表は **実行場所 / automation / 課金ルート / 復旧時に見る場所** を優先する。Claude routine / Local routine の旧 ID は履歴であり、現行復旧先として読まない。
6. **2026-06-03**: L2⑯ Management Monthly Signal Evaluation を追加。`/management-score` の月次試算表下に出す月末経営評価で、数字の再掲ではなく、状態アイコン・1行評価・判断理由・次に見ることを出す。これは design-only の L2 抽出設計であり、source of truth table / payload / source refs / 更新責務が固まるまで、migration / API route / DB write / UI本実装 / active cron登録は進めない。

| L2 | 旧 writer (停止/移管対象) | 現行 writer (= 実行場所 + automation) | cron | 状態 |
|---|---|---|---|---|
| ① monthly_reports | AMD-Report GAS R313 / PWA heavy route | Codex / subscription automation `AMD OS L2① 月次報告抽出` → `amd-os-ms/outbox.monthlyReports` → LaunchAgent | 月末最終日 | ✅ SKILL 正本追加済。Supabase L2-first、5生データは明示 fallback。R313 trigger は置かない |
| ② AMD プロトコル | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | daily consolidated evidence `amd-os-l2-consolidated-evidence` | daily 08:00 JST | ✅ consolidated routine 対象 |
| ③ MS 進捗 | ~~PWA `/api/cron/hourly-estimate` + GAS 154~~ ⛔ 2026-05-29 再停止 + Codex `amd-os-ms` review | MMOマシン automation `amd-os-l3-ms-progress-extract` | 毎時 0 分 | ✅ 定期抽出 primary。PWA/GAS background LLM cron は disabled |
| ④ PJ ナレッジ | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | daily consolidated evidence `amd-os-l2-consolidated-evidence` | daily 08:00 JST | ✅ consolidated routine 対象 |
| ⑤ メンバーナレッジ | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | daily consolidated evidence `amd-os-l2-consolidated-evidence` | daily 08:00 JST | ✅ consolidated routine 対象。migration 091 の status/source_hash 前提 |
| ⑥ MTG サマリ + フロー | ~~GAS 153~~ ⛔ + 旧 Local/Cloud routine | Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow` | 毎日 09:00-21:00 毎時 + Phase A 早期 exit | ✅ 2026-05-27 拡張完了 |
| ⑦ OS 台帳差分 | 旧 Cloud routine 案 / PWA LLM route | daily consolidated evidence `amd-os-l2-consolidated-evidence` + SKILL `amd-os-l7-registry-diff-extract` → `outbox.registryDiffs` → LaunchAgent | daily 08:00 JST | ✅ consolidated routine 対象 |
| ⑧ XRLチェックリスト監査 | 旧 Cloud routine 案 / PWA LLM route / 旧 daily `outbox.xrlEvidence` 案 | L2① 月次報告書作成直後の checklist audit。`xrl-level-definitions.ts` の項目を月次証拠で確認し、`amd_score_inputs.xrl_checklist` / `xrl_notes` 更新候補を作る | 月末 L2① 後 | ✅ daily抽出から除外。`project_xrl_evidence` は例外ログ・過去confirmed根拠として保持 |
| ⑨ 経営ハイライト | 旧 Cloud routine 案 | daily consolidated evidence `amd-os-l2-consolidated-evidence` → strategy-signals outbox → LaunchAgent | daily 08:00 JST | ✅ consolidated routine 対象。修正依頼ループは対話型と接続予定 |
| ⑩ Textbook Insights | 新規 | daily consolidated evidence `amd-os-l2-consolidated-evidence` → `outbox.textbookInsights` → candidate + notification → approved → local BZM applier | daily 08:00 JST / candidate generation | 🟡 candidate生成はconsolidated routine対象。Vercel runtime から git 追記しない |
| ⑪ Atlas Signals | 旧 Atlas report / collect cron 群 | daily consolidated evidence `amd-os-l2-consolidated-evidence` または Atlas signal collection automation → `amd-atlas/outbox` → ingest/applier。report は派生 | daily 08:00 JST evidence review / collection | 🟡 expanded taxonomy 対象。PWA LLM cron は復活させない |
| ⑫ Macrotrend Evidence / Index | 旧 macro / ASPI cron 群 | daily consolidated evidence `amd-os-l2-consolidated-evidence` + PWA non-LLM aggregate `cron/macro-aggregate-indicators` | daily evidence review / monthly aggregate | 🟡 expanded taxonomy 対象。LLM interpretation cron は復活させない |
| ⑬ Member Weekly Activities | 旧 PWA `/api/cron/member-weekly-activities` | separate weekly subscription automation candidate → outbox/applier。PWA route は manual/guarded only | weekly candidate | 🟡 expanded taxonomy 対象。daily bundle には入れない |
| ⑭ Finance Ops Evidence | 旧 Finance L2 拡張候補 | freee/payment PWA non-LLM cron + admin finance review + optional subscription automation | daily / monthly finance ops | ✅ 正式L2化。領収書本文は保存しない |
| ⑮ VC News / Funding Signals | 旧 PWA `cron/vc-discover` | Codex subscription automation `amd-os-l2-vc-news-funding-signals` → VC inbox / review outbox。PWA route は manual/guarded only | weekly Sat 09:00 JST | ✅ 新L2として復活。PWA LLM cronは復活させない |
| ⑯ Management Monthly Signal Evaluation | 現 `/management-score` UI の暫定自動抽出文 | Codex / subscription automation candidate。数字を再掲せず、経営状態の評価文へ変換する L2 設計を先に固める。PWA route / DB write / migration / UI本実装は未実装 | 毎月末日 17:00 JST 候補 | 🟡 design-only。暫定UIは期待とズレているため、L2設計確定後に直す |

**SKILL 正本**: [`pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`](../scheduled-tasks/) (= repo 入り、MMO/Codex/automation が読む)
**マニュアル正本**: [8-3 章 L2 Extraction Routines](../manual/8-3-l2-extraction-routines-spec.md)
**詳細経緯**: [`pwa/design_log/sessions_2026-05.md`](../design_log/) の 2026-05-26 セクション
**管理場所**: daily consolidated evidence (`amd-os-l2-consolidated-evidence`) は L2②④⑤⑦⑨⑩⑪⑫、①は月末 monthlyReports outbox/applier、⑧は月末 L2① 後の checklist audit 結果、③⑥は MMOマシン側 Codex Desktop automation 履歴、⑬は別 weekly subscription automation 候補、⑭は finance non-LLM cron / admin review、⑮は `amd-os-l2-vc-news-funding-signals`、⑯は月末17:00のManagement評価automation候補。⑩ の `pwa/bzm` 追記は approved 後の local BZM applier と git commit/push が別段階。古い claude.ai trigger ID は履歴確認用で、復旧の主導線ではない。

**経営ハイライト修正依頼 (= L2 ⑨ + #34)**: 一方通行 update を廃止、**対話型ループ** (= `/api/notifications/feedback/dialog/start|refine|confirm` + CockpitStrategySignals UI 拡張) に置換 2026-05-25 #71。設計議論は [`feedback_dialog.md`](feedback_dialog.md)。

---

## L2 で「実装中」のもの

| L2 | 現状 | 対応予定 |
|---|---|---|
| ⑦ OS台帳差分 | DB・通知・採否UIは本番反映済。KUTE Gmail で差分通知の手動実証中 | オートメーション抽出器を汎用化し、5生データすべてから `project_registry_diffs` を作る |
| ⑧ XRLチェックリスト監査 | `project_founding_members` は稼働済。`xrl-level-definitions.ts` と `amd_score_inputs.xrl_checklist` によるUIチェックリストは実装済。旧 `project_xrl_evidence` 受け皿は本番反映済 | 月末 L2① 後に monthly report + Supabase 内L2断面でチェック項目充足を確認し、`amd_score_inputs.xrl_checklist` / `xrl_notes` 更新候補へ接続 |
| ⑩ Textbook Insights | DB・通知採否・outbox・local BZM applier の最小導線は追加 | 実 schedule 登録、approved 候補を commit/push する運用、章選定のレビュー基準を詰める |
| ⑪ Atlas Signals | `atlas_signals` / Atlas outbox / ingest 導線は既存。ただし L2 正式番号としての表記は 2026-06-03 に採用 | consolidated evidence か Atlas collection automation のどちらを primary writer にするか、実automation prompt と履歴表示を合わせる |
| ⑫ Macrotrend Evidence / Index | `observation_log` / `macro_index_log` / `cron/macro-aggregate-indicators` は既存。LLM macro cron は停止方針 | deterministic aggregate と LLM interpretation の境界を operations catalog / runbook に反映 |
| ⑬ Member Weekly Activities | `member_activities(source='member_weekly')` の PWA route は実装済だが、Anthropic 経路のため active cron から退避済み | separate weekly subscription automation + outbox contract を作る |
| ⑭ Finance Ops Evidence | `company_finance_recurring_items` / `company_finance_receipt_events` は既存。freee/payment cron は non-LLM で稼働中 | source ref / hash / short subject だけを保存するreview運用を詰める |
| ⑮ VC News / Funding Signals | `vc_news` / VC inbox は既存。旧 PWA `vc-discover` は停止中 | subscription/Codex automation `amd-os-l2-vc-news-funding-signals` を primary writer とし、VC inbox reviewへ接続 |
| ⑯ Management Monthly Signal Evaluation | `/management-score` の月次試算表下の暫定UIはあるが、最終形ではない。L2⑯としての source of truth / payload / source refs / 更新責務を設計中 | 設計確定後に migration / DB write / UI文言 / status icon / 過去ログ表示 / 月末17:00 automation を本実装 |

## L2 候補

現時点で実装/運用候補が残る L2 は、⑩ Textbook Insights、⑪ Atlas Signals、⑫ Macrotrend Evidence / Index、⑬ Member Weekly Activities、⑭ Finance Ops Evidence、⑮ VC News / Funding Signals、⑯ Management Monthly Signal Evaluation。⑩はDB/API/outbox/local applier の最小実装済みだが、実 schedule と BZM 追記レビュー運用は partial。⑪⑫は daily consolidated evidence 対象、⑬⑮は privacy / source cadence が違うため別 weekly 候補、⑭は finance non-LLM cron + admin review を primary にする。⑯は design-only で、L2抽出・保存・更新設計が固まるまで実装しない。

`project_founding_members` は候補から正式昇格し、⑧ **XRL根拠** の HRL 根拠として扱う。関連メンバー単体を独立 L2 とするのではなく、TRL / BRL / GRL / SRL / HRL の算定根拠を束ねる L2 として運用する。

---

## 関連 md (詳細仕様への入口)

- ① monthly report の生成詳細 → [`pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`](../scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md)。AMD-Report GAS の R313 系は旧経路 (このリポにはソース無し、別 clasp)。R313 は LLM 不使用ではなく、未生成/差分あり時に R303 generator 経由で Claude API を呼びうるため、定期 trigger は復活させない。
- ② AMDプロトコルの設計思想 → [`knowledge/amd_os_vision.md`](../../../knowledge/amd_os_vision.md) の「AMDプロトコルの 4 要素」
- ③ MS進捗推定 → [`ms_progress.md`](ms_progress.md) ⭐ (Phase 4 正本) / 旧経緯は [`progress_estimation.md`](progress_estimation.md)
- ④ PJナレッジ → [`project_knowledge.md`](project_knowledge.md)
- ⑤ メンバーナレッジ → [`member_knowledge.md`](member_knowledge.md)
- ⑥ MTGサマリ → [`meeting_summaries.md`](meeting_summaries.md)
- ⑦ OS台帳差分 → [`project_registry_diffs.md`](project_registry_diffs.md)
- ⑧ XRL根拠 → [`xrl_evidence.md`](xrl_evidence.md) / [`amd_score.md`](amd_score.md)
- ⑩ Textbook Insights → [`../spec/3-13-l2-textbook-insights-current-spec.md`](../spec/3-13-l2-textbook-insights-current-spec.md) / [`../scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md`](../scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md)
- ⑪ Atlas Signals / ⑫ Macrotrend Evidence / ⑬ Member Weekly Activities / ⑭ Finance Ops Evidence / ⑮ VC News / ⑯ Management Monthly Signal Evaluation → [`l2_data_list.md`](l2_data_list.md) / [`l2_expanded_automation_strategy.md`](l2_expanded_automation_strategy.md) / [`management_score.md`](management_score.md)
- 全体的な PWA 仕様 → [`SPEC_pwa.md`](SPEC_pwa.md)

---

## このドキュメントを編集するときのルール

- L2 16 種の定義は**まさの正本**。勝手に増やしたり統合したりしない
- 新規 L2 を追加するときは必ずまさに確認
- cron を追加 / 削除 / 移動したら必ずこの md を更新する
- データ流入が止まった / 復活した変更があれば「状態」列を更新する
- provenance の区別 (internal 5生データ / external / internal hybrid / 派生レポート) を厳守

---

## 改訂履歴

| 日付 | 変更 |
|---|---|
| 2026-06-03 | **L2⑯ Management Monthly Signal Evaluation を追加**。`/management-score` 月次試算表下の経営シグナル評価を、数字再掲ではなく状態アイコン・1行評価・2〜3個の判断理由・次に見るべきことへ変換するL2として定義。現UIは暫定で、L2抽出・保存・更新設計が固まるまで migration / API route / DB write / UI本実装 / active cron登録は進めない。 |
| 2026-05-29 | **LLM 課金が発生する定期抽出 cron 全廃止方針へ再同期**。L2 ③ MS進捗の旧 GAS 154 → PWA `/api/cron/hourly-estimate` は再停止し、PWA route は `ALLOW_PWA_LLM_CRONS=1` なしでは disabled response のみ返す。Vercel active cron から Anthropic 経路を持つ `member-weekly-activities` / `graduation-detection` も退避。定期抽出 primary は MMO/Codex automation 側。 |
| 2026-05-29 | **L2⑥ weekly recurring 予定MTGカードを次回1件に制限**。`calendar-sync` は `recurring_event_id` / fallback series key で weekly series を検出し、2件目以降の future occurrence を `weekly_recurring_future_occurrence` として skip。cockpit 表示側も既存DB rowを series ごとに次回1件だけ残す safety filter を持つ。 |
| 2026-05-26 | **L2 ②〜⑨ を claude.ai/code/routines (= Cloud / Remote routine、Anthropic-managed cloud infrastructure) に移行完了**、8 個全部 entry 済 (= trigger ID 一覧は §「L2 ②〜⑨ Cloud routines 統一」表)。Mac の `~/.claude/scheduled-tasks/` (= Local routine) は「app open + 非スリープ中のみ発火」で MacBook Air 運用と相性悪い問題が判明、Cloud routine が laptop closed でも動くので一本化。SKILL 8 個を `pwa/scheduled-tasks/` に commit (= `41ef14c`、Cloud sandbox VM が auto-clone)。動作テスト: L2 ② 手動 run で Phase 0-A-C まで進行確認 (= Sonnet 4.6 が Supabase MCP execute_sql 経由で `protocols` / `l2_extract_state` / `project_meeting_summaries` 操作)。**残課題**: L5-L9 の Connector 不完全 (Supabase + Calendar が claude.ai UI bug で追加できず)、Mac 側 9 routine は依然 enabled (= Cloud 動作確認後 disable 予定)、Codex automation `amd-os-ms` / `amd-os` は L7/L8/L9 Cloud 安定稼働後に停止予定。詳細経緯: [`pwa/design_log/sessions_2026-05.md`](../design_log/) の 2026-05-26 セクション。 |
| 2026-05-27 | **L2⑥ 予定MTGカード同期を修正**。`calendar-sync` が `drive_files` metadata を受け取り、今日0:00 JSTから60日先の確定Calendar予定を `source_kinds='upcoming'` として upsert する。Drive探索はPJ folder rootに加えて会議日/title token の1階層サブフォルダを見て、Docs/Slides/Sheets/PDF/Officeを最大8件 `関連Drive資料` に載せる。CLG `260527_取締役会` の招集通知PDF・予算xlsx・予実xlsx 3件を本番カードへ反映済み。 |
| 2026-05-25 (#71) | **L2 ②〜⑨ Claude routine 8 個統一方針確定** (= まさお昼判断「すべて claude routines で抽出する形に変更」)。ghost 4 種 (②④⑤⑥) だけでなく稼働中の ③⑦⑧⑨ も Claude routine に移管予定。Routine 1 (= ⑥ MTG サマリ、`amd-os-meeting-extract`) は **GAS 153 + 074 + 074b-e 完全 inline 移植版** SKILL.md を `~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md` に Write 済 (= MCP 経由 Calendar/Notion/Gmail/Drive/Slack 直叩き、LLM はサブスク内 Claude、Supabase REST 直叩き)。scheduled task 登録待ち。Routine 2-8 は次セッション以降。経営ハイライト #34 修正依頼は対話型ループ (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI 拡張) に置換、一方通行 `reextractStrategySignalImmediate` は廃止。 |
| 2026-05-25 | 実装再クロールで `gas/154_PwaCronCaller.js` の一括 kill switch が MS hourly まで止めていることを発見。MS進捗は primary writer なので `NAV_PWA_HOURLY_ESTIMATE_DISABLED_20260522=false` に復旧し、ASPI 系 PWA ping は `NAV_PWA_ASPI_CRON_DISABLED_20260522=true` で停止継続に分離。`operations-catalog.ts` / [../manual/6-1-operations-settings-spec.md](../manual/6-1-operations-settings-spec.md) / `pwa/vercel.disabled-crons.json` も同時更新。 |
| 2026-05-25 | #68 クロールで L2 ②④⑤⑥復旧の current truth を [../manual/8-3-l2-extraction-routines-spec.md](../manual/8-3-l2-extraction-routines-spec.md) に正本化。`amd-os-meeting-extract` は SKILL + GAS dryRun live 200 OK まで確認済、scheduled task 登録待ち。当時は `member_knowledge` の `status` / `source_hash` schema gap を明記していたが、後続 migration 091 で解消済み。 |
| 2026-05-25 | マニュアル拡充時の再クロールで、当時の L2 ③ MS進捗の current truth を明確化。primary writer は GAS 154 `nav_pwa_pingHourlyEstimate` -> PWA `/api/cron/hourly-estimate` -> `estimateProgress`、Codex automation `amd-os-ms` は MS進捗の修正候補レビュー + L2 ⑦/⑧ outbox を担う扱いだった。2026-05-29 に課金ゼロ方針へ戻し、この復旧は再停止。 |
| 2026-05-23 | `/admin/payouts` の通常表示を重い再計算から切り離したため、毎日03:05 JSTの `cron/payout-reward-cache-refresh` を追加。前月・当月・翌月の支払月を対象に `syncRewardSummariesForBillingCycles()` を実行し、`billing_cycles.reward_summary_json` を日次更新する。 |
| 2026-05-22 | **PWA/GAS background cron停止**: 生データ抽出・L2/Atlas系の定期実行はCodex automationへ寄せるため、`pwa/vercel.json` の LLM crons を `pwa/vercel.disabled-crons.json` に退避。GAS `154_PwaCronCaller.js` も当時は `/api/cron/hourly-estimate` / ASPI系 ping を一括停止。2026-05-25 に MS hourly だけ一度復旧したが、2026-05-29 に再停止。旧GAS抽出cron (`060`, `056`, `153`, `152`, `155`) は kill switch で停止継続。 |
| 2026-05-22 | L2 ⑧ XRL根拠の HRL ベース (= `project_founding_members`) を「関連メンバー」リストとして再定義。HRL に算入するのは `category in ('amd','startup','university')` (= 該当SU社員 + AMD伴走メンバー + 大学キーパーソン)。VC / 顧客 / 行政 / 産業パートナーは HRL根拠外として invalid 化。AMDメンバーは `members.code_name` で記録 (本名 / 姓のみ表記は重複扱いで invalid)。関連メンバー抽出cronが読むmdは `project_ventures.master_md_text` に同期した `/Users/masa/projects/knowledge/<slug>.md` で、AMDメンバー正規化は `members.code_name` + `members.member_name` のDB alias mapで行う。migration 075 / 082、cron prompt v5 |
| 2026-05-15 | まさ確認により L2 を 8 種へ更新。⑦ OS台帳差分を新設し、`project_founding_members` は候補から正式昇格して ⑧ XRL根拠 (HRL含む TRL/BRL/GRL/SRL/HRL 根拠) に統合 |
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
| 2026-05-09 | **名前正規化マップ** (gas/079 `nameAlias_buildBlock`): `members.member_name` + email から動的生成。姓・フルネーム・ローマ字表記を `members.code_name` に正規化する block を 074 / 155 の LLM プロンプトに渡す |
| 2026-05-09 | **MTGサマリ feedback 連携** (gas/074): `_l2_loadFeedbackBlock_("meeting_summary", ...)` + applied 記録 + source_hash に active feedback hash 混ぜる + POST `/api/notifications/feedback` 末尾で **即 force 再抽出 fire-and-forget** |
| 2026-05-09 | **PJナレッジ抽出の汚染防御 v4_meta_strict** (gas/155): `=== project_meta ===` セクション + 「他 PJ 内容で汚染されているケースは items: [] を返せ」 + `monthly_reports.status=neq.invalid` フィルタ。p10/202604 (CX 内容で SE PJ に保存) の事故対応 |
| 2026-05-09 | **DB schema reference 自動生成** (`pwa/design/db_schema.md` + `pwa/scripts/dump_schema.py`): 88 テーブル / 948 列。「列名は想像で書かない」運用ルールを `pwa/CLAUDE.md` に追加。member_activities 列名 4 つ間違い事故への根本対策 |
| 2026-05-09 | **通知 UI 改善**: `/notifications` の既読は折りたたみトグル (default closed)、開いた瞬間 `notified_at = now()` PATCH (即既読化)、グループ分けは server 値固定で開いてもセッション内は未読セクションに残る (= 中身読める)。GlobalNav に 📬 ベル + 未読バッジ、Dashboard に通知バナー |
| 2026-05-11 | **Slack backfill 074b form-encoded 化** (gas/074b): `slack_callApi` の JSON body で `conversations.replies` が `invalid_arguments` を返す問題が真因。074b 専用 `_meeting_slack_callForm_` で form-encoded helper を新規、history / replies 両方をこれ経由に。3 PJ × 過去 3 ヶ月で saved=13 達成。`project_meeting_summaries.source_url` 列追加 (migration 052) |
| 2026-05-12 | **5 生データ backfill skeleton 完成** (074c/074d/074e): `meeting_extract.{drive,calendar,gmail}` を migration 054 で seed + 各 GAS ファイルに backfill 関数。GAS v1462 deploy 済。動作確認: Drive folder_id 取得 OK / Calendar events 1-12 件取得 (saved 0 = chitchat 判定) / Gmail 3 件 saved ✅ |
| 2026-05-21 | **Slack source refs 回収導線をPWAに追加**: `/api/sources/slack/collect` と `ms_progress_review_tool collect-slack` を追加。Slack channel history + thread replies を `source_cache(source='slack')` に upsertし、`metadata_json.source_url` に permalink、`text_sha256` に本文hashを保持。MS revision evidence は Gmail 固定をやめ、Slack/Drive/Calendar/Notion を含む `source_cache` 全sourceを見るよう修正。`cron/member-activities` も source_cache refs を入力に追加。active 5 PJ (CTB/SE/ZMP/CX/SX) × 202603-202605 を backfill 済み。p21/SX は source refs込みで `member_activities` も再抽出済み。source refs 取り込み自体は通知しない。通知はOS表示データ・台帳・L2正本に差分が出た時だけ作る。 |
| 2026-05-21 | **ZMP過去月の進捗イベントbackfill**: ZMP (`p19`) `202601` は `source_cache=14`, `monthly_reports=1`, `project_meeting_summaries=2` があるのに `member_activities=0` で、月次モーダルの進捗イベントが0件だった。原因は source refs 拡張後に過去月 `202601-202603` の `cron/member-activities` backfillが未実行だったこと。production cronを `projectId=p19` 指定で手動実行し、`202601=11`, `202602=12`, `202603=9` 件を保存済み。 |
| 2026-05-22 | **MS未設定月は通知ではなく月次ノートへ**: `cron/hourly-estimate` はactive PJ全体を見に行く。DTSU / ecosystemで対象月を覆うMS計画・有効MS項目がある場合だけ `milestone_monthly_progress` に保存し、MSがない月や非MS管理PJは `monthly_reports` + `project_meeting_summaries` を `project_monthly_notes` に保存する。旧 `missing_ms_plan` / `missing_ms_items` の `project_config_gap` 通知は廃止し、migration 084で既存通知を削除。 |
| 2026-05-21 | **メンバー週次活動抽出**: `/api/cron/member-weekly-activities` を追加。Gmail / OSから読める共有メンバーカレンダー / source_cache から活動を抽出し、member emailはメンバー特定だけに使い、PJ判定はPJ専用/関係先email・PJ名・client名で行う。Google Calendar共有はログイン時に `calendar.readonly` 必須scopeとして確認し、`/admin/members` に `members.google_calendar_status` と `last_login_at` を表示。`member_activities(source='member_weekly')` に保存し、`/mypage` は今週やったこととして表示、既存member_activities入力のL2にも利用できる。2026-05-29 に Anthropic 経路があるため active cron から退避。 |
| 2026-05-12 | **「📑 全 PJ 紹介資料作成」機能完成** (3 ラウンド試行錯誤後): 雛形 `AMD_allPJ_introduction.html` の 04 CHALLENERGY section を Chrome MCP + POST server で抽出 → template literal で一字一句コピー + Sonnet 4.5 で 1 PJ ごと JSON 集約 (= migration 055 で `exec_summary.extract` seed)。`/api/admin/pj-introduction-html` + `src/lib/exec_summary/template.{html,css}` + `next.config.ts outputFileTracingIncludes` |
| 2026-05-12 | **進捗イベント抽出ロジック見直し** が次セッションの最重要課題に: 「先手力」表示は復活したが、そもそも events が 0 件の PJ-月が多い (= EventsSection で「イベントデータなし」)。`progress_events` 系の cron / 抽出ロジック側の再点検が必要 |
| 2026-05-12 | **マクロ係数 P 以外列の集計 + 4 lane 欠落修復 + FRL grit/resilience LLM 推定 cron 新規** (blissful-robinson-8e462a #2): まさ「マクロ係数 P 以外 0 件、件数増やせる設計に」「FRL grit/resilience も 0 のまま」(過去複数回指摘済の TODO がやっと解決)。**真因 1 (lane 軸)** = macro-backfill-historical が 1 lane × 16 年 = 1 prompt で 180 オブジェクト要求 → LLM が JSON 途中切断で silent continue → 4 lane (advanced_ict/ai_technologies/quantum/sensing_timing_navigation) が 0 件。**真因 2 (列軸)** = macro_index_log の 6 列のうち policy_density のみ Sonnet 推定で入って budget/investment/mention/raw_signal_count が全 786 行 0、集計 cron 自体が無かった。**真因 3 (FRL)** = 列は migration 031 で追加済だが推定 cron 無く全 100 行 NULL。**対応**: (a) macro-backfill chunk 化 (1 lane × 4 年 × 4 回 = 16 prompts、retry 2 回、chunk 単位の成否を return JSON に含めて silent fail 排除) で 4 lane × 192 件 = 768 件補完、(b) 新 cron `cron/macro-aggregate-indicators` (= 月初 04:00 JST、observation_log + atlas_signals を lane × month で集計 → budget/investment/mention/signal_count を update 129 行 + insert 14 行)、(c) migration 058/059 で `llm_prompts.frl.grit_resilience.extract` seed (= Duckworth 2007 / Markman 2005 の 0-9 判定基準 + 「外部創業者を優先評価、AMD は伴走」明示) + 新 cron `cron/frl-grit-resilience-extract` (= 月初 03:00 JST、過去 3 ヶ月 monthly_reports + meeting_summaries 集約 → Sonnet で 0-9 推定 + reasoning 引用付き)。**動作確認**: macro 列 budget=¥9972 億 / investment=¥1963 億 / signal=286 件 / mention=82 件、FRL 5 PJ で grit/resilience = (神谷 7/6, 杉浦 7/6, 丸島 6/6, 神谷 5/6, 山地 4/5)。**事故**: 初版で cron が project_founding_members.organization 列を SELECT していたが該当列無し (= affiliation が正解) → PostgREST で空配列 → LLM「creator 未抽出」で null。修正版で affiliation + role_label_jp + category 経由に修正、prompt v2 で「creator 一覧空でも本文推定可」を明示 |
| 2026-05-12 | **進捗イベント抽出ロジック復元 + MS なし PJ 対応** (blissful-robinson-8e462a): 真因 = 2026-05-07 commit `6d81541` で `/api/progress/events` を旧 GAS rewardDashboard → Supabase 直読みに置換した際、旧 GAS `gas/054_RewardScoring_EventExtract.js` の Sonnet + system prompt + initiative_origin/impact/depth/responsibilities 出力スキーマがすべて落ちて Haiku で title のみ生成する構成に格下げされていた。migration 056 で member_activities に initiative_origin (CHECK 5 値) / impact / depth 列追加 + member_id NULL 許容、migration 057 で `llm_prompts.member_activities.extract` seed (旧 GAS 相当の system prompt 新規書き起こし、判断不能は unknown ルール明記)、cron リライトで Sonnet 4.6 + 入力に project_meeting_summaries 追加 + plan_cycle 必須緩和。**動作確認**: p21 4月 11→14 件・先手力 0%→46%、p20 (MS なし) 4月 0→9 件、全 active PJ 4月 16→50 件。`project_monthly_notes` テーブル新設 + `/api/project/monthly-note` + CockpitMonthlyModal の MonthlyNoteSection で **MS なし PJ でも月次モーダルから自由記述進捗ノートを残せる** (= まさ 2026-05-12 タスク 3) |
