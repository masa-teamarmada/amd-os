---
name: amd-os-l2m1-monthly-report
description: Claude Code Routines の Fable 5 で月次業務報告書を生成するM-1手順。kaku-reportで証跡を事業領域別に統合し、社内版finalと必要な提出版を決定論的品質ゲートに通してから、承認済みhelperで保存・再読込検証する。
---

# AMD OS L2 M-1 月次業務報告書

## 実行境界

- この手順は `amd-os-l2-monthend-evidence` Code Routine の Phase A としてだけ実行する。
- モデルは **Fable 5 固定**。別モデル、CLI、従量課金API、subagent、workflowへ生成を委譲しない。
- 実行前に `pwa/scheduled-tasks/shared/kaku-report/SKILL.md` を全文読み、その規範を社内版と提出版の両方に適用する。
- プロジェクトは1件ずつ順番に処理する。取得元別・会議別の文章を並列生成して後で連結しない。

## 対象

```text
projects.monthly_report_scope IN ('internal_only','internal_and_external')
AND projects.status IN ('active','sales')
```

- `internal_only`: 社内版 `monthly_reports.final_content` まで。
- `internal_and_external`: 社内版、提出版 `monthly_reports_external.body_md`、禁止語検査、PDFまで。
- `none`: 対象外。
- 対象判定は `monthly_report_scope` が正本。`project_category` や旧 `monthly_report_required` で勝手に除外・追加しない。
- 社内版 `ym` は `YYYYMM`、提出版 `ym` は `YYYY-MM`。

## 完了条件

1 PJについて、次をすべて満たした時だけ完了とする。

1. 社内版を Fable 5 で生成し、kaku-report自己検査と `validate-monthly-report` に合格した。
2. 承認済みhelperで `monthly_reports.final_content` に保存し、結果が `inserted` または `updated` だった。
3. 保存後に再読込し、本文、`status='final'`、`generated_at` を確認した。
4. `internal_and_external` は、同じPJの直前月実提出版を構造正本として取得し、提出版もkaku-report自己検査、`validate-monthly-report-external` の `formatMatch=true`、禁止語検査に合格し、承認済みhelperで保存・再読込した。
5. PDFが必要な場合は、提出版の保存後本文だけから生成し、指定Driveへ配置した。

outboxを作っただけ、validatorを呼んでいない、保存後に再読込していない状態は未完了。

## 動く前に読む

1. `pwa/scheduled-tasks/shared/kaku-report/SKILL.md`
2. `pwa/spec/3-2-monthly-reports-current-spec.md`
3. `pwa/spec/5-3-automation-responsibility-current-spec.md`
4. `pwa/manual/8-3-l2-extraction-routines-spec.md`
5. `pwa/design/L2_DATA.md`
6. `pwa/design/db_schema.md`
7. `pwa/design/ms_progress.md`
8. `pwa/design/progress_estimation.md`
9. `pwa/src/lib/monthly-report-quality.ts`
10. `pwa/scripts/ms_progress_review_tool.mjs` の月次 validator と upsert helper
11. `pwa/scripts/strip_internal_jargon.py`
12. `pwa/scripts/generate_monthly_report.py`

## Phase 1: 既存稿と当月証跡を読む

各PJについて、当月の既存社内版・提出版と、次の証跡を読む。

`internal_and_external` は、当月本文を書く前に**同じPJの直前月の実提出版**を1件取得する。第一候補は `monthly_reports_external(project_id=<same>, ym=<previous YYYY-MM>)`、そこになければそのPJの承認済みDrive提出物を使う。他PJの提出版、とくにKUTEの章立てを共通テンプレートとして流用しない。直前月版を取得できない初回月は自動生成・自動保存せず、`format_seed_required` として人の承認へ回す。

- `project_meeting_summaries`
- `project_strategy_signals`
- `project_xrl_evidence`
- `project_registry_diffs`
- `protocols`
- `project_knowledge`
- `member_knowledge`
- `milestone_monthly_progress`
- `progress_estimate_state`
- `project_monthly_notes`
- 契約、メンバー、action item、助成金、成果物、メディア、予実の当月関連行

L2のcoverageが薄い、古い、根拠不足、または no-data 候補のときだけ、Gmail、Drive、Calendar、Slack、Notionをgap checkする。`source_cache`だけを見て「データなし」と決めない。

### Phase 1.5: 会議書き起こし本文の必須確認 (2026-08-29 まさ確定)

`project_meeting_summaries` の要約だけを根拠に本文を書いてはいけない。要約層は名称変更や申請可否のような単発の意思決定を落とすことがある (実例: 2026-08 に SX のラウンドテーブル改称 EWIR→SIER と、KUTE の GTIE 9月エントリー申請断念の両方が要約層に無く、月報へ旧情報が載った)。各PJについて、本文を書く前に次を必ず行う。

1. 当月の会議一覧のうち、`source_kinds='upcoming'` のみ・`narrative_md` が空・要約が会議実施の事実しか持たない会議を列挙する。
2. それらの会議と、当月最後の定例・経営会議について、**書き起こし本文・議事メモの一次ソース**を読む。読む順序は (a) Notion 議事録 (routineはNotion connector、ローカルセッションは `GET /api/internal/notion-context?q=<会議名や人名>` に `Authorization: Bearer $CRON_SECRET`)、(b) Gmail の Gemini 自動メモ (`from:gemini-notes@google.com`) と議事メモ送付メール、(c) Drive の当月会議フォルダの資料 (`YYMMDD_<会議名>` 配下)。
3. 読んだ本文から、**固有名詞の現在値**を確認する: 枠組み・組織・製品の名称 (改称があれば新名称を正、旧名称は「旧称」として一度だけ)、公募・申請の採否/断念/見送りの確定、日程の確定値、金額の確定値。前月版や要約層の値と食い違う場合は、一次ソース側を正とする。
4. 一次ソースでも確認できない意思決定を本文へ書かない。「協議した」「検討中」と、「決定した」を混同しない。

生メール、Slack本文、議事録全文、私的なNotion本文、秘密情報、個人情報は報告書やoutboxに残さない。本文生成に必要な事実だけを短い作業メモへ抽出し、監査情報と分ける。

## Phase 2: 入力を5種類に分ける

kaku-reportに従い、証跡を次へ分類する。

1. 確認済み事実
2. 判断と合意
3. 成果と変化
4. リスクと次の行動
5. 監査情報

監査情報には取得件数、参照ID、生成時刻、コネクタ名、snapshot名を入れる。これは `collection_summary_json` やroutine最終報告の材料であり、社内版・提出版の本文には入れない。

予定と実績が重複する場合は実績を正本に統合する。確定、協議中、予定、推測を混同しない。

## Phase 3: 社内版を生成する

`llm_prompts.l2m1.monthly_report.internal.v2` が有効なら、プロジェクト固有の制約として読む。ただし文章品質の外枠はkaku-report、章構成と決定論的検査は現行コードを正本にする。DBプロンプトが生成過程や監査メタデータを本文に書かせる場合、その部分は採用しない。

章は次の順で1回ずつ使う。

1. `## 概要`
2. `## 今月進んだこと`
3. `## 重要な判断・合意`
4. `## 顧客・共同研究・外部関係者の動き`
5. `## 技術・知財・実験・資料`
6. `## リスク・未確定事項`
7. `## 来月の焦点`
8. `## 根拠`

### 概要

3〜5文で、当月に最も進んだ仕事と到達点、並行した重要事項、判断またはリスク、次月の焦点を書く。各文はプロジェクトの状況を更新する。

次は禁止する。

- 取得件数、確認範囲、データソース一覧
- draft、collection summary、source refs、L2、snapshot
- 「本文は〜から構成した」など作り方の説明
- 「月次断面」「補強した」「更新した」など生成者視点の説明
- 個別会議の羅列

### 今月進んだこと

当月の仕事を2〜5個の業務領域に統合し、各領域を「背景、実施、到達点、残課題」の順で書く。メール、会議、チャットの取得元順に並べない。

### その他の章

- 判断は誰が何をどの状態まで決めたかを書く。
- 未確定は未確認、協議中、予定を区別する。
- 成果物名は、それによって何が可能になったかと組み合わせる。
- 次の行動は、担当・対象・期限が根拠にある場合だけ具体化する。
- 根拠は日付、種別、自然な件名だけにし、内部ID、URL、件数、raw本文を入れない。
- 根拠が少ない月は短く書き、文字量を満たすための一般論や推測を足さない。

## Phase 4: 社内版の品質検査

まずkaku-reportの8項目を自己検査し、1つでも不合格なら影響する章全体を書き直す。その後、一時outbox JSONに社内版を入れて次を実行する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs validate-monthly-report --file "$INTERNAL_OUTBOX"
```

`ok=true` になるまで保存しない。`strict=false` で検査を迂回しない。

## Phase 5: 社内版を保存し、再読込する

一時ディレクトリはroutine内で `mktemp -d` を使う。outboxには少なくとも次を入れる。

```json
{
  "monthlyReports": [{
    "project_id": "<project_id>",
    "ym": "<YYYYMM>",
    "final_content": "<validated markdown>",
    "draft_content": "<same validated markdown>",
    "status": "final",
    "collection_summary_json": {
      "generated_by": "claude-code-routine-fable-5",
      "quality_standard": "kaku-report",
      "audit_counts": {}
    }
  }]
}
```

承認済みhelperだけで保存する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports --file "$INTERNAL_OUTBOX"
```

- 既存 `final_content` が空なら生成・保存する。
- 既存 final があり、品質ゲート合格なら `skipped_final_exists` を正常スキップとして扱う。
- 既存 final が品質ゲート不合格でも、定期routineから `force=true` を使わない。`repair_required` として報告する。
- helperの標準出力に本文が含まれても、最終実行報告へ転載しない。
- 保存後はread経路で再取得し、本文長、hash、status、generated_atを生成物と照合する。

## Phase 6: 提出版を生成する

`monthly_report_scope='internal_and_external'` だけ実行する。保存・再読込済みの社内版を入力にし、`llm_prompts.l2m1.monthly_report.external.v2` とプロジェクト固有allow listを制約として使う。

- 社内事情、内部スコア、内部判断ログ、禁止語、source ref、取得件数、生成過程を除く。
- 社内版を単に削るのではなく、委託元が実施内容、成果、体制、次月予定を判断できる連続文書へ書き直す。
- `# 月次業務報告書` で始め、**同じPJの直前月実提出版の構造を継承**し、末尾定型を満たす。
- 根拠がない成果や数値を足さない。提出体裁のためだけの一般論で水増ししない。
- 章間へMarkdown水平線 (`---` / `***` / `___`) を入れない。保存helperでも残存する水平線を除去する。
- 共同研究者、大学教員、協力先の個人名を活動評価の主語にしない。正式な決裁者・契約当事者の特定が不可欠な場合を除き、組織、研究チーム、PJの進展を主語にする。
- 外部関係者のフルネームを本文・表・打合せ名に出さない。様式上どうしても氏名が必要な場合も、本人・提出先と合意した表記または姓＋敬称・役職に留める。
- 「氏名＋先生／教授／准教授は〜を開始・実施」「経営体制候補者」「相手を巻き込む・動かす」のように、相手を査定、分類、操作する表現を使わない。
- 打合せ記録も、氏名が様式上必要な場合を除き、大学研究チーム・関係機関・弊社などの単位で表す。次の行動は、合意済みの担当か、関係者間の共同確認として書く。

### 前月フォーマットの継承契約

前月版から固定して引き継ぐものは次のとおり。

- H1
- 主要H2の名称、数、順序
- 表の数、順序、所属するH2、列名
- 冒頭の契約情報表の行ラベル
- 先頭列が `業務項目` の表にある固定行ラベルと順序
- 末尾定型文

当月の証跡で更新するものは、日付、対象期間、本文、表の値セル、実施記録、成果物、予定である。H3や通常の明細行は当月実績に応じて増減できる。**前月の事実を転記してはいけない。構造だけを継承する。** 契約変更などで構造変更が必要な場合はroutine内で独断変更せず、`format_change_required` として人の承認へ回す。

validator用outboxには候補本文と参照本文を同じPJ・連続月の組として入れる。

```json
{
  "monthlyReportsExternal": [{
    "project_id": "<project_id>",
    "ym": "<YYYY-MM>",
    "body_md": "<当月候補>",
    "reference_project_id": "<same project_id>",
    "reference_ym": "<previous YYYY-MM>",
    "reference_body_md": "<同じPJの直前月実提出版>",
    "generated_by_model": "claude-code-routine-fable-5"
  }]
}
```

次の順で検査する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs validate-monthly-report-external --file "$EXTERNAL_OUTBOX"
python3 pwa/scripts/strip_internal_jargon.py --input "$EXTERNAL_MARKDOWN" --mode check
```

`ok=true` かつ `formatMatch=true` と禁止語検査の両方に合格したときだけ、次のhelperで保存する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports-external --file "$EXTERNAL_OUTBOX"
```

`generated_by_model` は `claude-code-routine-fable-5`、`jargon_check_status` は実検査結果を保存する。保存後に再読込して本文長、hash、生成時刻、禁止語statusを照合する。

定期routineは `format_seed_approved=true` や `force=true` を設定しない。既存当月版は `skipped_existing`、前月参照なしは `format_seed_required`、構造不一致は `format_change_required` として報告し、自動上書きしない。

## Phase 7: PDFと通知

提出版の保存・再読込まで通ったプロジェクトだけPDFを生成する。固定のローカルパスを前提にせず、routineの一時ディレクトリを出力先にする。Drive配置先は `projects.drive_folder_id` とcurrent specを正本にする。

品質不合格、DB未反映、禁止語hard fail、PDF失敗を成功通知にしない。通知は現行specの承認済み経路だけを使い、raw本文や秘密情報を含めない。

## 禁止

- 監査情報を概要や本文へ書く。
- `String(array)`、配列のカンマ連結、先頭数件の `slice` だけで本文を作る。
- 既存draftへ新しい断片を継ぎ足すだけで完成扱いにする。
- 社内版なしで提出版を作る。
- 同じPJの直前月実提出版を読まずに提出版を作る。
- 他PJの書式を共通テンプレートとして使う。
- 前月の事実を当月へコピーする。
- 提出版を社内版列へ保存する。
- validatorや禁止語検査を迂回する。
- outbox作成だけでDB反映済みと報告する。
- Supabase connector、SQL、RESTで直接writeする。
- 非Fableモデル、CLI、従量課金API、subagent、workflowを使う。
