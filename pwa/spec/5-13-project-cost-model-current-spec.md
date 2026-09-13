# コスト試算タブ 現行仕様

> **この章は何か**: PJコックピット / PJワークスペースの「コスト試算」タブ (2026-08-29 新設、2026-09-13 二段階化) の contract。
> 前提（変数）と費用明細をDBに持ち、前提を1つ動かすとシナリオをクライアントで再計算する。
> **計算結果は保存しない。保存するのは前提と明細だけで、数字は常に導出する。**

## 目的

このタブ単体で次の4つが分かることを要件にしている（まさ 2026-08-23 指摘）。

1. どういう系を想定して、どういう計算をしているか
2. CAPEX と OPEX がそれぞれいくらか
3. いくら以下ならユニットエコノミクスが成立するか
4. どのパラメータの確度が低いせいで精度が落ちているか

Google Sheets が正本のままでは「前提を1つ動かしたときにシナリオがどう動くか」をMTGの場で出せない。これがDBへ移した理由。

## 二段階の計算（2026-09-13 まさ確定）

**菌体の製造原価は株で決まり、用途では変わらない。用途で変わるのは使い回せる回数と、そこから決まる必要菌体量。**
旧版はこの区別がなく、中央培養の設備償却を「排水1m³あたりの固定額」で置いていた。そのため菌体使用回数を変えると、菌体1kgあたりに割り戻した原価が見かけ上 98円 → 約440円 → 約1,200円と動いた。二段階はこれを直すための形。

| 段 | 何を出すか | 何で変わるか |
|---|---|---|
| 第1段 菌体の製造原価 | 株（強化株 / 自然株）ごとの乾燥菌体1kgあたりの原価（円/kg-DCW）。CAPEX・年額固定費・菌体量比例費を含む | 株。強化株は閉鎖系の追加費用が乗る |
| 第2段 用途別の処理原価 | 第1段の原価を一定として、用途（色素分解 / 金属回収）ごとの1単位あたり総コスト | 用途（濃度・取り込み効率・菌体使用回数・後処理）と、株（取り込み効率・現場の閉鎖系費用） |

株は画面上部のスイッチで選ぶ。**選択は保存しない**（見るための切り替え）。用途は第2段で横に並べ、下の詳細（成立ライン・サマリー・確からしさ・物量）は用途のタブで切り替える。

## 入口

| 面 | route | 権限 |
|---|---|---|
| PJコックピット | `/project/{projectId}/cockpit?tab=cost-model` | ログイン済みメンバー。編集は admin |
| PJワークスペース | `/project/{projectId}/workspace#cost-model` | 同上。**閲覧専用**（`allowEdit=false`） |

全PJ常設。試算が未登録のPJでは、何を登録する面かを説明する空状態を出す。

## データモデル

migration: `pwa/scripts/migrations/320` `324` `326` `392`（seed は `322` `323` `325` `327` `328` `329` `393`）

| table | 役割 |
|---|---|
| `project_cost_models` | 1試算=1行。**`case_kind` / `case_label` でケースを必ず持つ**（`dye_degradation` / `metal_recovery` / `multi` / `other`）。`system_scope_md` に想定系、`target_total_cost_per_m3` に成立ライン目標、`unit_basis_label` に単位（m³ 以外も可） |
| `project_cost_assumptions` | 変数辞書。`role_key` を計算エンジンが参照する。`is_key=true` がタブ上で編集可能な主要前提。**`strain` / `application` で効く株・用途を持つ**（null は共通） |
| `project_cost_items` | 費用明細。`price_rule` で変数への連動を表す。`is_breakdown` の行は親の小計に含むので金額を持たない。**`strain` / `application` で発生する株・用途を持つ**（null は共通） |
| `project_cost_questions` | 誰に何を聞けば確定するか。`impact_low/high` は確定時に総コストが動く幅（円/単位） |
| `project_cost_notes` | 数字ではない文章。`section` で描画位置が決まる（`caveat` / `benchmark` / `reading_guide` / `history`） |

- `strain` は `enhanced`（強化株）/ `wild`（自然株）、`application` は `dye`（色素分解）/ `metal`（金属回収）。
- 同じ `role_key` を株・用途ごとに持てるよう、一意制約は `(cost_model_id, role_key, coalesce(strain,''), coalesce(application,''))`（migration 392）。
- 同じ `role_key` が複数あるときは **株と用途の両方が一致 > 株だけ一致 > 用途だけ一致 > 共通** の順に採る（`resolveAssumption`）。

全テーブルに行単位の `visibility`（`amd_internal` / `workspace_shared`）。既定は内部。
RLS は `project_ip_*` と同形（read=`amd_os_is_member()`、write=`is_admin()`、`service_role` 全権）。
外部 `workspace_account` はこのポリシーに一致しない。外部へ見せる面は server component が service_role で読み、`workspace_shared` の行だけを返す設計にする（現時点で外部アカウントは未発行）。

## 計算エンジン

`pwa/src/lib/project-cost-model.ts`（純関数。DBアクセスもReactも持たない）

### 第1段 菌体の製造原価（`computeBiomassCost`）

中央培養（`scenario='中央培養'`）で、選んだ株に効く行だけを使う。

```
培養設備の償却 (円/kg)   = Σ(初期投資 ÷ 耐用年数) ÷ 年間生産能力
年ごとの固定費 (円/kg)   = Σ年額固定 ÷ 年間生産能力
菌体量に比例する費用     = Σ毎kg菌体比例の単価
菌体の製造原価 (円/kg)   = 上の3つの合計
                          （biomass_cost_per_kg_override に正の値があればそれで置き換える）
```

年間生産能力は `culture_capacity_kg_year`。**その量を作って使い切る前提**なので、実際の供給量が能力を下回ると実際の1kgあたり原価は上がる。
画面の第1段には、償却の行に「初期投資 ÷ 耐用年数 ÷ 年間生産能力」を数字つきで出す。

### 第2段 用途別の処理原価（`computeCostModel`）

用途ごと、方式（循環 / 投入）× 槽（既設 / 新設）の4シナリオ。

```
必要吸着菌体量       = 対象物質濃度 × k_ppm ÷ 取り込み効率α
ロス込必要菌体量     = ÷ 菌体回収率η
使い切る菌体量 (kg)  = ロス込 ÷ 菌体使用回数 ÷ 1000
菌体費 (円/単位)     = 第1段の原価 × 使い切る菌体量
総コスト             = 菌体費 + 現場の明細（方式・共通、選んだ株と用途に効く行）+ 新設槽
```

`basis` による年間発生額:

| basis | 年間発生額 |
|---|---|
| `初期投資配賦` | 数量 × 単価 × 年換算 ÷ 耐用年数 |
| `毎m³比例` | 数量 × 実効単価 × 年換算 × 年間処理量 |
| `バッチ連動` | 数量 × 単価 × 年換算 |
| `毎kg菌体比例` | 数量 × 実効単価 × 年換算 × 使い切る菌体量 × 年間処理量（中央培養の行は第1段で1kgあたりへ畳む） |
| `年額固定` | 数量 × 単価 × 年換算 |
| `内訳` | 0 |

`price_rule` による実効単価・年額:

| price_rule | 計算 |
|---|---|
| `null` | `unit_price` をそのまま |
| `module_swap` | モジュール単価 ÷ 耐用バッチ数 ÷ バッチ容量 |
| `power_circulation` / `power_injection` | 動力kW × HRT × 電力単価 ÷ バッチ容量 |
| `labor_batch` | 年額 = 1バッチの作業時間（`batch_hours_circulation` / `batch_hours_injection`）× 人件費単価 × 年間バッチ数 |
| `patrol` | 年額 = 訪問回数 ×（(移動＋作業時間) × 人件費単価 ＋ 車両費）。訪問回数 = 年間バッチ数 ÷ max(菌体使用回数, 1回の搬入でまかなうバッチ数) |
| `patrol_module` / `patrol_membrane` | 年額 = 交換回数 × 作業時間 × 人件費単価。交換回数はモジュール耐用バッチ数・膜交換年数から |
| `spent_disposal` | 円/kg-DCW = 脱水後の湿重量倍率 × 汚泥の処分単価（`毎kg菌体比例` と組む） |
| `biomass` / `broth` | 旧形式。`unit_price` × 旧基準値との比。二段階版の SX 明細では使わない |

- **人件費は総コストに含める**（`cost_type='OPEX'` + `labor_batch`）。画面には「人件費を除くと」の値も併記する。旧形式の `cost_type='参考'` 行があるときだけ、従来の「参考：人件費（総コストに不算入）」段を出す。
- `strainSpecificPerUnit` は株固有の行（閉鎖系の追加など）の合計で、現場分と第1段から配った分を足す。
- `postProcessPerUnit` は `group_label` が `シアノ回収後処理` / `使用済み菌体の処分` の行。
- 確度の帯グラフは、第1段の各行を「1kgあたりの額 × 使い切る菌体量」で配って数える。上書き値のときは上書きの前提の確度で1本にする。
- 株・用途を持たない試算（`strains=[]`, `applications=[]`）は、用途なし1系列・4シナリオとして従来どおり計算する。

## API

`/api/project-cost-model`（`runtime = "nodejs"`）

- `GET ?projectId=` → `{ ok, canEdit, bundle }`。`Cache-Control: private, max-age=60, stale-while-revalidate=300`。前提と明細は `strain` / `application` を含めて返す
- `PATCH` → `{ entity: "assumption"|"item"|"question"|"note", id, patch }`。admin のみ。entity ごとに書き込み可能な列をホワイトリストで制限。前提の `value` は `null` で空欄へ戻せる（上書き値を外すとき）
- `loadCostModelBundle(projectId)` を export しており、server component からも service_role で読める

**参照系なので画面から素の fetch をしない。** 読み書きとも `pwa/src/lib/project-cost-model-client.ts` を通す。
`scripts/check_reference_data_cache_contract.mjs` の `REFERENCE_DATA_ENDPOINTS` に登録済みで、違反すると `deploy.sh` が本番反映前に落とす。詳細は `5-10-reference-data-caching-current-spec.md`。

## UI 構成（描画順）

1. ケース・版・原典リンク、**株のスイッチ**（株を持つ試算だけ）、概要
2. 想定している系（`system_scope_md`）
3. 注意して読むところ（notes `caveat`）
4. **第1段 菌体の製造原価** — 株ごとのカード（押すと株が切り替わる）、選んだ株の内訳（償却・年額固定・比例費と、それぞれの割り算）、上書き値
5. **第2段 用途別の処理原価** — 行=方式×槽、列=用途。総コストと「人件費を除くと」。下に、方式・槽によらず同じ量（使い切る菌体量・菌体費・後処理）
6. **ここから下の詳細を見る用途**のタブ（用途が2つ以上のとき）
7. 成立ライン — 総コストの許容上限 / 総コスト目標 / 第1段の原価、シナリオ別の超過・余裕と「人件費を除くと」
8. 外部ベンチマークと出典（notes `benchmark`）
9. 事業成立サマリー — 菌体 / 現場設備 / 総コストに含む主な内訳（人件費・巡回・閉鎖系の追加・後処理）/ 事業全体 / 人件費を除くと。円/単位と円/年を併記
10. この表の読み方（notes `reading_guide`）
11. この数字の確からしさ — 確度別の帯グラフと構成比、精度を下げている項目の金額順
12. 主要前提（`is_key`。**表示中の株と用途に効く行だけ**。admin は入力欄で即再計算）/ 前提から導かれる物量
13. すべての前提（株・用途の印つき。表示中の選択で効かない行は薄く出す）
14. 確認事項（相手別・インパクト順）
15. 版の履歴と、この試算が答えていないこと（notes `history`）
16. 費用明細（株・用途の印つき。中央培養は右端を円/kg-DCWで出す。表示中の選択で発生しない行は薄く出し金額を空欄にする）

**費用明細と前提は既定で展開する**（畳まない。まさ 2026-08-23）。
スマホ幅では第1段・第2段の表を画面幅に収め、数字列が横スクロールの外へ隠れないようにする（ページ自体は横にはみ出さない）。
注記の本文は軽量レンダラ `MiniMarkdown` で描く。箇条書き・番号付きリスト・markdown表・`**強調**` に対応。markdown ライブラリは足さない。

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `pwa/src/lib/project-cost-model.ts` | 型と計算エンジン（純関数）。第1段 `computeBiomassCost`、第2段 `computeCostModel` |
| `pwa/src/lib/project-cost-model-client.ts` | 参照系キャッシュ経由の読み書き |
| `pwa/src/app/api/project-cost-model/route.ts` | GET / PATCH / `loadCostModelBundle` |
| `pwa/src/components/cockpit/CockpitCostModel.tsx` | タブ本体（2面で共有） |
| `pwa/src/components/cockpit/CockpitView.tsx` | `CockpitTab` に `cost-model` を追加、hover 先読み |
| `pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx` | `SxWeeklyControlView` に `cost` を追加 |
| `pwa/scripts/check_project_cost_model.mts` | 計算エンジンの契約チェック（`npm run test:project-cost-model`、`deploy.sh` が本番反映前に実行） |
| `pwa/scripts/__fixtures__/sx_cost_model_two_stage.json` | migration 393 適用後の SX データ（契約チェックの入力） |
| `pwa/scripts/gen_sx_cost_seed.py` | 260820版の原典スプレッドシートから seed SQL を生成（履歴。二段階版の 393 は現行データを変換して書き出した） |

## 検証

### 260820版（2026-08-29）

SX (p21) の 260820版で、原典スプレッドシートと一致することを確認済み。

| 指標 | A:循環/既設 | A:循環/新設 | B:投入/既設 | B:投入/新設 |
|---|---|---|---|---|
| 事業全体 総コスト (円/m³) | 582.4 | 642.4 | 349.7 | 409.7 |
| 初期投資 (円) | 21,700,000 | 39,700,000 | 25,650,000 | 43,650,000 |

### 260913 二段階版（2026-09-13）

`check_project_cost_model.mts` が次を機械で止める。

1. **旧版の再現** — 自然株・金属回収で、取り込み効率を0.05に戻し、人件費と巡回の行を外し、搬送費2行を旧単価へ戻すと、4シナリオが上の 582.4 / 642.4 / 349.7 / 409.7 に一致する
2. **製造原価は用途で変わらない** — 全シナリオで「菌体費 ÷ 使い切る菌体量 ＝ 第1段の原価」
3. **自然株に強化株の行が乗らない** — 自然株の株固有額が0。強化株の原価 > 自然株
4. **菌体使用回数を2倍にすると菌体費がちょうど半分**（旧版の頭打ちを戻さない）
5. **用途の行が混ざらない** — 金属回収専用の行を消しても色素分解の総コストは変わらない
6. **人件費・巡回が総コストに入り、「人件費を除くと」と整合する**
7. **下の表と一致する**
8. **株・用途を持たない試算でも落ちない**
9. **画面が株のスイッチと第1段・第2段を持つ**（静的確認）

| 株 | 菌体の製造原価 | 色素分解 B:投入/既設 | 金属回収 B:投入/既設 |
|---|---|---|---|
| 強化株 | 127.1 円/kg（償却 40.8 ＝ 953万円 ÷ 7年 ÷ 33,333kg、年額固定 24.0、比例 62.3） | 878.0（人件費を除くと 578.0） | 715.0（415.0） |
| 自然株 | 98.5 円/kg（償却 31.0 ＝ 723万円 ÷ 7年 ÷ 33,333kg、年額固定 7.2、比例 60.3） | 826.5（526.5） | 708.1（408.1） |

旧版 B:投入/既設 349.7 から自然株・金属回収 708.1 への差は、搬送費を巡回へ統合 −9.0、金属の取り込み効率 0.05→0.042 +33.0、巡回サービス +34.4、人件費 +300.0。
画面は手元の確認用ページ（コミットしない）で 1440px と 375px を実見し、株と用途のスイッチで第2段・成立ライン・サマリーが切り替わること、375px でページ横はみ出し 0px を確認した。
