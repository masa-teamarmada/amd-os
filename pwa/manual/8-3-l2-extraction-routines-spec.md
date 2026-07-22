# L2 Extraction Routines — 実行環境別の登録・復旧仕様

この章は、L2を **Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron** のどれで抽出するかをまとめる。処理IDだけでなく、**どの実行環境で、どの課金ルートで、止まった時にどこを見るか** を正本化する。

> 実装者向けの確定仕様は [/spec/3-1-l2-data-extraction-current-spec](/spec/3-1-l2-data-extraction-current-spec) へ移行開始済み。この章は、復旧時に読む運用手順として残す。迷う内容は移行完了まで両方に置く。
>
> **2026-06-16 注記**: Claude routines 停止前提での Codex 移植 inventory / approval bundle / first execution unit は [/spec/5-8-l1-l3-codex-migration-current-spec](/spec/5-8-l1-l3-codex-migration-current-spec) を優先する。この章の `Claude routine target` 記述は、移植前の target writer と既存 contract を残している。

**2026-06-04 事故訂正**: 2026-05-25〜26 の Claude routine / Cloud routine 「登録完了」系の記述は、Claude Routines UI上の `ACTIVE / next run / last run` 証跡が無い限り current truth として扱わない。`~/.claude/scheduled-tasks/.../SKILL.md` はローカル手順・素材であり、Claude routine登録済みの証拠ではない。

現在の是正ターゲットは、**cadence ベースで 3 本の Claude routine に束ねる** (= 2026-06-08 まさ確定、新ナンバリング D / M / W / H):

> **2026-07-22 現行**: H-1とH-1 reviewerは、Codex Desktopの可視taskを作る定期automationを停止した。MacのLaunchAgentが `codex exec --ephemeral` を起動し、H-1は平日毎時15分、reviewerは同45分に動く。候補gateは先に固定スクリプトでDBを確認し、Calendarは接続済みconnectorを1回だけ読む。候補なしでは本文抽出・横断探索へ進まず、OS通知・ローカルreport・memoryだけを確定する。可視prep threadはW-Prep専任であり、H-1/reviewerは作らない。古い「MMO / Codex Desktop automation / archive watchdog」の記述は履歴で、この段落が優先する。

- **Claude routine `amd-os-l2-consolidated-evidence`** = 表示名「**AMD OS L2 日次抽出 (D-1〜D-11+D-13 統合)**」(daily 08:00 JST、`0 8 * * *`): D-1〜D-11 + D-13。MS Progress、Member Activity Evidence、Media Mentions も daily 化してここに同居。
- **Claude routine `amd-os-l2-monthend-evidence`** = 表示名「**AMD OS L2 月末抽出 (M-1月次レポート/M-2 XRL/M-3経営シグナル)**」(月末候補日 16:00 発火 `0 16 28-31 * *`、Phase 0 で最終日判定、17:00 完了): M-1〜M-3 = 旧 M-1M-2M-3。3 つとも「月末」なので 1 本に統合。M-3 (Management Signal) を 18:00 月次振り返り MTG 前に出揃わせる。
- **Claude routine `amd-os-l2-weekly-vc-funding-signals`** = 表示名「**AMD OS L2 週次抽出 (W-1 VCニュース/資金調達)**」(weekly Saturday 09:00 JST、`0 9 * * 6`): W-1 = 旧 W-1 VC News / Funding Signals。weekly cadence なので D/M へ混ぜない。
- **2026-06-12**: 上記 3 routine の claude.ai 表示名と起動 prompt を日本語化 (まさ指示「writer の名前は何をするやつか分かる日本語に。指示が英語なのもダメ」)。slug (= SKILL.md パス・識別子) は変更なし。起動 prompt は「最後に必ず日本語で報告」を明記。
- **MMOマシン Codex Desktop automation 維持**: H-1 = 旧 H-1 MTGフロー (毎時 9-21 時)。Claude routine 化しない。

**Claude routine = マシン非依存**: cloud で発火するため laptop を閉じても・MMO が OFF でも動く。`claude.ai/code/routines` / `/schedule` / Desktop app のどこから登録しても同じ claude.ai アカウントに入る (= MMOマシンに置く必要はない)。Desktop / Local scheduled task (`~/.claude/scheduled-tasks/`、マシン依存) と混同しない。
**制約**: 最小インターバル 1 時間、daily run cap あり (one-off は cap 外) → 同 cadence の L2 を 1 routine に束ねて run 数を最小化する設計。平常日の Claude routine run は 1 本だけ。

**先手TODO**: 旧 `proactive_outbox` + `amd-os-proactive-heartbeat` は 2026-06-27 に廃止済み。現在は `proactive_todos` を正本にし、`/api/cron/proactive-todo-extract` が MTG 起点候補と Gmail の期限つき依頼 (`email_action_request`) を作る。確認・完了は `/proactive` と dashboard 上段バッジで扱い、PJ cockpit / institution cockpit には旧TODOを出さない。正本手順は [`pwa/spec/2-4-proactive-todo-current-spec.md`](../spec/2-4-proactive-todo-current-spec.md)。

**L2 health action ledger**: `amd-os-l2-extraction-health-check` は red/yellow を検知するだけで修復しない。まず `cd pwa && npm run --silent health:l2 -- --env-file /Users/masa/projects/AMD/amd-os/pwa/.env.local --json` でread-onlyの `tmp/l2-health-latest.json` を更新し、その後 `npm run --silent health:l2:actions -- --input tmp/l2-health-latest.json` を実行すると、`tmp/l2-health-action-ledger.json` に未対応 incident が残る。各 incident は health output の row id / row name を主語に、owner、次アクション、deadline、close条件、visible worker用の短い prompt seed を持つ。healthは取得不能・rowなし・時刻不正をgreenと扱わない。正本表示名への対応が曖昧な行は `mapping_pending` として扱い、action loop側では新しいL2名や番号体系を作らない。同じ red/yellow は内部キーで集約され、次回 health で green になったものだけ `resolved` へ閉じる。これは local artifact のみで、DB / Slack / Notion / Drive / scheduler には書かない。automation登録に組み込む時は別途 scheduler change bundle が必要。

## 対象 L2

| L2 | テーブル | 役割 | 旧 writer | 現行 writer |
|---|---|---|---|---|
| M-1 monthly_reports | `monthly_reports` | PJ 月次レポート。後続 L2 の一次入力 | AMD-Report GAS R313 / PWA report route | Codex automation `AMD OS M-1 月次報告抽出` |
| D-1 AMD Protocol | `protocols` / `protocol_examples` | 経営判断を普遍パターンとして残す | GAS 155 (5/22 停止) | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではMMOマシン Codex Desktop automation `amd-os-l2-protocol-extract` を暫定 writer として扱う |
| D-2 MS 進捗 | `milestone_monthly_progress` / `project_monthly_notes` | マイルストーン月次進捗 % | ~~PWA `/api/cron/hourly-estimate` + GAS 154 ping~~ ⛔ 2026-05-29 再停止 | MMOマシン automation `amd-os-l3-ms-progress-extract` |
| D-3 PJ ナレッジ | `project_knowledge` | PJ に関する人物 / 技術 / 組織 / 市場 | GAS 155 (5/22 停止) | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではMMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract` を暫定 writer として扱う |
| D-4 メンバーナレッジ | `member_knowledge` | メンバーごとの強み / スタイル / 関心 | GAS 155 (5/22 停止) | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではMMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract` を暫定 writer として扱う |
| H-1 MTG サマリ | `project_meeting_summaries` / `meeting_notifications` | Calendar event 単位の議事録要約 | GAS 153 + GAS 074 (5/22 停止) | Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow` |
| D-5 OS 台帳差分 | `project_registry_diffs` | 5 生データ vs OS 台帳の差分候補 | 旧 Cloud routine 案 / PWA LLM route | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではCodex automation `amd-os-ms` + SKILL `amd-os-l7-registry-diff-extract` |
| M-2 XRL 根拠 | `project_xrl_evidence` | TRL/BRL/GRL/SRL/HRL の算定根拠 | 旧 Cloud routine 案 / PWA LLM route | 月末M-1後のClaude routine別枠候補。UI証跡まではCodex automation `amd-os-ms` + SKILL `amd-os-l8-xrl-evidence-extract` |
| D-6 経営ハイライト | `project_strategy_signals` | 経営判断 / 事業進捗 / 戦略転換 等 | 旧 Cloud routine 案 | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではCodex automation `amd-os` + SKILL `amd-os-l9-strategy-signal-extract` |
| D-7 Textbook Insights | `textbook_insight_candidates` | BZM 教科書へ追記すべき Before Zero 実務知見 | 新規 | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡まではCodex automation / local worker `amd-os-l10-textbook-insight-extract` + approved 後 local BZM applier |
| D-8 Atlas Signals | `atlas_signals` | 外部政策・産業・市場シグナル | 旧 Atlas個別automation / PWA routes | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。UI証跡までは未完 |
| D-9 Macrotrend Evidence / Index | `observation_log` / `macro_index_log` | macro observation / index | 旧 Macrotrend個別automation / PWA routes | Claude routine `amd-os-l2-consolidated-evidence` 登録対象。LLM非依存集計cronはPWA non-LLM cron可 |
| D-10 Member Activity Evidence | `member_activities` | Dashboard / MyPage「今週やったこと」の根拠 | Mac Codex automation `amd-os-l2-2` + PWA `member-weekly-activities` route | route は evidence 収集と POST 保存を担当し、活動文合成は Codex automation 側で行う。legacy GET synthesis は定期 writer で使わない |
| D-11 Media Mentions | `project_media_mentions` / `news_mention` notifications | メディア掲載・公開露出 | 旧通知ラベル / 手動候補 | Claude routine `amd-os-l2-consolidated-evidence` 登録対象 |
| D-13 Contract Signals | `contract_signals` / `contract_terms` / `contracts` / `contract_documents` | 5生データからの契約締結予兆、契約条件候補、契約予定枠、契約書metadata | `/api/contracts/extract-l2` / 契約管理MVP | Claude routine `amd-os-l2-consolidated-evidence` Phase K-B 登録対象。新routineは作らない |
| W-1 VC News / Funding Signals | `vc_news` / `vcs` / `vc_funds` / `vc_investments` / `project_vc_relations` | VCニュース、ファンド組成、投資活動、調達関連public signal | PWA `/api/cron/vc-discover` (停止中) / Codex automation候補 | Claude routine `amd-os-l2-weekly-vc-funding-signals` 登録対象。UI証跡までは暫定 Codex automationが差分 |
| M-3 Management Monthly Signal Evaluation | `company_management_signal_reviews` | Management予実表から月末評価を作る | 専用Codexチャット/heartbeat案 | Claude routine別枠、月末最終日17:00 JST候補。UI証跡必須 |
| D-12 freee Transaction Actuals | freee `trial_pl` / `company_actual_monthly` / `amd_management_score_raw_signals` | freee取引履歴を月次試算表の実績値へ入れる | PWA cron `/api/cron/management-score-raw-data?includeFreee=1` | PWA non-LLM daily cron。Claude routine / Codex automation に混ぜない |

M-1 monthly reports はこの章の対象。R313 は旧経路で、差分あり/未生成時に R303 generator 経由で Claude API を呼びうるため、定期 trigger を置かない。2026-05-29 実画面確認時点では `run_monthlyReportCron` / `run_L2CronDaily` trigger は存在しない。定期 writer は Codex automation `AMD OS M-1 月次報告抽出` で、正本 SKILL は [`pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md`](../scheduled-tasks/amd-os-l1-monthly-report-extract/SKILL.md)。

## Claude routine registration gate

Claude routine は 2026-06-04事故以降、**Claude Routines UIで実在を確認したものだけ**を指す。追加API課金を避ける方針自体は正しいが、登録証跡が無いものは未完。

古い trigger ID、`claude.ai/code/routines`、`~/.claude/scheduled-tasks/` は履歴調査用。止まった時に見るものは次の順にする。

1. Claude Routines UI上のroutine存在、`ACTIVE`、`next run`、`last run`
2. 初回dry runまたは手動run evidence
3. L2ごとの暫定 writer のautomation履歴、repo内 SKILL、outbox/applier

`SKILL.mdがある` と `Claude routineがACTIVE登録されている` は別物。

### Cloud routine 案を選んだ当時の理由

claude.ai/code/routines の Cloud routine は **Anthropic-managed cloud infrastructure 上の sandbox VM で実行** されるため:

- ✅ ローカル PC のスリープ / 起動状態に依存しない (= MacBook Air が closed でも明日 03:20 に発火する)
- ✅ subscription (Pro/Max/Team/Enterprise) 内で動く、追加 LLM 課金なし
- ✅ claude.ai の Connectors (= Notion/Gmail/Calendar/Drive/Slack/Supabase/GitHub) が routine 内から直接呼べる
- ✅ 複数 PC からの共有管理 (= 個人アカウントに紐づくが、Mac/Windows 両方から claude.ai/code/routines で見える)

vs ローカル Mac scheduled task の問題:
- ❌ Mac の `~/.claude/scheduled-tasks/` の routine は **「app open かつ非スリープ」中のみ発火** ([code.claude.com/docs](https://code.claude.com/docs/en/desktop-scheduled-tasks))
- ❌ 2026-05-25-26 の観察で、Mac スリープ中の cron は完全 skip → L2 取り込みゼロが継続

公式ドキュ引用:
> "Routines execute on Anthropic-managed cloud infrastructure, so they keep working when your laptop is closed." ([code.claude.com/docs/en/routines](https://code.claude.com/docs/en/routines))

## target routine 一覧 (= 2026-06-08 cadence 束ね、新ナンバリング D / M / W / H)

| 新 | target Claude routine | cadence | 対象 (旧番号) |
|---|---|---|---|
| D-1〜D-11 / D-13 | `amd-os-l2-consolidated-evidence` | daily 08:00 JST (`0 8 * * *`) | AMD Protocol / MS Progress / Project Knowledge / Member Knowledge / Registry Diff / Strategy Signals / Textbook Insights / Atlas Signals / Macrotrend / Member Activity Evidence / Media Mentions / Contract Signals |
| M-1〜M-3 | `amd-os-l2-monthend-evidence` | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、最終日判定、17:00 完了 | M-1M-2M-3 |
| W-1 | `amd-os-l2-weekly-vc-funding-signals` | weekly Saturday 09:00 JST (`0 9 * * 6`) | W-1 |
| H-1 | (MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow`、Claude routine 化しない) | 毎時 09:00-21:00 JST。開始直後にCalendar/DBの候補gateを通し、対象ゼロならH-1は3分、reviewerは2分を目安に終了する。開催済み候補がある時だけraw確認を行い、対象を間引かない。H-1はsanitized reportとOS通知まで、reviewerは未集約reportがある時だけ日次まとめを扱う。完了markerのあるrunは即時回収し、未完了runは自動で閉じず残留として可視化する | H-1 |

SKILL 正本: `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` (D 群) / `amd-os-l2-monthend-evidence/SKILL.md` (M 群) / `amd-os-l2-weekly-vc-funding-signals/SKILL.md` (W 群)。束ね SKILL は各 L2 の個別 SKILL を Phase 詳細として参照する。

## 暫定 / 復旧先 automation 一覧 (= Claude routine UI 登録証跡が出るまでの writer)

下表は **target が Claude routine に移るまでの暫定 writer**、および止まった時の復旧先。Claude routine が ACTIVE になったら、各暫定 writer は段階的に停止する (= 二重抽出を避ける)。

| 新 | 名称 | 暫定 実行場所 | automation / SKILL | 暫定頻度 | 止まった時に見る場所 |
|---|---|---|---|---|---|
| M-1 | M-1 monthly_reports | Codex automation + outbox applier | `AMD OS M-1 月次報告抽出` / `amd-os-l1-monthly-report-extract` | daily 05:30 JST | `~/.codex/automations/amd-os-ms/outbox/`、LaunchAgent applier |
| D-1 | D-1 AMD Protocol | MMOマシン Codex Desktop automation | `amd-os-l2-protocol-extract` | daily 08:00 JST | MMOマシン側 automation 履歴、`pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md` |
| D-2 | D-2 MS 進捗 | MMOマシン Codex Desktop automation | `amd-os-l3-ms-progress-extract` | 毎時 0 分 (target は daily) | MMOマシン側 automation 履歴、`amd-os-l3-ms-progress-extract/SKILL.md` |
| D-3 | D-3 PJ ナレッジ | MMOマシン Codex Desktop automation | `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | MMOマシン側 automation 履歴、`amd-os-l4-project-knowledge-extract/SKILL.md` |
| D-4 | D-4 メンバーナレッジ | MMOマシン Codex Desktop automation | `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | MMOマシン側 automation 履歴、`amd-os-l5-member-knowledge-extract/SKILL.md` |
| H-1 | H-1 MTG サマリ + フロー | Windows MMO Codex Desktop automation | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | 毎日 09:00-21:00 毎時。並行実行を維持しつつ、Calendar/DB候補gateがゼロなら3分以内を目安に終了する。H-1はsanitized reportとOS通知までで、日次配送やvisible prep threadは行わない。reviewerは開催済み候補または未集約reportがある時だけローカルreport・集約台帳・automation memoryへ日次集約を行い、日次taskを作らない。ゼロなら2分以内を目安に終了する。watchdogは完了markerをsession実体の有無に関わらず回収し、未完了runは自動で閉じず残留として可視化する | MMOマシン側 automation 履歴、`amd-os-l6-meeting-extract/SKILL.md`、`amd-os-l6-meeting-reviewer/SKILL.md`、`archive_stale_h1_codex_threads.mjs`、`npm run notify:h1-report`、automation run_state / reports |
| D-5 | D-5 OS 台帳差分 | Codex automation + outbox applier | `amd-os-ms` / SKILL `amd-os-l7-registry-diff-extract` | 6h ごと | `amd-os-ms` automation 履歴、`outbox.registryDiffs`、LaunchAgent applier |
| M-2 | M-2 XRL 根拠 | Codex automation + outbox applier | `amd-os-ms` / SKILL `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `amd-os-ms` automation 履歴、`outbox.xrlEvidence`、LaunchAgent applier |
| D-6 | D-6 経営ハイライト | Codex automation + outbox applier | `amd-os` / SKILL `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `amd-os` automation 履歴、strategy-signals outbox、LaunchAgent applier |
| D-7 | D-7 Textbook Insights | Codex automation / local worker + outbox applier + local BZM applier | `amd-os-l10-textbook-insight-extract` | TBD / manual start | `amd-os-ms` outbox `textbookInsights`、`textbook_insight_candidates`、`apply_approved_textbook_insights.mjs` |
| D-8 | D-8 Atlas Signals | (Claude routine target / 旧 Codex Atlas automation) | `POST /api/atlas/signals-ingest` | daily | `atlas_signals`、`amd-atlas/outbox/` |
| D-9 | D-9 Macrotrend | PWA non-LLM cron (index 集計) + Claude routine (observation 収集) | `macro-aggregate-indicators` / `kaken-ingest` / `grant-ingest` / `vc-investment-ingest` | 月初集計 + daily 収集 | `observation_log`、`macro_index_log`、各 cron route |
| D-10 | D-10 Member Activity Evidence | **2026-07-08 current truth**: Mac Codex automation `amd-os-l2-2` が primary。PWA route は `GET ?mode=evidence` で evidence groups を返し、Codex が合成した `activities[]` を `POST /api/cron/member-weekly-activities` で保存する | `member_google_oauth_tokens` の per-member refresh_token で全メンバー本人として Gmail/Calendar を読む。POST は全 groupId がそろわない限り delete-then-upsert しない。legacy `interactive=1` GET 一発実行は保存に使わない | daily 18:30 JST | `member_activities(source='member_weekly')`、Dashboard / MyPage read evidence、`raw_metadata.synthesis_method='codex'` |
| W-Prep | visible prep thread launch | Codex automation `w-prep-launch` | 今後7日以内の確定 upcoming MTG を Calendar + DB で照合し、必要な prep thread を作る。DBだけで完了扱いにしない。Calendar直読みでは `CFG_ColorPJHistory` を先に使い、`2025-06-01` 以降の `colorId=4` は SX/p21、`SolvioraX` は SX high-confidence alias として扱う。thread は PJディレクトリ target、`{meeting_title} prep` title、pin 必須。worker の第一声は3点完了報告、共有フォルダ資料は HTML 主成果物に統一 | weekly Wednesday 15:00 JST | `/Users/masa/.codex/automations/w-prep-launch/automation.toml`、`/Users/masa/.codex/automations/w-prep-launch/memory.md`、`pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` |
| D-11 | D-11 Media Mentions | Codex automation `amd-os-d-11` + `POST /api/media-mentions/extract` | 公開URL単位でdedupeした candidate / `news_mention` notifications | daily | 通知の「はい」で `verified=true`、 「いいえ」で `dismissed=true` |
| D-12 | freee Transaction Actuals | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` | freee取引履歴 → `company_actual_monthly` / raw signals | daily | freee同期、月次試算表実績値 |
| D-13 | D-13 Contract Signals | Codex automation `amd-os-d-13` + PWA route | `POST /api/contracts/extract-l2` | daily 03:35 JST | `contract_signals`、`contracts`、`contract_documents`、`l2_notifications(l2_kind='contract_signals')` |
| W-1 | W-1 VC News / Funding Signals | Claude routine target / 暫定 Codex automation | `amd-os-l2-weekly-vc-funding-signals` / 暫定 `amd-os-l2-vc-news-funding-signals` | weekly Saturday 09:00 JST | `vc_news`、`vcs`、`vc_funds`、`vc_investments`、review outbox |
| M-3 | M-3 Management Signal | (Claude routine target、新規) | M routine Phase C inline | 月末最終日 | `company_management_signal_reviews`、`/management-score` |
| control | 先手TODO | PWA cron + admin review | `/api/cron/proactive-todo-extract` | Vercel cron daily 09:15 JST | `proactive_todos`、`/proactive`、dashboard 上段バッジ、Gmail `email_action_request` |

## 各 L2 の入出力仕様

各 routine の SKILL.md (= `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`) に Phase 0-E の詳細手順が書かれている。以下は L2 ごとの入出力サマリ。

### M-1 monthly_reports

- 入力: active / sales PJ × {当月, 前月} の Supabase L2 snapshot primary。最低でも `project_meeting_summaries` / `project_strategy_signals` / `project_xrl_evidence` / `project_registry_diffs` / `protocols` / `project_knowledge` / `member_knowledge` / `milestone_monthly_progress` / `progress_estimate_state` / 既存 `monthly_reports` を見る
- fallback: L2 coverage が薄い・古い・source refs 不足・no-data 判定候補・backfill 候補があるときは Gmail / Drive / Calendar / Slack / Notion 5 生データを gap check する。`source_cache` だけで no-data 判定しない
- 抽出: 対象月に起きた進捗、判断、外部関係者の動き、技術/資料、リスク、来月焦点を markdown draft にする
- 出力: `monthly_reports` (`status='draft'`)。既存 `final_content` は force 明示なしで上書きしない
- 反映: `~/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` を LaunchAgent が `ms_progress_review_tool.mjs apply-outbox-dir` で反映
- 禁止: R313 trigger 復活、PWA `/api/report/generate` / `/api/cron/monthly-reports-backfill` の定期実行、従量課金LLM API の直接呼び出し

### D-1 AMD Protocol

- 入力: 直近 24 時間から増えた `project_meeting_summaries`、必要に応じて当月/前月単位の再集約
- 抽出: 分岐点 / 判断材料 / アクションを普遍化して `protocols.content` に保存
- 結果: 自動抽出では埋めない。後追いの結果観測は `protocol_result_observations`
- status: `candidate -> confirmed / rejected / archived`
- `protocols` の yes は `confirmed`。`active` ではない

### D-3 PJ ナレッジ

- 入力: `monthly_reports` + `project_meeting_summaries`
- 出力: `project_knowledge`
- category: `people`, `tech`, `ip`, `org`, `funding`, `market`, `competitor`, `strategy`, `term`
- status: `candidate -> active / rejected`
- 注意: `project_knowledge` に UNIQUE 制約は無い。既存行を壊さず `(project_id, category, entity_name)` で SELECT してから更新/追加する

### D-4 メンバーナレッジ

- 入力: `member_activities` + `project_meeting_summaries`
- 出力: `member_knowledge`
- category: `skills`, `personality`, `communication_style`, `growth_areas`, `work_style`, `interests`, `episodes`
- 現スキーマ: migration 091 以降、`member_knowledge` は `status` / `source_hash` / `last_processed_at` を持つ。列名は `pwa/design/db_schema.md` を確認してから使う
- 採否: 新規抽出は `status='candidate'`、通知 yes で `active`、no で `rejected`、古いものは `archived`

### H-1 MTG サマリ + フロー (= 2026-05-27 予定MTG + Drive資料同期まで拡張)

**現在の writer**: Codex Desktop automation `amd-os-l6-meeting-flow` (= Windows MMO PC、毎日 09:00-21:00 毎時 0 分発火 = 13回/日 × 7 = 91回/週、gpt-5.5 high reasoning)。Cloud routine は 2026-05-26 25 時時点で deprecated (= Mac/Cloud 共に問題があり Windows MMO の Codex Desktop に集約)。

**🚨 cron 設計 (= 2026-05-27 00:30 まさ要求で credit 節約)**:
- 元: 毎時 0 分 (= 24回/日 × 7 = 168回/週、深夜も走って無駄)
- 新: **毎日 09:00-21:00 毎時** (= 91回/週、元の 54%) + **Phase A 早期 exit** (= 該当 MTG event 0 件なら Phase B 以降一切実行せず 1 行 summary だけ出して終了)
- 結果: 深夜 (22:00-08:00) は完全不発火、日中も実際に MTG event がある時だけ重い Phase B-J が走る
- 土日 9-21 時も毎時走る (= AMD は柔軟、土日 MTG / 朝晩 MTG も拾う)

**役割**: 議事録抽出を超えて MTG 1 回のライフサイクル全体を自動化 (= Phase A-J、10 機能):

1. (A) 議事録抽出 + 高品質化 narrative_md (= 前後 MTG / PJ 全体 / 関連 MS を踏まえた `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の5見出し構成)
2. (C) 次 MTG カード生成 + Calendar event 登録 + 参加者招待 + Notion DB に「📋 準備情報 / 📝 議事録」toggle
3. (D) 次 MTG までのタスクを Slack nudge (= 担当者 mention + thread)
4. (E) タスク完了検出 → MTG 資料 update
5. (F) 前日までに資料未完成ならファシリに Slack DM
6. (G) 当日 MTG 終了 → MTG カード内に議事録 insert + 準備情報 toggle close
7. **(H) MTG TODO → cockpit + Calendar 作業枠 (= まさ 2026-05-26 23:55 要求)**: TODO を `tsukuyomi_nudge_queue` 等 cockpit テーブルに upsert + 実行者 & PL カレンダーに「+<PJコード> <task>」枠を freebusy 見て空き時間に作成 (= estimated_hours は LLM 推定、典型値: 資料作り 2h / 軽い調査 1h / アポ調整 0.5h)
8. **(I) automation 内で資料即生成 (= まさ要求)**: 「議事録 + monthly_reports + 既存 Drive 資料で前提が揃う」「成果物が text/markdown/Google Docs/Slides/Sheets」と判定したものは Phase I で LLM が本文生成 → Drive 保存 → Calendar 作業枠の description に「📎 資料 draft: <drive_url>」追記
9. **(J) ファシリ役名義で follow-up メール下書き (= まさ要求)**: 当該 MTG の facilitator (= projects.facilitator_member_id) 名義で Gmail draft 作成 (本送信禁止、ファシリが本人 Gmail で確認後送信)。本文構成 = 挨拶 / 本日サマリ / 決まったこと / 次回までの宿題 / 次回 MTG 概要 / 添付資料案内 / 結び。当日シェアした Drive 資料は exportLinks で PDF 化して attach
10. (旧) iOS APNs 通知 (= meeting_notifications upsert)

**入力**: Calendar event (= 過去 60-180 分終了 + 現在時刻の前後24時間にある直近予定。ただし weekly recurring は series ごとに次回1件のみ。60日先までの広い予定表メンテはM系が担当) + Notion 議事録 + Gmail (= report_emails スレッド) + Drive Doc/PDF/Office/Sheets + Slack thread + PWA `meeting_assets` (= まさが直接アップロードしたスクショ / PDF / 画面キャプチャ) + `project_meeting_summaries` 過去 3 件 (= 前回比較) + `monthly_reports` 直近 3 件 (= PJ 全体文脈) + `value_milestones` + `milestone_monthly_progress` (= MS context) + Calendar freebusy (= H 用) + `projects.drive_folder_id` + `projects.facilitator_member_id` + `project_members` (= role=PL 特定)

**Calendar color diagnostic helper (= connector 色payload欠落時の前段)**:
- Google Calendar connector が `get_colors` / raw `event.colorId` を返さない場合でも、connector 待ちだけで止めない。
- `pwa/scripts/l6_calendar_color_diagnostic.mjs` は Calendar API v3 の `events.list` / `calendarList.get` を既存 PWA Google env で read-only 実行し、対象 window の `event_id` / `calendar_id` / `summary` / `start` / `end` / 明示 `colorId` / `calendar_default.colorId` だけを返す。
- PWA 側 Google env が無い環境では、GAS Advanced Calendar Service の `gas/188_L6CalendarColorDiagnostic.js` (`l6_calendar_color_diagnostic`) を `pwaApi runFunc` から呼ぶ。GAS manifest は Calendar API v3 advanced service と calendar scope を持つ。
- GAS helper は CFG_PJAlias が読める場合だけ、alias 値を出さずに high-confidence 候補の有無も返す。
- helper は diagnostic 専用で、DB/API/outbox/Calendar/Notion/Gmail/Drive/Slack へ write しない。明示 `event.colorId` が無い event でも、CFG_PJAlias の exact / regex / bracketed / ASCII whole-token title alias が high confidence で当たり、`EXCLUDE` / `AMD` でなく、duplicate guard と既存良質サマリ保護を通る場合だけ Live 候補へ進める。単なる substring は review-only で Live 候補にしない。

**Notion eventId 方針 (= 2026-05-31 incident guard)**:
- MMO automation は Calendar event から Notion 議事録ページを見つけたら、可能な範囲で Notion page の `eventId` / 相当プロパティに Calendar event id を追記する。これは L6 writer 側の責務。
- Notion page に `eventId` が無いことだけを理由に skip しない。eventId 検索で取れない場合は title + event date + attendees + Gemini/Drive/Gmail URL で fallback 検索し、Notion が取れない場合も Gmail / Drive / Slack / Calendar 本文で `source_kinds` を判定する。
- eventId 追記に失敗しても抽出は続け、run summary に `notion_event_id_backfill_failed` と page id / reason を残す。`skip_no_notion_event_id` は現行仕様では禁止。
- Notion connector が `oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` を返した場合は、再認証を待たず `npm run h1:local-notion-fallback -- --title "<event title>" --date "<YYYY-MM-DD>" --event-id "<calendar_event_id>"` を実行し、Notion Desktop local cache から該当 page を自動探索する。hit した page は `notion-local` source として H-1 narrative 入力に使う。
- `source_kinds='none'` / `summary_short='議事録なし'` の開催済み marker は 24 時間だけ自動再探索する。通常 window から外れていても、`meeting_start_at` / `calendar_event_id` / `title` から event payload を再構成し、Local Notion fallback と他 source を再評価する。

**held-source guard (= 2026-05-31 飯野さんケース再発防止)**:
- `source_kinds='upcoming'` の準備カードは残しつつ、開催済みソースがある event は `meeting_id=<calendar_event_id>` の別 row 候補へ進める。既存 upcoming row がある場合は `prep_source_meeting_id='upcoming:<calendar_event_id>'` で紐付ける。
- Calendar event に Gemini / Google Meet notes Doc 添付、Notion 議事録ページが title + date + attendees fallback で hit、または `projects.report_emails` が空でも Gemini notes / follow-up Gmail が event 文脈で hit した場合は、準備カードだけで完了扱いにしない。
- repo guard は `pwa/scripts/l6_meeting_held_source_guard.cjs`。`npm run test:l6-held-source-guard` で `Calendar添付Geminiメモ + Notion eventId空 + report_emails空 + 既存upcoming行` から開催済み候補が出ることを検査する。
- fallback 紐付けは `confidence` と `needs_review` を残す。`projects.report_emails` の補完は自動DB更新せず、registry diff / 通知候補として出す。

**議事録本文の固定フォーマット**:
- 開催済みMTGの `narrative_md` は必ず `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順にする。
- 見出し文言・絵文字・順序は固定。`## 🎯 背景` のように絵文字と語の間に空白を入れない。
- 各見出しの本文は、MTGに参加していなかったメンバーが前提から次の動きまで理解できる段落で書く。箇条書き・チェックボックス・raw配列の貼り付けは使わない。
- `## ✅決まったこと` には会議で実際に合意・確認されたことだけを書く。Drive資料や準備資料だけからの推定は `## 📊経緯` または `## ⚠️残課題` に置く。

**予定MTGカード同期 (= LLM不要 / deterministic)**:
- H-1 は議事録抽出とは別に、`now - 24 hours` から `now + 24 hours` までの確定Calendar予定だけを `POST /api/meeting-prep/calendar-sync` に渡す。60日先までの広い予定表メンテはM系が担当する。
- recurring MTG は series ごとに次回1件だけ同期・表示する。Google Calendar の `recurring_event_id` が取れる series は cadence を問わず2件目以降の future occurrence を `recurring_series_future_occurrence` として skip する。`recurring_event_id` が無い場合も、title に `定例` / `月次` / `毎月` / `weekly` / `monthly` 等が含まれるものは曜日を外して series 推定し、曜日がズレる月次定例も1枚に畳む。それ以外は weekly cadence を推定できる series だけ同じ扱いにする。既にDBに残っている future row も cockpit 表示側でシリーズ1枚に畳む。
- `title` が `+` / `＋` 始まり、全日予定、start datetime の無い予定は除外する。
- PWA route は `project_id` が渡された場合は強制紐付け、無い場合は `projects.project_name` / `project_id` / `client_name` でPJ判定する。
- `calendar-sync` は直近24時間以内に開始済みの予定も更新対象にする。これにより、会議開始後にDrive資料を見つけたケースでもカードを補強できる。
- `projects.drive_folder_id` があるPJでは、root直下だけでなく、会議日 token (`YYMMDD` / `YYYYMMDD` / `YYYY-MM-DD`) と title token (`取締役会` / `board` / `キックオフ` / `MTG` 等) で1階層サブフォルダを探す。
- Docs / Slides / Sheets / PDF / Office files を最大8件 `{title,url,mime_type,modified_time,snippet}` に正規化し、`drive_files` として `calendar-sync` に渡す。route自体はDriveを読みに行かない。
- Drive資料は `narrative_md` の `関連Drive資料` と `summary_short` / `progress` / `risks` に反映するが、Drive資料だけで `decided` に「決定済み」とは書かない。

**H-1 task registration + owner nudge**:
- MTGカード / 議事録 / Gmail TODO / Slack TODO から次アクションが出たら、`POST /api/task-calendar/register-tasks` で `tasks` に自動登録する。
- Slack nudge は担当者本人だけへ送る。送信先は payload の `owner_slack_user_id`、無ければ `members.slack_id` で解決する。admin review queue は作らない。
- route は `task_id` で重複を止め、既存 task には既定で再通知しない。再通知が必要な時だけ `renotify_existing=true` を使う。
- Calendar 作業枠候補が必要な場合だけ `POST /api/meeting-calendar/upsert-plan` または `POST /api/task-calendar/schedule-plan` の dry-run を使う。PWA route は Calendar event 作成、Gmail返信、外部attendee招待を実行しない。

**Notion 文字起こし導線 (= PWA UI補助 / LLM不要)**:
- `CockpitMeetingSummary` は `project_meeting_summaries.notion_url` がある MTG / 予定MTGに `Notion文字起こし` CTA を出す。
- `notion_url` が無い予定MTGは、`source_url` の Calendar 予定へ遷移する `Calendarから開始` CTA を出す。Notionの録音/文字起こし開始は Notion 側で行う。
- `notion_url` も `source_url` も無い場合は `Notion未連携` と表示し、DB write / DDL / Notion page 自動作成はしない。
- L6 automation が後から `notion_url` / `eventId` を補完した場合は、PWA の `メモ再読込` で `project_meeting_summaries` を再取得する。

**H-1 reviewer (= 重大情報の落ち検知 / L3 Coverage接続)**:
- H-1保存直後または H-1 run end で、別automation `amd-os-l6-meeting-reviewer` が直近更新された開催済みMTGを再読する。
- reviewer は raw Notion/Gmail/Drive/Slack/Calendar と、保存済み `summary_short` / `narrative_md` / `decided` / `progress` / `next_actions` / `risks` を突き合わせる。raw transcript 側に CEO/社長/代表/VC/フルコミット/地元勢/PoC/PR などの重大な経営判断があるのに H-1要約が薄い場合だけ、抽出漏れ疑いとして扱う。
- 出力は `POST /api/coverage-gaps/extract` 経由の `l2_coverage_gaps(review_status='candidate', gap_class='extractor_miss', proposed_target_l2='strategy_signal')` + `l2_notifications(l2_kind='coverage_gap')`。H-1 row は自動上書きしない。
- H-1 reviewer結果は、`~/.codex/automations/amd-os-h-1-meeting-reviewer/reports/` のsanitized local reportと `aggregated_h1_reports.json`、automation memoryへ確定する。日次まとめtaskの作成・検索・追記はしない。確定後、毎時 reviewer run スレッドをアーカイブする。ローカル確定に失敗した場合は完了markerを書かず、失敗理由をautomation memoryへ残して次回runで再試行する。
- deterministic guard は `pwa/scripts/lib/h1_meeting_summary_reviewer.mjs`、CLI は `pwa/scripts/review_h1_meeting_summary.mjs`、fixture 回帰は `npm run test:h1-meeting-summary-reviewer` で検査する。

**出力**:
- `project_meeting_summaries` (PK=`meeting_id`) + `meeting_notifications` (旧)
- `meeting_assets` (= PWA から追加される private Storage 添付。routine は必要に応じて caption / extracted_text を読む)
- `tsukuyomi_nudge_queue` or `project_todos` (= cockpit TODO 反映、H)
- Calendar event (+<PJ> prefix task 枠、H)
- Drive file (= Phase I 生成資料、命名 `<YYYY-MM-DD>_<PJcode>_<task slug>_draft.<ext>`)
- Gmail draft (= Phase J follow-up メール、添付 PDF 含む)
- source_kinds: `notion+gmail+drive+slack` 等 (= 30 chars 閾値)
- 議事録なし event は `source_kinds='none'` のマーカー行を upsert (= 重複判定用)

### H-1 内 Phase P: MTG Prep セッション自動立ち上げ (2026-06-22 まさ確定)

既存 H-1 automation (`amd-os-l6-meeting-flow`、name は「H-1」) の内部に prep 用 Phase P を追加する。**新 automation は作らず、H-1 1本に統合**。

これは「明日 MTG あるけど準備してない、codex を毎回開いて『背景はこうで…』と説明するのがだるい」を OS 側で解決する仕組み。Phase P が24時間以内の MTG ごとに **codex の新規 session を事前 spawn** する。session の中で worker prompt が文脈ロード→着地点 draft→資料 draft→readiness 計算まで完遂して待機する。まさは codex desktop で該当 session に入って対話開始 (= ターミナル操作不要)。

**実行場所**: 既存 H-1 と同じ Mac codex automation (`~/.codex/automations/amd-os-l6-meeting-flow/`)。毎時 平日 09:00-21:00、15分発火で動く。

**Phase P の流れ** (= 各 MTG ごとに順次):

1. 24時間以内の upcoming MTG を抽出 (`source_kinds LIKE '%upcoming%'`、`projects.status IN ('active','sales')`、`prep_worker_status IS NULL OR 'failed'`)
2. **timing 判定**: post-MTG 即時主義で「前回 MTG 翌日 〜 今回 MTG 24時間前」の間でまさカレンダー空き枠を探す
3. **カレンダー＋枠作成**: 空き枠に `＋ <PJコード> MTG準備: <MTGタイトル>` を作成 (= 動かせるタスク、ドラッグ可)。event ID を `prep_calendar_event_id` に保存
4. **spawn 判定**: 現在時刻が prep 枠開始時刻に達してたら spawn 実行
5. **codex exec で新規 session spawn** (subprocess):
   ```bash
   codex exec --skip-git-repo-check --json \
     --output-last-message /tmp/prep-{hash}-out.txt \
     "あなたは {MTG} 専属 prep worker。pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md を読んで meeting_id={...} project_id={...} で実行。"
   ```
6. **SESSION_ID 取得**: codex stdout の `session id: {UUID}` 行から取得 → `prep_worker_session_id` に保存
7. session 内で worker prompt が `prep_*` 列を upsert + Phase 完遂で `prep_worker_status='ready'`
8. **Slack DM nudge**: H-1 run の Phase P 末尾で `ready` 達成MTG を まさ専用 Slack DM にまとめて送る

**保存先列** (`project_meeting_summaries`):
- `prep_readiness_score` (0-100) / `prep_readiness_reasons` (jsonb 内訳)
- `prep_draft_md` (= 着地点 / 背景 / 想定質問 / 持参物 Markdown)
- `prep_drive_asset_id` (= Drive 生成資料 draft の file ID、`_prep/` フォルダ配下)
- `prep_notion_page_id` (= アジェンダ草案入り議事録ページ)
- `prep_worker_session_id` (= codex SESSION_ID、まさが codex desktop で開く)
- `prep_worker_status` (`preparing` / `ready` / `failed`)
- `prep_calendar_event_id` (= ＋ prep 枠の Calendar event ID、ドラッグ追従用)
- `prep_worker_spawned_at` / `prep_worker_ready_at` / `prep_concierge_nudged_at`

**Notion AI Meeting Notes context gate**:
- worker は `pwa/scripts/l6_prep_notion_context_gate.cjs` で、当日の AI Meeting Notes page に `amd-os:notion-ai-context:{meeting_id}:{digest}` marker が入ったか確認する。
- target page があり marker 未挿入の `needs_insert` は中間状態で、`prep_worker_status='ready'` にしてはいけない。Notion MCP で append-only insert → page 再fetch → gate 再実行まで行う。
- `prep_readiness_reasons.notion_ai_context.status` は `injected` / `already_present` / `not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting` のいずれかで保存する。`needs_insert` のまま ready 保存は禁止。
- 既存 `prep_notion_page_id` が別日/別MTG page を指す場合は `wrong_page` として扱い、過去 page へ context を追記しない。

**ドラッグ追従**: まさが `＋ prep 枠` を別日時に移動したら、次の H-1 run (毎時) で `prep_calendar_event_id` 経由で Calendar を read し、新しい start time を spawn 予定時刻として更新する。

**Slack DM nudge** (= 同 H-1 run 内、Phase P 末尾):
- 送信先: `members.slack_id` から `is_admin=true` AND `code_name='まさ'` で解決 (env には保持しない)
- つくよみ口調、「{MTG} の prep セッション立ち上げといたよー / codex で開いてね」
- Link 不要 (= まさは codex desktop を自分で起動)
- `prep_concierge_nudged_at` で重複送信防止
- `failed` の MTG は別ブロックで「手動準備して」と告げる

**禁止事項**:
- Phase P / Worker は MTG 本体の議事録 (`narrative_md` / `decided` 等) を書き換えない (= 既存 H-1 Phase A の責務)
- worker draft を本ページ / 本資料 / Calendar event description に自動反映しない (= `_prep/` フォルダ / draft Notion page / DB の prep_* 列のみ)
- ended / frozen PJ、`source_kinds='upcoming_tentative'` は対象外
- recurring MTG は series ごとに次回1件のみ
- 同じ MTG に複数 session を spawn しない (`prep_worker_status` で防御)
- `claude code` で spawn しない (= まさ 2026-06-22 確定、codex 一本化)
- 定額外トークン課金経路 (= OpenAI API key 等) を使わない (= `~/.codex/auth.json` の `auth_mode='chatgpt'` 維持)

**詳細仕様**: `pwa/spec/3-3-meeting-flow-current-spec.md` 末尾「H-1 MTG Prep セッション自動立ち上げ」節 / `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` (= spawn 後の session で読まれる prompt)。

**禁止事項追加 (= Phase H/I/J 用)**:
- LLM が Calendar / Drive / Gmail に直接書き込み (= 全部 non-LLM helper `apply-outbox` 経由)
- Gmail メール本送信 (= draft 止まり、ファシリ役本人が確認後送信)
- Calendar 既存枠と重複作成 (= freebusy 必ず確認)
- TODO Calendar 枠を「+<PJ>」prefix 無しで作る (= まさルール違反)
- 生成不能タスクを強引に資料生成 (= 前提データ不足なら skip + reason 記録)

### D-5 OS 台帳差分

- 入力: 5 生データ + OS 台帳 (= `project_members` / `projects.report_emails` / `project_partners` 等)
- 出力: `project_registry_diffs` (= status='pending')
- 判定: 5 生データで言及があるが OS 台帳に無い (or 異なる) 項目を差分候補として抽出
- 通知採否で apply (= 安全な DB 更新) or `status='rejected'`

### M-2 XRL 根拠

- 入力: 5 生データ + 既存 L2 (= monthly_reports / meeting_summaries / member_knowledge 等)
- 出力: `project_xrl_evidence` (= TRL/BRL/GRL/SRL/HRL の axis × evidence、status='candidate')
- 関連メンバー (HRL ベース) は `project_founding_members` の `category in ('amd','startup','university')` 対象、VC/顧客/行政は invalid

### D-6 経営ハイライト

- 入力: 5 生データ + OS snapshot (= `amd_management_score_*` / `billing_cycles` 等)
- 出力: `project_strategy_signals` (= status='candidate')
- ルール: 「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26)、impact_level / signal_type / polarity 等 4 軸で記録
- 修正依頼は対話型 (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI 拡張) と接続予定

### D-7 Textbook Insights

- 入力: Supabase 内の既存 L2 / OS データ (= `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `protocols`, `protocol_examples`, `project_knowledge`, `member_knowledge`, `project_registry_diffs`, `project_xrl_evidence`, `amd_score_inputs`, `project_ventures`, `projects`)。`source_cache` は補助証跡であり、これだけで no-data 判定しない
- 出力: `textbook_insight_candidates` (= status='candidate') + `l2_notifications(l2_kind='textbook_insight')`
- 優先度: `before_zero_knowhow` > `cross_project_pattern` > `case_study` / `theory_evidence`
- 採否: 通知 yes で `approved`、no で `rejected`
- 追記: approved 後に local worker が `node pwa/scripts/apply_approved_textbook_insights.mjs --apply` で `pwa/bzm/*.md` へ追記し、git commit/push する。Vercel runtime から git file を直接編集しない
- target routing: `practice_kind` に応じて第8部へ振り分ける。`decision_branch` は `8-2`、`failure_learning` は `8-3`、`relationship_playbook` は `8-4`、`reusable_question` / `field_transition` は `8-5`。`cross_project_pattern` は明確な単一実践章がないため default は `8-1`、具体的な retrofit 検証ケースなら抽出側が `6-1` を明示する。`theory_case` は式・rubric・定義を変えず、BZM review 前提で `6-1` へ候補化する

## 冪等性と通知

| テーブル | 使い方 |
|---|---|
| `l2_extract_state` | `(l2_kind, target_id, scope_key)` ごとに `source_hash`, `saved_count`, `total_count`, `last_processed_at` を保存 |
| `l2_feedbacks` | レビュー担当の修正依頼。現行 automation は該当 `l2_kind` / `target_id` / `scope_key` の active feedback を prompt に入れる |
| `l2_notifications` | D-1D-3D-4D-5M-2D-6D-7 の承認カード。`saved_count` が変わったら再通知対象 |
| `meeting_notifications` | H-1 MTG サマリの承認/通知カード (= iOS APNs 通知用) |
| `progress_estimate_state` | D-2 MS 進捗の `source_hash` 差分検知 (= UNIQUE `project_id, ym`) |

## 実装時の禁止事項

- ローカル Mac scheduled task (= `~/.claude/scheduled-tasks/amd-os-l*`) を現行 writer として復活させない。復旧は現行 automation 表の実行場所から行う
- AMD-Report GAS R313 の `run_monthlyReportCron` / `run_L2CronDaily` trigger 復活 (= M-1の定期 writer は Codex automation)
- GAS 153 / 155 の kill switch を外して LLM cron を復活させない
- PWA / GAS / Vercel route から Anthropic・Gemini・OpenAI の従量課金 API を L2 抽出用途で新規に呼ばない。LLM が必要な抽出・要約・議事録品質改善は Claude routine / Codex Desktop automation / Codex automation の定額枠へ寄せる
- D-7 の承認を受けて、Vercel runtime から `pwa/bzm/*.md` を直接編集・commit しない。追記は local applier + git commit/push だけ
- D-7 の unknown `practice_kind` を helper 側で勝手に既知分類へ丸めない。`metadata_json.validation_warnings` に残し、fallback slug のまま review 対象にする
- raw Gmail / raw Notion 本文を L2 row に丸ごと保存しない (= source refs + short snippet + hash のみ)
- `member_knowledge` の列名を想像で書かない。`status` / `source_hash` / `last_processed_at` は migration 091 + `db_schema.md` 前提で使う
- L6 で Notion `eventId` 欠損だけを理由に議事録抽出を skip しない
- `protocols` の「はい」を `active` にしない。正本は `confirmed`
- 実行場所を曖昧にしない。`amd-os-l3-ms-progress-extract` のような処理IDだけで書かず、MMOマシン / Codex automation / outbox applier まで明記する
- 列名を想像しない。必ず [`pwa/design/db_schema.md`](../design/db_schema.md) を見る

## 層 (tier) 軸 と Coverage Scanner (L3) — 2026-06-15 まさ確定

L2 を語るとき、cadence (D/M/W/H = いつ走るか) とは別に **tier (どこまで吟味されたデータか)** の軸がある。両者は直交する。

- **L1** = 生データ・外部APIの値を吟味せず吸い出し/同期しただけ (LLMなし)。例: `source_cache`、**D-12 Finance/freee 実績** (`freee-payment-sync` / `management-score-raw-data` は LLM を一切呼ばない)。
- **L2** = LLM が吟味して「欲しい情報の形」に抽出した中核データ。大半の D/M/W。
- **L3** = L2 群のカバレッジ自体を見張るメタレイヤー (不在検知)。= **Coverage Scanner**。
- **非LLM派生/計算** (L1/L2 のどちらでもない) = D-2 デフォルト進捗%按分 (`ms-schedule-progress`)、D-9 macro index 集計 (`macro-aggregate-indicators`)。機械計算。

**Coverage Scanner (L3, 不在検知 / negative space)**: 個別抽出器 (D-1〜D-14) は「自分がプログラムされたパターン」しか拾わない。その上位に立ち、「**来た生データ × 既存L2カバレッジ の差分 = OSのどのL2にも構造化されていない重要情報**」を検知する安全網。起点は JOYCLE 臨時株主総会 招集通知が `source_cache` の痕跡すら残さず取りこぼされた事故。

- 実行: `amd-os-l2-consolidated-evidence` の **最終 Phase M** (全 D-Phase の後に走らせ、その日の不在を計算)。5生データを **ungated** (report_emails/active PJ で絞らない) にスイープ。
- 反映: `POST /api/coverage-gaps/extract` → `l2_coverage_gaps`(candidate) + `l2_notifications(l2_kind='coverage_gap')`。
- 採否: `/notifications` で はい=confirmed / いいえ=rejected。一覧と再現性指標は **`/admin/coverage-gaps`**。
- 各データの tier/writer 完全表は [/spec/3-0-l2-data-list-current-spec](/spec/3-0-l2-data-list-current-spec) の「層 (tier) 軸」、設計は [`design/coverage_gap_scanner.md`](../design/coverage_gap_scanner.md)。

## 残課題

| 優先 | タスク | 備考 |
|---|---|---|
| P0 | 現行 automation 履歴の見方を 3-2 / 8-3 / 6-1 で統一 | 人間が `amd-os-l3-ms-progress-extract` のようなIDだけを見て迷わないようにする |
| P1 | Mac 側 `~/.claude/scheduled-tasks/amd-os-l*` 8 個の扱いを棚卸し | 現行 writer ではない。重複稼働や誤復旧の原因になるなら disable / archive |
| P1 | 旧 `amd-os-meeting-extract` (Mac scheduled task、リネーム済の disabled) を削除 | 整理 |
| P2 | L5 `member_knowledge` の採否 UI 接続確認 | migration 091 の `status` / `source_hash` 前提で MMO automation と通知側の接続を確認 |
| P2 | `/admin/settings` に M/W/D/H L2 automation の稼働状態を表示 | MMOマシン側 / Codex automation / outbox applier / local BZM applier の状態を分けて表示 |

## 2026-05-26 移行ログ (= 履歴)

- claude.ai/code/routines に 8 個全部 entry 完了という旧記録があるが、2026-06-04事故以降はClaude Routines UIの `ACTIVE / next run / last run` 証跡が出るまで未完扱い
- SKILL 8 個を repo `pwa/scheduled-tasks/` に commit (= `41ef14c`)、Cloud routine の sandbox VM が auto-clone する正本
- 詳細経緯: [`pwa/design_log/sessions_2026-05.md`](../design_log/sessions_2026-05.md) の 2026-05-26 セクション
- 動作テスト: D-1 を手動 run で Phase 0-A-C まで確認、Sonnet 4.6 / Anthropic サーバー側 sandbox VM で動作証明
- Mac 側 9 routine (= dialogue-prep + amd-os-l*) は依然 enabled (= Cloud 動作確認後に disable 予定)
- UI bug で L5-L9 の Connector 不完全 (= Supabase 必須なのに追加不可)、handoff doc 経由で次セッションへ引き継ぎ
