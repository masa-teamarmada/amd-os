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
| `seed_company_facts` | 会社メモ。会社・技術について会議や資料で分かった断片的な事実を1行1件。SPS初回評価が読む source facts の6系統目 |
| `institutions` | 研究機関カタログ。シーズとは別の一覧を持つ |
| `seed_projects` | 個別シーズを対象にするAMD契約PJ。`projects` と1対1、`seeds` と多対1 |
| `seed_status_transitions` | `seeds.status` の遷移履歴 (旧状態/新状態/時刻/変更者)。migration 280 のトリガが自動記録。観測開始 2026-08-15、過去遷移は復元しない。一次選別 (Tier 0) の遷移率検証の前提インフラ |
| `seed_screening_bands` | 現行SPSの凍結評価ストア。`measure_version='sps-ind-v1' AND ruleset_version='rubric-v1.1+ind-v1' AND frozen=true`の完全一致だけをactive pathが読む。frozen行はDB triggerで更新・削除不可、再評価はappend-only。旧評価テーブルは監査履歴として退役。RLSポリシーなし = service_role専用 |
| `sps_initial_assessment_candidates` | 未評価シーズ専用の初回SPS候補。候補作成と凍結行公開を分離し、同一seed lock・完全版組の未存在・11要因根拠・情報締切・数式をDBで検証する。既存完全tupleがあれば再評価導線だけを使う |

### 初回SPS評価の運用（2026-08-20）

未評価とは、`seed_screening_bands` に current tuple（`sps-ind-tier0-v1` / `sps-ind-v1` / `q-eval-v2` / `rubric-v1.1` / `p-ind-v1` / `rubric-v1.1+ind-v1`）の凍結行がない状態だけを指す。旧評価をfallbackにしない。

`npm run sps:initial:prepare -- --output /private/tmp/sps-initial-prepared.json` は正本prompt本文と、基本情報・確定系補助金・確認済みニュース短縮要約・接触日/方法・PJ有無・会社メモの安全化source factsを決定順で出す。Codex automation は評価値だけを候補JSONにし、facts・prompt/model/prepared hashは非LLM submitterがpreparedから注入する。`validate` はprepared自己hash、prompt/model hash、P×qの端点丸め・11要因・段階順序・情報締切を検証し、`submit` と `apply` はDB再計算のfacts/full source fingerprint CASを同一seed lock下で通す。pending候補と採否済み監査履歴は内容変更不可。公開は別操作の `apply --candidate-id <UUID> --actor <識別子>` だけで、DB RPC が既存評価の不在を確認してから初回candidate FK付き凍結行をappendする。候補ゼロと同一candidateの冪等submitは正常で、batchは全件成功か全件rollbackになる。

議事録、Slack、Teams等からシーズ情報を取り込むときは、本文要約や `internal_notes` だけで完了扱いにしない。助成金・採択は `seed_funding`、接触は `seed_contact_log`、ニュース・論文・特許は `seed_news`、PJ化は `seed_projects` または `institution_projects` へそれぞれ構造化して保存する。**どれにも当てはまらない断片的な事実は `seed_company_facts` (会社メモ) へ入れる**——「ベンチプラントが川崎にある」のような、会議で聞いた設備・体制・顧客・資金の事実がここに当たる。採択年度・金額・実施期間など根拠にない値は `null` のままにし、確認済み事実だけを登録する。

### 会社メモ (`seed_company_facts`、2026-09-02)

まさ 2026-09-02「いまLSTの経営会議で『つばめBHBのベンチプラントが川崎にある』という情報を得た。こういう会社のちょっとした情報をためておける場所を作ってほしい。そしてそれがSPS計算の素材になるようにしてほしい」。

会議や資料で分かった、会社・技術についての断片的な事実を1行1件で貯める。既存の3つでは受け止められない:

| テーブル | 入るもの | 入らないもの |
|---|---|---|
| `seed_funding` | 採択という出来事 | 採択以外 |
| `seed_news` | 公表済みの記事・論文・プレス (出典URLが前提) | 公表されていない話 |
| `seed_contact_log` | 誰といつ会ったか | 聞いた中身の構造化 |
| `seed_company_facts` | 上のどれにも収まらない事実 | — |

列は 分類 (`category`) / 事実 (`fact`、240字) / 補足 (`detail`) / いつ時点か (`observed_on`) / どこで知ったか (`heard_at`) / 出どころ (`source_kind`) / 確からしさ (`confidence`) / SPSのどこに効くか (`sps_relevance`) / URL。語彙はDBのCHECK制約が正本で、画面のラベルは [`seeds-data.ts`](../src/lib/seeds-data.ts) の `SEED_COMPANY_FACT_*_LABEL`。

- `category`: facility=設備・拠点 / scale_up=量産・規模拡大 / customer=顧客・引き合い / partner=提携・出資 / capital=資金 / team=人・体制 / ip=知財 / regulation=規制・許認可 / competition=競合 / market=市場・価格 / other
- `source_kind`: meeting=会議で聞いた / document=資料で読んだ / public=公開情報 / hearsay=伝聞
- `confidence`: confirmed=一次資料または当事者で確認済 / reported=当事者から聞いたが裏取り前 / unconfirmed=未確認
- `sps_relevance`: stage=段階仮説とBZM 3.0の証拠水準 / q=到達見込みの11要因 / p=産業創出価値の帯 / bzm30=`seed_bzm30_inputs` の入力。**空でもよい**——印は評価者への申し送りであって、必須にすると印を付けるために事実を歪める

**SPS計算の素材になる経路。** `sps_initial_assessment_source_snapshot` の6系統目として、既存5系統と同じ扱いで渡る (migration `20260902090000_seed_company_facts.sql`)。

- 情報締切より後に更新された行があれば prepare をやり直させる。`observed_on` が締切より後の行は facts に載らない
- 本文は `sps_initial_assessment_safe_text` でURL・連絡先・認証情報を落としてから渡す
- fingerprint の材料に入るので、素材が動いた候補は stale になる
- **`heard_at` と `source_url` は評価へ渡さない。** どこで聞いたかは評価の材料ではなく (個人名が入りうる)、確からしさは `confidence` と `source_kind` が担う
- 正本prompt (`sps.initial-assessment.candidate.v1`) に「confidenceがconfirmedでない行を確定事実として帯へ入れない。source_kindがmeetingやhearsayの行は、そう明記したうえで幅を広げる側にだけ使う」を追記済み

BZM 3.0 側へは自動では入らない。`seed_bzm30_inputs` の `evidence_stage_reason` などを人が置くときの材料として、同じモーダルの上に置く ([`pwa/spec` 4-8 §7.1](../spec/4-8-bzm30-seed-score-panel-current-spec.md))。

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

> **実装補足 (2026-08-18)**: `/seeds` と AMD 内部の研究機関PJコックピットは、同じ `CockpitKuteSeeds` と社内用 `SeedDetailModal` を使う。一覧だけ `scope` に応じて全件または `institution_id` で絞り、行クリック後の詳細・接触履歴・編集導線は分岐させない。外部共有面だけ `KuteSeedDetailModal` と公開ホワイトリストを使う。`detailSurface` は `internal` / `public` を呼び出し側で必ず明示し、暗黙の公開・非公開切替を禁止する。

### `/seeds` リスト

- **テーブル列** (`scope="all"`、実質 `/seeds`): **シーズNo.** / シーズ / **会社名** / 研究機関 / 研究者・PI / 産業創出価値 / 現在地・型 / TRL・BRL・HRL / 事業化情報 / 次の検証 / **追加研究による市場創出案** / 資料。**PJ状態カラムは置かない**。`seed_no` は研究機関内の固定番号で、ソートや絞り込みによって採番し直さない。desktopはシーズNo.とシーズ名、mobileはシーズNo.だけを横スクロール時も左へ固定し、狭い画面で固定列が本文を覆わないようにする。追加研究案は `additional_research_hypothesis` に置くAMD内部の未検証仮説で、研究成果・市場成立・ブルーオーシャンの確定情報として扱わず、外部公開ホワイトリストには含めない。シーズ名の左には外部サイトのfaviconではなく、`domain_lane` を形でも判別できるLucideアイコンを表示する (`gx_energy=Zap` / `gx_circular=Recycle` / `life=Dna` / `materials=Atom` / `robo=Bot` / `ict=Cpu` / `other・null=FlaskConical`)。会社名は `seed_projects.venture_name` を正本とし、`commercialization_stage='pre_incorporation'` は「会社名（未設立）」、紐付く会社名が未登録またはPJ未紐付けなら「未設立」と表示する。
- **列幅**: 全列のヘッダー右端をポインターで左右へドラッグして48〜720pxで変更できる。キーボードでは区切りへフォーカスして左右キーで16pxずつ変更し、ダブルクリックでその列だけ既定幅へ戻す。幅は `localStorage` に端末単位で保存し、他の利用者やDBへ共有しない。内容は省略せず、指定幅内で全文を折り返す。
- **SPS(億円)列** (2026-08-15 追加、同日 中央値表示へ修正。2026-08-16 産業創出価値版へ差し替え): 各シーズ最新の `seed_screening_bands` 行 (`measure_version='sps-ind-v1'` に明示限定した `assessed_at` 降順の先頭) から `sps_lower_yen`/`sps_upper_yen` を「中央値 (下限〜上限)」の億円表記で表示。例:「30.3 (0.5〜60)」。**中央値は算術中点 (下限+上限)/2 の仮置き実装** (まさ裁定 2026-08-15「帯にしちゃってるからソーティングがきかない。一旦仮置きで、中央値をSPSとして、括弧書きで（min〜max）みたいにしておいてほしい」)。帯が無いシーズは「—」。列ソート可、**既定キーは中央値の降順** (同裁定「中央値でソーティングされるようにして」。旧仕様の上限降順から変更)。中央値を計算できない (上限・下限のどちらかのみ) 行は常にソート末尾。表示・ソート値の算出は [`seeds-data.ts`](../src/lib/seeds-data.ts) の `seedScreeningBandMedianYen()` / `formatOkuYen()` に一本化 (一覧セルは中央値を太字・帯を小さめ併記の2スパン表示、`whitespace-nowrap`・列min-w 170pxで折り返さない。詳細モーダルは `formatSpsBandWithMedian()`)。列ヘッダーのツールチップに「産業創出価値版（sps-ind-v1）。そのシーズ事業が日本国内に生む付加価値NPVの桁×到達見込み」を併記する。`seed_screening_bands` はRLSポリシー無し (service_role専用) のため、[`/api/seeds/screening-bands`](../src/app/api/seeds/screening-bands/route.ts) (member認証) 経由でクライアントへ渡す。DTOには表示に必要な値だけを含め、`q_evidence` の全文はリストDTOへ入れない ([seed-screening-bands.ts](../src/lib/seed-screening-bands.ts))
- **根拠Lv列** (2026-08-18訂正): Lv2=`seed_projects`紐付け、Lv1=`seed_contact_log`1件以上または接触状態、Lv0=それ以外。Lv3はverified actualを計画値から分離した正規化証跡が必要で、現行の`project_pl_monthly`行数からは自動付与しない。行数だけの旧Lv3判定は廃止。
- **旧SPSの完全退役** (2026-08-18): `/seeds`だけでなくPJ/機関scopeを含む全表示・sort・APIから旧9軸と旧評価行を除外する。現行完全一致がなければ最新版未評価。旧データは監査履歴としてDBに残すが、fallback・writer・表示条件分岐を持たない。
- **全件表示**: PJ化・スピンアウト・見送りを理由にリストから除外しない。契約前後を通じて同じカタログ行を使う
- **フラット台帳**: 1シーズ=1行。研究機関・研究者・PJ有無を行グループやセクションにせず、通常カラムとして表示する
- **PJ優先ソート**: `/seeds` (全機関横断、`scope="all"`) は `seed_projects` のPJ化済み (`active/ended/frozen`) → PJ化検討中 (`sales/draft`、または未紐付けの `contacted/discussing`) → PJなし・SPS評価済み (`latest_sps.status==="ready"`) → その他の4段階に固定し、各区分の中を列ソートする (`seedListPriority()`)。**例外: SPS(億円)列でソートしている間はこの4段固定を外し、リスト全体を中央値でフラットに並べる** (まさ裁定 2026-08-15「全然ソーティングされない」への対応。/seeds の既定ソートキーはSPS中央値のため、初期表示はフラット順になる)。ECRはこの優先度に関与させない。PJ cockpit / 研究機関 cockpit 内の比較表 (`scope!=="all"`) はPJ優先ソートをかけず列ソートのみ、かつSPS(億円)・根拠Lv列は出さない (`/seeds` 限定)
- **フィルタ**: シーズ自体のstatus / 領域 / 担当 / フリーテキスト。AMD PJ状態とは混ぜない
- **新規作成**: 右上「+ 新規シーズ」ボタン → `SeedDetailModal` を createMode で開く
- **深掘り資料**: `deep_dive_material_url` には、AMDが確認済みの共有資料リンクだけを置く。資料本文、一次ソース本文、一次ソースの生URLは置かない。md はOS内Markdownモーダル (左メニューなし) で表示し、ヘッダーの補助リンクからDriveを開ける。

### `KuteSeedDetailModal` (外部共有用の読み取り専用モーダル)

> **現状 (2026-08-20 確認)**: `detailSurface="public"` を渡す呼び出し元はリポジトリに存在しない (`/seeds` の `page.tsx` も `CockpitKuteSeeds` の既定値も `internal`)。したがってこのモーダルは現在どの画面からも表示されない。外部共有面を再開するまでの間、**まさが実際に読むシーズ詳細は `SeedDetailModal` 側だけ**である。帯や根拠の表示を追加・変更するときは、まず `SeedDetailModal` に入れる。ここだけに入れても画面には出ない。

- **一次選別スクリーニング帯セクション** (2026-08-15 追加、2026-08-16 産業創出価値版へ差し替え、`seed_screening_bands` に `measure_version='sps-ind-v1'` の帯がある場合のみ表示): 見出しは「SPS帯（産業創出価値）」+ `measure_version` (`sps-ind-v1`) の小表示。段階仮説 (stage_lower〜stage_upper + stage_tag) / q帯 (q_lower_pct〜q_upper_pct % + 主要因タグ) / 「P^ind帯(産業創出価値・判断層)」(p_class) + P帯 (億円) / SPS (億円、中央値 (下限〜上限) 表示。中央値は仮置きの算術中点、まさ裁定 2026-08-15) + 根拠Lvバッジ / 評価者・評価日時・ruleset_version / 固定注記「この帯は接触と調査の優先順位づけの下書き。上限は楽観シナリオの包絡であり評価額ではない。投資判断・対外表示には使わない」。判断根拠は共通UI [`SpsBandRationale`](../src/components/sps/SpsBandRationale.tsx) が描画する: `notes` (帯の総合判断。q上限側/下限側の理由とSPS主因) を「総合判断」段落で常時表示し、`q_evidence` (11要因の根拠引用) を折りたたみ (初期閉じ) で要因名・direction・根拠引用・評価として表示 (2026-08-20 追加。判断記録の md だけに根拠を置かず、OS画面から読める状態を正とする)。同じ共通UIをPJコックピットの `?tab=score-detail` でも使う。詳細DTOは `/api/seeds/screening-bands?seedId=` から取得 (member認証、service_role経由)
- **旧SPSセクションの非表示化** (2026-08-15 見出しを「旧SPS (全国共通シーズスコア)」に改名 → 2026-08-16 まさ裁定でOS非表示化。[SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md) §8): M/P/R/S 9軸ルーブリックのセクションを非表示にする。JSX・データ取得コードは `KuteSeedDetailModal.tsx` の `SHOW_LEGACY_SPS`定数 (`false`) で残したまま表示だけ切る (機能削除ではない)

### `SeedDetailModal` (AMD社内用の完全版詳細)

- **詳細モード**: `/seeds` と研究機関PJコックピットの行クリックでは同じ内部向け詳細を開き、4 セクション (シーズ概要 / 機関・研究者 / AMD 評価 / 関連・ソース) + BZM 3.0 スコアパネル + (参考) 旧の一次選別の帯 (折りたたみ) + サブセクション 3 つ (補助金 / 接触履歴 / ニュース) を表示する。研究機関側は一覧だけ対象機関へ絞り、詳細は省略しない
- **PJ化の有無で中身を変えない** (まさ確定 2026-08-20): `seed_projects` の接続有無でモーダルの構成・レイアウト・表示セクションを切り替えない。PJ化済みでも未PJ化と同じ読み取りビューとサブセクションを出す。接続PJの入口はヘッダーのPJバッジから `/project/{project_id}/cockpit` だけを開き、workspaceへの直リンクは置かない。まさ「PJ化しても元通りのコンテンツにしておいた方がいい。中途半端なコックピットみたいになっちゃってる。コックピットはPJ化される、または事業化検討開始で生成されてるようになってるし、モーダルは変える必要がない」
- **BZM 3.0 スコアパネル (産業創出価値 V の算出)** (2026-08-27 追加): 詳細モードの4セクションの下に [`Bzm30ScorePanel`](../src/components/bzm30/Bzm30ScorePanel.tsx) を**帯の有無に関わらず常時**置く。このシーズで式に入る値がいくつ埋まっているか / スコアの定義と金額になるまでの道筋 / 型×規制×証拠水準ごとの v / モデルの式17本 / 係数73件 / 近似と誤差 の6ブロック。**仕様の正本は [`pwa/spec` 4-8 BZM 3.0 スコアパネル](../spec/4-8-bzm30-seed-score-panel-current-spec.md)**（OSの `/spec` に出る）。ここには置かない
- **案件ごとの入力とスコアは DB に持つ** (2026-08-27。migration 331): 用途ごとの天井は `seed_value_ceilings`、工程の型・規制属性・証拠水準・観測状態は `seed_bzm30_inputs`、算出結果は `seed_bzm30_scores`。算出は `model/tools/bzm30_score_seeds.cjs`（1件2〜3分なので画面のリクエストでは走らせない）。詳細は [`pwa/spec` 4-8 §7](../spec/4-8-bzm30-seed-score-panel-current-spec.md)
- **旧の一次選別の帯は「V の上限としての検算基準」へ降格** (2026-08-27。それ以前は「一次選別スクリーニング帯 (SPS = 産業創出価値)」の見出しで詳細の主役だった): BZM 3.0 パネルの下に折りたたみ (初期閉じ) で残す。中身は従来どおり共通UI [`SpsScreeningBandSection`](../src/components/sps/SpsScreeningBandSection.tsx)。位置づけと規律は [`pwa/spec` 4-8 §5](../spec/4-8-bzm30-seed-score-panel-current-spec.md)
- **編集モード**: 編集ボタンで全フィールド inline form に切替。保存 / キャンセル
- **サブセクション CRUD**: 会社メモ・補助金・接触履歴・ニュースは「+ 追加」ボタン → 軽量 form。会社メモは4つの先頭に置き、1行1事実の表で出す (列: 時点 / 分類 / 事実 / 効く先 / 確度・出どころ)。接触履歴はメール、電話、Slack、Teams、MTG/面談、イベント、紹介、訪問、その他を記録できる。削除は ✕ ボタン
- **事業化検討の開始** (2026-08-19): 接触済み・協議中への状態変更だけではPJを自動作成しない。詳細画面の「事業化検討を開始」から、member認証済みの `/api/seeds/[seedId]/commercialization` を呼び、DB RPC `activate_seed_commercialization` がseed行をロックしたうえで `projects.status='draft'`、`seed_projects`、実行者の `project_members` を同一transactionで作成する。機関所属や外部共有権限は自動付与しない。既に複数PJ接続がある場合はstatus優先で表示PJを選べる。
- **事業化ワークベンチ (2026-08-19 導入 → 2026-08-20 廃止)**: `seed_projects` 接続後にモーダルを全画面型へ切り替え、固定ヘッダー・判断レール (根拠→仮説→次の検証→判断→行動)・判断 / 推進 / 記録の3領域を出していた `CommercializationWorkbench` は削除した。PJ化したシーズだけモーダルの中身が別物になり、補助金・接触履歴・ニュースまで消えていたため。事業化検討開始とPJ化で本物のPJコックピットが生成される以上、モーダル内に簡易コックピットを二重実装しない。MTGカード・AMD内部資料・内部判断記録はPJコックピット、週次差分・ガント・関係先・論点仮説・共有資料はそこから開くPJワークスペースで扱う。`check_pwa_critical_ui.cjs` に `CommercializationWorkbench` の `expectNotIncludes` を置いて再導入を止めている。

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
- ✅ **HSFC GAPファンド 4年度分の収集**: 2021/2022/2024/2025年度の86件を投入 (重複除外後ユニーク70件、migration 314)
- ✅ **JST さきがけ 2024年度の収集**: 公開PDF 15研究領域から175件を機械抽出し、国内機関所属の166件を投入 (migration 315)。海外機関所属9件は国内シーズ台帳の趣旨から対象外。採択金額・実施期間はPDFに記載が無いため `null` のまま
- ⬜ **さきがけ 2023 / 2025年度** の収集

### Phase 3

### 機関外部への公開 (実装済)

旧TODOにあった「`is_public=true` のシーズを別認証で公開閲覧可能にする」「`/research-orgs/[org_name]` で機関単位の seeds 一覧」は、**研究機関ワークスペースとして実装済み**。設計正本は [institution_seed_project_model.md](institution_seed_project_model.md) §6。migration 212/213 は2026-08-01に本番適用済み。

- 面は `/workspace/[slug]`。公開トップ `/` は掲載可のワークスペースをslug・名称・機関の種別/地域だけで一覧し、外部の人は `/workspaces` を入口にする。
- 可視範囲は `seeds.is_public` ではなく `institution_workspace_seed_scopes` で決める。機関に紐づくシーズを機関段階かPJ化済みかで絞り込まず、現時点の全件を範囲へ入れる。
- 認可はメールアドレス単位のアカウント + 機関ワークスペース所属 + PJ個別アクセスの3つの明示的な付与だけ。**機関ワークスペースの所属はPJ詳細ワークスペースへのアクセスを意味しない**。メールのドメイン一致も根拠にしない。
- 外部へ返すのは許可列DTOだけ。`internal_notes` / `source_detail` / `deep_dive_material_url` 等の社内列と、`seed_sps_assessments.axis_evidence` / `evaluator` は外部の面に出さない。
- 一覧の並びは `/seeds` と同じライフサイクル優先度 (PJ化済み → PJ化検討中 → PJなし・SPS算出済み → その他)。同じ区分の中は表題の日本語順。
- **SPSとECRは合算しない**。機関ワークスペースでもSPSはシーズごとの評価、ECRは機関の縦並び (総合値 + 8軸) として別々に表示し、合成スコア・相関・因果指標を作らない。
- 資料共有はAMD OSの共通資料室へ実装済み。機関資料は `/workspace/[slug]/files`、PJ資料は `/project/[projectId]/workspace/files` に分け、どちらも同じ `workspace_documents` を使うが1資料の所有先は必ず片方だけ。機関所属からPJ資料権限は派生しない。旧Project Share 6環境はPJ資料室へ移行readback後、2026-08-26に全廃した。旧入口・独立Vercel project・Blob store・共有パスワード方式は復元しない。

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
- **プライバシー境界**: AMD社内の `/seeds` と研究機関PJコックピットは `SeedDetailModal` から完全版を読む。外部 `/workspace/[slug]` と将来の公開シーズ詳細では `internal_notes` / `source_detail` / `seed_contact_log` 等を返さず、ホワイトリスト型 `SeedPublicView` + `KuteSeedDetailModal` を使う。`CockpitKuteSeeds.detailSurface` は呼び出し側で `internal` / `public` を明示する
- **UI**: PJ cockpit (`/project/p25/cockpit`) と研究機関 cockpit (`/institutions/inst_kute/cockpit`) の進捗タブ、および `/seeds` で、横スクロール可能な比較テーブル (`CockpitKuteSeeds.tsx`) を共有する。社内では行クリック後も同じ完全版詳細へ接続する。1シーズ=1行で、研究機関・研究者/PI・PJ状態を通常列に置き、機関/研究者/PJ有無のgroup rowは作らない。`SPS` / `M` / `P` / `R` / `S`、`TRL` / `BRL` / `GRL` / `SRL` / `HRL`、事業化フィールドと資料有無を横並び比較する。長文は省略せずセル内で折り返す。`discovery_status='discovered'` は「公開情報候補」、SPS欠損は0へ変換せず「未評価」と表示する。`axis_evidence` / `evaluator` は内部専用なので公開面へ返さない
- **KUTE公開情報の候補4件**: migration [`189_kute_public_seed_candidates.sql`](../scripts/migrations/189_kute_public_seed_candidates.sql) で「165〜220nm次世代クリーンUV面光源」「金属フリー透明フレキシブル導電膜」「塩水・交流電気分解による都市鉱山金回収」を、migration [`225_kute_public_seed_candidate_fujii.sql`](../scripts/migrations/225_kute_public_seed_candidate_fujii.sql) で「バイオガスと飼料バイオマスを同時生産する資源循環技術」を `discovery_status='discovered'` で追加する。225の後に追加された行は migration [`226_link_kute_fujii_public_seed.sql`](../scripts/migrations/226_link_kute_fujii_public_seed.sql) で `inst_kute` に紐付ける。公開情報調査の旧100点スクリーニング値はSPS/XRLへ移植せず、`seed_sps_assessments` は未登録のままにする
- **`/seeds` (全機関横断比較)**: `CockpitKuteSeeds` を `scope="all"` で全175件表示する。フラットな1行台帳を `PJ化済み → PJ化検討中 → PJなし・SPS評価済み → その他` の順に固定し (`seedListPriority()`)、同じ区分内を列ソートする。`seeds.status='spun_off'` は会社設立状態であり、AMD PJ判定には使わない。SXは会社未設立のため `discussing` / `pre_incorporation`
- **テスト**: `npm run test:kute-seeds-scope` は動的スコープとPJ優先度、公開ホワイトリストを検査する。`npm run test:institution-seed-project-domains` は物理テーブル分離、p30/p21移行、二重分類防止、全件表示、ECR/SPS非更新を検査する。`npm run test:seed-sps-score` はSPSの0/NULLと欠損軸を検査する

## トレードオフ・残課題

- **機関名の確認状態**: 大学・国研シーズ141件は46機関へ `institution_id` で紐付け済み。推定名称は `institutions.identity_status='candidate'` のまま表示し、人の確認前に確定名称へ昇格させない。PI名の表記ゆれは引き続き表示正規化だけで、DB行は統合しない
- **Venture Map との連動**: 旧 seeds は Venture Map のグラフ予兆 / レーン別 seedScore に使われていた。新 seeds は意味が違う (AMD 視点の事業化候補) ので Venture Map からは切り離した。将来「AMD が手がけそうなレーン」を Venture Map に再投入したくなったら、新 seeds から `domain_lane` × `amd_rating>=4` を集計して再接続できる
- **`milestone_responsibility` のような複数担当**: 現状 1 シーズ = 1 AMD owner。Phase 2 で `seed_owners` 表を切るか検討
- **PJ化済み/検討中シーズ**: `seed_projects` の実行・履歴がある行は最上段、商談・契約検討はその次へ上げる。カタログから別リストへ移動・複製・非表示にしない
### Seed詳細からのPJ入口 (2026-08-20 追補)

`SeedDetailModal` の接続PJリンクは `/project/{project_id}/cockpit` のみとする。ワークスペースはコックピットの「共有ワークスペースへ」から入る。これにより、シーズを確認した後に社内の判断面（cockpit）を経由してPJ実行面（workspace）へ進む。

PJワークスペースは、SX (p21) が最初に作った `SxWeeklyControlDashboard` を全PJ共通仕様として使う。全PJに `週次差分 / ガント / 関係先 / 論点・仮説 / ドライブ` のタブを表示し、ドライブは `WorkspaceDocumentRoom` を `scopeKind='project'` / `scopeId=当該PJ` / `surface='workspace'` で再利用する。共通化はタブ、配置、操作、資料室の仕様だけで、PJ固有の `project_name`、管理柱・レーン、実データ、外部workspace accountの権限絞り込みは維持する。p30の6領域など既存のDB分類を3レーンへ変換しない。
