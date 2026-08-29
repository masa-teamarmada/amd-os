# コスト試算タブ 現行仕様

> **この章は何か**: PJコックピット / PJワークスペースの「コスト試算」タブ (2026-08-29 新設) の contract。
> 前提（変数）と費用明細をDBに持ち、前提を1つ動かすとシナリオをクライアントで再計算する。
> **計算結果は保存しない。保存するのは前提と明細だけで、数字は常に導出する。**

## 目的

このタブ単体で次の4つが分かることを要件にしている（まさ 2026-08-23 指摘）。

1. どういう系を想定して、どういう計算をしているか
2. CAPEX と OPEX がそれぞれいくらか
3. いくら以下ならユニットエコノミクスが成立するか
4. どのパラメータの確度が低いせいで精度が落ちているか

Google Sheets が正本のままでは「前提を1つ動かしたときにシナリオがどう動くか」をMTGの場で出せない。これがDBへ移した理由。

## 入口

| 面 | route | 権限 |
|---|---|---|
| PJコックピット | `/project/{projectId}/cockpit?tab=cost-model` | ログイン済みメンバー。編集は admin |
| PJワークスペース | `/project/{projectId}/workspace#cost-model` | 同上。**閲覧専用**（`allowEdit=false`） |

全PJ常設。試算が未登録のPJでは、何を登録する面かを説明する空状態を出す。

## データモデル

migration: `pwa/scripts/migrations/320` `324` `326`（seed は `322` `323` `325` `327` `328` `329`）

| table | 役割 |
|---|---|
| `project_cost_models` | 1試算=1行。**`case_kind` / `case_label` でケース（色素分解 / 重金属回収）を必ず持つ**。`system_scope_md` に想定系、`target_total_cost_per_m3` に成立ライン目標、`unit_basis_label` に単位（m³ 以外も可） |
| `project_cost_assumptions` | 変数辞書。`role_key` を計算エンジンが参照する。`is_key=true` がタブ上で編集可能な主要前提 |
| `project_cost_items` | 費用明細。`price_rule` で変数への連動を表す。`is_breakdown` の行は親の小計に含むので金額を持たない |
| `project_cost_questions` | 誰に何を聞けば確定するか。`impact_low/high` は確定時に総コストが動く幅（円/単位） |
| `project_cost_notes` | 数字ではない文章。`section` で描画位置が決まる（`caveat` / `benchmark` / `reading_guide` / `history`） |

全テーブルに行単位の `visibility`（`amd_internal` / `workspace_shared`）。既定は内部。
RLS は `project_ip_*` と同形（read=`amd_os_is_member()`、write=`is_admin()`、`service_role` 全権）。
外部 `workspace_account` はこのポリシーに一致しない。外部へ見せる面は server component が service_role で読み、`workspace_shared` の行だけを返す設計にする（現時点で外部アカウントは未発行）。

## 計算エンジン

`pwa/src/lib/project-cost-model.ts`（純関数。DBアクセスもReactも持たない）

```
必要吸着菌体量   = 対象物質濃度 × k_ppm ÷ 取り込み効率α
ロス込必要菌体量 = ÷ 菌体回収率η
必要培養液量     = ÷ 運転時菌体濃度
菌体量連動係数   = (ロス込 ÷ 菌体使用回数) ÷ 基準値(1111.111111)
培養液量連動係数 = (必要培養液量 ÷ 菌体使用回数) ÷ 基準値(222.222222)
```

`price_rule` による実効単価:

| price_rule | 実効単価 |
|---|---|
| `null` | `unit_price` をそのまま |
| `biomass` / `broth` | `unit_price` × 各連動係数 |
| `module_swap` | モジュール単価 ÷ 耐用バッチ数 ÷ バッチ容量 |
| `power_circulation` / `power_injection` | 動力kW × HRT × 電力単価 ÷ バッチ容量 |

`basis` による年間発生額: `初期投資配賦`=数量×単価×年換算÷耐用年数 / `毎m³比例`=数量×実効単価×年換算×年間処理量 / `バッチ連動`=数量×単価×年換算 / `内訳`=0。

シナリオは 方式(循環/投入) × 槽(既設/新設) の4本。中央培養CAPEXは `supply_sites` で除算。
人件費（`cost_type='参考'`）は総コストに算入せず、参考値と「人件費を戻した利益」を併記する。

## API

`/api/project-cost-model`（`runtime = "nodejs"`）

- `GET ?projectId=` → `{ ok, canEdit, bundle }`。`Cache-Control: private, max-age=60, stale-while-revalidate=300`
- `PATCH` → `{ entity: "assumption"|"item"|"question"|"note", id, patch }`。admin のみ。entity ごとに書き込み可能な列をホワイトリストで制限
- `loadCostModelBundle(projectId)` を export しており、server component からも service_role で読める

**参照系なので画面から素の fetch をしない。** 読み書きとも `pwa/src/lib/project-cost-model-client.ts` を通す。
`scripts/check_reference_data_cache_contract.mjs` の `REFERENCE_DATA_ENDPOINTS` に登録済みで、違反すると `deploy.sh` が本番反映前に落とす。詳細は `5-10-reference-data-caching-current-spec.md`。

## UI 構成（描画順）

1. ケース・版・原典リンク
2. 想定している系（`system_scope_md`）
3. 注意して読むところ（notes `caveat`）
4. 成立ライン — 総コストの許容上限 / 総コスト目標 / 菌体製造原価の含意、シナリオ別の超過・余裕
5. 外部ベンチマークと出典（notes `benchmark`）
6. 事業成立サマリー — 現場設備 / 中央培養拠点 / 事業全体の3段。円/単位と円/年を併記
7. この表の読み方（notes `reading_guide`）
8. この数字の確からしさ — 確度別の帯グラフと構成比、精度を下げている項目の金額順
9. 主要前提（`is_key`。admin は入力欄で即再計算）/ すべての前提
10. 確認事項（相手別・インパクト順）
11. 版の履歴と、この試算が答えていないこと（notes `history`）
12. 費用明細

**費用明細と前提は既定で展開する**（畳まない。まさ 2026-08-23）。
注記の本文は軽量レンダラ `MiniMarkdown` で描く。箇条書き・番号付きリスト・markdown表・`**強調**` に対応。markdown ライブラリは足さない。

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `pwa/src/lib/project-cost-model.ts` | 型と計算エンジン（純関数） |
| `pwa/src/lib/project-cost-model-client.ts` | 参照系キャッシュ経由の読み書き |
| `pwa/src/app/api/project-cost-model/route.ts` | GET / PATCH / `loadCostModelBundle` |
| `pwa/src/components/cockpit/CockpitCostModel.tsx` | タブ本体（2面で共有） |
| `pwa/src/components/cockpit/CockpitView.tsx` | `CockpitTab` に `cost-model` を追加、hover 先読み |
| `pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx` | `SxWeeklyControlView` に `cost` を追加 |
| `pwa/scripts/gen_sx_cost_seed.py` | 原典スプレッドシートから seed SQL を生成 |

## 検証

SX (p21) の 260820版で、原典スプレッドシートと一致することを確認済み（2026-08-29）。

| 指標 | A:循環/既設 | A:循環/新設 | B:投入/既設 | B:投入/新設 |
|---|---|---|---|---|
| 事業全体 総コスト (円/m³) | 582.4 | 642.4 | 349.7 | 409.7 |
| 初期投資 (円) | 21,700,000 | 39,700,000 | 25,650,000 | 43,650,000 |

現場OPEX 400.6 / 123.7、CAPEX年額 2,170,000 / 3,498,333、中央培養 109.4、人件費参考 230.0 / 300.0 も一致。
本番画面でも Chrome から実見して確認済み（確度タグ149個の折返し0件、ページ横はみ出し0px）。
