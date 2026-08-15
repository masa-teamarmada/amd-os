# Seeds — 研究シーズリスト

> **AMD の Before 0 起点となる個別技術シーズの正本カタログ**。研究機関カタログとは別に持つ。
> AMD のコア能力 3 本柱の一つ「大学連携ネットワーク」を OS 上に可視化する。

---

## 動機

- AMD は Before 0 (技術はあるがビジネスを知らない研究者を起業家に変える) フェーズに特化している ([amd_value_model.md](/Users/masa/projects/knowledge/amd_value_model.md))
- そのため「全国の大学・国研・高専のどこに、事業化できそうなシーズがあるか」を網羅・優先順位付けする一次情報マスタが必要
- これまでは個人の頭の中・Slack の断片・スプシで分散していた
- AMD OS ビジョン ([amd_os_vision.md](/Users/masa/projects/knowledge/amd_os_vision.md)) では将来 URA/EIR が当事者として参画する基盤になる予定。Phase 1 は AMD 内部、Phase 2/3 で URA に開放

## シーズ自体の流れ (`seeds.status`)

```
candidate(候補) → investigating(調査中) → contacted(接触済) → discussing(協議中) → spun_off(スピンアウト済み) / declined(見送り)
```

AMDとの契約はこの状態遷移と別軸。契約した個別シーズは `projects` + `seed_projects` に1行追加し、同じシーズ行へ契約・月次・タスク等のPJ運用情報を重ねる。`spun_off_project_id` は旧互換であり、新しいAMD PJ関係の判定には使わない。

## 設計判断 (確定)

| 論点 | 確定方針 | 理由 |
|---|---|---|
| 主な使い手 | **Phase 1 = AMD 内部**、Phase 2 で URA 公開、Phase 3 で対外ショーケース | 段階拡張。`is_public` 列で将来の公開切替が可能 |
| シーズの単位 | **案件単位 (技術 × 応用先)** | "シアノバクテリア排水処理" のように、PI が複数案件を持てる。`researcher_name` は一意キーではなく、同じPI名の複数行を統合・重複除外しない |
| データ構造 | **`institutions` と `seeds` を別カタログ**として持ち、`seeds.institution_id` で機関へ紐付ける | 研究機関と個別シーズを同じPJ概念へ潰さず、どちらもAMDとの契約前から増やせる |
| AMD契約レイヤー | **共通親 `projects` + 種別子 `seed_projects`** | 契約・月次・タスクの共通情報と、事業化段階・経路・想定市場等のシーズ固有情報を分離する |
| サブデータ | **別テーブルに分割** (`seed_funding` / `seed_news` / `seed_contact_log`) | 検索性・cron ingest しやすさ。UI は 1 リストで完結する原則は満たす |
| 旧 `seeds` テーブル (006_venture_map.sql で作られた予兆 4 件用) | **drop して再構築** | 既存 4 行の中身は実態と合っていなかった (工学院大エコシステム = エコシステム業務、CX/SX = 既に PJ 化済)。Venture Map の予兆プロット (黄色点滅) も意味不明だったので削除 |
| 収集方法 | **Phase 1: 手動 + つくよみ chat 経由** → Phase 2: 公的採択 DB ingest (NEDO/AMED/JST GAP/A-STEP) → Phase 3: researchmap / OpenAlex 発掘 cron | 段階拡張。最初から全部やると母集団がぼけて使われない |

## スキーマ

migration: [024_seeds_overhaul.sql](../scripts/migrations/024_seeds_overhaul.sql) / [207_institution_seed_project_domains.sql](../scripts/migrations/207_institution_seed_project_domains.sql) / [209_research_portfolio_flat_ledger.sql](../scripts/migrations/209_research_portfolio_flat_ledger.sql)

| テーブル | 役割 |
|---|---|
| `seeds` | シーズ本体 (機関 + PI + シーズ情報を 1 行) |
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等) |
| `seed_news` | 関連ニュース・論文・プレス (Atlas とは別系統) |
| `seed_contact_log` | AMD メンバー × シーズ の接触履歴 |
| `institutions` | 研究機関カタログ。シーズとは別の一覧を持つ |
| `seed_projects` | 個別シーズを対象にするAMD契約PJ。`projects` と1対1、`seeds` と多対1 |
| `seed_status_transitions` | `seeds.status` の遷移履歴 (旧状態/新状態/時刻/変更者)。migration 280 のトリガが自動記録。観測開始 2026-08-15、過去遷移は復元しない。一次選別 (Tier 0) の遷移率検証の前提インフラ |
| `seed_screening_bands` | 一次選別のスクリーニング帯 (段階仮説 / q帯% / P帯円 / SPS帯円 / ルーブリック11要因の根拠引用)。`seed_sps_assessments` (本測定系) とは別。append-only・frozen行は更新しない。RLSポリシーなし = service_role専用、外部ワークスペースDTOへの追加は `npm run test:seed-screening-bands` が静的に禁止。正本設計: `pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md` |

`seeds.status` は migration 280 で上記6値の CHECK 制約つき (`seeds_status_check`)。

### `seeds` の主要列

```
識別:           title, summary
機関:           institution_id (FK institutions), org_name, org_type, org_region, org_url
研究者:         researcher_name, researcher_title, lab_name, researcher_url
分類:           domain_lane (gx_energy/gx_circular/life/materials/robo/ict/other),
                industry_target[], keywords[]
成熟度:         trl, brl, hrl (0-9)
AMD 視点:       status, amd_rating (1-5), amd_owner_member_id, next_action,
                internal_notes (非公開), public_summary, is_public
関連:           source, source_detail,
                deep_dive_material_url (AMD内の深掘り資料)
旧互換:         spun_off_project_id (新規AMD PJ関係の判定には使わない)
```

### `discovery_status` 列 (033 migration)

`reviewed` (デフォルト、人が確認済) / `discovered` (cron が新規発見、未確認) / `dismissed` (ノイズ扱い)。
受信箱 `/seeds/inbox` は `discovered` のみを表示し、verify で `reviewed`、dismiss で `dismissed` に更新。

### RLS

旧仕様 (`016_vc_list.sql` / `017_vc_rls_writes.sql` と同じ `anon_read` 全開 + `authenticated_all` = `auth.uid() IS NOT NULL`) は **[213_workspace_access_security_closure.sql](../scripts/migrations/213_workspace_access_security_closure.sql) で撤去済み**（2026-08-01本番適用）。

213 適用後の `seeds` / `seed_funding` / `seed_news` / `seed_contact_log` / `seed_sps_assessments`:

- **anon read は無い**。anon key だけでシーズ台帳やSPSの生の軸値を読める経路を残さない。
- authenticated の read / insert / update / delete はすべて `amd_os_is_member()` ゲート。`auth.uid() IS NOT NULL` の汎用チェックは使わない。外部ワークスペースのアカウントは `members` に載らないので、Supabase セッションを持っていた瞬間があってもここへ直接触れない。
- `service_role_bypass` は cron / API route 用に維持する。
- 既存ポリシー名を過去の migration 文面から推測せず、`pg_policies` を動的に走査して全削除してから正本ポリシーを作り直す。
- 213 が触るのはポリシーだけで、SPS の軸値 (`mu_a` / `mu_i` / `mu_g` / `potential` / `trl` / `brl` / `grl` / `srl` / `hrl`) と評価行そのものへは INSERT / UPDATE / DELETE を一切行わない。ECR (`institution_assessments`) も同じ。
- 外部の研究機関ワークスペースは service_role のサーバー側 DTO で読むため、anon / authenticated を閉じても外部画面の表示は壊れない。

## ルーティング

| パス | 役割 |
|---|---|
| `/seeds` | リスト画面 (検索 / フィルタ / ソート / 行クリックで `SeedDetailModal`)。深掘り資料のmdはOS内Markdownモーダル (左メニューなし) で開く。新規発見シーズは行頭に 🆕 マーク、右上に「受信箱」リンク + バッジ |
| `/seeds/[id]` | 単独詳細ページ。直接 URL アクセス用フォールバック (リスト画面で開く Modal を full-page で表示) |
| `/seeds/inbox` | 受信箱 (cron 自動収集分の未確認シーズ)。verify=採用 / dismiss=非表示 |
| `/api/cron/seeds-ingest` | 旧: 毎週 月曜 09:00 JST に Claude Sonnet + web_search で 7 ソース (GAP/NEP/AMED/D-Global/CREST/創発/先導研究) を巡回 → discovery_status='discovered' で投入。2026-05-22 以降は LLM/web_search 課金回避で自動 schedule 停止 |

GlobalNav に **Seeds** を Venture Map と VC の間に追加 ([GlobalNav.tsx](../src/components/nav/GlobalNav.tsx))。

## UI

> **実装補足 (2026-08-15)**: 現行の `/seeds` は `CockpitKuteSeeds` (`scope="all"`) + `KuteSeedDetailModal` で描画する ([CockpitKuteSeeds.tsx](../src/components/cockpit/CockpitKuteSeeds.tsx) / [KuteSeedDetailModal.tsx](../src/components/seeds/KuteSeedDetailModal.tsx))。`SeedDetailModal` (下記) は編集・削除・サブセクションCRUD用の別コンポーネントで、`/seeds/[id]` の直接URLフォールバックと「+ 新規シーズ」導線からのみ開く。行クリックで開く読み取り専用モーダルは `KuteSeedDetailModal`。

### `/seeds` リスト

- **テーブル列**: シーズ / 研究機関 / 研究者・PI / PJ状態 / SPS帯(億円)・根拠Lv / 旧SPS・M・P・R・S / TRL・BRL・GRL・SRL・HRL / 事業化情報 / 資料
- **SPS帯(億円)列** (2026-08-15 追加): 各シーズ最新の `seed_screening_bands` 行 (`assessed_at` 降順の先頭) から `sps_lower_yen`/`sps_upper_yen` を億円表記「0.5〜60」で表示。帯が無いシーズは「—」。列ソート可、キーは上限 (`sps_upper_yen`) 降順が既定 (まさ確定)。`seed_screening_bands` はRLSポリシー無し (service_role専用) のため、[`/api/seeds/screening-bands`](../src/app/api/seeds/screening-bands/route.ts) (member認証) 経由でクライアントへ渡す。DTOには表示に必要な値だけを含め、`q_evidence` の全文はリストDTOへ入れない ([seed-screening-bands.ts](../src/lib/seed-screening-bands.ts))
- **根拠Lv列** (2026-08-15 追加): バッジ表示 (Lv0〜Lv3)。判定はサーバー側で機械導出し上位が勝つ。Lv3=紐付くPJの`project_pl_monthly`が6ヶ月分以上／Lv2=`seed_projects`に紐付け行あり／Lv1=`seed_contact_log`に1件以上 or `seeds.status`が`contacted`/`discussing`／Lv0=それ以外。バッジの`title`属性にLv定義を表示。正本: [BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md](../bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md) §6 確定13
- **旧SPS表記** (2026-08-15): 既存の「SPS・M・P・R・S」列見出しは「旧SPS」に改名 (機能・列・導線は変更なし)。9軸ルーブリック (M×P×R×S) を指し、一次選別のSPS帯とは別系統であることを明示する
- **全件表示**: PJ化・スピンアウト・見送りを理由にリストから除外しない。契約前後を通じて同じカタログ行を使う
- **フラット台帳**: 1シーズ=1行。研究機関・研究者・PJ有無を行グループやセクションにせず、通常カラムとして表示する
- **PJ優先ソート**: `/seeds` (全機関横断、`scope="all"`) は `seed_projects` のPJ化済み (`active/ended/frozen`) → PJ化検討中 (`sales/draft`、または未紐付けの `contacted/discussing`) → PJなし・SPS評価済み (`latest_sps.status==="ready"`) → その他の4段階に固定し、各区分の中を列ソートする (`seedListPriority()`)。ECRはこの優先度に関与させない。PJ cockpit / 研究機関 cockpit 内の比較表 (`scope!=="all"`) はPJ優先ソートをかけず列ソートのみ、かつSPS帯・根拠Lv列は出さない (`/seeds` 限定)
- **フィルタ**: シーズ自体のstatus / 領域 / 担当 / フリーテキスト。AMD PJ状態とは混ぜない
- **新規作成**: 右上「+ 新規シーズ」ボタン → `SeedDetailModal` を createMode で開く
- **深掘り資料**: `deep_dive_material_url` には、AMDが確認済みの共有資料リンクだけを置く。資料本文、一次ソース本文、一次ソースの生URLは置かない。md はOS内Markdownモーダル (左メニューなし) で表示し、ヘッダーの補助リンクからDriveを開ける。

### `KuteSeedDetailModal` (現行 `/seeds` 行クリックで開く読み取り専用モーダル)

- **一次選別スクリーニング帯セクション** (2026-08-15 追加、`seed_screening_bands` に帯がある場合のみ表示): 段階仮説 (stage_lower〜stage_upper + stage_tag) / q帯 (q_lower_pct〜q_upper_pct % + 主要因タグ) / P類型 (p_class) + P帯 (億円) / SPS帯 (億円) + 根拠Lvバッジ / 評価者・評価日時・ruleset_version / 固定注記「この帯は接触と調査の優先順位づけの下書き。上限は楽観シナリオの包絡であり評価額ではない。投資判断・対外表示には使わない」。`q_evidence` (11要因の根拠引用) は折りたたみ (初期閉じ) で要因名・direction・根拠引用を表示。詳細DTOは `/api/seeds/screening-bands?seedId=` から取得 (member認証、service_role経由)
- **旧SPSセクション**: 見出しを「旧SPS (全国共通シーズスコア)」に改名 (2026-08-15。機能・データは変更なし)。M/P/R/S 9軸ルーブリックの表示

### `SeedDetailModal` (編集・削除用。`/seeds/[id]` フォールバックと新規作成導線から開く)

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
- ✅ **AMD関与シーズPJの移行**: migration 209で個別シーズ型19PJを `seed_projects` へ補完。p21/p26は既存seedを再利用し、p00/p12/p14/p19/p23/p25/p28/p30は個別シーズへ潰していない
- ⬜ **HSFC 残り 23 件 / さきがけ 175件** の収集

### Phase 3

### 機関外部への公開 (実装済)

旧TODOにあった「`is_public=true` のシーズを別認証で公開閲覧可能にする」「`/research-orgs/[org_name]` で機関単位の seeds 一覧」は、**研究機関ワークスペースとして実装済み**。設計正本は [institution_seed_project_model.md](institution_seed_project_model.md) §6。migration 212/213 は2026-08-01に本番適用済み。

- 面は `/workspace/[slug]`。公開トップ `/` は掲載可のワークスペースをslug・名称・機関の種別/地域だけで一覧し、外部の人は `/workspaces` を入口にする。
- 可視範囲は `seeds.is_public` ではなく `institution_workspace_seed_scopes` で決める。機関に紐づくシーズを機関段階かPJ化済みかで絞り込まず、現時点の全件を範囲へ入れる。
- 認可はメールアドレス単位のアカウント + 機関ワークスペース所属 + PJ個別アクセスの3つの明示的な付与だけ。**機関ワークスペースの所属はPJ詳細ワークスペースへのアクセスを意味しない**。メールのドメイン一致も根拠にしない。
- 外部へ返すのは許可列DTOだけ。`internal_notes` / `source_detail` / `deep_dive_material_url` 等の社内列と、`seed_sps_assessments.axis_evidence` / `evaluator` は外部の面に出さない。
- 一覧の並びは `/seeds` と同じライフサイクル優先度 (PJ化済み → PJ化検討中 → PJなし・SPS算出済み → その他)。同じ区分の中は表題の日本語順。
- **SPSとECRは合算しない**。機関ワークスペースでもSPSはシーズごとの評価、ECRは機関の縦並び (総合値 + 8軸) として別々に表示し、合成スコア・相関・因果指標を作らない。
- 資料共有はAMD OSの共通資料室へ実装済み。機関資料は `/workspace/[slug]/files`、PJ資料は `/project/[projectId]/workspace/files` に分け、どちらも同じ `workspace_documents` を使うが1資料の所有先は必ず片方だけ。機関所属からPJ資料権限は派生しない。旧Project Share 6環境はPJ資料室へ非破壊コピー済みで、外部アカウント/grantの到達確認までは旧入口を並行稼働する。

### 残TODO

- **researchmap / OpenAlex 発掘 cron**: 機関 × 領域別に Claude + web_search で「注目シーズ候補」を生成 → inbox
- **つくよみ chat tool 群**: `upsert_seed` `update_seed_status` `add_seed_funding` `add_seed_contact` 等

## SPS (Seed Prospect Score) — 全国全シーズ共通の評価 (2026-07-20)

SPS はシーズ有望度スコア。KUTE / p25 に限らず **全国のすべての `seeds` 行に適用される**。`seed_projects` の有無やPJ状態とは独立で、まだどのPJにも紐づいていない `candidate` 段階のシーズにも同じ式・同じテーブルで評価をつけられる。

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
- **研究機関PJは「対象機関でフィルタして表示するだけ」**: project_id → institution_id の対応はDBの `institution_projects` を正本に解決する。KUTE (`p25`)、NIMS (`p28`)、愛媛大全体PJ (`p30`) を同じ取得経路で扱い、コードの固定対応表は持たない。SPSは対象シーズの最新評価を読むだけで、ECRとは合算しない
- **事業化フィールド** (`seeds` テーブル、187 でリネーム、すべて nullable / CHECK 制約つき、根拠のない値は null のまま = 捏造禁止):
  - 事業化タイプ: `primary_commercialization_type` (単一) + `secondary_commercialization_types[]` (複数可)。enum は `large_startup` / `small_business_1b_yen` / `license` / `jv_ma` / `joint_research_poc`
  - 公開向けテキスト (旧 `kute_*` から全国共通名へ改名、値は保持): `envisioned_use_case` / `first_customer_candidate` / `market_size_range` / `market_size_confidence` (low/medium/high) / `biggest_bottleneck` / `ip_status` / `next_verification_step`
- **プライバシー境界**: `internal_notes` / `source_detail` 等の社内限定フィールド、および `seed_sps_assessments.axis_evidence` / `evaluator` は公開面の select に含めない。ホワイトリスト型 `SeedPublicView` + 定数 `SEED_PUBLIC_VIEW_COLUMNS` ([`types/seeds.ts`](../src/types/seeds.ts)) を select の唯一の呼び出し元にする。既存の `SeedDetailModal` (編集用、confidential 項目を含む) は再利用せず、新規の読み取り専用 `KuteSeedDetailModal` ([`components/seeds/KuteSeedDetailModal.tsx`](../src/components/seeds/KuteSeedDetailModal.tsx)) を使う
- **UI**: PJ cockpit (`/project/p25/cockpit`) と研究機関 cockpit (`/institutions/inst_kute/cockpit`) の進捗タブ、および `/seeds` で、横スクロール可能な比較テーブル (`CockpitKuteSeeds.tsx`) を共有する。1シーズ=1行で、研究機関・研究者/PI・PJ状態を通常列に置き、機関/研究者/PJ有無のgroup rowは作らない。`SPS` / `M` / `P` / `R` / `S`、`TRL` / `BRL` / `GRL` / `SRL` / `HRL`、事業化フィールドと資料有無を横並び比較する。長文は省略せずセル内で折り返す。`discovery_status='discovered'` は「公開情報候補」、SPS欠損は0へ変換せず「未評価」と表示する。`axis_evidence` / `evaluator` は内部専用なので画面へ返さない
- **KUTE公開情報の候補4件**: migration [`189_kute_public_seed_candidates.sql`](../scripts/migrations/189_kute_public_seed_candidates.sql) で「165〜220nm次世代クリーンUV面光源」「金属フリー透明フレキシブル導電膜」「塩水・交流電気分解による都市鉱山金回収」を、migration [`225_kute_public_seed_candidate_fujii.sql`](../scripts/migrations/225_kute_public_seed_candidate_fujii.sql) で「バイオガスと飼料バイオマスを同時生産する資源循環技術」を `discovery_status='discovered'` で追加する。225の後に追加された行は migration [`226_link_kute_fujii_public_seed.sql`](../scripts/migrations/226_link_kute_fujii_public_seed.sql) で `inst_kute` に紐付ける。公開情報調査の旧100点スクリーニング値はSPS/XRLへ移植せず、`seed_sps_assessments` は未登録のままにする
- **`/seeds` (全機関横断比較)**: `CockpitKuteSeeds` を `scope="all"` で全175件表示する。フラットな1行台帳を `PJ化済み → PJ化検討中 → PJなし・SPS評価済み → その他` の順に固定し (`seedListPriority()`)、同じ区分内を列ソートする。`seeds.status='spun_off'` は会社設立状態であり、AMD PJ判定には使わない。SXは会社未設立のため `discussing` / `pre_incorporation`
- **テスト**: `npm run test:kute-seeds-scope` は動的スコープとPJ優先度、公開ホワイトリストを検査する。`npm run test:institution-seed-project-domains` は物理テーブル分離、p30/p21移行、二重分類防止、全件表示、ECR/SPS非更新を検査する。`npm run test:seed-sps-score` はSPSの0/NULLと欠損軸を検査する

## トレードオフ・残課題

- **機関名の確認状態**: 大学・国研シーズ141件は46機関へ `institution_id` で紐付け済み。推定名称は `institutions.identity_status='candidate'` のまま表示し、人の確認前に確定名称へ昇格させない。PI名の表記ゆれは引き続き表示正規化だけで、DB行は統合しない
- **Venture Map との連動**: 旧 seeds は Venture Map のグラフ予兆 / レーン別 seedScore に使われていた。新 seeds は意味が違う (AMD 視点の事業化候補) ので Venture Map からは切り離した。将来「AMD が手がけそうなレーン」を Venture Map に再投入したくなったら、新 seeds から `domain_lane` × `amd_rating>=4` を集計して再接続できる
- **`milestone_responsibility` のような複数担当**: 現状 1 シーズ = 1 AMD owner。Phase 2 で `seed_owners` 表を切るか検討
- **PJ化済み/検討中シーズ**: `seed_projects` の実行・履歴がある行は最上段、商談・契約検討はその次へ上げる。カタログから別リストへ移動・複製・非表示にしない
