# L2M-1 Monthly Reports 仕様 (v2 — 2026-07-01 まさ確定)

> **この章は何か**: `monthly_reports` / `monthly_reports_external` の writer、内部保存版 + 対外提出版の 2 段生成、月末最終日発火の Claude routine、`llm_prompts` DB 管理化、旧 Codex `amd-os-l2` (M-1 月次報告抽出) の廃止を固定する章。運用者向けの説明は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも残す。

## v1 → v2 の要点差分 (2026-07-01)

| 観点 | v1 (〜2026-06-30) | v2 (2026-07-01〜) |
|---|---|---|
| primary writer | Codex automation `amd-os-l2` (name="AMD OS M-1 月次報告抽出") | Claude routine `amd-os-l2m1-monthly-report` |
| 実行環境 | Codex Desktop MMOマシン (gpt-5.5 + reasoning_effort=high) | まさの mac local Claude Code アプリ Scheduled Tasks (opus-4-8 + ultracode/xhigh、アプリ open 時に発火。cloud sandbox 常駐ではない、2026-07-01 テスト実走で判明) |
| schedule | daily 05:30 JST (毎日) | **月末最終日 03:00 JST** (cron `0 3 28-31 * *` + Phase 0 で JST 最終日判定) |
| 出力 | 内部保存版のみ (`monthly_reports.final_content`) | **内部保存版 + 対外提出版**の 2 段生成 (`monthly_reports.final_content` + `monthly_reports_external.body_md` + PDF) |
| 対象判定 | 全 active/sales PJ (対外提出義務の概念なし) | `projects.monthly_report_scope IN ('internal_only','internal_and_external')` の 3 状態 enum |
| プロンプト | SKILL.md / prompt に直書き | `llm_prompts` table 正本 (`prompt_key='l2m1.monthly_report.internal.v2'` / `'l2m1.monthly_report.external.v2'`)、admin UI で編集可能 |
| PDF 生成 | なし | Claude routine が pandoc + Chrome headless (まさの mac local 実行) → 失敗時 outbox → ローカル LaunchAgent fallback |
| 品質検証 | なし | `scripts/ms_progress_review_tool.mjs validate-monthly-report` が固定 8 章体系・生ログ丸写し・句読点崩れ・eLAD 表記を draft/final 書き込み前に検証する。対外版は `upsert-monthly-reports-external` が氏名を姓だけへ正規化し、`strip_internal_jargon.py` が code_name / 内部用語を検査する |
| Slack 通知 | なし (Codex automation は run summary のみ) | まさ DM に集約 (`scripts/send-eimi-slack.mjs` = GAS webapp えいみ persona bot 経由)、PJ チャンネルには投げない |
| 通知タイミング | なし | Phase 2.1 (開始) + Phase 2.7 (PJ 完了、scope 別 4 パターン) + Phase 3 (全体サマリ) |

## 正本テーブル

| table | 用途 |
|---|---|
| `monthly_reports` | 内部保存版の PJ × ym 月次レポート本文。`draft_content` と `final_content` を持つ |
| `monthly_reports_external` | **v2 新設**。対外提出版の PJ × ym レポート本文 (`body_md`) + PDF リンク + jargon check 結果。1 PJ × 1 ym で UNIQUE |
| `source_cache` | Gmail / Slack などの source refs / short snippet / hash 証跡。no-data 判定の正本ではない |
| `llm_prompts` | プロンプト本文の正本。`prompt_key='l2m1.monthly_report.internal.v2'` / `'l2m1.monthly_report.external.v2'` の 2 本。admin UI で編集可能 |
| `llm_prompt_revisions` | プロンプト書き換え履歴 (admin UI 経由 save 時に 1 行追加) |
| `projects.monthly_report_scope` | routine 対象範囲 3 状態 enum (`'none'` / `'internal_only'` / `'internal_and_external'`) |
| `projects.work_content` | 業務内容配列 (対外版の第 N 領域章に展開) |
| `projects.report_local_alias` | ローカル output ディレクトリ命名 (KUTE / SX / AMD 等) |
| `projects.report_extra_allow_terms` | 対外版 jargon check の allow_list |
| `contracts.tax_basis` | 税基準 (`'included'` / `'excluded'`)、業務委託料表記に直結 |
| `contracts.recipient_emails` | 送付確認 to: マッチ用 email 一覧 |
| `project_documents.delivered_to_client_at` | 顧客に正式に渡した時刻 |

`monthly_reports` は後続 L2 の一次入力になるため、完全版を待たず、確認済み事実だけでも draft を積む。

`llm_prompts` の 2 本の現行本文は `scripts/migrations/194_monthly_report_prompts_v2_rewrite.sql` に記録 (2026-07-27)。`internal.v2` は `llm_prompt_revisions` に旧稿が 0 行だったため固定 8 章体系 (概要/今月進んだこと/重要な判断・合意/顧客・共同研究・外部関係者の動き/技術・知財・実験・資料/リスク・未確定事項/来月の焦点/根拠) に沿って新規に書き起こしたもの (= 復元ではなく新規稿という判断)。`external.v2` は姓のみ表記・eLAD→e-Rad 正規化の 2 点を既存稿に追記した差分。

## 現行 writer (v2)

| 項目 | 値 |
|---|---|
| primary writer | Claude routine `amd-os-l2m1-monthly-report` |
| taskId | `amd-os-l2m1-monthly-report` (list_scheduled_tasks で取得可能) |
| schedule | `0 3 28-31 * *` (LOCAL time = JST) + Phase 0 で「今日 == 当月最終日 JST」判定、非最終日は即 exit |
| repo 正本 SKILL | `pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md` |
| model / effort | claude-opus-4-8 + ultracode (xhigh) 想定 (SKILL.md description の散文で指定) |
| input | Gmail / Drive / Calendar / Slack / Notion 5 生データ + L2 スナップショット + contracts + members + AMD Score + XRL + MS 進捗 + action_items + grants + media + documents |
| プロンプト | `llm_prompts` table から fetch (SKILL.md / コードにハードコード禁止) |
| 内部保存版 output | `monthly_reports.final_content` (force なし上書き禁止) |
| 対外提出版 output | `monthly_reports_external.body_md` + PDF (共有 Drive `projects.drive_folder_id / 月次業務報告書 / YYYY-MM/` + ローカル outbox) |
| Slack 通知 | まさ DM (= `scripts/send-eimi-slack.mjs` 経由、`members` where `code_name='まさ' AND is_admin=true` の `slack_id` を解決) |

## v1 廃止済 writer (参考、復活禁止)

| 項目 | 値 |
|---|---|
| Codex automation | `~/.codex/automations/amd-os-l2/automation.toml` (id=`amd-os-l2`, name="AMD OS M-1 月次報告抽出") — **2026-07-01 に `status = "PAUSED"` に変更、復活禁止** |
| 旧 schedule | daily 05:30 JST |
| 旧 output | `~/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` |
| 旧 applier | LaunchAgent + `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` (= 他 outbox 処理のため LaunchAgent 自体は残存、amd-os-l2 分の入力は絶えるので実質不動) |

## 上書きルール

- 既存 `final_content` がある row は、`force:true` が明示されない限り上書きしない。
- no-data テンプレや未作成 row は、確認済み source refs があれば `draft_content` を暫定更新してよい。
- `projects.start_ym` より前でも、キックオフ / 提案 / 契約前調整など PJ 形成に意味がある月は作成対象にしてよい。
- `sourceChecklist` が 0 のままでも connector で現物が取れた場合は、`raw_data_gap` だけで終えず source refs / L2 候補へ寄せる。

## 生成対象ガード (writer 共通) — 正本原則 (2026-06-03 まさ確定)

**月次サマリを生成するかは「PJ状態」ではなく「その月に実進捗があるか」で決める。** 生成元 (`billing_cycles`) は請求ライフサイクルで動き状態と一致しないため、状態だけで切ると誤生成・誤除外が起きる (2026-06-02〜03 事故)。

| 当月の実進捗 | PJ状態 | 月次サマリ |
|---|---|---|
| **あり** (5生データ / MTGサマリ / メンバー活動のどれかに痕跡) | active / ended / frozen いずれも | **生成する** (中身に実進捗を書く。ended でも清算・株主総会等の進捗は残す) |
| **なし** | active | **生成する** =「進捗なし」テンプレ |
| **なし** | ended / frozen | **生成しない** (捏造の温床) |

実進捗判定 (`hasActivity`) は 3 経路で見る: `source_cache` (5生データ集約) / `project_meeting_summaries` (L2H-1) / `member_activities`。`source_cache` 単独で no-data 判定しない (extraction 不完全で薄いだけのことがある)。

frozen 判定は `projects.status='frozen'` **または** (`projects.freeze_from_ym` があって当月 ym ≥ `freeze_from_ym`) の両方を見る (例: CTB p06 は `status='active'` だが `freeze_from_ym=202605`)。

加えて2つの境界ガード:

| ガード | 規則 | 理由 |
|---|---|---|
| **未来月** | 当月 (JST) より後の ym は生成しない | `billing_cycles` に請求予定の未来 ym があり、無いと未来月を先回り捏造する |
| **開始前** | `projects.start_ym` 前は自動 backfill しない | キックオフ等で意味がある開始前月は手動で作る / 既存 row は残す (例: KUTE p25 / 202604) |

補足:
- **`end_ym` で機械的に切らない**。active PJ は `end_ym` が更新されず古いまま残ることがある (例: LST p07 は `end_ym=202507` だが `status='active'` で継続中・実進捗あり)。`end_ym` 超過でも active なら進捗ありは生成、進捗なしは「進捗なし」テンプレ。
- 進捗なしテンプレの本文は「活動・成果物は検出されていません」と**断定せず**記述し、`collection_summary_json` に `sourceChecklist` / `mtgCount` / `memberActivityCount` / `noActivity:true` を残す。
- これは新規生成 (missing = DB に無い月) のガード。既存 row は対象外なので、過去の捏造 draft は個別にまさ判断で cleanup する。
- この原則は L2M-1 月報だけでなく **L2H-1 MTGサマリ生成にも適用する** (ended/frozen で進捗ゼロなら MTGサマリも作らない)。
- 実装: `pwa/src/app/api/cron/monthly-reports-backfill/route.ts` の missing 抽出フィルタ (`currentYm` / `start_ym` / `projMeta`) と `generateOne` の `hasActivity` 判定 + frozen/ended スキップ分岐。

## 禁止経路

| 経路 | 扱い |
|---|---|
| AMD-Report GAS R313 | 旧経路。定期 trigger を置かない |
| `api_generateMonthlyReport` | L2M-1 automation の定期経路として使わない |
| PWA `/api/report/generate` | 手動復旧用。定期 writer にしない |
| PWA `/api/cron/monthly-reports-backfill` | 重い手動 backfill route。定期 writer にしない。ただし上記「生成対象ガード」の実装はこの route が持つ (進捗ベース判定の正本実装) |
| Codex automation `amd-os-l2` (M-1 月次報告抽出) | **v2 で PAUSED 済 (2026-07-01)**。復活禁止。gpt-5.5 + daily 05:30 の旧 writer |
| MCP `slack_send_message` を bot として直叩き | えいみ persona 通知に使わない。必ず `scripts/send-eimi-slack.mjs` (GAS webapp 経由) |
| Anthropic / OpenAI / Gemini 従量課金 API 直叩き | Claude routine 自身の定額サブスク model 以外の LLM 呼び出しは禁止 |

> ⚠️ **writer 間のガード整合**: 上記「生成対象ガード」は backfill route だけでなく、primary writer (Claude routine `amd-os-l2m1-monthly-report`) も通す必要がある。ガードのコード実装は backfill route にあり、Claude routine 側は SKILL.md の Phase 2 プロンプト指示で同等の判定をかける。両 writer が「進捗なし & ended/frozen は生成しない」を守ることが正本。

## 5 生データ確認

月次レポート抽出では、`source_cache` だけで「データなし」と判定しない。Gmail / Drive / Calendar / Slack / Notion の 5 connector を全部確認する。

| source | 見るもの |
|---|---|
| Gmail | 外部連絡、議事録メール、添付、請求/契約前後の文脈 |
| Drive | 提案資料、議事録 docs、試算表、PDF / Office file |
| Calendar | MTG event、attendees、description、色→PJ判定 |
| Slack | channel / thread / file / 長文報告 |
| Notion | 議事録 DB、PJ DB、page 本文 |

## 出力検証

- `monthlyReports` 配列が空のときは、5 生データを確認した範囲と no-data 理由を残す。
- `final_content` 既存行への変更がないことを確認する。
- outbox file は `applied/` / `failed/` のどちらへ移ったか確認する。
- helper failure は `AggregateError` / `EPERM` / `transient_network` など failure type を分けて記録する。

## クライアント提出用 印刷出力 (v0.31.0 追加 / v0.32.0 国プロ網羅型へ拡張)

大学・研究機関クライアント (CX=NIMS / SX=愛媛大 / KUTE=工学院大学) への月次提出を一次想定。国プロ網羅型 (NEDO 成果報告書 + 内閣府 SIP 出口戦略 + JST/AMED 年次の構成要素) と 民間コンサル型 (Exec Summary + RAG + Next Steps) の二段構え。

### 章立て (v0.33.0 — 「正式な対外報告書」品質)

| 章 | 内容 | 主データソース |
|---|---|---|
| **§01 表紙** | 機関名・業務名・報告期間・提出日・機密区分 + 業務契約特定ブロック (契約タイトル/相手方/期間/金額 + 契約番号・入札番号・見積書番号・AMD契約番号があれば併記) | `projects` + `contracts (status=signed)` + `contract_terms (status=applied)` |
| **§01 Exec Summary** | 業務遂行レポート見出し文 (「本書は、{機関名}と株式会社チームアルマダの間で締結された「{contract_title}」(期間: …, 金額: …) に基づき、{YYYY年MM月} 稼働分の業務遂行状況を報告するものである。」) / 今月のハイライト 3行 / **RAG 3軸** (SCHEDULE: 期待% vs 実績% / COST: budget vs reported_amount / RISK: ⚠️ signal 件数 × impact) / KPI 3指標 / XRL 主要指標表 (前月→当月) | `monthly_reports` + `billing_cycles` + `project_xrl_log` + `project_strategy_signals` |
| **§02 当月の進捗** | 進捗本文 (markdown) + マイルストーン進捗表 (前月%/当月%/Δ) | `monthly_reports.final_content` + `value_milestones` + `milestone_monthly_progress` |
| **§02b Gantt** | SVG 自前描画。MS 期間バー (period_start_ym→target_ym) + 進捗%fill + 当月マーカー (赤縦線) | `value_milestones.period_start_ym / target_ym` + `value_plan_cycles` |
| **§03 当月の成果** | 主要成果シグナル (polarity🎉/✨ confirmed) + **会議で固まった事項** (会議由来の Decided を出典つきナラティブで列挙) + 公募採択 (当月 adopted_date) + メディア掲載 (当月 occurred_on) | `project_strategy_signals` + `project_meeting_summaries.decided` + `project_grants` + `project_media_mentions` |
| **§04 実施体制** | 担当メンバー表 (PM/PL + 役割 + MS別担当 & share)。**本名表示** (`members.member_name`、フォールバック `code_name`)。Closer タグは内輪呼称のため除外 | `project_members` + `members.member_name` + `milestone_responsibility` + `project_founding_members` |
| **§05 課題・リスク** | Risk Register (⚠️ signal + 会議risks) + Action Items (open due_at順, 12件) + ボトルネック | `project_strategy_signals (polarity=⚠️)` + `project_meeting_summaries.risks` + `action_items` + `project_xrl_log.bottleneck` |
| **§06 次月計画** | 翌月期日アクション + 翌月 upcoming MTG | `action_items (due_at ∈ next_ym)` + `project_meeting_summaries (source_kinds=upcoming, ym=next)` |
| **§07 添付資料・参照** | 当月PJ資料 (`project_documents`) + 契約書 (`contract_documents.is_latest`) + 5生データソース証跡 + 改訂履歴 | 各 web_view_link |

#### v0.33.0 で削除した章

- **§05 主要会議** (旧 MeetingsSection): 議事録・会議リストは提出物の主役ではないため除外。会議由来の決定事項は §03 当月の成果へ統合
- **§07 財務サマリ** (旧 FinanceSection): 大学・研究機関提出には不要 (契約金額・予算は表紙メタで足りる、まさ確定)
- **§07 添付資料の `meeting_assets` (会議資料)**: 議事録添付を行わない方針

### ルート

| ルート | 役割 |
|---|---|
| `GET /api/project/monthly-report-print?projectId=&ym=` | 章 §01-§07 全ブロックを 1 fetch で返す集約 route。requireAdmin、列名は `pwa/design/db_schema.md` 準拠。**メンバー名は `members.member_name` (本名) を優先、空なら `members.code_name`** |
| `/(app)/project/[projectId]/report/[ym]/print` | 集約 JSON を Team ARMADA ブランド (Work Sans / Noto Sans JP / JetBrains Mono / dark #0a1628) で A4 縦に表示。`@page A4 / margin 14mm 14mm 18mm 14mm`、各 sheet を `page-break-after: always` で章分離。`@page` の top-left に 機関名+期間、top-right に「取扱注意 / Confidential」、bottom-left に コピーライト、bottom-center に Page X/Y を CSS で自動付与 |
| Cockpit 月次モーダルヘッダの `📄 印刷 / PDF` リンク (v0.33.0〜) | 新規タブで上記ページを開く。ユーザーは Cmd+P → 「PDFとして保存」(余白=既定 / 背景のグラフィック=ON / A4縦) |
| Cockpit 月次モーダルヘッダの `📝 レポート本文を編集` ボタン (v0.33.0〜) | 旧「レポート」タブの機能を折りたたみアコーディオンで提供 (生成・修正指示・FIX・再生成)。タブUIは廃止 |

### 設計判断

- **PDF化路線**: Vercel serverless での Puppeteer/Playwright を **採用しない** (bundle/timeout で詰む)。ブラウザの印刷 → PDF 保存に寄せて、HTML レイヤだけを資産化する。後で Puppeteer 化したくなったら同じ HTML を使い回せる
- **削減した国プロ標準要素 (v0.32.0 時点)**: 倫理審査・利益相反 / 論文・学会発表・特許 / 株主構成 / 株主総会履歴 — CX/SX/KUTE は事業化・経営支援系で、研究委託でも会社運営報告でもないため (まさ 2026-06-22 確定)
- **RAG は 3 軸**: スケジュール・コスト・リスクのみ (品質・スコープは判定根拠が曖昧なため削除、まさ 2026-06-22 確定)
- **契約番号の正本化は別タスク**: `contract_terms.contract_no` が空 / `contracts.bid_no` 列なし / AMD 側採番 (`AMD-YYYY-PP-NNN`) 未実装。レポート上は「該当なし」表示で出る。**AMD 契約番号採番システムは別タスク (`AMD-YYYY-PP-NNN`、γ半自動採番、`contracts.bid_no` 列追加、入札番号抽出も同梱) で対応する** (まさ 2026-06-22「後回しでOK、タスクボードに入れて」確定)

### 業務遂行レポート見出し文の自動生成

`leadParagraph()` で contract.title / counterparty / period / value を組み合わせて生成。契約タイトルが取れない場合は `本業務 ({project_name})` にフォールバック。

### `monthly_reports` との関係

`monthly_reports.final_content` (markdown) が **§C 当月の進捗** 本文の主出力。`draft_content` フォールバック、両方空なら `project_monthly_notes.body`、それも空なら「未生成」表示。`generated_at` / `fixed_at` / `confirmed_by` は **§J 改訂履歴** に反映される。

### 外販含む大学・研究機関提出での運用 (v1 時代の設計、v2 で位置付け更新)

- **v1**: この印刷ビュー (`/project/[projectId]/report/[ym]/print` + Cmd+P PDF) を対外提出正本にした。
- **v2 (2026-07-01〜)**: この印刷ビューは **cockpit 内での内部保存版レビュー用** に位置付ける。対外提出版は Claude routine `amd-os-l2m1-monthly-report` が生成する `monthly_reports_external.body_md` + 自動 PDF を正本にする (下記「対外提出版」節参照)。既存の印刷ビュー §01-§07 章立ては cockpit 内で「内部保存版のリッチプレビュー」として引き続き提供、章立てを削除しない。

## 対外提出版 (v2 新設、2026-07-01〜)

### 生成経路

1. **Claude routine が月末最終日 03:00 JST に発火** (Phase 0 で最終日判定)
2. **Phase 2.3**: `monthly_reports.final_content` (内部保存版 markdown) を生成
3. **Phase 2.4**: `scope='internal_and_external'` の PJ のみ、内部版 markdown を入力に対外版 markdown を生成 (LLM が対外用語・章削除・言い換えを行う)
4. **Phase 2.5**: 禁止語チェック (`scripts/strip_internal_jargon.py`)。hard_fail → PDF 生成停止、まさ DM 通知
5. **Phase 2.6**: PDF 生成 (`scripts/generate_monthly_report.py` = pandoc → HTML → Chrome headless)。A4 の連続文書として自然改頁だけを許し、明示的な page break は入れない。routine 自体がまさの mac local Claude Code アプリ内で発火するため (= cloud sandbox ではない、SKILL.md 冒頭「登録・実行環境の current truth」参照)、pandoc / Chrome headless ともローカル実行。失敗時は outbox 経由でローカル LaunchAgent (`com.amd-os.l2m1-pdf-renderer`) fallback
6. **配置**: ローカル `/Users/masa/projects/AMD/{report_local_alias}/output/monthly_reports/` + 共有 Drive `projects.drive_folder_id / 月次業務報告書 / YYYY-MM/`

### 対外提出版のフォーマット (KUTE 実納品準拠)

- 章構成: 1. 業務概要 → 2. 当月の実施内容 → 3..N. 業務内容の各領域 → N+1. 体制および打合せ実施記録 → N+2. 主要成果物 → N+3. その他活動 (任意) → N+4. 来月以降の予定 → N+5. 継続協議事項 (任意)
- 文体: である体、儀礼挨拶なし、締め「以上のとおり報告する。」
- 自社メンバーは姓のみ表記 (`members.member_name` の姓部分)、フルネーム・code_name (えいみ / つくよみ 等) とも削除する。担当者名が不明な場合は「担当者」とする。客先関係者は「XX 先生」「XX 様」維持
- eLAD 等の表記ゆれは e-Rad (府省共通研究開発管理システム) に正規化する (`scripts/strip_internal_jargon.py` --mode normalize が最終ゲート)
- 業務期間・契約金額は `contracts.contract_terms_json` + `contracts.tax_basis` の verbatim
- 内部評価指標 (RAG / XRL / KPI / signals / pt / Δ 等) は全削除
- 「お願い・確認」セクション原則なし

### 対外版の allow_list (jargon check)

`projects.report_extra_allow_terms[]` + `projects.project_name` + `contracts.title` の和集合を allow_list として渡す。禁止語リストは opus-4-8 プロンプト内に埋め込み、`scripts/strip_internal_jargon.py` が最終ゲート。

### 対象 PJ (2026-07-01 まさ確定)

| scope | PJ | 動作 |
|---|---|---|
| `internal_and_external` | p25 KUTE / p21 SX / p20 CX (NIMS) | 内部保存版 + 対外提出版 + PDF 生成 |
| `internal_only` | p00 AMD / p07 LST / p10 SE / p19 ZMP / p24 CLG / p26 VasculaX | 内部保存版のみ生成、対外版と PDF は skip |
| `none` | p06 CTB | routine 対象外 |

scope は `/admin/projects` の「月報 scope」列でまさが編集可能。
