# L2 データ抽出 / Outbox 仕様

> **この章は何か**: AMD OS の中核データである L2 と、5 生データ、Codex automation / MMO Codex Desktop automation / PWA non-LLM cron / outbox / LaunchAgent 反映の確定仕様。運用者向けの読み方は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも置く。

> **2026-07-22 H-1 current**: `amd-os-l6-meeting-flow` と `amd-os-h-1-meeting-reviewer` のCodex Desktop cronはPAUSED。`jp.teamarmada.amd-os-h1-background` / `jp.teamarmada.amd-os-h1-reviewer-background` LaunchAgentが非可視 `codex exec --ephemeral` を実行する。H-1は平日毎時15分、reviewerは同45分。候補gateはDBを固定scriptで先に読み、Calendarはconnectorを一度だけ確認する。候補ゼロは本文抽出・横断探索へ進まず、可視task・thread・thread marker・archiveを作らない。以下のMMO / Desktop automation記述は履歴参照であり、この段落を優先する。
>
> **2026-06-16 current truth**: Claude routines 停止前提で、まず見るべき実行主体は [`5-8-l1-l3-codex-migration-current-spec`](5-8-l1-l3-codex-migration-current-spec) とこの章の `L2 writers` 表。`Claude routine target` は履歴として残る場合があるが、現行 writer の正本ではない。

## 2026-06-16 current truth

| runtime | 現在の役割 | 主な対象 |
|---|---|---|
| Codex local automation | Mac側の primary writer。outbox を作るか、既存 route の evidence/apply 境界を使って反映する | M-1, D-6, D-8, W-1, D-10(Mac) |
| MMO側 Codex Desktop / launcher | MMO側の primary writer。meeting flow と日次知識抽出を担う | D-1, D-2, D-3, D-4, H-1 |
| PWA non-LLM cron | freee 同期や index 集計など、LLM 不要の定期処理 | D-12, D-9(index) |
| PWA route + Codex collector planned / partial | route はあるが前段 collector が未実装または段階実装中 | D-13, D-14, L3-1, M-3 |
| legacy route | 旧 D-10 の GET 一発実行。Anthropic route synthesis は `ALLOW_PWA_LLM_CRONS=1` がない限り保存に使わない | D-10 legacy fallback |

## Historical Note: 2026-06-04 registration gate

Claude定額token/routineへ載せるL2について、`~/.claude/scheduled-tasks/.../SKILL.md` が存在するだけでは登録済みと扱わない。**Claude routine** と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run`、`last run` を確認できるものだけ。

2026-06-04時点で、Claude Routines UIにroutineが1本も見えない事故が確認された。過去docsの「routine登録完了」「subscription automationで稼働」等の記述は、UI証跡が無い限り current truth として使わない。

**Claude routine = マシン非依存**: Claude routine (cloud) は Anthropic-managed cloud infrastructure で実行され、`claude.ai/code/routines` / CLI `/schedule` / Desktop app のどこから登録しても同じ claude.ai アカウントに入る。**laptop を閉じても・どのマシンが OFF でも動く**。MMOマシンに置く必要はない。これと混同してはいけないのが Desktop / Local scheduled task (`~/.claude/scheduled-tasks/`) で、こちらは**マシン依存** (app open + 非スリープ中のみ)。事故時はここに全 disabled で置かれていた。

**制約**: Claude routine は最小インターバル 1 時間、daily run cap あり (one-off は cap 外)。→ **同じ cadence の L2 を 1 routine に束ねて run 数を最小化**する。

履歴上の是正ターゲット (= 2026-06-08 時点で検討されていた cadence ベース束ね、新ナンバリング D / M / W / H):

| runtime | 対象 (新ナンバリング) | cadence | completion evidence |
|---|---|---|---|
| Claude routine `amd-os-l2-consolidated-evidence` | **D-1〜D-11 / D-13** = daily LLM L2 | daily 08:00 JST (`0 8 * * *`)、平常日 run +1 | Claude Routines UI `ACTIVE / next run / last run`、初回 one-off dry run |
| Claude routine `amd-os-l2-monthend-evidence` | **M-1〜M-3** = month-end L2 | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、最終日判定、17:00 完了 | UI 登録証跡 + run evidence |
| Claude routine `amd-os-l2-weekly-vc-funding-signals` | **W-1** = VC News / Funding Signals | weekly Saturday 09:00 JST (`0 9 * * 6`) | UI 登録証跡 + `vc_news` / review outbox evidence |
| MMOマシン Codex実行系 | **H-1** = Meeting Flow | 毎時 09:00-21:00 JST | 2026-06-08時点の実稼働は Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher。manual Live run 成功と次回run時刻を証跡にする。Claude routine 化しない |
| PWA non-LLM cron | **D-12** = Finance Ops Evidence / freee Transaction Actuals、D-9 の `macro_index_log` 集計など | D-12: `/api/cron/management-score-raw-data?includeFreee=1` daily / D-9 index: `/api/cron/macro-aggregate-indicators` monthly | code 上 LLM 非依存であること |

注: D-10 は `Member Activity Evidence` と呼び、旧「Member Weekly Activities」表記を廃止する。M-2 / M-3 は M-1 Monthly Reports を入力に含むため、M-1 が抽出できない月は正規完了扱いにしない。Media Mentions は D-11、Finance Ops Evidence / freee Transaction Actuals は D-12、Contract Signals は D-13、VC News / Funding Signals は W-1 とする。

PWA/Vercel background LLM cronはL2抽出用途では復活させない。

## 5 生データ

L2 抽出は必ず次の 5 種類を対象にする。

| 生データ | 例 |
|---|---|
| Gmail | メール、添付ファイル、外部関係者連絡 |
| Drive | Docs / Slides / Sheets / PDF / Office file |
| Calendar | event title / description / attendees / color |
| Slack | channel message / thread / file |
| Notion | 議事録 DB / PJ DB / page 本文 |

`source_cache` は旧 L1 正本ではなく、source refs / short snippet / hash の証跡キャッシュ。メール全文・議事録全文・Slack全文を L2 row に保存しない。

### PJ別 Drive 抽出root

`projects.drive_folder_id` は会議資料・提出物の**保存先**であり、既存の書込み経路の正本として維持する。Drive生データの抽出対象は、各PJで次をID単位に重複排除した集合とする。

- `projects.drive_folder_id`（設定済みの場合）
- `projects.drive_source_folder_ids[]`（追加の読み取り専用root）

追加rootは保存先へ昇格させず、抽出時だけ読み取る。共有ドライブルートも登録できるが、他PJ資料の混入を避けるため、PJ関連性を本文・folder lineage・aliasで確認してから根拠化する。root未設定や列挙未完は「生データなし」ではなく、`limitations` に残す。

### 可視母集団の全列挙契約

5生データ抽出は検索上位から始めず、`観測枠固定 -> page EOF全列挙 -> source固有ID重複排除 -> 12 PJ暫定routing -> 全unique item内容抽出 -> canonical event統合`の順で行う。

観測枠は、`source × credential/account × shared/private scope × query window × traversal policy`で固定する。

ここでいう母集団は「この観測枠でAPIまたはconnectorから列挙できる可視集合」であり、サービス内に実在する全資料を意味しない。

| 段階 | 必須契約 |
|---|---|
| page EOF全列挙 | 各root / container / thread / child streamをnext cursorが無くなるまで読む。25件・100件等の既定page size、検索上位、最初のpageで打ち切らない |
| source固有ID重複排除 | Gmail message ID、Drive file ID、Calendar instance ID、Slack message ID、Notion page/block IDでdedupeする。thread/series/parentはlineageとして別に保持する |
| 12 PJ暫定routing | 現行runで固定した正規12 project IDだけを候補に使う。単一帰属を強制せず、`multi_pj / shared / company / personal_private / unassigned / unknown`を許す |
| 内容抽出 | routingは取得対象の除外に使わない。全unique itemを対象にし、unsupported / failure / backlogは`limitations`と`incomplete`へ出す |
| canonical event統合 | source内ID dedupeと、跨sourceの同一事象統合を分ける。`canonical_event_id`は複数evidenceと複数PJを持てるが、同じeconomic / cashflow legは一度だけ計上する |

Gmailはmessageを消してthreadだけに畳まない。

Calendarはrecurring seriesとinstanceを分ける。

Driveの同一内容コピーは内容hashを共有できるが、所在、権限、PJ帰属のlineageは失わない。

Slackは可視shared/private channelのhistoryとthread repliesをそれぞれEOFまで読む。

Notion再帰は宣言root配下のchild page、child block、database itemに限り、任意link、relation、backlinkは無制限に追わない。

### source別complete/incomplete契約

各sourceのrun reportは、最低限次を必須とする。

| field | 意味 |
|---|---|
| `total` | provider推定値ではなく、全pageが返した重複込みindex行数 |
| `fetched` | 内容取得に成功したunique ID数 |
| `unique` | source固有IDの重複排除後件数 |
| `dateRange` | requested from/toと、実際に列挙したitemのobserved min/max |
| `paginationComplete` | 宣言scope内の全cursorがEOFへ達したか。世界全体の完全性ではない |
| `limitations[]` | 権限不足、private未認可、保持期間、削除、API制約、未対応形式、rate limit、cursor/再帰/内容取得失敗の構造化code |

補助fieldとして`duplicateOccurrences / fetchFailed / skipped / recursiveComplete / extractionComplete / visibilityScopes / status`も保持する。

一つでも`paginationComplete=false`、再帰未完、内容取得未完、またはlimitationsがあればsourceとrun全体を`incomplete`にする。

incomplete runの肯定証拠は候補化してよいが、欠測を0に置かず、「証拠なし」「該当なし」「全件確認済み」という否定判断へ使わない。

raw本文、個人情報、URL、メールアドレスはreport / outbox / DBへ保存しない。

永続化できるのはsource名、鍵付きID hash、内容hash、安全なlocator、日時、thread/parent hash、短い非個人特徴、PJ候補とconfidence、limitations codeだけである。

実行可能な契約は`pwa/scripts/lib/five_source_population_contract.mts`、回帰は`node --experimental-strip-types pwa/scripts/check_five_source_population_contract.mts`で確認する。

## L2 writers (新ナンバリング D / M / W / H)

cadence は **D / M / W / H** で残すが、writer は now mixed。下の表では **今動かす writer** を書く。

| 新 | data | table | current writer | 反映 |
|---|---|---|---|---|
| **D-1** | AMD Protocol | `protocols` / `protocol_examples` | MMO側 Codex Desktop automation `amd-os-l2-protocol-extract` | Supabase + notifications。yes は `confirmed` |
| **D-2** | MS Progress | `milestone_monthly_progress` / `project_monthly_notes` | MMO側 Codex Desktop automation `amd-os-l3-ms-progress-extract` + non-LLM `ms-schedule-progress` | Supabase + revisions |
| **D-3** | Project Knowledge | `project_knowledge` | MMO側 Codex Desktop automation `amd-os-l4-project-knowledge-extract` | candidate → active/rejected |
| **D-4** | Member Knowledge | `member_knowledge` | MMO側 Codex Desktop automation `amd-os-l5-member-knowledge-extract` | candidate → active/rejected |
| **D-5** | Registry Diff | `project_registry_diffs` | `amd-os-ms` 系 second wave 予定。専用writerは未再始動 | outbox → applier / notification |
| **D-6** | Strategy Signals | `project_strategy_signals` | Codex automation `AMD OS D-6 経営ハイライト抽出` (`amd-os`) | strategy-signals outbox → applier |
| **D-7** | Textbook Insights | `textbook_insight_candidates` | local worker / review / approved後 local BZM applier | candidate + notification → approved → local BZM applier |
| **D-8** | Atlas Signals | `atlas_signals` / derived `atlas_stories` / `atlas_reports` | Codex automation `AMD OS D-8 Atlas外部シグナル抽出` (`amd-atlas-2`) | outbox / apply / `atlas_signals` upsert |
| **D-9** | Macrotrend Evidence / Index | `observation_log` / `macro_index_log` / derived `macro_lane_weights` / `triple_helix_state_log` | observation collector は未整理。index は PWA non-LLM cron `macro-aggregate-indicators` | observation_log + index 集計 |
| **D-10** | Member Activity Evidence | `member_activities` | Codex automation `AMD OS D-10 メンバー活動根拠抽出 (Mac)` (`amd-os-l2-2`)。PWA route は evidence 収集 (`GET ?mode=evidence`) と保存 (`POST activities[]`) を担い、活動文合成は Codex 側で行う | Dashboard / MyPage / admin |
| **D-11** | Media Mentions | `project_media_mentions` / `news_mention` notifications | Codex automation `AMD OS D-11 メディア掲載候補抽出` → `POST /api/media-mentions/extract` | 公開URLを根拠に candidate + notification。通知の「はい」で `verified=true`、 「いいえ」で `dismissed=true` |
| **D-12** | Finance Ops Evidence / freee Transaction Actuals | freee `trial_pl` / `company_actual_monthly` / `amd_management_score_raw_signals` / finance ops tables | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` + admin review | freee取引履歴 → 月次試算表の実績値 |
| **D-13** | Contract Signals | `contract_signals` / `contracts` / `contract_documents` | Codex automation `AMD OS D-13 契約シグナル抽出` → PWA route `POST /api/contracts/extract-l2` | 契約管理 `/admin/contracts`、l2_notifications(l2_kind='contract_signals') |
| **D-14** | Action Items + Governance Email Sweep | `action_items` / `project_shareholder_meetings` / `source_cache(source='gmail_governance')` | PWA routes `POST /api/action-items/extract` / `GET /api/cron/governance-email-sweep` / `POST /api/governance/extract` + Codex collector planned | `/admin/projects` の「総会」「役会」ON PJだけ `report_emails` × ガバナンスkeywordで Gmail を検索し、既定は候補、`apply=1` で canonical + Drive添付保存 |
| **D-15** | Important Evidence | `l2_coverage_gaps` → 採用後`project_important_evidence` | 5生データを共通正規化。DriveはPDF / Word / Excel / PowerPoint / Google native / textを本文化し、画像PDFはOCR待ちを明示。LSTは最初の回帰例 | `coverageGaps[]` outbox → non-LLM applier → 通知採否。重要カテゴリ、PJ帰属、本文hash、全所在lineage、field provenanceを保持 |
| **M-1** | Monthly Reports | `monthly_reports` | Codex automation `AMD OS M-1 月次報告抽出` (`amd-os-l2`) | monthly reports outbox → applier |
| **M-2** | XRL Evidence | `project_xrl_evidence` / `project_founding_members` | `amd-os-ms` 系 second wave 予定 | M-1後に抽出。candidate → confirmed |
| **M-3** | Management Monthly Signal | `company_management_signal_reviews` | month-end runner planned | M-1 / M-2後に抽出。18:00 MTG 前に出揃わせる |
| **W-1** | VC News / Funding Signals | `vc_news` / `vcs` / `vc_funds` / `vc_investments` / `project_vc_relations` | Codex automation `AMD OS W-1 VCニュース・資金調達シグナル抽出` (`amd-os-l2-vc-news-funding-signals`) | reviewable candidates。安全な write path が曖昧なら blocked summary |
| **H-1** | Meeting Flow | `project_meeting_summaries` / `meeting_assets` | MMOマシン Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` / Mac fallback `AMD OS H-1 MTGフロー` | Supabase / Calendar / Drive / Gmail draft |

## H-1 MTG サマリの開催済みソース guard

`project_meeting_summaries` は準備カードと開催済み議事録を同じ table に別 row で持つ。準備カードは `meeting_id='upcoming:<calendar_event_id>'` / `source_kinds='upcoming'`、開催済み議事録は `meeting_id='<calendar_event_id>'`。既存準備カードを削除せず、開催済み row には `prep_source_meeting_id` が使える場合だけ `upcoming:<calendar_event_id>` を入れる。

H-1 writer は、次のいずれかがある event を upcoming だけで完了扱いにしない。

- Calendar event attachments / conference notes / description に Gemini / Google Meet notes の Google Docs link がある
- Notion 議事録ページの `eventId` が空でも、同日または近接日、title token、attendees、PJ context、Gemini / Drive / Gmail URL で該当 Calendar event へ fallback match できる
- `projects.report_emails` が空の PJでも、Gemini notes sender や follow-up Gmail が event title / PJ / client / attendee 文脈で hit する

fallback match は `confidence` と `needs_review` を run summary / candidate metadata に残す。`projects.report_emails` の不足は自動 DB 更新せず、`project_registry_diffs` または通知/outbox の config gap として出す。

Executable guard: `cd pwa && npm run test:l6-held-source-guard`。fixture は飯野さんケース相当 (`Calendar添付Geminiメモ + Notion eventId空 + report_emails空 + 既存upcoming行`) で、開催済み `meeting_id=<event_id>` 候補、`source_kinds` に `drive/gmail/notion`、`prep_source_meeting_id`、config gap が出ることを検査する。

## Writer 境界

- D/M/W の current writer は Codex automation / MMO側 Codex Desktop automation / PWA non-LLM cron。Claude routine 記述は履歴参照としてのみ扱う。
- H-1 だけ MMOマシン Codex実行系が primary writer。Mac側 `AMD OS H-1 MTGフロー` は fallback / verification を含む。
- D-10 は 2026-07-08 以降、定期 writer では内部 Anthropic route synthesis を使わない。Codex automation が evidence groups を合成し、PWA route は POST 保存だけを担う。
- 旧 GAS 153 / 155、AMD-Report GAS R313、PWA LLM cron は定期 writer として復活させない。
- PWA `/api/cron/hourly-estimate` は `ALLOW_PWA_LLM_CRONS=1` がない限り disabled response のみ。
- D-7 は `/notifications` の「はい」で DB 候補を `approved` にするだけ。git 管理の `pwa/bzm/*.md` 追記は local applier / worker が行い、Vercel runtime から直接 commit しない。

## Outbox 契約

| outbox | 用途 |
|---|---|
| `~/.codex/automations/amd-os-ms/outbox/` | monthlyReports / registryDiffs / xrlEvidence / MS revision / important document coverageGaps |
| `~/.codex/automations/amd-os/strategy-signals-outbox/` | D-6 経営ハイライト |
| `~/.codex/automations/amd-atlas/outbox/` | Atlas 外部 signal |

反映はローカルの非LLM LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が行う。成功 file は `applied/`、失敗 file は `failed/` へ移動する。

## 採否 / 正本反映

| kind | yes | no |
|---|---|---|
| MS進捗 revision | monthly modal 側で confirm | discard |
| OS台帳差分 | allowlist 済み DB 更新 | `project_registry_diffs.status='rejected'` |
| XRL根拠 | `project_xrl_evidence.status='confirmed'` | `rejected` |
| 経営ハイライト | `project_strategy_signals.status='confirmed'` | `rejected` |
| Textbook Insights | `textbook_insight_candidates.status='approved'` → local applier で `pwa/bzm/*.md` 追記 | `rejected` |
| PJナレッジ | `project_knowledge.status='active'` | `rejected` |
| AMD Protocol | `protocols.status='confirmed'` | `rejected` |
| founding members | `project_founding_members.status='active'` | `invalid` |
| 重要情報 | `l2_coverage_gaps.confirmed` → `project_important_evidence.status='confirmed'`へ追記。接続先とBZM入力は候補のまま | gapを`rejected`、正本行は作らない |

## 禁止事項

- `source_cache` だけを見て no-data 判定しない。
- 5 生データのうち一部だけで「全部確認済み」と扱わない。
- `monthly_reports.final_content` を `force:true` なしで上書きしない。
- R313 / `/api/cron/monthly-reports-backfill` を定期 writer にしない。`/api/report/generate` と `/api/monthly-report/edit-by-tsukuyomi` は410停止を維持する。
- raw source 全文を L2 row や通知に保存しない。
- 存在しない列名や status 値を想像で書かない。`pwa/design/db_schema.md` を確認する。

## 個別 Rebuild Spec

| L2 | rebuild spec |
|---|---|
| D-1 AMD Protocol | [/spec/3-9-l2-protocol-current-spec](/spec/3-9-l2-protocol-current-spec) |
| D-2 MS Progress | [/spec/3-10-l2-ms-progress-current-spec](/spec/3-10-l2-ms-progress-current-spec) |
| D-3 Project Knowledge | [/spec/3-11-l2-project-knowledge-current-spec](/spec/3-11-l2-project-knowledge-current-spec) |
| D-4 Member Knowledge | [/spec/3-12-l2-member-knowledge-current-spec](/spec/3-12-l2-member-knowledge-current-spec) |
| D-7 Textbook Insights | [/spec/3-13-l2-textbook-insights-current-spec](/spec/3-13-l2-textbook-insights-current-spec) |
| D-15 Important Evidence | [/spec/3-18-important-document-extraction-current-spec](/spec/3-18-important-document-extraction-current-spec) |

## 復旧時の確認順

1. 該当 L2 の現行 writer がどこかをこの章で確認する。
2. repo 内 SKILL (`pwa/scheduled-tasks/.../SKILL.md`) を読む。
3. outbox がある L2 は file が `outbox/`, `applied/`, `failed/` のどこにあるか確認する。
4. LaunchAgent / helper の失敗種別を分けて記録する。
5. DB/API へ直接逃げず、outbox 経路で閉じる。

## L2 health red/yellow 後の action loop

`health:l2` は見張り番であり、抽出器の修復や外部書き込みはしない。ただし red/yellow を報告だけで終わらせないため、health JSON の後段で `health:l2:actions` を実行し、ローカル action ledger に未対応 incident を残す。

```sh
cd pwa
npm run --silent health:l2 -- --env-file /Users/masa/projects/AMD/amd-os/pwa/.env.local --json --fail-on-red
npm run --silent health:l2:actions -- --input tmp/l2-health-latest.json
```

`health:l2` は canonical L2 table の最新時刻をread-onlyで確認して `pwa/tmp/l2-health-latest.json` を作る。環境値を表示せず、取得不能・rowなし・時刻不正は green へ推測せず yellow にする。fixture 回帰は `npm run --silent test:l2-health`。action ledger の既定出力は `pwa/tmp/l2-health-action-ledger.json`。この artifact は local state で、DB / Slack / Notion / Drive / scheduler には書き込まない。recurring automation 登録や schedule 変更が必要な場合は、対象・影響・rollbackを scheduler change bundle として別タスクへ渡す。

各 red/yellow 行は、health output の row id / row name を主語にした incident に変換する。action loop側では正本mappingを再設計せず、新しい L2 データ名や番号体系を作らない。正本表示名への対応が曖昧な行は `mapping_pending` として扱い、丸数字表現へ戻さない。health output 側の行IDや内部キーは incident 管理用であり、新しい L2 データ名として扱わない。

| field | 意味 |
|---|---|
| `actionRequired` | red/yellow は必ず `true`。green で解消した incident は `false` |
| `ackRequired` | red、failed/stale outbox、review_required は `true` |
| `owner` | 復旧workerの責任範囲。verification / outbox drain / review drain / extraction recovery / scheduler evidence に分類 |
| `recommendedNextStep` | その failureMode に対して次にやること |
| `workerPromptSeed` | 司令塔が visible worker を切る時に使える短い prompt |
| `deadline` | red は原則 24h、yellow は原則 72h 以内 |
| `closeCondition` | green 判定、fresh output、review_required 採否、outbox 分類などの close 条件 |
| `status` | `open` / `reopened` / `resolved` |
| `firstSeenAt` / `lastSeenAt` / `occurrences` | 同じ incident の継続回数 |
| `resolvedAt` / `lastGreenAt` | 次回 health で該当 L2 が green になった時の close 証跡 |

同じ red/yellow を毎回新規起票しないために、ledger 内部では `L2 health row id + failureMode + destination` から重複判定用の技術キーを作る。このキーは UI や手順の主語にせず、「health output のどの row が red/yellow か」「次に誰が何をするか」を主語にする。

red/yellow の標準処理は次の順番。

1. `health:l2` の結果を読む。
2. `health:l2:actions` で action ledger を更新する。
3. `currentOpenWorkerPrompts[]` から優先度順に visible worker を切る。
4. worker は修復または安全な復旧 bundle を実行し、`health:l2` を再チェックする。
5. 次回 `health:l2:actions` で同じ incident は重複起票されない。該当 L2 が green なら `resolved` へ close される。

close は「報告した」ではなく、次のいずれかで閉じる。

- fresh な DB/applied output evidence が確認され、health が green になった。
- zero-output の場合は明示 no-data / report artifact があり、health が green または理由付き yellow へ落ちた。
- review_required は owner/action/status が付き、未読放置ではなく採否または明示保留へ進んだ。
- failed/stale outbox は再投入済み / 要手動修正 / 破棄禁止保留のどれかに分類され、同じ failure が未分類で残らなくなった。
