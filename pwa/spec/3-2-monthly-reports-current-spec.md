# L2M-1 Monthly Reports 仕様

> **この章は何か**: `monthly_reports` の writer、上書き禁止、source refs、outbox 反映、旧 R313 / PWA route の扱いを固定する章。運用者向けの説明は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも残す。

## 正本テーブル

| table | 用途 |
|---|---|
| `monthly_reports` | PJ × ym の月次レポート本文。`draft_content` と `final_content` を持つ |
| `source_cache` | Gmail / Slack などの source refs / short snippet / hash 証跡。no-data 判定の正本ではない |

`monthly_reports` は後続 L2 の一次入力になるため、完全版を待たず、確認済み事実だけでも draft を積む。

## 現行 writer

| 項目 | 値 |
|---|---|
| primary writer | Codex automation `AMD OS L2M-1 月次報告抽出` |
| schedule | daily 05:30 JST |
| input | Gmail / Drive / Calendar / Slack / Notion 5 生データ + OS snapshot |
| output | `~/.codex/automations/amd-os-ms/outbox/*.json` の `monthlyReports` |
| applier | LaunchAgent + `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir` |

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
| paid external LLM API direct call | automation 外で新規に使わない |

> ⚠️ **writer 間のガード整合**: 上記「生成対象ガード」は backfill route だけでなく、primary writer (Codex automation `AMD OS L2M-1 月次報告抽出`) も通す必要がある。現状ガードのコード実装は backfill route にあり、Codex automation 側は automation.toml のプロンプト指示で同等の判定をかける。両 writer が「進捗なし & ended/frozen は生成しない」を守ることが正本。

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

### 外販含む大学・研究機関提出での運用

CX (NIMS) / SX (愛媛大) / KUTE (工学院大学) の月次提出はこの印刷ビューを正本にする。固有テンプレートが必要になったら `print-client.tsx` の §セクションを差し替えるか、`reportTemplate` クエリパラメータで分岐させる (未実装、必要になったら追加)。
