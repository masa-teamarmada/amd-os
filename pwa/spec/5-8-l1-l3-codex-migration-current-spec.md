# L1-L3 Codex移植仕様

> **この章は何か**: Claude routines 停止前提で、AMD OS の L1 / L2 / L3 抽出を Codex 側へ移すための current truth。`3-0` / `3-1` / `5-3` が持つ「Claude routine target」設計のうち、**2026-06-16 時点でどこまで Codex へ寄せられていて、何が未移植か**を棚卸しする正本。

## 2026-06-16 current truth

AMD OS では、当面 **Claude routines / `claude -p` / Claude Agent SDK / Claude Code CI / third-party wrapper 常駐実行** を L1-L3 抽出の前提にしない。以後の primary は次の4系統に寄せる。

1. **Codex local automation**: Mac / MMO の visible automation。`automation.toml` と run evidence を持つ。
2. **Codex worker manual run**: visible worker が SKILL / route / helper を読んで都度実行する。
3. **PWA non-LLM cron**: freee 同期や index 集計など、LLM 不要の定期処理。
4. **outbox + applier**: LLM 抽出結果の DB 反映は helper / LaunchAgent / route へ分離する。

`Claude routine` を target と書いてある既存 spec は、**移植前提の履歴**として読む。実行主体の current truth はこの章を優先する。

## 実行面の原則

- hidden subagent は使わない。復旧・移植・監視は visible worker か visible automation に限る。
- scheduler 変更、automation の create/update/delete/enable/disable、Windows Task Scheduler 変更、LaunchAgent 変更は **approval bundle** を作る。
- DB / Slack / Notion / Drive / Gmail / Calendar への write は、既存 route / helper / applier が担う。新しい直書き経路を増やさない。
- RED は「調査報告で終わり」にしない。`health:l2` + `health:l2:actions` → `currentOpenWorkerPrompts[]` → visible worker の流れで、**復旧・approval bundle 化・司令塔通知**のどれかへ必ず進める。

## L1-L3 抽出 inventory

| ID / name | 現在の実行主体 | 入力 source | 出力 destination | 頻度 | Claude依存 | Codex移植方針 | scheduler変更 | write boundary | RED/health接続 | 優先 |
|---|---|---|---|---|---|---|---|---|---|---|
| M-1 Monthly Reports | Mac Codex automation `amd-os-l2` が **ACTIVE** | 既存L2 snapshot + 5生データ fallback | `amd-os-ms/outbox.monthlyReports` → applier → `monthly_reports` | daily 05:30 JST | なしで運用可能 | **Codex primary として継続運転** | 不要 (再始動済み) | outbox only | health の M-1 row / outbox stale / applied evidence | P0 |
| D-1 AMD Protocol | repo SKILLのみ。旧 MMO / Claude target 記述あり | `project_meeting_summaries` + `monthly_reports` + feedback | `protocols` / `protocol_examples` / notifications | daily target | 旧 target が Claude | **新規 visible Codex automation** へ移す。まず manual run で prompt / output contract を固める | 要 | DB write は existing path のみ | health D-1 red 時は protocol recovery worker | P0 |
| D-2 MS Progress revision | 非LLM default は PWA cron。LLM revision writer は visible primary 不在 | `monthly_reports` + `meeting_summaries` + `progress_estimate_state` | `ms_progress_revisions` / notifications | daily target | 旧 target が Claude | default は現状維持。**LLM revision 提案だけ Codex worker / automation** へ分離する | 要 | revision candidate only | health D-2 row / revision drain | P1 |
| D-3 Project Knowledge | repo SKILLのみ。旧 MMO / Claude target 記述あり | `monthly_reports` + `meeting_summaries` + feedback | `project_knowledge` / notifications | daily target | 旧 target が Claude | **新規 visible Codex automation**。D-1 と同じ cadence bundle 候補 | 要 | candidate rows only | health D-3 row | P1 |
| D-4 Member Knowledge | repo SKILLのみ。旧 MMO / Claude target 記述あり | `member_activities` + `meeting_summaries` + `milestone_responsibility` | `member_knowledge` / notifications | daily target | 旧 target が Claude | **新規 visible Codex automation**。D-10 生成物を入力に使う | 要 | candidate rows only | health D-4 row / review drain | P1 |
| H-1 Meeting Flow | Mac fallback automation `amd-os-l6-meeting-flow` **ACTIVE**。MMO launcher は別正本 | Calendar / Notion / Gmail / Drive / Slack / `meeting_assets` | `project_meeting_summaries`、予定MTGカード、必要時 review artifact | hourly 09:00-21:00 JST | なし | **現状維持**。Codex primary として扱う | approvalは MMO 側変更時のみ | route / existing write path only | health H-1 row、review_required 件数 | P0 |
| D-5 Registry Diff | helper / outbox はあるが visible writer は未確定。旧 `amd-os-ms` prompt に同居 | 5生データ vs OS台帳 | `outbox.registryDiffs` → applier → `project_registry_diffs` | daily target | 旧 target が Claude | **M-1 と同じ outbox 系 Codex automation へ bundle**。単独 runner を足さず `amd-os-ms` 系へ寄せる | 要 | outbox only | health D-5 row / outbox stale | P1 |
| M-2 XRL Evidence | helper / outbox apply あり。visible writer は未確定 | 5生データ + `monthly_reports` + 既存L2 | `outbox.xrlEvidence` → applier → `project_xrl_evidence` | month-end | 旧 target が Claude | **month-end Codex automation** へ移す。M-1 成功後のみ実行 | 要 | outbox only | health M-2 row / outbox drain | P1 |
| D-6 Strategy Signals | Mac Codex automation `amd-os` が **ACTIVE** | 5生データ + OS snapshot | `strategy-signals-outbox` → applier → `project_strategy_signals` | daily 03:20 JST | なしで運用可能 | **Codex primary として継続運転** | 不要 (再始動済み) | outbox only | health D-6 row / strategy outbox | P0 |
| D-7 Textbook Insights | SKILL / outbox / local BZM applier あり。visible writer は未確定 | 既存L2 / OSデータ | `outbox.textbookInsights` → `textbook_insight_candidates` → approved 後 local applier | daily target / manual | 旧 target が Claude | **manual Codex worker 先行**で十分。定期化は後段 | 要 | outbox then local file apply | health D-7 row / approved drain | P2 |
| D-8 Atlas Signals | Codex automation `amd-atlas-2` が **ACTIVE**。applier あり | public web / reliable external sources | `amd-atlas(-2)/outbox` → applier / `POST /api/atlas/signals-ingest` | daily 08:10 JST | なしで運用可能 | **Codex primary として継続運転** | 不要 (再始動済み) | outbox only | health D-8 row / outbox drain | P0 |
| D-9 Macrotrend Evidence / Index | observation writer は未確定、index 集計は PWA non-LLM cron | external observation + `atlas_signals` | `observation_log` / `macro_index_log` | observation daily, index monthly | 旧 target が Claude (observation only) | **observation を Atlas 系 Codex workerへ寄せる**。index cron は現状維持 | observation側のみ要 | PWA route / DB via existing path | health D-9 row | P1 |
| D-10 Member Activity Evidence | Mac Codex automation `amd-os-l2-2` (`AMD OS D-10 メンバー活動根拠抽出 (Mac)`) と MMO launcher。**どちらも Codex 側 writer だが、内部では Anthropic API を呼ぶ PWA route を叩く** | member OAuth Gmail / Calendar / `source_cache` / `meeting_summaries` | `member_activities(source='member_weekly')` | daily 18:30 JST (Mac) / 19:30 JST (MMO) | **あり**。`/api/cron/member-weekly-activities` が `@anthropic-ai/sdk` を直接呼ぶ | **例外許容**。当面は Codex 側 writer として継続しつつ、将来は route 内 LLM を Codex 本体へ寄せる | MMO 側変更時のみ要 | 現状は PWA route write | health D-10 row / token errors | P0 |
| D-11 Media Mentions | spec / phase 定義のみ。visible writer 不在 | public media / existing mention rows | `project_media_mentions` / notifications | daily target | 旧 target が Claude | **要設計**。runner と dedupe contract を先に固める | 要 | candidate rows only | health D-11 row | P2 |
| D-12 Finance/freee | PWA non-LLM cron current | freee / finance tables / billing | `company_actual_monthly` / raw signals / billing updates | daily | 依存なし | **移植不要**。current を維持 | 不要 | direct route write (non-LLM) | health D-12 row は freshness確認のみ | P0 |
| D-13 Contract Signals | PWA route はあるが source sweep runner 不在 | 5生データ / source_cache / MTG context | `contract_signals` / `contracts` / `contract_documents` / notifications | daily target | 旧 target が Claude | **route 前段の Codex collector を新設**する | 要 | route POST only | health D-13 row / contract review | P1 |
| D-14 Action Items | PWA route はあるが source sweep runner 不在 | Gmail first、将来 Drive/Calendar/Slack/Notion | `action_items` / notifications | daily target | 旧 target が Claude | **route 前段の Codex collector を新設**。governance系の最優先候補 | 要 | route POST only | governance / action-item review、health対象拡張候補 | P0 |
| L3-1 Coverage Scanner | PWA route はあるが negative-space sweep runner 不在 | ungated 5生データ + claimed-source index | `l2_coverage_gaps` / notifications | daily target | 旧 target が Claude | **route 前段の Codex collector を新設**。D-13/D-14 と同じ source sweep bundleで設計 | 要 | route POST only | health row / coverage gap admin queue | P0 |
| W-1 VC News / Funding Signals | Codex automation `amd-os-l2-vc-news-funding-signals` が **ACTIVE** | public VC / funding sources | reviewable VC candidates | weekly Saturday | なしで運用可能 | **Codex primary として継続運転** | 不要 (再始動済み) | review-first / blocked summary | weekly health or manual evidence | P1 |
| M-3 Management Monthly Signal | table / UI はあるが visible writer 不在 | `company_management_score_*` + D-6 + D-12 + W-1 + M-1/M-2 | `company_management_signal_reviews` | month-end | 旧 target が Claude | **month-end Codex worker / automation を新設**。M-1/M-2 後段 | 要 | candidate rows only | management review evidence | P1 |

## 分類

### すぐ Codex へ移せるもの

- H-1 Meeting Flow: すでに Codex active。current truth をそのまま維持する。
- D-10 Member Activity Evidence: Codex 側 writer はすでにある。Anthropic route 依存は残るが、例外許容で継続する。
- D-12 Finance/freee: 非LLM cron なので移植対象外。
- M-1 Monthly Reports: `amd-os-l2` はすでに ACTIVE。Codex 側の主系として継続できる。
- D-6 Strategy Signals: `amd-os` はすでに ACTIVE。Codex 側の主系として継続できる。
- D-8 Atlas Signals: `amd-atlas-2` はすでに ACTIVE。Codex 側の主系として継続できる。
- W-1 VC News / Funding Signals: `amd-os-l2-vc-news-funding-signals` はすでに ACTIVE。weekly の主系として継続できる。

### approval bundle が必要なもの

- MMO / Windows Task Scheduler 側の新規 launcher 追加や schedule 変更。
- LaunchAgent 監視対象ディレクトリ追加。
- D-1 / D-3 / D-4 / D-5 / M-2 / M-3 / D-13 / D-14 / L3 の新規 recurring automation 登録。

### 仕様未実装 / 要設計のもの

- D-11 Media Mentions: extraction runner と review contract が未確定。
- D-13 Contract Signals: route はあるが collector が未実装。
- D-14 Action Items: route はあるが collector が未実装。
- L3-1 Coverage Scanner: route はあるが ungated source sweep runner が未実装。
- M-3 Management Monthly Signal: table / UI はあるが Codex runner が未実装。

## first execution unit

1. **運転継続**: `amd-os-l6-meeting-flow`、`amd-os-l2-2`、`amd-os-l2-extraction-health-check` を current のまま維持する。D-10 は例外許容の paid route 依存ありとして扱う。
2. **first wave keep-running**: `amd-os-l2` → `amd-os` → `amd-atlas-2` → `amd-os-l2-vc-news-funding-signals` はすでに ACTIVE。各 run evidence / outbox / applied / DB row を継続監視する。
3. **second wave runner build**: D-5 / M-2 / D-7 を `amd-os-ms` 系 outbox contract に揃えて visible Codex automation 化する。
4. **third wave design+runner**: D-13 / D-14 / L3 / M-3 は既存 POST route を活かす collector runner を新設する。

## RED / health 運用

- health red/yellow は `npm run --silent health:l2 -- --json --fail-on-red` の出力に対して `npm run --silent health:l2:actions -- --input tmp/l2-health-latest.json` を続ける形を正とし、`tmp/l2-health-action-ledger.json` の `currentOpenWorkerPrompts[]` を visible worker seed にする。
- worker の完了形は 3 種だけ: `green に戻した` / `approval bundle を作った` / `review_required / blocked artifact を作った`。
- 同じ failure が続いたら、scheduler / env / outbox / review queue のどこで詰まっているかを分類し、`owner / deadline / next step` を open-worker-queue に残す。

## 禁止

- Claude routines 停止を理由に、PWA / GAS / Vercel へ新しい従量課金 LLM cron を戻さない。
- repo 上の SKILL だけを見て「実行中」と扱わない。必ず automation status / run evidence / DB evidence を見る。
- local automation の status を変える前に、同 cadence の既存 active writer を見ずに二重実行させない。
