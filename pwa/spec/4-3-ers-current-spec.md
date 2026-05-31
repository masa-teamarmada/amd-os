# ERS 実装仕様

> **この章は何か**: 研究機関 ERS (Ecosystem Readiness Score) の PWA 実装、DB、評価 UI、API contract。理論と rubric は `/bzm/7-1-ers-ecosystem-readiness` と `/bzm/9-4-ers-rubric`。

## Route / Files

| route / file | 役割 |
|---|---|
| `/institutions` | ERS 一覧 |
| `/institutions/[institutionId]` | 機関詳細 |
| `/institutions/[institutionId]/cockpit` | 機関カード起点の関連PJコックピット。NIMSは `inst_nims -> p20` |
| `/institutions/assess` | ERS 評価 matrix |
| `pwa/src/lib/ers-data.ts` | client fetch bundle |
| `pwa/src/lib/ers.ts` | ERS 型 / score calculation |
| `pwa/src/lib/institution-projects.ts` | 機関と既存PJの静的関連付け |
| `pwa/src/app/api/institutions/assess/route.ts` | 評価 cell upsert |

## DB

| table | contract |
|---|---|
| `institutions` | 機関 master。`institution_id` PK、name、short_name、type、region、contract_status、sort_order |
| `institution_capability_axes` | ERS 8 軸。`axis_id` PK、axis_no、name、corresponds_xrl、weight、sort_order |
| `institution_capability_criteria` | 各軸の sub criteria。`criterion_id` PK、axis_id、code、name、rubric JSON |
| `institution_assessments` | 評価履歴。`assessment_id` PK、unique `(institution_id, criterion_id, evaluated_at)` |

`institution_assessments.level` は 1..5 または NULL。`na=true` の場合は該当なしとして軸平均から除外する。

## Fetch Contract

`fetchErsBundle()` は以下を parallel fetch する。

- `institutions` order by `sort_order`
- `institution_capability_axes` order by `sort_order`
- `institution_capability_criteria` order by `sort_order`
- `institution_assessments` order by `evaluated_at desc`

assessment は `(institution_id, criterion_id)` ごとに最新 `evaluated_at` の 1 行だけを採用する。

## Institution Cockpit Contract

`/dashboard` の研究機関ERSリストから、NIMS (`inst_nims`) は `/institutions/inst_nims/cockpit` へ遷移する。これは新規PJ作成ではなく、既存関連PJ CX (`p20`) のコックピットを機関文脈で表示する route。

実装 contract:

- `pwa/src/lib/institution-projects.ts` が `inst_nims -> p20` を定義する。
- `/institutions/[institutionId]/cockpit` は `fetchErsBundle()`, `fetchCockpitFromSupabase(projectId)`, `fetchProjectMeetingSummaries(projectId)` を読むだけで、本番DBへ write しない。
- 上部に ERS summary / 関連PJ / 今期MS / MTG件数を表示する。
- ERS summary の直下に常時見る readiness snapshot を置き、ERS充足率、強い軸、確認したい軸、関連PJのMS/月次件数を表示する。
- 基本タブは `進捗管理` / `スコア詳細`。研究機関でも運用構造はPJ cockpitに寄せるが、スコア詳細はSU向けAMD ScoreではなくERS 8軸・評価項目・Lv/根拠メモを表示する。
- `進捗管理` は既存 `CockpitView` を使うため、MS進捗管理、月次モーダル、月次ルーティン、MTGサマリの挙動は通常PJコックピットと同じ。
- `project_meeting_summaries` は月別の MTG tree として `進捗管理` の下部に表示し、各 row は `/project/[projectId]/cockpit?meeting=<meeting_id>` へ遷移する。MTG tree を機関コックピット最上部には置かない。
- まだ機関とPJの正式 scope table はない。外部機関向け tenant/access 設計は `pwa/design/institution_tenant_access.md` の draft を正本にし、現時点では内部向け導線に留める。

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

## Failure Mode

| failure | response |
|---|---|
| unauthenticated | 401 |
| non-admin | 403 |
| missing id | 400 |
| invalid level | 400 |
| Supabase upsert error | 500 |

## Validation

- `/institutions/assess` で cell を更新し、同日同 criterion が 1 row に upsert されること。
- `fetchErsBundle()` が最新評価だけを採用すること。
- rubric の文言は `/bzm/9-4-ers-rubric` と一致させる。
- `/dashboard` の NIMS 研究機関カードから `/institutions/inst_nims/cockpit` へ遷移し、CX `p20` の既存コックピットを表示できること。
- NIMSコックピット上のMTG treeから通常PJコックピットの `?meeting=` detail route へ遷移できること。

## 再構築可能性チェック

この章で ERS の DB、fetch、upsert API、admin gate は再構築できる。まだ不足しているのは seed data / migration の完全手順、ERS 8 軸 rubric の PWA seed と `/bzm` からの同期方法。
