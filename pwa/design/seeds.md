# Seeds — 研究シーズリスト

> **AMD の Before 0 起点となる外部技術シーズマスタ**。VC List の研究機関版。
> AMD のコア能力 3 本柱の一つ「大学連携ネットワーク」を OS 上に可視化する。

---

## 動機

- AMD は Before 0 (技術はあるがビジネスを知らない研究者を起業家に変える) フェーズに特化している ([amd_value_model.md](/Users/masa/projects/knowledge/amd_value_model.md))
- そのため「全国の大学・国研・高専のどこに、事業化できそうなシーズがあるか」を網羅・優先順位付けする一次情報マスタが必要
- これまでは個人の頭の中・Slack の断片・スプシで分散していた
- AMD OS ビジョン ([amd_os_vision.md](/Users/masa/projects/knowledge/amd_os_vision.md)) では将来 URA/EIR が当事者として参画する基盤になる予定。Phase 1 は AMD 内部、Phase 2/3 で URA に開放

## 流れ (status 遷移)

```
candidate(候補) → investigating(調査中) → contacted(接触済) → discussing(協議中) → spun_off(PJ化) / declined(見送り)
```

シーズリストから具体的な協議が始まり、一部が AMD の PJ になっていく。`spun_off_project_id` で `projects` に紐付け。

## 設計判断 (確定)

| 論点 | 確定方針 | 理由 |
|---|---|---|
| 主な使い手 | **Phase 1 = AMD 内部**、Phase 2 で URA 公開、Phase 3 で対外ショーケース | 段階拡張。`is_public` 列で将来の公開切替が可能 |
| シーズの単位 | **案件単位 (技術 × 応用先)** | "シアノバクテリア排水処理" のように、PI が複数案件を持てる。`researcher_name` は一意キーではなく、同じPI名の複数行を統合・重複除外しない |
| データ構造 | **単一テーブル `seeds`** に機関・PI・シーズを 1 行で保持 | UI 上ひとつのリストで「機関で検索」「PI で検索」「シーズで検索」が完結。表記ゆれ正規化は将来課題 |
| サブデータ | **別テーブルに分割** (`seed_funding` / `seed_news` / `seed_contact_log`) | 検索性・cron ingest しやすさ。UI は 1 リストで完結する原則は満たす |
| 旧 `seeds` テーブル (006_venture_map.sql で作られた予兆 4 件用) | **drop して再構築** | 既存 4 行の中身は実態と合っていなかった (工学院大エコシステム = エコシステム業務、CX/SX = 既に PJ 化済)。Venture Map の予兆プロット (黄色点滅) も意味不明だったので削除 |
| 収集方法 | **Phase 1: 手動 + つくよみ chat 経由** → Phase 2: 公的採択 DB ingest (NEDO/AMED/JST GAP/A-STEP) → Phase 3: researchmap / OpenAlex 発掘 cron | 段階拡張。最初から全部やると母集団がぼけて使われない |

## スキーマ

migration: [024_seeds_overhaul.sql](../scripts/migrations/024_seeds_overhaul.sql)

| テーブル | 役割 |
|---|---|
| `seeds` | シーズ本体 (機関 + PI + シーズ情報を 1 行) |
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等) |
| `seed_news` | 関連ニュース・論文・プレス (Atlas とは別系統) |
| `seed_contact_log` | AMD メンバー × シーズ の接触履歴 |

### `seeds` の主要列

```
識別:           title, summary
機関:           org_name, org_type, org_region, org_url
研究者:         researcher_name, researcher_title, lab_name, researcher_url
分類:           domain_lane (gx_energy/gx_circular/life/materials/robo/ict/other),
                industry_target[], keywords[]
成熟度:         trl, brl, hrl (0-9)
AMD 視点:       status, amd_rating (1-5), amd_owner_member_id, next_action,
                internal_notes (非公開), public_summary, is_public
関連:           spun_off_project_id (FK projects), source, source_detail,
                deep_dive_material_url (AMD内の深掘り資料)
```

### `discovery_status` 列 (033 migration)

`reviewed` (デフォルト、人が確認済) / `discovered` (cron が新規発見、未確認) / `dismissed` (ノイズ扱い)。
受信箱 `/seeds/inbox` は `discovered` のみを表示し、verify で `reviewed`、dismiss で `dismissed` に更新。

### RLS

`016_vc_list.sql` / `017_vc_rls_writes.sql` と同じパターン (4 テーブル全部):
- `anon_read` (SELECT 全開)
- `authenticated_all` (auth.uid() IS NOT NULL なら ALL)
- `service_role_bypass` (cron route 用)

## ルーティング

| パス | 役割 |
|---|---|
| `/seeds` | リスト画面 (検索 / フィルタ / ソート / 行クリックで `SeedDetailModal`)。深掘り資料のmdはOS内Markdownモーダル (左メニューなし) で開く。新規発見シーズは行頭に 🆕 マーク、右上に「受信箱」リンク + バッジ |
| `/seeds/[id]` | 単独詳細ページ。直接 URL アクセス用フォールバック (リスト画面で開く Modal を full-page で表示) |
| `/seeds/inbox` | 受信箱 (cron 自動収集分の未確認シーズ)。verify=採用 / dismiss=非表示 |
| `/api/cron/seeds-ingest` | 旧: 毎週 月曜 09:00 JST に Claude Sonnet + web_search で 7 ソース (GAP/NEP/AMED/D-Global/CREST/創発/先導研究) を巡回 → discovery_status='discovered' で投入。2026-05-22 以降は LLM/web_search 課金回避で自動 schedule 停止 |

GlobalNav に **Seeds** を Venture Map と VC の間に追加 ([GlobalNav.tsx](../src/components/nav/GlobalNav.tsx))。

## UI

### `/seeds` リスト

- **テーブル列**: シーズ / 機関 / PI / 領域 / 成熟度 (TRL/BRL/HRL) / 状態 / ★ / 担当 / 助成計 / 深掘り資料 / 次の一手 / 最終接触
- **フィルタ**: status (デフォルト: アクティブ = PJ化/見送り を除外) / 領域 / 担当 / フリーテキスト (シーズ・機関・PI・キーワード)
- **ソート**: 列クリックで切替 (デフォルト: 更新日 desc)
- **新規作成**: 右上「+ 新規シーズ」ボタン → `SeedDetailModal` を createMode で開く
- **深掘り資料**: `deep_dive_material_url` には、AMDが確認済みの共有資料リンクだけを置く。資料本文、一次ソース本文、一次ソースの生URLは置かない。md はOS内Markdownモーダル (左メニューなし) で表示し、ヘッダーの補助リンクからDriveを開ける。

### `SeedDetailModal` (詳細 + 編集 + 削除)

- リスト行クリックで開くオーバーレイ
- **詳細モード**: 4 セクション (シーズ概要 / 機関・研究者 / AMD 評価 / 関連・ソース) + サブセクション 3 つ (補助金 / 接触履歴 / ニュース)
- **編集モード**: 編集ボタンで全フィールド inline form に切替。保存 / キャンセル
- **サブセクション CRUD**: 補助金・接触履歴・ニュースは「+ 追加」ボタン → 軽量 form。削除は ✕ ボタン

## 実装メモ

### Phase 1 で実装済 (2026-05-08)

- migration 024 (旧 seeds drop + 新 schema 4 テーブル)
- Venture Map から旧 seeds 依存を全削除
  - `fetchSeedsForMap` 削除、`SeedRow` 型削除
  - `fetchSnapshot()` 引数から seeds 削除
  - `LaneSnapshot` の seeds 列削除、グラフ予兆プロット削除
  - View B テーブルの「シーズ在庫」列削除
  - `compositeScore` の重みを `0.4 macro + 0.2 papers + 0.2 policy + 0.1 invest + 0.1 seeds` から `0.4 + 0.2 + 0.2 + 0.2` に再正規化 (seeds 0.1 を invest に振替)
- types/seeds.ts + lib/seeds-data.ts
- /seeds リスト画面 + SeedDetailModal + /seeds/[id] フォールバックページ
- GlobalNav に Seeds 追加

### Phase 2 (一部実装済 / 残り TODO)

- ✅ **`/seeds/inbox`**: 自動収集された未確認シーズの受信箱 (vcs/inbox 同型)
- ✅ **`cron/seeds-ingest` route**: web_search 自動発見の実装はあるが、2026-05-22 以降は自動 schedule 停止 (下記参照)
- ✅ **GlobalNav バッジ**: Seeds に sky 色の未確認件数バッジ
- ⬜ **既存 PJ から逆引き seed 化**: `project_ventures.origin_org` / `origin_pi` を参照して、既存 9 PJ の起源を seeds に登録 (status='spun_off')
- ⬜ **HSFC 残り 23 件 / さきがけ 175件** の収集

### Phase 3 (TODO)

- **researchmap / OpenAlex 発掘 cron**: 機関 × 領域別に Claude + web_search で「注目シーズ候補」を生成 → inbox
- **つくよみ chat tool 群**: `upsert_seed` `update_seed_status` `add_seed_funding` `add_seed_contact` 等
- **URA/EIR 公開**: `is_public=true` のシーズだけを別認証で公開閲覧可能にする
- **機関別ダッシュボード**: `/research-orgs/[org_name]` で機関単位の seeds 一覧 (現状は `/seeds?org=...` フィルタで代替)

## SPS (Seed Prospect Score) — 全国全シーズ共通の評価 (2026-07-20)

SPS はシーズ有望度スコア。KUTE / p25 に限らず **全国のすべての `seeds` 行に適用される**。`spun_off_project_id` の有無や PJ status とは独立で、まだどの PJ にも紐づいていない `candidate` 段階のシーズにも同じ式・同じテーブルで評価をつけられる。

- migration: [186_kute_seeds_commercialization_score.sql](../scripts/migrations/186_kute_seeds_commercialization_score.sql) (historical — 下記参照) → [187_seed_sps_assessments.sql](../scripts/migrations/187_seed_sps_assessments.sql) → [188_seed_sps_kute_backfill.sql](../scripts/migrations/188_seed_sps_kute_backfill.sql)
- **migration 186 (historical)**: KUTE 専用の 0-100点ルーブリック (`kute_score_future_need/market/technical_advantage/ip_barrier` 各15 + `kute_score_current_trl/brl/hrl` 各10 + `kute_score_support` 10) を導入したが、全レコード null のまま一度も使われなかった。187 でこの 8 列は安全確認 (非 null が 1 件でもあれば `RAISE EXCEPTION` して停止) の上で `DROP COLUMN` 済み。**現行の current truth ではこの 100 点ルーブリックは存在しない**。
- **migration 187**: `seed_sps_assessments` を新設し、186 の未使用 `kute_score_*` 8列を撤去、KUTE 公開向けテキスト7列 (`kute_envisioned_use_case` 等) を値を保持したまま全国共通の一般名 (`envisioned_use_case` 等) へリネームして KUTE 以外のシーズにも使えるようにした。
- **migration 188**: 工学院大学 (KUTE) の現行6シーズについて、2026-07-20 時点の provisional 評価を `seed_sps_assessments` へ投入 (title 完全一致で対象特定、6件ちょうど存在することを assert)。
- **`seed_sps_assessments`** ([定義](../scripts/migrations/187_seed_sps_assessments.sql)) が SPS の **全国共通・時系列の入力ストア**:
  - `(seed_id, evaluated_at)` unique。同一シーズでも評価日が変われば新しい時系列点として別行になる
  - 生の評価軸のみを持つ (M: `mu_a`/`mu_i`/`mu_g`、P: `potential`、R: `trl`/`brl`/`grl`/`srl`/`hrl`、S: `f_character`/`f_cap`/`r_net` + 計算結果スナップショット `frl`)。各軸は 0-9 の整数か `NULL`
  - **`0` (観測済みのゼロ) と `NULL` (未評価) は明確に区別する**。例: 経営/事業化チーム未形成という組織的事実は `hrl=0` として明示投入し (個人資質の推測ではない)、根拠がまだ無い軸は `NULL` のまま計算に含めない
  - `shallow_tech_mode=true` のときだけ `trl` の `NULL` を許容 (それ以外の `NULL` は欠損=未評価として扱う)
  - `axis_evidence` (軸ごとの評価根拠 JSON) と `evaluator` (評価者) は **内部専用列**。公開面・KUTE 比較テーブルには一切返さない (RLS も `authenticated` / `service_role` のみ、anon 直接 select 不可)
- **計算式は完全共有**: [`pwa/src/lib/seed-sps.ts`](../src/lib/seed-sps.ts) の `calculateSeedSpsScore()` が [`amd-score.ts`](../src/lib/amd-score.ts) の `calculatePrsScore` / `PRS_ALPHA_DEFAULT` をそのまま呼ぶ。**別式・別重みは作らない** — SPS は AMD Score 側の PRS (M × P × R × S) と同じ計算コアの表示名違いであり、KUTE 専用スコアは存在しない。必要な軸が1つでも欠けていれば計算せず `missingAxes` を返す (部分合計・部分点を総合点として出さない)
- **KUTE (p25) は「フィルタして表示するだけ」**: project_id (`p25`) → `seeds.institution_id` (`inst_kute`) のスコープ対応は `researchInstitutionIdForProject()` (実体: [`kute-seeds-scoring.ts`](../src/lib/kute-seeds-scoring.ts)、`seeds-data.ts` が re-export) の一箇所だけに定義する。KUTE 側は独自スコアを持たず、`seed_sps_assessments` から対象シーズの **最新 (evaluated_at DESC 1件)** SPS を読むだけ。同じ境界に `p30` → `inst_ehime` (愛媛大学 EHM) も追加済み (2026-07-31)。今後の研究機関コックピットも同じ境界とスコアを再利用する
- **事業化フィールド** (`seeds` テーブル、187 でリネーム、すべて nullable / CHECK 制約つき、根拠のない値は null のまま = 捏造禁止):
  - 事業化タイプ: `primary_commercialization_type` (単一) + `secondary_commercialization_types[]` (複数可)。enum は `large_startup` / `small_business_1b_yen` / `license` / `jv_ma` / `joint_research_poc`
  - 公開向けテキスト (旧 `kute_*` から全国共通名へ改名、値は保持): `envisioned_use_case` / `first_customer_candidate` / `market_size_range` / `market_size_confidence` (low/medium/high) / `biggest_bottleneck` / `ip_status` / `next_verification_step`
- **プライバシー境界**: `internal_notes` / `source_detail` 等の社内限定フィールド、および `seed_sps_assessments.axis_evidence` / `evaluator` は公開面の select に含めない。ホワイトリスト型 `SeedPublicView` + 定数 `SEED_PUBLIC_VIEW_COLUMNS` ([`types/seeds.ts`](../src/types/seeds.ts)) を select の唯一の呼び出し元にする。既存の `SeedDetailModal` (編集用、confidential 項目を含む) は再利用せず、新規の読み取り専用 `KuteSeedDetailModal` ([`components/seeds/KuteSeedDetailModal.tsx`](../src/components/seeds/KuteSeedDetailModal.tsx)) を使う
- **UI**: PJ cockpit (`/project/p25/cockpit`) と同じ `CockpitView` を使う研究機関 cockpit (`/institutions/inst_kute/cockpit`) の進捗タブで、年度内ロードマップ (`CockpitKuteAnnualRoadmap`) の直後に **比較優先のテーブル** (`CockpitKuteSeeds.tsx`) を表示する。カード形式ではなく横スクロール可能な `<table>` で、`SPS` / `M` / `P` / `R` / `S` を個別列、`TRL` / `BRL` / `GRL` / `SRL` / `HRL` を個別列として並べ、事業化フィールド (想定用途・最初の顧客候補・市場規模レンジと確度・最大のボトルネック・知財状況・事業化タイプ・次の検証ステップ) と資料有無を同じ行で横並び比較できる。列ソート可。**シーズ名・研究者名・事業化タイプ・全長文セルは省略記号にせず、セル内で全文を折り返す**。DB上のシーズ行は案件 (技術 × 用途) 単位のままだが、比較テーブルの表示は同一機関かつ同じ研究者の複数シーズを、研究者名1回のグループヘッダー行の下にまとめる (2026-07-21 追加、`groupSeedsByResearcher()` / `sortSeedGroups()` / `countDistinctResearchers()`、いずれも `pwa/src/lib/kute-seeds-scoring.ts`)。研究者名と機関名は NFKC 正規化・連続空白の単一化・前後空白除去を行う。`researcher_name` が null の行は他の未登録行と混ぜず、シーズ単位でそれぞれ独立したグループにする。列ソートはグループ内の各行をソートした上でグループ自体も代表値でソートするため、どの列でソートしてもグループの連続性は保たれる。特定の研究者名 (例: 高橋義典) をロジックにハードコードすることはなく、任意の研究者に同じ挙動が適用される。集計行にはシーズ件数に加え、重複除外した研究者数も表示する。`discovery_status='discovered'` は「公開情報候補」と表示し、大学・研究者確認前であることを明示する。SPS が計算できないシーズ (`missingAxes` あり、評価行なしを含む) は「未評価」表示とし、部分点を出さない。長文と計算済みの SPS / M / P / R / S / XRL 内訳は `KuteSeedDetailModal` で確認できるが、`axis_evidence` / `evaluator` は内部専用なのでモーダルにも出さない。深掘り資料は既存の `SeedMarkdownPreviewModal` を再利用し、無ければ「資料なし」
- **KUTE公開情報の上位3件**: migration [`189_kute_public_seed_candidates.sql`](../scripts/migrations/189_kute_public_seed_candidates.sql) で「165〜220nm次世代クリーンUV面光源」「金属フリー透明フレキシブル導電膜」「塩水・交流電気分解による都市鉱山金回収」を `discovery_status='discovered'` で追加する。公開情報調査の旧100点スクリーニング値はSPS/XRLへ移植せず、`seed_sps_assessments` は未登録のままにする
- **`/seeds` (全機関横断比較, 2026-07-31)**: `/seeds` は旧・単一テーブルの管理画面 (検索/フィルタ/新規作成/受信箱) から、`CockpitKuteSeeds` を `scope="all"` で全機関横断表示する読み取り専用の比較画面に置き換えた。機関コックピット (`scope="project"` 相当、`projectId` 指定) と同じ研究者グループ化テーブルを、機関グループヘッダー行の下にネストして並べる (`groupSeedsByInstitution()` / `countDistinctInstitutions()`)。データ取得は `fetchAllResearchInstitutionSeeds()` (org_name/institution_id で絞らず全件、ホワイトリスト select は共通) を使い、PJ化/見送りを除外する既存のアクティブフィルタは表示側で適用する。旧管理画面 (新規作成・受信箱・編集) は撤去した
- **テスト**: `npm run test:kute-seeds-scope` ([`check_kute_seeds_scope.mts`](../scripts/check_kute_seeds_scope.mts)) — スコープ境界 (p25→inst_kute、p30→inst_ehime、他は null)、ホワイトリストに confidential フィールドが混入していないこと。`npm run test:seed-sps-score` ([`check_seed_sps_score.mts`](../scripts/check_seed_sps_score.mts)) — SPS 計算 (`calculateSeedSpsScore`) が 0 と NULL を区別すること、欠損軸があれば `missing` になり部分点を返さないこと、shallow_tech_mode の TRL 除外を検証

## トレードオフ・残課題

- **機関名・PI 名の表記ゆれ**: 単一テーブル方針なので「愛媛大学」「愛媛大」が混在し得る。Phase 2 で正規化マスタ追加を検討
- **Venture Map との連動**: 旧 seeds は Venture Map のグラフ予兆 / レーン別 seedScore に使われていた。新 seeds は意味が違う (AMD 視点の事業化候補) ので Venture Map からは切り離した。将来「AMD が手がけそうなレーン」を Venture Map に再投入したくなったら、新 seeds から `domain_lane` × `amd_rating>=4` を集計して再接続できる
- **`milestone_responsibility` のような複数担当**: 現状 1 シーズ = 1 AMD owner。Phase 2 で `seed_owners` 表を切るか検討
- **PJ 化済みシーズ**: status='spun_off' になった seeds はリストの「アクティブ」フィルタで除外される。それでも検索可能ではあるので情報資産として残る
