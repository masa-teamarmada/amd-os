# L2 データ ＋ レポート — AMD OS の中核データ正本 ⭐⭐⭐

**最重要**: AMD OS の中核データ。すべての Claude / Codex / GPT セッションは作業前にここを読む。

> **manual / spec / bzm 3層分割中**: L2 ①〜⑩、5 生データ、outbox / LaunchAgent、採否ループの確定仕様は `/spec/3-1-l2-data-extraction-current-spec.md` へ移行開始済み。移行完了までは、この `design/L2_DATA.md` も未移行領域の正本として残し、迷う内容は両方に置く。

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

## 現在のデータフロー (2026-05-29 正本)

```text
5生データ
  Gmail / Drive / Calendar / Slack / Notion
        ↓
抽出・取り込み層
  subscription automation / GAS backup / PWA manual route / Codex automation
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
        ↓
通知
  l2_notifications / meeting_notifications
        ↓
/notifications
  はい / いいえ / コメント
        ↓
反映・学習
  Supabase更新 / l2_feedbacks / tsukuyomi_learnings
```

### Finance L2 拡張候補 (2026-05-21)

まさ方針: サブスク領収書や自動振替は、月次試算表の中だけでなく admin の経理オペ台帳として慎重に管理する。

| データ | テーブル | 生データ | 使い道 |
|---|---|---|---|
| 継続支払い / サブスク / 自動振替 | `company_finance_recurring_items` | Gmail / freee / 手入力 / GAS月次PL seed | 月額、発生頻度、引落口座、自動振替、budget forward-fill の管理 |
| 領収書イベント | `company_finance_receipt_events` | Gmail 領収書、添付PDF、freee明細 | confirm後に `company_actual_monthly` へ実績同期し、毎月発生しそうなら予算へ forward-fill |

これは既存 L2 8種を置き換えるものではなく、Management Score の `finance` 軸に入る財務系 L2。実装時はメール全文や領収書全文を保存せず、source ref / hash / short subject / attachment refs と正規化金額だけを保存する。

### 重要な原則

- GAS シートはバックアップ・人間確認用。正本ではない
- 正本は Supabase
- 5生データから直接 L2 に抽出する。汎用 L1 経由に戻さない
- 5生データで有効な現物を拾ったら、通知だけで止めず、短い source refs / snippet として Supabase に戻す。月次報告書が no-data テンプレ、または未作成の場合は、完璧な完成版を待たず、L2① automation が確認できた範囲だけで `monthly_reports.draft_content` を暫定更新する
- **2026-05-31 以降の L2①**: 月次報告書は Supabase 内の既存 L2 (`project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `project_registry_diffs` / `protocols` / `project_knowledge` / `member_knowledge` / MS進捗系) を primary input にする。5生データは、L2 coverage が薄い・stale・source refs 不足・no-data 候補のときの gap check / backfill fallback として見る。
- **2026-06-02 no-activity ガード**: `monthly-reports-backfill` cron は、当月の `source_cache` が 0 件なら LLM に推測本文を書かせない。代わりに「進捗なし」テンプレ（「活動・成果物は検出されていません」と断定せず記述）を `draft_content` に置き、`collection_summary_json` に `sourceChecklist` / `noActivity:true` を残す。これは「投資家向け資料整備」等のハルシネーション本文が活動の無い月に入る事故（`project_config_gap` の `raw-route-zero` 通知の根本原因）の再発防止。source の薄さ自体は extraction 不完全の可能性があるため本文では断定しない。過去に生成済みの捏造 draft は cron では直さない（既存行は backfill 対象外）ので、誤判定リスクを避けて個別にまさ判断で是正する。
- **2026-06-03 未来月 / PJ期間外ガード**: `monthly-reports-backfill` cron の missing 抽出 (`billing_cycles - monthly_reports`) に2つのガードを追加。(1) **当月 (JST) より後の未来月は作らない** — `billing_cycles` に請求予定として未来 ym があり、ガード無しだと未来の月報を先回り捏造していた。(2) **PJ 活動期間外は作らない** — `start_ym` より前は除外、`end_ym` 超過は **`projects.status='ended'` のときだけ**除外。active PJ は `end_ym` が古いまま更新されないことがある (例: LST p07 は `end_ym=202507` だが `status='active'` で継続中) ため、`end_ym` だけで切ると継続中 PJ の実データ月報まで誤除外する。開始前月でもキックオフ等の意味があれば既存行は残す (上の `start_ym` 例外と整合)。2026-06-03 に既存の未来月 draft 84件 + 過去の捏造/期間外 draft を cleanup 済み (実データ・意味ある開始前コンテキストは保持)。
- `projects.start_ym` より前の月でも、キックオフ・提案・契約前調整などPJ形成に意味がある生データがあるなら、月次サマリを作ってよい。MS進捗には直接反映しないが、開始前コンテキストとして `monthly_reports` に残す。
- メール全文・議事録全文・Slack全文を L2 や通知に保存しない
- L2 に保存するのは「AMD OS が使う構造化情報」と「短い根拠 snippet / source refs / hash」
- 差分が出たら必ず `l2_notifications` / `meeting_notifications` へ出して、まさが `/notifications` で確認できるようにする

### 月次報告書は少しずつ作る

`monthly_reports` は「全生データが揃ったあとに一括で完成させる」だけのテーブルではない。まず Supabase の L2 snapshot を見て月次断面を作り、Gmail / Drive / Calendar / Slack / Notion のどれかで当月の確かな活動が見つかった、または L2 coverage に穴がある時点で、抽出器や Codex automation は以下を行う。

1. 全文ではなく、source id / date / title / sender / short snippet / hash を `source_cache` または該当 L2 の `source_refs_json` に保存する。`source_cache` だけを見て no-data 判定しない
2. `monthly_reports` が未作成、または no-data テンプレのままなら、確認済み事実だけで `draft_content` を暫定更新する。PJ期間外でも、開始前コンテキストとして意味がある月は作成対象にする。
3. 既に `final_content` がある場合は自動上書きせず、追加候補を通知または revision として出す
4. sourceChecklist が 0 のままなのに connector で現物が取れた場合は、`raw_data_gap` だけで終えず、可能な範囲で source refs を Supabase に backfill する。backfill 先や候補 kind が安全に決められるなら、`raw_data_gap` ではなく `project_registry_diff` / `xrl_evidence` / `ms_progress` revision / `meeting_summary` など具体的なL2候補にする。

この運用の目的は、MS進捗・PJナレッジ・XRL根拠・月次FIXが no-data テンプレに引きずられないよう、OS内に小さくても使える月次断面を積み上げること。

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

## L2 データ 10 種 (正本リスト)

| L2 | 意味 | テーブル | cron / 書き込み元 | 場所 | 状態 |
|---|---|---|---|---|---|
| ① **monthly report** | PJ 月次レポート本文 | `monthly_reports` | **Codex automation `AMD OS L2① 月次報告抽出`** (= daily 05:30 JST、Supabase L2 snapshot primary + 5 生データ gap check fallback → `amd-os-ms/outbox.monthlyReports` → LaunchAgent applier)。PWA manual/backfill route と AMD-Report GAS R313 は手動復旧/旧経路 | `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md` + `pwa/scripts/ms_progress_review_tool.mjs` | ✅ 定額 subscription automation の正式対象。R313 trigger は置かない |
| ② **AMDプロトコル** ⭐ | 経営判断の構造化記録 (分岐点 / 判断材料 / アクション / 結果)。結果はアクション後に実際に起きたことを後追いで入れる欄で、自動抽出では空欄。**AMD の最重要知財** ([amd_os_vision.md](../../../knowledge/amd_os_vision.md)) | `protocols` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract`** | `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` + PWA `AdminProtocolsClient.tsx` | ✅ MMOマシン側へ移管。復旧時は MMO 側 automation 履歴を見る |
| ③ **MS進捗** | DTSU PJ / エコシステム構築PJのマイルストーン進捗%。advisorなど非MS管理PJはMS進捗を抽出せず、月次モーダルの月次ノートに毎月の進捗を残す | `milestone_monthly_progress` / `project_monthly_notes` | **MMO/Codex automation** `amd-os-l3-ms-progress-extract`。旧 本体GAS 毎時 trigger (`nav_pwa_pingHourlyEstimate` / 154) → PWA `cron/hourly-estimate` は 2026-05-29 に再停止。PWA route は `ALLOW_PWA_LLM_CRONS=1` を明示しない限り disabled response のみ返す | `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md` + PWA `lib/progress-estimator.ts` (ロジック正本/fallback) | ✅ **定期抽出は subscription automation 側**。PWA/GAS background LLM cron は停止 |
| ④ **PJナレッジ** | PJ にまつわる事実・人物・組織・進行中事項 | `project_knowledge` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **MMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract`** | `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` | ✅ MMOマシン側へ移管 |
| ⑤ **メンバーナレッジ** | メンバーごとの強み・スキル・関心 | `member_knowledge` | ~~Phase 4 = GAS 155~~ ⛔ **2026-05-22 停止** → **MMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract`** | `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md` + (旧) 本体GAS `155_L2KnowledgeExtractor.js` | ✅ MMOマシン側へ移管。`status` / `source_hash` / `last_processed_at` は migration 091 + `db_schema.md` に反映済み |
| ⑥ **MTGサマリ** | calendar event 1 回ごとの decided/progress/nextActions/risks (PK = calendar event id)。開催前/当日の準備ブリーフは `source_kinds='upcoming'` で同じ欄に出す。未来/同日Calendar予定同期では、`today 00:00 JST` から60日先までの確定予定をカード化し、PJ Drive folder の会議日サブフォルダ・議案資料・予実表・招集通知を `関連Drive資料` として載せる。ただし weekly recurring MTG は series ごとに次回1件だけ同期・表示し、それ以降の future occurrence は非表示/skip にする。画面共有・表・スライドなど自動メールに落ちない素材は `meeting_assets` + private Storage `meeting-assets` に添付し、`narrative_md` へ Markdown 画像/リンクとして挿入できる。 | `project_meeting_summaries` + `meeting_assets` | ~~Phase 3 = GAS 153 毎時 polling~~ ⛔ **2026-05-22 停止** → ✅ **Codex Desktop automation `amd-os-l6-meeting-flow` / repo正本 `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`**。議事録抽出は過去60-180分終了events、予定MTGカードは `POST /api/meeting-prep/calendar-sync`、手動/仮置き予定MTG準備は `POST /api/meeting-prep`。`calendar-sync` は `drive_files` metadata と recurring metadata を受け取り、Driveを読みに行かずに予定カードへ反映する。MTG添付は PWA `POST /api/meeting-assets` で admin 手動保存し、LLM 抽出は routine 側の入力に寄せる。設計 [meeting_summaries.md](meeting_summaries.md)、マニュアル [8-3章](../manual/8-3-l2-extraction-routines-spec.md) | (旧) 本体GAS `152_NavigatorCron.js` + `153_MeetingHourlyTrigger.js` + `074_MeetingSummaryRepo.js`。iOS APNs 通知用 `meeting_notifications` テーブル (PK=meeting_id) は新 routine も維持予定 | ✅ 稼働。2026-05-27 に KUTE/CLG の予定カード生成境界と CLG取締役会Drive資料同期を本番検証済み。2026-05-29 に weekly recurring 予定MTGは次回1件だけ表示する guard を追加 |
| ⑦ **OS台帳差分** | 5生データとOS構造データの差分。PJメンバー候補、関係先メール、担当者、契約/期間/スコープ、請求/ステータスなど「OSに反映する?」が必要な候補 | `project_registry_diffs` + `l2_notifications(l2_kind='project_registry_diff')` | Codex automation `amd-os-ms` + SKILL `amd-os-l7-registry-diff-extract` → `outbox.registryDiffs` → non-LLM applier | Codex automation + LaunchAgent | ✅ subscription automation 枠で稼働。詳細 [project_registry_diffs.md](project_registry_diffs.md) |
| ⑧ **XRL根拠** | AMD Score / XRL 算定に使う構造化根拠。`project_founding_members` は HRL 評価のベース = **関連メンバー** リストで、`category in ('amd','startup','university')` (= AMD 伴走 / 該当SU 社員・創業候補 / 大学キーパーソン) を HRL 算入対象にする。VC / 顧客 / 行政 / 産業パートナーは HRL根拠外として `status='invalid'` 化。AMDメンバーは `members.code_name` で記録 (フルネーム / 姓のみ表記は重複として invalid)。`projects.project_category='ecosystem'` は AMD Score 対象外 | `project_founding_members`, `project_xrl_evidence`, `project_xrl_log`, `amd_score_inputs.xrl_notes` | Codex automation `amd-os-ms` + SKILL `amd-os-l8-xrl-evidence-extract` → `outbox.xrlEvidence` → non-LLM applier | Codex automation + LaunchAgent | ✅ subscription automation 枠で稼働。詳細 [xrl_evidence.md](xrl_evidence.md) |
| ⑨ **経営ハイライト** | MS進捗より上位の、経営上の重要方針・事業上の進捗・戦略転換・提携・資金・知財/規制・重要リスク・次の一手。PJ cockpit のMSリスト直下に表示する | `project_strategy_signals` + `l2_notifications(l2_kind='project_strategy_signal')` | Codex automation `amd-os` (= daily 03:20 JST) → `/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/` → non-LLM applier `ms_progress_review_tool.mjs apply-outbox-dir`。初期backfillは `scripts/backfill_strategy_signals_from_activities.mjs` → `ms_progress_review_tool.mjs apply-outbox` | Codex automation / PWA | ✅ DB・cockpit表示・通知採否UIを追加。抽出はCodex automationで日次運用。2026-05-23に既存 `member_activities` から40件backfill済み。詳細 [project_strategy_signals.md](project_strategy_signals.md) |
| ⑩ **Textbook Insights** | Before Zero / BZM 教科書に追記すべき実務知見。最重要は Before Zero PJ推進のノウハウ・経営判断、次点でPJ横断傾向、ケーススタディ、既存理論の裏付け。承認前は候補DBだけに保存し、承認後も本番runtimeからgitを直接編集しない | `textbook_insight_candidates` + `l2_notifications(l2_kind='textbook_insight')` | Codex automation / local worker `amd-os-l10-textbook-insight-extract` → `outbox.textbookInsights` → non-LLM applier が candidate + notification 作成 → `/notifications` yes で approved → `apply_approved_textbook_insights.mjs` が `pwa/bzm/*.md` へ追記 | Codex automation / local BZM applier | 🟡 partial。DB/API/outbox/local applier contract を追加。実 schedule 登録と commit loop は司令塔レビュー後に確定 |

**重要**: 5 生データから抽出した結果 = L2 だけ。Atlas / VC ニュース / マクロ index は外部ソース由来なので **L2 ではなく「レポート関連」**カテゴリ。

**通知反映ルール (2026-05-25 #68 current truth)**: 通知に出る情報は、通知画面で「はい」を押したものだけが正本反映される。
`project_knowledge` は `status='candidate'` → yes で `active`、no で `rejected`。`protocols` は `candidate` → yes で `confirmed`、no で `rejected`、archive は `archived`。`member_knowledge` は migration 091 以降 `status='candidate' -> active / rejected / archived` と `source_hash` を持てる。`project_registry_diff` と `project_xrl_evidence` も候補状態から「はい」で apply / confirmed する。

---

## レポート関連 (L2 とは別。外部ソース or 派生)

| レポート | テーブル | cron | 場所 |
|---|---|---|---|
| **Atlas 日次** | `atlas_stories` 等 | `cron/atlas-daily` (06:00 daily) | PWA |
| **Atlas 週次** | 同上 | `cron/atlas-weekly` (fri 17:00) | PWA |
| **Atlas 月次** | 同上 | `cron/atlas-monthly` (毎月 1 日 07:00) | PWA |
| **Atlas マクロ収集** | `atlas_signals`, `macro_index_log` | Codex automation `AMD Atlas外部シグナルレビュー` (08:10 daily)。旧 `cron/atlas-collect` は課金回避のため停止済み | Codex automation + PWA ingest |
| **Atlas 政策シグナル** | `atlas_policy_signals` | `cron/atlas-collect-policy` (07:00 daily) | PWA |
| **Atlas divergence** | テーマ単位 | `cron/atlas-divergence` (sun 06:00) | PWA |
| **macro lane weights 再学習** | macro index 関連 | `cron/relearn-lane-weights` (03:30 daily) | PWA |
| **macro バックフィル** | `macro_index_log` (過去) | `cron/macro-backfill-historical` (sun 12:00) | PWA |
| **VC ニュース** | `vc_news` | `cron/vc-discover` route (旧: 土 09:00 weekly、業界横断 + 新規 VC 発見 + suggested_fund_patch。2026-05-22 以降は LLM/web_search 課金回避で自動 schedule 停止) | PWA |
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
| **05:30 daily** | `AMD OS L2① 月次報告抽出` (= Codex automation、repo正本 `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`) | **L2 ① monthly_reports**。5 生データから active / sales PJ の当月・前月 monthly draft を作り、`amd-os-ms/outbox.monthlyReports` 経由で非LLM applier が Supabase に反映。R313 / PWA heavy route は定期実行しない | Codex automation + LaunchAgent |
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
| **土 09:00** | `cron/vc-discover` | **停止中**。VC ニュース + 新規 VC 発見 (旧 weekly) | PWA |
| ~~mon 03:00~~ ⛔ | `cron/amd-score-l2-refresh` | AMD Score / XRL根拠リフレッシュ (L2 ⑧)。Sonnet 利用のため schedule 停止中、route は手動検証用に残す | PWA |
| ~~月初 03:00 (1日 18:00 UTC)~~ ⛔ | `cron/frl-grit-resilience-extract` | ecosystemを除くactive PJ × 過去 3 ヶ月 monthly_reports + meeting_summaries 集約 → Sonnet 4.6 で frl_grit (Duckworth 2007) / frl_resilience (Markman 2005) を 0-9 推定 → 既存amd_score_inputsをupdate。prompt = `llm_prompts.frl.grit_resilience.extract` (v2、外部創業者優先 / null 厳格化)。Sonnet 利用のため schedule 停止中、手動 route は残す | PWA |
| **月初 04:00 (1日 19:00 UTC)** | `cron/macro-aggregate-indicators` | observation_log (kaken/grant → budget_amount, vc/vc_investment → investment_amount) + atlas_signals (ATL domain → ASPI lane mapping → policy_mention_count / raw_signal_count) を lane × month で集計 → macro_index_log の P 以外列を update。?since=YYYY-MM 指定可、デフォルト過去 36 ヶ月 | PWA |
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

## 🚨 L2 ①〜⑩ subscription automation 統一 (= 2026-05-29 正本訂正)

**📜 経緯** (= 3 段階の方針進化):
1. **2026-05-22**: 「LLM 課金が発生する定期抽出 cron 全廃止」判断 → GAS 153/155/152 kill switch → L2 ②④⑤⑥ ghost 化
2. **2026-05-25 #71**: 「すべて claude routines で抽出する形に変更」確定、L2 ②〜⑨ 全 8 個を Claude routine 統一の方針確定、Mac の `~/.claude/scheduled-tasks/` (= Local routine) で 8 個 SKILL 作成
3. **2026-05-26**: Mac Local routine は **「app open + 非スリープ中のみ発火」** で MacBook Air 運用と相性悪い問題判明 → **claude.ai/code/routines (= Cloud / Remote routine、Anthropic-managed cloud infrastructure 上で実行)** に一本化、8 個全部 entry 完了
4. **2026-05-29**: L2 ① `monthly_reports` も正式対象に訂正。Codex automation `AMD OS L2① 月次報告抽出` が draft を作り、`amd-os-ms/outbox.monthlyReports` 経由で非LLM applier が反映する。R313 は旧有料API経路で trigger 復活しない。2026-05-31 以降は Supabase L2 snapshot primary + 5生データ gap check fallback。
5. **2026-05-29 正本整理**: 人間が復旧できる粒度にするため、現行表は **実行場所 / automation / 課金ルート / 復旧時に見る場所** を優先する。Claude routine / Local routine の旧 ID は履歴であり、現行復旧先として読まない。

| L2 | 旧 writer (停止/移管対象) | 現行 writer (= 実行場所 + automation) | cron | 状態 |
|---|---|---|---|---|
| ① monthly_reports | AMD-Report GAS R313 / PWA heavy route | Codex automation `AMD OS L2① 月次報告抽出` → `amd-os-ms/outbox.monthlyReports` → LaunchAgent | daily 05:30 JST | ✅ SKILL 正本追加済。Supabase L2-first、5生データは gap check fallback。R313 trigger は置かない |
| ② AMD プロトコル | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract` | daily 08:00 JST | ✅ MMOマシン側へ移管。復旧時は MMO 側 automation 履歴を見る |
| ③ MS 進捗 | ~~PWA `/api/cron/hourly-estimate` + GAS 154~~ ⛔ 2026-05-29 再停止 + Codex `amd-os-ms` review | MMOマシン automation `amd-os-l3-ms-progress-extract` | 毎時 0 分 | ✅ 定期抽出 primary。PWA/GAS background LLM cron は disabled |
| ④ PJ ナレッジ | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | MMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | ✅ MMOマシン側へ移管 |
| ⑤ メンバーナレッジ | ~~GAS 155~~ ⛔ + 旧 Local/Cloud routine | MMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | ✅ MMOマシン側へ移管。migration 091 の status/source_hash 前提 |
| ⑥ MTG サマリ + フロー | ~~GAS 153~~ ⛔ + 旧 Local/Cloud routine | Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow` | 毎日 09:00-21:00 毎時 + Phase A 早期 exit | ✅ 2026-05-27 拡張完了 |
| ⑦ OS 台帳差分 | 旧 Cloud routine 案 / PWA LLM route | Codex automation `amd-os-ms` + SKILL `amd-os-l7-registry-diff-extract` → `outbox.registryDiffs` → LaunchAgent | 6h ごと | ✅ subscription automation 枠で稼働 |
| ⑧ XRL 根拠 | 旧 Cloud routine 案 / PWA LLM route | Codex automation `amd-os-ms` + SKILL `amd-os-l8-xrl-evidence-extract` → `outbox.xrlEvidence` → LaunchAgent | 6h ごと (L7 +15 分) | ✅ subscription automation 枠で稼働 |
| ⑨ 経営ハイライト | 旧 Cloud routine 案 | Codex automation `amd-os` + SKILL `amd-os-l9-strategy-signal-extract` → strategy-signals outbox → LaunchAgent | daily 03:20 JST | ✅ subscription automation 枠で稼働。修正依頼ループは対話型と接続予定 |
| ⑩ Textbook Insights | 新規 | Codex automation / local worker `amd-os-l10-textbook-insight-extract` → `outbox.textbookInsights` → candidate + notification → approved → local BZM applier | TBD | 🟡 partial。候補・採否・安全な追記導線を追加。Vercel runtime から git 追記しない |

**SKILL 正本**: [`pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`](../scheduled-tasks/) (= repo 入り、MMO/Codex/automation が読む)
**マニュアル正本**: [8-3 章 L2 Extraction Routines](../manual/8-3-l2-extraction-routines-spec.md)
**詳細経緯**: [`pwa/design_log/sessions_2026-05.md`](../design_log/) の 2026-05-26 セクション
**管理場所**: ①/⑦/⑧/⑨/⑩は Codex automation 履歴と outbox/applier、②〜⑥は MMOマシン側 Codex Desktop automation 履歴。⑩ の `pwa/bzm` 追記は approved 後の local BZM applier と git commit/push が別段階。古い claude.ai trigger ID は履歴確認用で、復旧の主導線ではない。

**経営ハイライト修正依頼 (= L2 ⑨ + #34)**: 一方通行 update を廃止、**対話型ループ** (= `/api/notifications/feedback/dialog/start|refine|confirm` + CockpitStrategySignals UI 拡張) に置換 2026-05-25 #71。設計議論は [`feedback_dialog.md`](feedback_dialog.md)。

---

## L2 で「実装中」のもの

| L2 | 現状 | 対応予定 |
|---|---|---|
| ⑦ OS台帳差分 | DB・通知・採否UIは本番反映済。KUTE Gmail で差分通知の手動実証中 | オートメーション抽出器を汎用化し、5生データすべてから `project_registry_diffs` を作る |
| ⑧ XRL根拠 | `project_founding_members` は稼働済。`project_xrl_evidence` 受け皿は本番反映済。TRL/BRL/GRL/SRL/HRL 根拠の統合抽出器は未完 | `project_xrl_evidence` の抽出器を作り、XRL/AMD Score 再計算と通知確認フローへ接続 |
| ⑩ Textbook Insights | DB・通知採否・outbox・local BZM applier の最小導線は追加 | 実 schedule 登録、approved 候補を commit/push する運用、章選定のレビュー基準を詰める |

## L2 候補

現時点で候補扱いの L2 は、⑩ Textbook Insights。DB/API/outbox/local applier の最小実装はあるが、実 schedule と BZM 追記レビュー運用は partial。

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
- 全体的な PWA 仕様 → [`SPEC_pwa.md`](SPEC_pwa.md)

---

## このドキュメントを編集するときのルール

- L2 8 種の定義は**まさの正本**。勝手に増やしたり統合したりしない
- 新規 L2 を追加するときは必ずまさに確認
- cron を追加 / 削除 / 移動したら必ずこの md を更新する
- データ流入が止まった / 復活した変更があれば「状態」列を更新する
- レポート関連と L2 の区別 (「5 生データから直接抽出か」「外部ソース由来か」) を厳守

---

## 改訂履歴

| 日付 | 変更 |
|---|---|
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
