# ECR 実装仕様

> **この章は何か**: 研究機関 ECR (Ecosystem Construction Rate / エコシステム構築率) の PWA 実装、DB、評価 UI、API contract。理論と rubric は `/bzm/7-1-ers-ecosystem-readiness` と `/bzm/9-4-ers-rubric`。

> **2026-07-29 主張境界**：この章が確定するのは現行PWAの入力、計算、表示、保存契約であり、ECRの成果妥当性または因果妥当性ではない。現行ECRは自前の制度・装置を中心とする診断指数で、機関成果の確率、外部連携を含む実効サービス能力、案件処理速度、支援の因果効果を表す検証済み尺度ではない。Lv1〜5を順序尺度として扱い、総合ECRだけで機関順位、支援優先順位、AMDの営業提案を決めない。BZM 2.0では自前ストック、実効サービス、流量成果へ分離する。改訂要件は [`BZM_2_0_REVISION_REQUIREMENTS.md`](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) を参照する。
>
> **呼称**: 旧称 ERS (Ecosystem Readiness Score) は 2026-07-11 まさ確定で廃止 (`pwa/bzm/terminology_glossary.md` §1.5)。式・計算は不変で、`ers.ts` / `fetchErsBundle` などのコード・route slug は内部識別子として据え置き。アーカイブ内の「ERS」は「= 現 ECR」と読む。

## Route / Files

| route / file | 役割 |
|---|---|
| `/institutions` | 契約有無に依存しない研究機関カタログ。初期表示は一覧、ECR比較は別タブ |
| `/institutions/[institutionId]` | 機関詳細 |
| `/institutions/[institutionId]/cockpit` | `institution_projects` から解決する研究機関PJコックピット |
| `/institutions/assess` | ECR 評価 matrix |
| `pwa/src/lib/ers-data.ts` | client fetch bundle |
| `pwa/src/lib/ers.ts` | ECR 型 / score calculation |
| `pwa/src/lib/institution-projects.ts` | `institution_projects` 行を画面用の関連PJへ変換する純粋関数 |
| `pwa/src/app/api/institutions/assess/route.ts` | 評価 cell upsert |
| `pwa/src/components/institutions/InstitutionSupportPrograms.tsx` | `/institutions` 支援プログラム比較タブ (比較表 + 推奨表 + 詳細/編集ドロワー) |
| `pwa/src/lib/institution-support-programs.ts` | server-only。比較列・セル・推奨のプロセス内スナップショット (TTL 5分、single-flight、ページ読み) |
| `pwa/src/lib/institution-support-programs-client.ts` | クライアント層。`reference-data-cache` 経由の読み取りと、セル・推奨の保存 |
| `pwa/src/app/api/institutions/support-programs/route.ts` | 支援プログラム比較の読み取り (member、portfolio scope、Cache-Control 明示) |
| `pwa/src/app/api/institutions/support-program-recommendations/route.ts` | 推奨 (論点) の upsert (admin) |

## DB

| table | contract |
|---|---|
| `institutions` | 契約前から増やす機関カタログ。`institution_id` PK、name、short_name、type、region、contract_status、identity_status、sort_order |
| `institution_projects` | 研究機関全体を対象にするAMD契約PJ。`project_id` PK/FK、institution_id、engagement_scope、target_unit、ecosystem_goal、seed_discovery_in_scope |
| `institution_capability_axes` | ECR 8 軸。`axis_id` PK、axis_no、name、corresponds_xrl、weight、sort_order |
| `institution_capability_criteria` | 各軸の sub criteria。`criterion_id` PK、axis_id、code、name、rubric JSON |
| `institution_assessments` | 評価履歴。`assessment_id` PK、unique `(institution_id, criterion_id, evaluated_at)` |
| `institution_policy_items` | 制度比較マトリクスの項目 master。`policy_item_id` PK、category、key、label、description、value_type、sort_order |
| `institution_policy_items` (追加列) | `compare_group` / `compare_sort` / `compare_label` (migration 375)。`compare_sort` を持つ項目だけが `/institutions` 支援プログラム比較の列になる。列の並び・短い見出しは DB が正本 |
| `institution_policy_assessments` | 機関 × 制度項目の証拠台帳。`policy_assessment_id` PK、unique `(institution_id, policy_item_id)`、status、attribute_value、evidence_note、source_type、source_url、source_path、confirmed_at、evaluator |
| `institution_policy_recommendations` | AMD が規程類へ盛り込むべき論点と推奨 (migration 376)。`recommendation_id` PK、`policy_item_id` (nullable FK)、topic、stance (`recommend` / `conditional` / `not_recommend` / `open`)、recommendation、conditions、rationale、evidence_note、stat_note、sort_order、is_active。統計は持たず画面が算出する。RLS は member read / admin all / service_role |

`institution_assessments.level` は 1..5 または NULL。`na=true` の場合は該当なしとして軸平均から除外する。

`institution_policy_assessments.status` は `unknown` / `not_started` / `drafting` / `established`。`unknown` は未確認、`not_started` は根拠を見た上で未整備なので混ぜない。内部資料パスやヒアリング由来の根拠を含むため、`institution_policy_items` は anon read 可、`institution_policy_assessments` は admin authenticated + service_role read/write 限定。

## Fetch Contract

`fetchErsBundle()` は以下を parallel fetch する。

- `institutions` order by `sort_order`
- `institution_capability_axes` order by `sort_order`
- `institution_capability_criteria` order by `sort_order`
- `institution_assessments` order by `evaluated_at desc`
- `institution_projects` + `projects(project_name,status)`
- `seeds.institution_id`（機関別シーズ件数）

assessment は `(institution_id, criterion_id)` ごとに最新 `evaluated_at` の 1 行だけを採用する。

## `/institutions` List / Comparison Contract

- 研究機関一覧はdescriptionを表示せず、機関名・種別/地域・所属シーズ・ECR・PJ状態を1機関1行で表示する。
- 固定優先順は `PJ化済み → PJ化検討中 → その他`。`active/ended/frozen` はPJ化済み、`sales/draft` または機関 `contract_status=draft/prospect` はPJ化検討中。
- ECR比較は1研究機関=1行へ転置し、列は研究機関 / 総合ECR / 8軸 / 評価数・最新評価日。機関数に応じて列を増やさない。
- ECRは研究機関環境、SPSは個別シーズ/PJの別系列。比較表でも合算しない。

## Institution Cockpit Contract

`/dashboard` と `/institutions` の研究機関行から、`institution_projects` に紐づく関連PJコックピットへ遷移する。コード内の機関ID→PJ ID固定表、名称部分一致、PJカテゴリ推定は使わない。

実装 contract:

- `fetchErsBundle()` が `institution_projects` を読み、現行PJを優先して機関ごとの関連PJを組み立てる。
- `/institutions/[institutionId]/cockpit` は `fetchErsBundle()`, `fetchCockpitFromSupabase(projectId)`, `fetchProjectMeetingSummaries(projectId)` を読むだけで、本番DBへ write しない。
- 上部に ECR summary / 関連PJ / 今期MS / MTG件数を表示する。
- ECR summary の直下に常時見る readiness snapshot を置き、ECR充足率、強い軸、確認したい軸、関連PJのMS/月次件数を表示する。
- 基本タブは `進捗管理` / `スコア詳細` / `土壌×シーズ`。研究機関でも運用構造はPJ cockpitに寄せるが、スコア詳細はSU向けAMD ScoreではなくECR 8軸・評価項目・Lv/根拠メモを表示する。`土壌×シーズ`タブの契約は本章末尾「土壌×シーズタブ」を参照。
- `進捗管理` は既存 `CockpitView` を使うため、MS進捗管理、月次カード/モーダル、MTGサマリの挙動は通常PJコックピットと同じ。
- `project_meeting_summaries` は月別の MTG tree として `進捗管理` の下部に表示し、各 row は `/project/[projectId]/cockpit?meeting=<meeting_id>` へ遷移する。MTG tree を機関コックピット最上部には置かない。
- 機関とPJの正式scopeは `institution_projects`。外部機関向けワークスペースと認可は `pwa/design/institution_seed_project_model.md` §6、route境界は `pwa/spec/2-1-pwa-runtime-routes.md` を正本にする。旧 `institution_tenant_access.md` はNIMS固有の将来候補を残す履歴資料。

## API

`POST /api/institutions/assess`

認証:

- Supabase auth user 必須。
- `members.email` から member を引き、`is_admin=true` のみ許可。
- write は `createAdminClient()`。

body:

| field | required | contract |
|---|---|---|
| `institution_id` | yes | target institution |
| `criterion_id` | yes | target criterion |
| `level` | no | integer 1..5 or null |
| `na` | no | true なら level null |
| `note` | no | 2000 chars max |

`evaluated_at` は today JST。同日中の編集は `onConflict: institution_id,criterion_id,evaluated_at` で同一 row に上書きされる。

`POST /api/institutions/policies`

認証:

- Supabase auth user 必須。
- `members.email` から member を引き、`is_admin=true` のみ許可。
- write は `createAdminClient()`。

body:

| field | required | contract |
|---|---|---|
| `institution_id` | yes | target institution |
| `policy_item_id` | yes | target制度項目 |
| `status` | yes | `unknown` / `not_started` / `drafting` / `established` |
| `attribute_value` | no | 属性項目の自由入力値 |
| `evidence_note` | no | 根拠メモ |
| `source_type` | no | `official` / `internal_doc` / `hearing` / `unknown` など |
| `source_url` | no | 公開URL |
| `source_path` | no | admin-only内部資料path |
| `confirmed_at` | no | 確認日 |
| `evaluator` | no | 入力者 |

`onConflict: institution_id,policy_item_id` で 1 機関 × 1 制度項目を上書きする。

## Seed / Data Import

制度比較マトリクスの初期入力は `pwa/scripts/migrations/120_institution_policy_assessments_seed.sql`。対象は香川大学 (`inst_kagawa`) / 工学院大学 KUTE (`inst_kute`) / NIMS (`inst_nims`) の 3 機関 × 32 項目 = 96 件。

- `113_institution_policy_matrix.sql`: `institution_policy_items` / `institution_policy_assessments` と初期 master 32 件。
- `114_institution_policy_assessments_admin_read.sql`: evidence-bearing table を admin authenticated + service_role 限定へ修正。
- `120_institution_policy_assessments_seed.sql`: 96 件の first evidence-backed seed。main の既存 `116`〜`119` と衝突しない採番。

適用コマンド:

```sh
cd pwa
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/120_institution_policy_assessments_seed.sql
```

適用後の確認:

- 件数: `institution_policy_assessments` が対象3機関で計96件。
- `confirmed_at is null` が0件。
- 機関別status分布が入力記録 `pwa/design/institution_policy_matrix_inputs_2026-05-31.md` と一致する。
- `/institutions/assess` の `制度整備` / `規程比較` / `根拠資料` タブで、香川大/KUTE/NIMSの各セルと根拠が読める。

## 支援プログラム比較 Contract (2026-09-05)

`/institutions` の「支援プログラム比較」タブ。行は `institutions` 全件 (SU関連規程タブと同じ母集団)、列は `institution_policy_items` の `compare_sort` 非 NULL 項目 (16 列、5 群)。

読み取り `GET /api/institutions/support-programs`:

- 認証: `requireMember()` に加えて `getCurrentMemberAccess()` が `portfolio` scope のときだけ通す。PJ限定の外部メンバーへ横断母集団を返さない。
- `institution_policy_assessments` の RLS は admin 限定のまま。route が service client で読み、会員へは `status` / `attribute_value` / `evidence_note` / `source_url` / `source_type` / `confirmed_at` だけ返す。**`source_path` と `evaluator` は返さない**。
- 3 層キャッシュ (spec 5-10)。サーバ層は列定義と推奨を並列に読み、セルは `.range()` のページ読みで 1000 行上限を跨ぐ。`?fresh=1` でサーバ層を強制再読込。`Cache-Control: private, max-age=60, stale-while-revalidate=600`。
- 応答: `{ ok, columns[], cells[], recommendations[], generatedAt, canEdit }`。`canEdit` は `members.is_admin`。
- 書き込み経路 (`POST /api/institutions/policies`、`POST /api/institutions/support-program-recommendations`) は保存後に `invalidateInstitutionSupportProgramsCache()` を呼ぶ。クライアントは `invalidateInstitutionSupportPrograms()` の後に `fresh=1` で読み直す。

推奨の書き込み `POST /api/institutions/support-program-recommendations` (admin):

| field | required | contract |
|---|---|---|
| `recommendationId` | no | 省略で新規 (`rec_<uuid>`)。指定で上書き |
| `policyItemId` | no | 比較列に紐づける `institution_policy_items.policy_item_id`。存在しない ID は 400。null なら統計なし |
| `topic` | yes | 論点 (問いの形) |
| `stance` | yes | `recommend` / `conditional` / `not_recommend` / `open` |
| `recommendation` | yes | AMD の推奨 (一文) |
| `conditions` / `rationale` / `evidenceNote` / `statNote` | no | 規程へ盛り込む条件 / 根拠 / 代表例・出典 / 統計への補足 |
| `sortOrder` | no | 既定 100 |
| `isActive` | no | false で表から外す (行は残す) |

画面の集計契約 (純粋関数 `computeRecommendationStats`):

- 論点に `policyItemId` があるとき、全機関のセル状態を数える。`confirmed = total - unknown`、割合は `established / confirmed`。**未確認を分母に入れない**。
- 比較表上部の要約 (認定制度あり / 学内本店登記 可 / 施設貸与あり / 共用設備あり) も `established` だけを数える。

Validation:

- `npm run test:reference-data-cache` で `/api/institutions/support-programs` が登録済み参照系として契約 1〜3 を満たすこと。書き込み専用の 2 経路は `reference_data_cache_baseline.json` に理由付きで載っている。
- `institutions` に 1 件足すと、一覧 / SU関連規程 / 支援プログラム比較 / ECR比較 の全部に同じ行が出ること (行の母集団はコード側で持たない)。

## Failure Mode

| failure | response |
|---|---|
| unauthenticated | 401 |
| non-admin | 403 |
| missing id | 400 |
| invalid level | 400 |
| invalid policy status | 400 |
| Supabase upsert error | 500 |

## Validation

- `/institutions/assess` で cell を更新し、同日同 criterion が 1 row に upsert されること。
- `fetchErsBundle()` が最新評価だけを採用すること。
- rubric の文言は `/bzm/9-4-ers-rubric` と一致させる。
- KUTE (`p25`→`inst_kute`)、NIMS (`p28`→`inst_nims`)、愛媛大学 (`p30`→`inst_ehime`) が `institution_projects` から解決されること。p30は `engagement_scope='university_wide'`、`ecosystem_goal='愛媛大学全体のエコシステム構築'` であり個別シーズPJとして扱わない。
- 機関コックピットの連携シーズ比較テーブル (`CockpitKuteSeeds`) は `institution_projects.institution_id` が解決できるPJでのみ表示する。PJ IDの固定表をコードに持たない。
- 研究機関コックピット上のMTG treeから通常PJコックピットの `?meeting=` detail route へ遷移できること。
- `120_institution_policy_assessments_seed.sql` を dry review し、migration番号が既存 `001`〜`119` と衝突しないこと。
- 制度比較seedは `(institution_id, policy_item_id)` unique upsert なので、再適用しても同一96件を更新するだけで重複しないこと。

## 土壌×シーズタブ (2026-07-30)

> **絶対制約**: ECR (機関の生態系構築度) と SPS (シーズの事業化見込み) は同じ機関に属していても合成単一スコアにしない (`pwa/bzm/terminology_glossary.md` §4、`BZM_2_0_REVISION_REQUIREMENTS.md` §3-5)。本タブは両者を同じ観測基準日 (as-of) で整列するが、ECR元評価日とSPS元評価日は別表示し、同日に測ったとは扱わない。相関係数・回帰係数・因果主張は一切計算・表示しない。小標本、同一機関内の反復観測、交絡、欠測、ECR level と SPS 構成軸に含まれる順序尺度を常に注記する。

### DB

新規テーブルなし。既存2テーブルに最小列追加 (migration `202_soil_seeds_institution_link.sql`、適用済み):

| table | 追加列 | contract |
|---|---|---|
| `seeds` | `institution_id text REFERENCES institutions(institution_id)` (nullable) | migration 207で大学・国研シーズ141件を46研究機関へbackfill。推定名称は `institutions.identity_status='candidate'` のまま保持する |
| `institution_assessments` | `evaluation_version text NOT NULL DEFAULT 'v1'` | 既存行は rubric v1 のみのため一括 `'v1'`。`ers-data.ts` は `row.evaluation_version || "v1"` でNULL/空のみ fallback |

SPS 評価値そのものは本 migration で一切変更しない (既存 `seed_sps_assessments` の値をそのまま参照する)。

### Data Layer (`pwa/src/lib/institution-soil-seeds.ts`)

Supabase import なしの純粋関数群。ECR と SPS を独立に as-of 整列し、絶対に1つの値へ合成しない設計:

| function | 契約 |
|---|---|
| `computeSpsDistributionStats(scores)` | null (未評価) を除外し n/min/q1/median/q3/max を返す。分位点は線形補間法 (R-7 / Excel PERCENTILE.INC 相当)。空配列は全て null (n=0) |
| `rankSeedsBySps(seeds)` | 降順 competition ranking (同点同順位、次順位はスキップ)。SPS未評価 (null) は末尾かつ `rank: null` |
| `selectLatestAsOf(snapshots, asOfDate)` | `evaluatedAt <= asOfDate` で最新1件を選ぶ。該当なしは `selected: null` (捏造しない)。最新観測が「missing」状態でも黙って古い「ready」行へ戻らず、その missing 行をそのまま返す |
| `selectLatestPerKeyAsOf(snapshots, asOfDate, keyOf)` | ECR criterion 単位の carry-forward。ECR 8軸履歴断面の再構成に使う |
| `collectObservationDates(ecrDates, spsDates)` | ECR/SPS 実観測日の union を新しい順で返す。今日日付などの疑似断面は生成しない |
| `formatSourceDateRange(dates)` | 元評価日を単日 or `最古〜最新` 範囲文字列として表示用に整形 |

`fetchSeedSpsHistoryForSeeds()` (`pwa/src/lib/seeds-data.ts`) を新規追加。既存 `fetchSeedsForInstitution` は latest snapshot のみのため、履歴断面台帳用に全履歴取得関数を追加した。

### UI (`pwa/src/components/cockpit/CockpitSoilSeeds.tsx`)

機関コックピット `土壌×シーズ` タブ。研究評価ラボノート調 (白紙・墨文字・既存藍アクセント・罫線中心)。KPIカード/レーダーチャート/相関散布図は使用しない (禁止事項として `test:critical-ui` で regression guard 済み)。

- 冒頭に「読み方の制約」注意書き (小標本・機関内反復・順序尺度・因果主張なしを明記)
- 観測断面台帳: ECR/SPS の実観測日 union (最大24断面) を新しい順に並べ、各断面で ECR 8軸 (`selectLatestPerKeyAsOf` で評価点ごとcarry-forward) と SPS 分布 (`selectLatestAsOf` 相当をシーズごとに独立適用) を横に並べる。ECR元日とSPS元日は別列で表示し、「同日観測」という表現は使わない (各系列固有の観測日をそのまま見せる)
- 最新ECR 8軸表、最新SPS分布表 (n/min/Q1/median/Q3/max。SPS未評価はNへ含めず分布外に保持)、所属シーズ順位表
- KUTE専用: 所属シーズの上位ランクから既存 p25 GTIE 申請支援検討フローへの導線リンク (`pathwayProjectId`/`pathwayProjectLabel` が渡された場合のみ表示)

### Failure Mode

| failure | response |
|---|---|
| ECR/SPS に観測基準日以前の評価がない | 該当系列は `null` のまま表示し、0で埋めない。SPS最新評価が欠損状態なら、過去の評価済み値へ黙って戻らない |
| 所属シーズ0件 | 順位表・分布は空状態 (n=0) を表示、エラーにしない |
| `institution_id` 未backfillの機関 | 所属シーズ0件として扱う (捏造しない) |

### Validation

- `npm run test:institution-soil-seeds` — 分位点/ランキング/as-of整列/観測日collect/UI・migration・seeds-data contract test
- `npm run test:critical-ui` — タブ導線・見出し文言・recharts不使用のregression guard

## 再構築可能性チェック

この章で ECR の DB、fetch、upsert API、admin gate、制度比較seedの投入手順、および土壌×シーズタブのDB・データ層・UI契約は再構築できる。まだ不足しているのは ECR 8 軸 rubric の PWA seed と `/bzm` からの同期方法。
