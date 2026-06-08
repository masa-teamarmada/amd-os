# L2 データリスト / Cadence Writer Matrix

> **この章は何か**: AMD OS の L2 データを D / M / W / H の cadence ナンバリングで一覧化するトップページ。詳細仕様へ入る前に、どの L2 がどの cadence で、どの実行基盤に置かれるべきかを確認する入口。

## 基本方針

L2 は cadence ごとに束ねる。Codex が持ってよい L2 系は **H 系だけ**。D / M / W のうち LLM 抽出が必要なものは Claude routine に置く。LLM 不要の daily 同期は PWA non-LLM cron に置く。

| 系 | 意味 | 本来あるべき置き場所 | cadence |
|---|---|---|---|
| **D** | Daily | Claude routine `amd-os-l2-consolidated-evidence` / PWA non-LLM cron | daily |
| **M** | Month-end | Claude routine `amd-os-l2-monthend-evidence` | 月末 |
| **W** | Weekly | Claude routine `amd-os-l2-weekly-vc-funding-signals` | weekly |
| **H** | Hourly | MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow` | hourly |

Claude routine と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run` を確認できるもの。実出力の完了証跡は `last run` または初回 one-off evidence で別途確認する。`SKILL.md` や repo 上の仕様があるだけでは登録済み扱いにしない。

## D系: Daily

| 新番号 | データ名 | primary table / source | 本来あるべき置き場所 | 現状差分 |
|---|---|---|---|---|
| **D-1** | AMD Protocol | `protocols` / `protocol_examples` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。初回run evidenceは未実行 |
| **D-2** | MS Progress | `milestone_monthly_progress` / `project_monthly_notes` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。旧MMO個別automationはPAUSED |
| **D-3** | Project Knowledge | `project_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。旧MMO個別automationはPAUSED |
| **D-4** | Member Knowledge | `member_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。旧MMO個別automationはPAUSED |
| **D-5** | Registry Diff | `project_registry_diffs` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み |
| **D-6** | Strategy Signals | `project_strategy_signals` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み |
| **D-7** | Textbook Insights | `textbook_insight_candidates` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。approved後のBZM local applierは別段階 |
| **D-8** | Atlas Signals | `atlas_signals` / derived `atlas_stories` / `atlas_reports` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み |
| **D-9** | Macrotrend Evidence / Index | `observation_log` / `macro_index_log` | Claude routine `amd-os-l2-consolidated-evidence` + PWA non-LLM cron `macro-aggregate-indicators` | 差分なし: Claude UIでACTIVE / next run確認済み。index集計cronはPWA non-LLM |
| **D-10** | Member Activity Evidence | `member_activities` | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み |
| **D-11** | Media Mentions | `project_media_mentions` / `news_mention` notifications | Claude routine `amd-os-l2-consolidated-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み |
| **D-12** | freee Transaction Actuals / 月次実績取込 | freee `trial_pl` / `company_actual_monthly` / `amd_management_score_raw_signals` | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` | 差分なし: `pwa/vercel.json` で daily cron 定義済み。LLM routine / Codex automation には載せない |

## M系: Month-end

| 新番号 | データ名 | primary table / source | 本来あるべき置き場所 | 現状差分 |
|---|---|---|---|---|
| **M-1** | Monthly Reports | `monthly_reports` | Claude routine `amd-os-l2-monthend-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。MMO暫定automationはPAUSED |
| **M-2** | XRL Evidence | `project_xrl_evidence` / `project_founding_members` | Claude routine `amd-os-l2-monthend-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。**M-1 Monthly Reports 抽出後に実行する** |
| **M-3** | Management Monthly Signal | `company_management_signal_reviews` | Claude routine `amd-os-l2-monthend-evidence` | 差分なし: Claude UIでACTIVE / next run確認済み。**M-1 Monthly Reports と M-2 XRL Evidence 抽出後に実行する** |

M-2 / M-3 は M-1 の結果を入力に含む。M-1 が抽出できない月は、M-2 / M-3 を正規完了扱いにしない。

## W系: Weekly

| 新番号 | データ名 | primary table / source | 本来あるべき置き場所 | 現状差分 |
|---|---|---|---|---|
| **W-1** | VC News / Funding Signals | `vc_news` / `vcs` / `vc_funds` / `vc_investments` / `project_vc_relations` | Claude routine `amd-os-l2-weekly-vc-funding-signals` | 差分なし: Claude UIでACTIVE / next run確認済み。MMO暫定automationはPAUSED |

## H系: Hourly

| 新番号 | データ名 | primary table / source | 本来あるべき置き場所 | 現状差分 |
|---|---|---|---|---|
| **H-1** | Meeting Flow | `project_meeting_summaries` / `meeting_assets` | MMOマシン Codex実行系。現状は Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher | 復旧済み: 2026-06-08 16:00 JST manual Live run 成功、次回 17:00 JST。Codex Desktop UI automation storeは未登録/旧DB不使用のため、UI上の`amd-os-l6-meeting-flow`ではなくLive launcherを実稼働証跡にする |

## 移管ゲート

D / M / W を Claude routine へ配置完了と扱うには、各 routine で次を確認する。

1. Claude Routines UI上に routine が存在する。
2. UI上で `ACTIVE` と `next run` を確認できる。
3. 二重実行防止のため、MMO側の暫定 D / M / W Codex automation が `PAUSED` になっている。

実出力の完了証跡は、`last run` または初回 one-off / dry run evidence と、対象 L2 の DB row / outbox / applied / UI read evidence のどれかで別途確認する。初回run前でも、配置としては Claude routine ACTIVE + MMO暫定PAUSED を current state とする。

## 関連章

- D / M / W / H の抽出責務: `/spec/3-1-l2-data-extraction-current-spec`
- Automation 責務分担: `/spec/5-3-automation-responsibility-current-spec`
- L2⑥ Meeting Flow: `/spec/3-3-meeting-flow-current-spec`
- W-1 SKILL: `pwa/scheduled-tasks/amd-os-l2-weekly-vc-funding-signals/SKILL.md`
