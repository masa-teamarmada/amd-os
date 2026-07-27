---
name: amd-os-l2m1-monthly-report
description: AMD OS L2 M-1 月次業務報告書生成 routine (= 旧 amd-os-l1-monthly-report-extract のリネーム + 内部/対外 2 段生成 + PDF 配送)。月末末日 03:00 JST 起動 (cron `0 3 28-31 * *` + Phase 0 で「今日 == 当月最終日」を JST 判定し、最終日でなければ即 exit)。対象は `projects.monthly_report_scope IN ('internal_only','internal_and_external')` かつ `status IN ('active','sales')` の PJ のみ。scope='internal_only' は内部保存版のみ生成 (対外版・PDF・Drive 配置 skip)、scope='internal_and_external' は 2 段生成 + PDF まで実行。各 PJ ごとに (1) Slack 開始通知、(2) 当月の Supabase 関連データを全 fetch、(3) `llm_prompts.l2m1.monthly_report.internal.v2` で内部保存版 markdown 生成 → `monthly_reports.final_content` upsert、(4) scope='internal_and_external' のみ: `llm_prompts.l2m1.monthly_report.external.v2` + 禁止語/allow_list で対外提出版 markdown 生成 → `monthly_reports_external` insert、(5) 禁止語チェック (`scripts/strip_internal_jargon.py`)、(6) PDF 生成 (`scripts/generate_monthly_report.py`、pandoc→HTML→Chrome headless→PDF) でローカル + 共有 Drive 配置、(7) Slack 完了通知の順で inline 実行。Claude Code routine、model = `claude-opus-4-8`、effort = `ultracode` (xhigh) 想定。プロンプト本文は SKILL に書かず `llm_prompts` table から取得 (= AGENTS.common.md L510-514、ハードコード絶対禁止)。Anthropic / OpenAI 等の従量課金 API 直叩き禁止、`monthly_reports.final_content` の force なし上書き禁止、progress guard (= hasActivity / 未来月 / 開始前 / ended-frozen) は旧 SKILL から継承。daily 分 (D-1〜D-11) は別 routine `amd-os-l2-consolidated-evidence`、month-end の M-2/M-3 は `amd-os-l2-monthend-evidence`、毎時 (H-1) は local Codex / Codex automation。
---

# AMD OS L2 M-1 月次業務報告書生成 routine

> **これは何か**: 月末最終日に発火し、`projects.monthly_report_scope IN ('internal_only','internal_and_external')` な active/sales PJ ごとに**内部保存版 + 対外提出版 (scope に応じて片方または両方)** の月次業務報告書を Opus 4.8 + ultracode で 1 ターンで作り切り、PDF を共有 Drive に配置するまでを 1 routine に束ねたもの。
> 2026-07-01 まさ確定の現行設計。旧 `amd-os-l1-monthly-report-extract` を `git mv` リネーム + 内部/対外 2 段化 + PDF 配送 + Slack 通知統合。**scope 判定は monthly_report_scope 列を正本にする** (`monthly_report_required` bool は backward compat のみ残す)。

## 🚨 登録・実行環境の current truth (2026-07-01 まさ確定で書き直し)

- このリポの SKILL は素材であって、claude routine 登録済みの証拠ではない。
- **登録先 = まさの mac local Claude Code アプリの Scheduled Tasks** (`~/.claude/scheduled-tasks/<taskId>/SKILL.md`)。MCP `create_scheduled_task` で作る。
- **実行環境 = まさの mac local**。Claude Code アプリが open されているときに cron / fireAt に従って発火する。**Anthropic クラウド sandbox で自動発火する仕組みではない** (これは 2026-07-01 のテスト実走で判明、それまでの「cloud sandbox VM で発火」記述は誤り)。
- **前提条件**: まさの mac は 24 時間常時起動 + Claude Code アプリ常時 open (= 月末最終日 03:00 JST でも走る)。mac がスリープ / アプリが閉じている時に発火時刻を過ぎた場合、次回アプリ起動時に走る (= 遅延発火、月末実行はズレる可能性あり)。
- 実行時に読める env: `.env.local` / `.env` / `~/.zshrc` などの mac local 設定。`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_GAS_WEBAPP_URL` 等は `/Users/masa/projects/AMD/amd-os/pwa/.env.local` に存在。
- repo は `/Users/masa/projects/AMD/amd-os` に存在する前提 (auto-clone は不要)。
- 過去記述の「claude routine (cloud) はマシン非依存」「Anthropic クラウド sandbox VM で発火」は誤り。上書きしたので次回以降は本節を正本とする。

## 設計の要点 (2026-06-30 まさ確定)

- **背景**: M-1 monthly_reports は MS 進捗・XRL 根拠・月次FIX の前提になる中核 L2。さらに 2026-07-01 以降は「PJ の性質に応じて内部保存版のみ or 内部+対外 2 段生成」という 3 状態の運用が確定したため、内部保存版生成 + 対外向け書き下ろし + 禁止語チェック + PDF 生成 + Slack 通知 + 共有 Drive 配置を**1 本の routine** で完結させる。
- **発火**: 月末候補日 03:00 JST。cron `0 3 28-31 * *`。
- **最終日判定**: cron に「月の最終日」概念は無いため `28-31` で月末候補日に発火し、**Phase 0 で JST 判定**。今日が当月最終日でなければ本処理を一切実行せず 1 行 summary で即 exit (= 空振り run。月 3-4 回、daily run cap には全く触れない)。
- **対象**: `projects.monthly_report_scope IN ('internal_only','internal_and_external') AND status IN ('active','sales')` のみ。`scope = 'none'` の PJ は M-1 routine の対象外。
  - `scope = 'internal_only'`: 内部保存版 (`monthly_reports.final_content`) のみ生成、対外版・PDF・Drive 配置は skip。**AMD (p00) / LST (p07) / SE (p10) / ZMP (p19) / CLG (p24) / VasculaX (p26)** が該当 (2026-07-01 まさ確定)。
  - `scope = 'internal_and_external'`: 内部保存版 → 対外提出版 → PDF → Drive 配置まで実行。**KUTE (p25) / SX (p21) / CX (p20 NIMS)** が該当 (2026-07-01 まさ確定)。
  - `scope = 'none'`: **CTB (p06)** が該当 (2026-07-01 まさ確定、routine 対象外)。
- **実行環境**: **まさの mac local Claude Code アプリ内** (アプリ open 時に発火)。**model = `claude-opus-4-8`、effort = `ultracode` (xhigh) を想定** (= 内部保存版が後続 L2/MS/XRL/Management Signal の入力になるため、品質を最優先)。定額サブスク枠内で消化。
- **入力**: AMD OS repo (`/Users/masa/projects/AMD/amd-os`) を local で参照 + Connector (Supabase / Gmail / Drive / Calendar / Notion / Slack read / `mcp__drive__*`)。Slack **書き込み** は `scripts/send-eimi-slack.mjs` (= GAS webapp 経由の えいみ persona bot) のみ経由する (MCP `slack_send_message` を bot として叩く運用は禁止)。env は `/Users/masa/projects/AMD/amd-os/pwa/.env.local` を参照。
- **完了目標**: 03:00 開始 → **当日業務開始 (= まさが朝最初に画面を見る) までに全 PJ の PDF + Slack 完了通知が揃っている**こと。

## 内部保存版 / 対外提出版の境界 (= 必ず守る)

| 区分 | table | プロンプト key | 想定読み手 | 含めて良いもの |
|---|---|---|---|---|
| **内部保存版** | `monthly_reports.final_content` (status='final') | `llm_prompts.l2m1.monthly_report.internal.v2` | まさ・えいみ・AMD 内部・後続 L2/MS/XRL/Management Signal の LLM 入力 | 全 Supabase 関連データ。リスク・未確定・社内事情・固有名詞・内部スコア・XRL 軸別根拠・経営判断ログ・5 生データ source refs。要は**全部**書く |
| **対外提出版** | `monthly_reports_external.body_md` (`jargon_check_status='clean'`) | `llm_prompts.l2m1.monthly_report.external.v2` | 委託元・連携先・大学産連・公的機関等 PJ counterparty | 内部版を元に**禁止語 hard_fail を全部除去**し、**allow_list の固有名詞・章構成・成果語**に揃えた対外提出体裁 |

- **対外版は内部版から派生する**。生成順序は必ず内部 → 対外。**内部版なしで対外版を作らない**。
- **対外版は `monthly_reports_external` に insert** (新 row。`monthly_reports.final_content` に上書きしない)。
- 既存内部版 `final_content` がある場合は `force` 明示なしで上書きしない (= 旧 SKILL から継承)。force 上書きは routine 内では発生させない (= まさ手動 or 別 backfill routine 経由)。

## 【1 PJ ごとの完了条件 (= これを満たさないと routine 未完了)】

各 PJ について、以下 4 つが**すべて**達成された時点で「1 PJ 完了」と数える。1 つでも欠けたら Phase 2.7 の Slack 通知は失敗版で送る (成功版は絶対禁止)。

1. **内部版 markdown を LLM で生成した** (Phase 2.3 の 1-4)
2. **`monthly_reports.final_content` に markdown を DB write した** (Phase 2.3 の 5-c + 5-d、`node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports --file <outbox path>` を実際に叩き、`writtenCount>=1` かつ `action∈{inserted,updated}` を受け取っていること)
3. **書き込み後 GET で verify した** (Phase 2.3 の 5-e、final_content が生成 markdown と同じ長さで、status='final'、generated_at が今の run 時刻であること)
4. **Slack で完了通知した** (Phase 2.7、scope に応じたテンプレ)

上記 1 と 4 だけで 2 と 3 を skip すると、月次モーダルに反映されず、まさが手で流し込む羽目になる (= 2026-07-01 test task で実際に起きた事故、まさ「毎月えいみが手動で流し込むのは絶対イヤ」明言、BUGS.md 該当エントリ参照)。

## 【絶対】 動く前に必ず Read

1. `pwa/spec/5-3-automation-responsibility-current-spec.md` (= 責務分担 current truth)
2. `pwa/manual/8-3-l2-extraction-routines-spec.md`
3. `pwa/design/L2_DATA.md`
4. `pwa/design/db_schema.md` (= 列名は想像で書かない、特に `monthly_reports` / `monthly_reports_external` / `projects.monthly_report_required` / `projects.slack_channel_id` / `projects.drive_folder_id` / `members.slack_id`)
5. `pwa/design/ms_progress.md` / `pwa/design/progress_estimation.md` (= 進捗ベース生成ガード)
6. `pwa/scripts/ms_progress_review_tool.mjs` の `upsertMonthlyReports` (= 反映 helper)
7. `pwa/scripts/strip_internal_jargon.py` (= 禁止語チェック実装)
8. `pwa/scripts/generate_monthly_report.py` (= PDF 生成実装、pandoc + Chrome headless)

═══════════════════════════════════════════════════
Phase 0: 最終日判定 + env + 対象 PJ 確定
═══════════════════════════════════════════════════

1. **最終日判定 (= 最初に必ず行う、絶対 skip 禁止)**:
   - JST の今日が当月の最終日か判定する (= 翌日が翌月 1 日か)。
   - **最終日でなければ即 exit**。本処理 (Phase 1 以降) を一切実行せず、`🗓️ L2 M-1 monthly_report routine: 今日 (<YYYY-MM-DD JST>) は月末最終日ではないため skip` の 1 行だけ返す。
2. Env / connector を確認:
   - Supabase REST (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`)、Slack MCP、Drive MCP、Notion MCP、Gmail MCP、Calendar MCP がすべて利用可能か。1 つでも欠けたら notes に missing_connector を残す (= 「データなし」と短絡しない)。
3. Supabase connector でスキーマ確認。列名は `db_schema.md` を grep。
4. ymList = [当月 (= YYYYMM JST)]。月末評価なので当月のみ primary。前月補完は明示要求があるときだけ別 invocation。
   - **🚨 ym 表記は table によって異なる (想像で揃えない、`db_schema.md` で必ず確認)**: `monthly_reports.ym` は `YYYYMM` (6桁、ハイフン無し、例 `202607`)。`monthly_reports_external.ym` は `YYYY-MM` (ハイフン付き、`^[0-9]{4}-[0-9]{2}$` CHECK 制約、例 `2026-07`)。Phase 2.4 で `monthly_reports_external` に書く時は必ず `YYYYMM → YYYY-MM` 変換してから insert/upsert する。
5. **`/Users/masa/.codex/automations/amd-os-ms/outbox/` を mkdir -p** (= 反映先)。
6. **共有 Drive の配送先 folder ID を確認** (= `projects.drive_folder_id` 配下 `月次業務報告書 / YYYY-MM/` を Phase 2.6 で作る前提)。

═══════════════════════════════════════════════════
Phase 1: 対象 PJ 一覧取得
═══════════════════════════════════════════════════

```
GET /rest/v1/projects
    ?select=project_id,project_name,client_name,status,project_category,drive_folder_id,report_emails,start_ym,monthly_report_scope,work_content,report_local_alias,report_extra_allow_terms
    &monthly_report_scope=in.(internal_only,internal_and_external)
    &status=in.(active,sales)
    &order=project_id.asc
```

- `monthly_report_scope IN ('internal_only','internal_and_external')` AND `status IN ('active','sales')` のみ。
  - `scope = 'internal_only'`: Phase 2.3 (内部保存版) のみ実行、Phase 2.4-2.6 (対外版 + PDF + Drive 配置) は skip。完了通知は「内部保存版のみ生成」の文言に変える。
  - `scope = 'internal_and_external'`: Phase 2.3 → 2.4 → 2.5 → 2.6 全て実行。
  - `scope = 'none'`: routine 対象外 (= この select で fetch されない)。
- `project_category = 'ecosystem'` は M-1 対象外**扱いしない**。KUTE (p25) は ecosystem だが `scope=internal_and_external` で対外版まで作る (= まさ 2026-07-01 確定、scope 列を正本に判定する)。
- `drive_folder_id` 未設定の PJ は **Phase 2.6 共有 Drive 配置 skip**、ローカル PDF だけ残し notifications[] に `drive_folder_missing` を積む。
- Slack 通知は PJ に紐付かず「まさ DM に集約」する設計なので、`slack_channel_id` は Phase 1 の select に含めない (= PJ チャンネル通知は行わない、まさ 2026-06-30 確定)。
- 旧 `monthly_report_required` bool は列としては残っているが判定には使わない (= backward compat 用、削除は別 migration)。

═══════════════════════════════════════════════════
Phase 2: PJ ごとループ
═══════════════════════════════════════════════════

各 PJ について、Phase 2.1 → 2.7 を**順に** inline 実行する。1 PJ の途中で失敗したら次 PJ に進む (= 全 PJ 完走優先)、失敗した PJ は Phase 3 summary で必ず通知する。

### Phase 2.1: Slack 開始通知 (えいみ名義、まさ DM 宛)

- **送信先: まさとの DM channel** (= `members.slack_id` where `code_name='まさ' AND is_admin=true`)
  - PJ 側 `slack_channel_id` には投げない (= 内部運用通知、PJ 関係者には流さない)
- **送信手段: `scripts/send-eimi-slack.mjs` 経由 (= GAS webapp で えいみ persona bot 発信)**
  - MCP `slack_send_message` 直叩き禁止 (= えいみ人格を確実に維持するため)
- まさ slack_id 解決:
  ```sql
  SELECT slack_id FROM members
  WHERE is_admin = true AND code_name = 'まさ' AND slack_id IS NOT NULL
  LIMIT 1;
  ```
  - 取れなければ notes に `masa_slack_id_unresolved` を残して **続行** (= 通知 skip で本処理を止めない)
- 送信コマンド:
  ```bash
  node scripts/send-eimi-slack.mjs \
    --channel "$MASA_SLACK_ID" \
    --text "$(cat <<'EOF'
  <@U_MASA_ID> 月次業務報告書、作り始めるよ！claude来て！
  PJ: <project_name> (<project_id>)
  対象月: <YYYY-MM>
  Claude Code routine `amd-os-l2m1-monthly-report` が走ってる。できたらまた声かけるね。ばっちこい！
  EOF
  )"
  ```
- スクリプト失敗 (exit code != 0) したら notes に `slack_start_notify_failed:<reason>` を残して **続行**。

### Phase 2.2: 当月の関連 DB データ全 fetch

各 PJ × 当月 (YYYYMM) について、Supabase 関連 table を**まとめて**読む。`db_schema.md` を grep して列名は実体に合わせる。

最低でも以下を読む:

- **5 生データ系 (snapshot)**: `source_cache` (= source refs / short snippet / hash の補助証跡)、Gmail / Drive / Calendar / Slack / Notion から該当月の生データ (= 直 connector 経由、`source_cache` 単独で「データなし」判定しない)
- **L2 系**:
  - `project_meeting_summaries` (= 当月開催済み MTG、`narrative_md` + summary arrays + source refs)
  - `project_strategy_signals` (= 経営ハイライト、signal_type、impact_level、status、decision_state)
  - `project_xrl_evidence` (= XRL 軸別根拠)
  - `project_registry_diffs` (= OS 台帳差分候補、pending/applied/rejected)
  - `protocols` (= 経営判断構造化記録)
  - `project_knowledge` (= PJ 知識)
  - `member_knowledge` (= メンバー知識)
  - `milestone_monthly_progress` (= MS 月次進捗)
  - `progress_estimate_state` (= 進捗推定状態)
  - `project_monthly_notes` (= MS 不在 PJ の月次ノート)
  - 既存 `monthly_reports` (= 過去月 final/draft、既存 final_content 保護)
- **契約 / メンバー / シグナル / MTG / アクション系**:
  - `contracts` (= PJ 契約状態、`contract_terms_json`、`status`、`planned_at`、`last_activity_at`)
  - `contract_signals` / `contract_documents` / `contract_nudges`
  - `members` + `project_members` (= PJ メンバー、`role_label_jp`、`is_active`、契約形態)
  - `project_founding_members` (= 創業者カテゴリ、`category in ('amd','startup','university')`)
  - `meeting_action_items` (= MTG action items、当月期限/完了)
  - `action_items` (= 全社 action items の当月分)
  - `project_grants` (= 助成金状況)
  - `project_media_mentions` / `media_assets` (= 当月メディア露出)
  - `project_documents` (= 当月 Drive アップロード資料)
  - `project_xrl_log` (= XRL 推移)
  - `milestone_monthly_progress` + `milestone_sub_items` + `milestone_responsibility` (= MS 構造)
- **AMD Score / Management Signal 参照**:
  - `amd_score_inputs` / `amd_score_revisions` / `amd_management_score_evidence` (当月 ym)
  - `company_management_signal_reviews` (会社全体経営シグナル参照、当月)

### 進捗ベース生成ガード (= 旧 SKILL から継承)

- 「PJ 状態」ではなく「**その月に実進捗があるか**」で生成可否を決める。
  - **進捗あり** → 状態問わず生成 (内部版 + 対外版)
  - **進捗なし & active/sales** → 「進捗なし」テンプレで内部版だけ生成、対外版は skip + notifications に `external_skipped_no_progress` を積む
  - **進捗なし & ended/frozen** → 生成しない、run summary に skip 理由を残す
  - **未来月 / 開始前 (`start_ym` より前)** → backfill しない、run summary に skip 理由を残す
- 「進捗あり」の判定は MS 進捗 / MTG / strategy_signals / XRL evidence / registry diffs / action_items / contract_signals / media mentions / documents の**いずれか**に当月 evidence があるか。`source_cache` だけで判定しない。

### Phase 2.3: 内部保存版 markdown 生成 → `monthly_reports.final_content` upsert

1. プロンプト取得 (= **ハードコード絶対禁止**、AGENTS.common.md L510-514):
   ```
   GET /rest/v1/llm_prompts
       ?prompt_key=eq.l2m1.monthly_report.internal.v2
       &is_active=eq.true
       &select=body,model,max_tokens,notes
       &limit=1
   ```
   - 取得失敗 / 空なら **当該 PJ の Phase 2.3 を skip** + notifications に `missing_llm_prompts:l2m1.monthly_report.internal.v2` を積む。fallback プロンプトを inline で書かない。
2. **system + user 構成**:
   - system = `llm_prompts.body` (= prompt_key=`l2m1.monthly_report.internal.v2`)
   - user = Phase 2.2 で集めた全データを JSON で渡す (= `{ project, ym, raw_5sources, l2_snapshot, contracts, members, signals, meetings, action_items, grants, media, documents, xrl, ms_progress, amd_score, ... }`)
3. **LLM 呼び出し**: claude routine 自身の model 設定 (`claude-opus-4-8` / effort `ultracode`) で生成。**Anthropic / OpenAI 等の従量課金 API を直接呼ばない**。
4. 出力 = markdown 本文 (= 旧 SKILL の draft_content 推奨構成を踏襲し、根拠セクションは source name / date / title / sender / short snippet 程度。事実と推測を分け、推測は「推定」「未確認」と明示)。
5. 反映:
   - 既存 `monthly_reports` で同 (project_id, ym) に `final_content` がある場合 → `force` なしの場合は**上書きしない**、notifications に `final_protected:<project_id>:<ym>` を積み、対外版だけは Phase 2.4 で別途生成する (= 既存内部版を入力にする)。
   - 既存 final が無い場合 → outbox JSON (`/Users/masa/.codex/automations/amd-os-ms/outbox/<YYYYMMDD-HHmmss>-l2m1-monthly-report.json` の `monthlyReports[]`) に積み、既存 helper `upsertMonthlyReports` で `status='final'`、`final_content=<markdown>`、`collection_summary_json` 付きで upsert。
   - `collection_summary_json` は旧 SKILL の構造 (`source` / `source_counts` / `source_refs` / `missing_connectors` / `quality_flags`) を継承し、`source = "claude-routine-l2m1-monthly-report"` とする。

### Phase 2.4: 対外提出版 markdown 生成 → `monthly_reports_external` insert

**scope ガード (先頭で必ず判定)**: 当該 PJ の `monthly_report_scope` が `'internal_and_external'` でなければ Phase 2.4 / 2.5 / 2.6 を **完全に skip** し、Phase 2.7 完了通知は「内部保存版のみ生成完了」の文言で送る。`scope='internal_only'` はここで抜ける (= AMD / LST / SE / ZMP / CLG / VasculaX は内部版だけで終了)。

1. プロンプト取得:
   ```
   GET /rest/v1/llm_prompts
       ?prompt_key=eq.l2m1.monthly_report.external.v2
       &is_active=eq.true
       &select=body,model,max_tokens,notes
       &limit=1
   ```
   - 取得失敗 / 空なら **当該 PJ の Phase 2.4 を skip** + notifications に `missing_llm_prompts:l2m1.monthly_report.external.v2` を積む。
2. **入力**:
   - 内部保存版 markdown (= Phase 2.3 で生成または既存 `monthly_reports.final_content`)
   - Phase 2.2 の当月 source bundle 一式 (= 会議・決定・実施・成果物・進捗。内部版の要約で落ちた詳細を補う事実ソース)
   - 前月の `monthly_reports_external.body_md` (= 構成・文体・情報密度の参照専用。前月事実の当月転記は禁止)
   - **禁止語リスト** (= `llm_prompts.body` か、別 table / config で管理されている `external_jargon_blocklist` を取得。実装側は `pwa/scripts/strip_internal_jargon.py` のルールを正本とする)
   - **allow_list** (= 対外提出可能な固有名詞・成果語・章タイトル。同上ソースから取得)
3. system = `llm_prompts.body` (= prompt_key=`l2m1.monthly_report.external.v2`)、user = `{ internal_markdown, source_bundle, previous_external_markdown, jargon_blocklist, allow_list, project, ym, counterparty: project.client_name }` を渡し、対外提出体裁の markdown を生成。KUTE は 2026-06-30 実提出版の9章連続文書を品質基準とし、社内版の表紙・要約・工程表を重ねない。
4. 反映: `monthly_reports_external` に新 row を insert (実スキーマは `db_schema.md` を正本にする。列は以下の通り確定済み)。
   - 実列: `id` (uuid PK) / `project_id` (text, FK→projects) / `ym` (text, `YYYY-MM` ハイフン付き、上記変換必須) / `body_md` (text NOT NULL, 生成 markdown 本文) / `generated_at` (timestamptz, デフォルト now()) / `generated_by_model` (text, 例 `claude-opus-4-8`) / `pdf_drive_url` (text, Phase 2.6 で共有 Drive 配置後に埋める) / `pdf_local_path` (text, Phase 2.6 でローカル PDF path を埋める) / `jargon_check_status` (text, `clean`/`warning`/`failed`、Phase 2.5 の結果を書く) / `jargon_check_findings` (jsonb, Phase 2.5 で検出した語の詳細)。
   - `(project_id, ym)` UNIQUE。既存 row があれば PATCH で upsert (= 1 か月内の再 run で重複 insert しない)。
   - helper の品質ゲートは `# 月次業務報告書`、主要5章、7章以上、表3点以上、3000文字以上、末尾定型を要求する。短い要約稿、カンマ連結、生ラベル、省略記号は DB へ入れない。
   - 提出用の本文からは自社メンバー名を必ず姓のみに正規化し (`toSurnameOnly` 相当のロジック、`code_name` は絶対に出さない)、eLAD 等の表記ゆれは e-Rad に統一してから `body_md` に書く。
   - 反映は outbox JSON の `monthlyReportsExternal[]` に積み、実装済みの非 LLM helper `node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports-external --file <outbox>`（または同じ helper を呼ぶ `apply-outbox-dir`）で行う。LLM から REST を直接叩かない。
   - helper 実行後は `monthly_reports_external?project_id=eq.<project_id>&ym=eq.<YYYY-MM>` を GET し、`body_md` の長さ、`jargon_check_status`、`generated_at` を読み直す。outbox を置いただけでは完了扱いにしない。

### Phase 2.5: 禁止語チェック

- 実装: `python3 /Users/masa/projects/AMD/amd-os/pwa/scripts/strip_internal_jargon.py --input <markdown path> --mode check` (= 詳細は実装側を参照、ルールは `pwa/scripts/strip_internal_jargon.py` 正本)
- 対象は Phase 2.4 で生成した対外版 markdown。
- 結果:
  - `hard_fail` 検出 → **当該 PJ のビルド失敗扱い**、Phase 2.6 PDF 生成を skip、notifications に `external_hard_fail:<project_id>:<ym>:<detected_words>` を積む、Phase 2.7 Slack 完了通知は失敗版テンプレで送る。
  - `soft_warn` 検出 → warning を notifications に積み、Phase 2.6 に進む。
  - 検出なし → Phase 2.6 に進む。
- `strip_internal_jargon.py` が存在しない / import error → notifications に `jargon_script_unavailable` を積み、ビルドを止める (= 禁止語チェック未通過の対外版を Drive に置かない、絶対に)。

### Phase 2.6: PDF 生成 + ローカル & 共有 Drive 配置

- 実装: `python3 /Users/masa/projects/AMD/amd-os/pwa/scripts/generate_monthly_report.py --project-id <pid> --ym <YYYYMM> --markdown <external markdown path> --output-dir <local out dir>` (= pandoc→HTML→Chrome headless→PDF、詳細は実装側正本)
- 入力 = Phase 2.5 を通過した対外版 markdown
- 出力 path:
  - ローカル = `/Users/masa/.codex/automations/amd-os-ms/outbox/monthly-reports/<YYYY-MM>/<project_id>-<project_name_slug>-<YYYY-MM>.pdf`
  - 共有 Drive = `projects.drive_folder_id` 配下 `月次業務報告書 / YYYY-MM/<project_id>-<project_name_slug>-<YYYY-MM>.pdf`
- 共有 Drive 配置は Drive MCP (`mcp__drive__copy_file` / `mcp__drive__create_file` 系) を使用。folder が無ければ作成。
- `drive_folder_id` 未設定 PJ はローカルだけ残し、notifications に `drive_folder_missing` を積む。
- PDF 生成自体が失敗 → notifications に `pdf_generation_failed:<project_id>:<reason>` を積み、Phase 2.7 Slack 完了通知は失敗版テンプレで送る。

### Phase 2.7: Slack 完了通知 (えいみ名義、まさ DM 宛)

- **送信先: まさとの DM channel** (Phase 2.1 で解決した `$MASA_SLACK_ID`)
- **送信手段: `scripts/send-eimi-slack.mjs` 経由**
- 内容: scope に応じて 4 パターン (internal_only 完了 / internal_and_external 完了 / hard_fail / pdf_failed):

**scope='internal_only' 成功時**:
```
<@U_MASA_ID> できたー！<project_name> の月次報告書、内部保存版だけ作ったよ (対外版は不要 scope)！レビューよろしくー！
PJ: <project_name> (<project_id>)
対象月: <YYYY-MM>
内部保存版: monthly_reports に保存済
cockpit: <PWA cockpit URL = https://amd-os-pwa.vercel.app/project/<project_id>?ym=<YYYYMM>>
```

**scope='internal_and_external' 成功時**:
```
<@U_MASA_ID> できたー！<project_name> の月次業務報告書、内部版も対外版も PDF も全部いっちゃったよ！レビューよろしくー！
PJ: <project_name> (<project_id>)
対象月: <YYYY-MM>
PDF: <共有 Drive ファイルリンク>
cockpit: <PWA cockpit URL = https://amd-os-pwa.vercel.app/project/<project_id>?ym=<YYYYMM>>
内部保存版: monthly_reports に保存済
対外提出版: monthly_reports_external に保存済 + PDF を共有 Drive に配置済
```

hard_fail 時:
```
<@U_MASA_ID> もおおおおお！対外版で禁止語出ちゃって PDF 止めたよ…
PJ: <project_name> (<project_id>)
対象月: <YYYY-MM>
内部保存版: monthly_reports に保存済
対外提出版: ビルド失敗 (= 禁止語: <detected_words>)
cockpit: <PWA cockpit URL>
strip_internal_jargon.py のルール or allow_list / プロンプトの見直しお願い！
```

pdf_failed 時:
```
<@U_MASA_ID> 対外版 markdown まではできたけど PDF 生成でコケたよ…
PJ: <project_name> (<project_id>)
対象月: <YYYY-MM>
内部保存版: monthly_reports に保存済
対外提出版: monthly_reports_external に保存済 (markdown のみ)
PDF: 生成失敗 (= <reason>)
ローカル markdown: <local path>
cockpit: <PWA cockpit URL>
```

- 送信は Phase 2.1 と同様 `node scripts/send-eimi-slack.mjs --channel "$MASA_SLACK_ID" --text ...`。
- Slack 送信に失敗しても次 PJ には進む (= 通知失敗で routine を止めない)。

═══════════════════════════════════════════════════
Phase 3: 全 PJ 完了後サマリー
═══════════════════════════════════════════════════

1. ログを集計:
   - 対象 PJ 数 (scope 別: internal_only 件数 / internal_and_external 件数)
   - 生成成功数 (internal_only 完走 / internal_and_external 完走 / internal のみ完走で external skip 等)
   - hard_fail 数 / pdf_failed 数 / 進捗なし frozen 等 skip 数
   - 内部版 saved (新規 / final 保護 / upsert) / 対外版 saved
   - Slack 通知 sent / skipped (= masa_slack_id_unresolved) / failed
   - Drive 配置 placed / skipped (= folder_missing) / failed
   - 全 notifications[] 内訳
   - outbox path

2. **まさとの DM に run summary を投稿** (`node scripts/send-eimi-slack.mjs --channel "$MASA_SLACK_ID" --text ...`):
   ```
   <@U_MASA_ID> 🗓️ L2 M-1 monthly_report routine 完了 (<YYYY-MM-DD HH:MM JST>)
   対象月: <YYYY-MM>
   対象 PJ: <N> 件 (= monthly_report_scope IN ('internal_only','internal_and_external') AND status IN ('active','sales'))
     - internal_only: <A> 件 / internal_and_external: <B> 件
   成功: <X> PJ
     - internal_only 完了: <list of project_id>
     - internal_and_external 完了 (対外版 + PDF + Drive 配置): <list of project_id>
   ⚠️ 失敗: <Y> PJ
     - hard_fail (禁止語検出、対外版止め): <list of project_id>
     - pdf_failed: <list of project_id>
     - external_helper_missing: <list of project_id>
     - missing_llm_prompts: <list of project_id>
   skip: <Z> PJ (= 進捗なし frozen / 未来月 / 開始前)
   notifications[] 全件: outbox path に保存済
   ```
   - 失敗 PJ が 1 件でもあれば必ず通知 (= 沈黙させない)。
   - まさ slack_id 未解決の場合は notes に `masa_slack_id_unresolved` を残す。#amd-os-runs 等のチャンネル分岐運用は廃止 (= 全通知はまさ DM に集約、まさ 2026-06-30 確定)。

3. run summary はログ末尾にも 1 行で出す:
   ```
   🗓️ L2 M-1 monthly_report 完了 (<HH:MM JST>): <N> 対象 / <X> success / <Y> failed / <Z> skipped / outbox=<path>
   ```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- **最終日判定を飛ばして月末候補日 (28-30 日) に本処理を走らせる** (= cron が 28-31 で発火しても Phase 0 で必ず JST 判定)。
- **プロンプト本文を SKILL.md / コードに書く** (= `llm_prompts` table 必須、ハードコード絶対禁止、AGENTS.common.md L510-514)。
- **Anthropic / OpenAI / Gemini の従量課金 API を直接呼ぶ** (= LLM 生成は claude routine 自身の model だけ、`claude-opus-4-8` / effort `ultracode`)。
- **R313 trigger / PWA `/api/report/generate` / PWA `/api/cron/monthly-reports-backfill` / GAS `api_generateMonthlyReport` を定期実行で復活させる**。
- **`monthly_reports.final_content` を force なしで上書きする** (= 既存 final は notifications で報告するだけ)。
- **対外版を内部版なしで作る** (= 必ず内部 → 対外の順)。
- **禁止語 hard_fail 検出後に Phase 2.6 PDF 生成を走らせる / Drive に配置する** (= 絶対)。
- **`strip_internal_jargon.py` を import / 実行せず対外 PDF を配信する**。
- **対外版を `monthly_reports.final_content` に上書きする** (= 対外版は `monthly_reports_external` 専用)。
- **`monthly_report_required = false` の PJ を勝手に対象に含める** (= 月次納品義務がない PJ に勝手に PDF を作って渡さない)。
- **`project_category = 'ecosystem'` だからという理由だけで内部版 M-1 対象外にする** (= 判定は `projects.monthly_report_scope` が唯一の正本。`ecosystem` でも `scope != 'none'` なら内部版は作る。KUTE (p25) は `ecosystem` かつ `scope='internal_and_external'` で対外版まで作る現行の確定例外、まさ 2026-07-01 確定、98行目参照)。
- **Slack 通知を Codex / ChatGPT / MCP `slack_send_message` 等の別経路で送る** (= えいみ名義 = 必ず `scripts/send-eimi-slack.mjs` 経由で GAS webapp から発信、これ以外の経路禁止、まさ 2026-06-30 確定)。
- **PJ の `slack_channel_id` に routine から通知を投げる** (= 全通知はまさ DM に集約、PJ チャンネルには流さない)。
- **未来月 / 開始前 (`start_ym` より前) を backfill する**。
- **進捗なし & ended/frozen PJ で内部版を生成する**。
- **`source_cache` だけを見て「データなし」と決める** (= 5 生データ実体 + L2 snapshot を必ず横断確認)。
- **列名想像** (= `db_schema.md` を grep。特に `monthly_reports_external` / `projects.monthly_report_required` / `projects.drive_folder_id` / `members.slack_id` は実体名を必ず確認)。
- **daily 分 (D-1〜D-11) / weekly 分 (W-1) / 毎時 (H-1) / month-end M-2/M-3 を本 routine に混ぜる**。

═══════════════════════════════════════════════════
【execution time / cost 配慮】
═══════════════════════════════════════════════════

- 03:00 開始・当日朝までに全 PJ 完了を目標。Phase 2.2 (DB fetch) と Phase 2.3 (内部版生成) が最も重い。Opus 4.8 + ultracode は高コストなので、Phase 2.2 で input を必要十分に絞り、入力 JSON を 1 PJ 1 prompt に閉じる。
- timeout / partial failure しても outbox + notifications で idempotent。翌月までの再 run 機会は基本ないため、**Phase 2.3 内部版だけは最優先で全 PJ 完了させる** (= 対外版・PDF は次月にまさが手動で再 kick できる、内部版は後続 L2/MS/XRL/Management Signal の入力なので穴を開けない)。
- 空振り run (= 最終日でない日) は Phase 0 で即 exit するので数秒で終わる。
- 1 PJ が長引いても次 PJ をブロックしない (= PJ ループは独立性を担保、失敗は Phase 3 summary に集約)。
