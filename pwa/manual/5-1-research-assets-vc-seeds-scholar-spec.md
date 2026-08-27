# Seeds / PoC / VC / Scholar 詳細仕様

`/seeds` / `/poc` / `/vcs` / `/scholar` の外部探索・案件化アセット画面の開発者向け正本。 メンバー向け使い方は [2-5 章](2-5-research-assets-quick-start.md) を見る。

## 全体マップ

| 画面 | 目的 | 主な table | cron |
|---|---|---|---|
| `/seeds` | 研究シーズ (= 機関 × PI × シーズ) のマスタ | `seeds` / `seed_funding` / `seed_news` / `seed_contact_log` | `/api/cron/seeds-ingest` (停止中) |
| `/seeds/inbox` | 自動収集された未確認シーズの受信箱 | `seeds (discovery_status='discovered')` | 同上 |
| `/poc` | シーズ x PoC先のPoC案件化台帳 | `seeds` / `poc_companies` / `poc_matches` | なし |
| `/vcs` | 国内ディープテック VC マスタ | `vcs` / `vc_funds` / `vc_investments` / `vc_contacts` / `project_vc_relations` / `vc_news` | `/api/cron/vc-discover` (停止中) |
| `/vcs/inbox` | VC ニュース受信箱 | `vc_news (verified=false)` | 同上 |
| `/scholar` | 論文 / OpenAlex 由来の lane 別件数 | `papers_log` | `/api/cron/papers-quarterly-ingest` |

## Seeds 設計

### 流れ (= status 遷移)

```text
candidate (候補)
   → investigating (調査中)
   → contacted (接触済)
   → discussing (協議中)
   → spun_off (PJ 化) / declined (見送り)
```

`spun_off_project_id` で `projects` に紐付け。

### `seeds` 主要列

| column | 用途 |
|---|---|
| `title` / `summary` | シーズ識別 |
| `org_name` / `org_type` / `org_region` / `org_url` | 機関情報 |
| `researcher_name` / `researcher_title` / `lab_name` / `researcher_url` | PI 情報 |
| `domain_lane` | `gx_energy` / `gx_circular` / `life` / `materials` / `robo` / `ict` / `other` |
| `industry_target` (= `_text` 配列) / `keywords` (= `_text` 配列) | 検索性 |
| `trl` / `brl` / `hrl` | 0-9 の成熟度 |
| `status` | candidate → ... → spun_off / declined |
| `amd_rating` | 1-5 ★、 AMD 視点の相性 |
| `amd_owner_member_id` | 担当 AMD メンバー |
| `next_action` | 次の一手 |
| `internal_notes` | 非公開メモ |
| `public_summary` | 公開可能サマリ |
| `is_public` | true なら将来 URA / EIR 向けに公開可 |
| `spun_off_project_id` | PJ 化したら set |
| `source` / `source_detail` | 情報源 (= manual / cron / chat 等) |
| `deep_dive_material_url` | AMD確認済みの深掘り資料リンク。資料本文や一次ソースの生URLは置かない |
| `discovery_status` | `reviewed` (= 人確認済) / `discovered` (= cron 新規発見) / `dismissed` (= ノイズ) |

### サブテーブル

| table | 役割 | UNIQUE / 主要列 |
|---|---|---|
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等) | `seed_id` + `program` / `amount_jpy` / `fiscal_year` / `status` |
| `seed_news` | 関連ニュース / プレス / 論文 | UNIQUE `(seed_id, source_url)`、 `kind` / `title` / `body` / `occurred_on` / `verified` / `dismissed` |
| `seed_contact_log` | AMD メンバー × シーズの接触履歴 | `seed_id` + `contacted_on` / `method` / `amd_member_id` / `note` / `next_action` |

### 初回SPS評価

完全な現行SPS tupleをまだ持たないシーズだけを、初回評価の対象にできる。自動化は評価値の候補JSONを出すところまでで、source factsと監査hashは非LLM処理がpreparedから固定する。`prepare → validate → submit → apply` の順に進め、最後の`apply`だけがサービスロールRPCで凍結評価を追記する。候補後に根拠、prompt、modelが変わった場合は再prepareが必要。既に現行tupleがあるシーズは再評価導線を使う。候補ゼロ、同一候補の再submitは正常で、URL・メール・認証情報、11要因不足、数式不一致、情報締切外は検証で止まる。未評価の残数は`status`で数える（`prepare --limit`は100件が上限なので残数の確認には使えない）。帯を置くときの較正（段階仮説を資金制度から割り当てる既定値、q帯の水準、型別の要因の向き、要因10で引用してよい政策文書）は`pwa/bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md`、20件ずつ組むときの手順と検査スクリプトは`pwa/scripts/sps_batch/README.md`に置いてある。

### UI

| パス | 役割 |
|---|---|
| `/seeds` | リスト画面。検索 / フィルタ / ソート。シーズ名の左は外部サイトのfaviconではなく、技術領域 (`domain_lane`) を形と淡色で判別できるアイコン。hoverで領域名を確認でき、未分類にも共通の研究アイコンを表示する。会社名は太字で表示し、未設立は「会社名（未設立）」または「未設立」とする。PJ状態カラムは置かず、紐付く行だけ会社名セル右上の `PJ` バッジで分かる。深掘り資料は資料アイコンから開く。行クリックで `SeedDetailModal` を開き、リンクの確認・更新ができる。modal の構成はPJ化の有無で変わらない (2026-08-20〜)。新規発見は 🆕 マーク、右上「受信箱」リンク + バッジ。スコアの列は「産業創出価値(億円)」と「現在地・型」で、BZM 3.0 の算出結果を出す (2026-08-27〜。それ以前の「現行SPS(億円)」「根拠Lv」は旧モデルなので外した) |
| `/seeds/[id]` | 単独詳細ページ (= 直接 URL 用 fallback、 リストと同じ Modal の full-page 表示) |
| `/seeds/inbox` | 受信箱 (= `discovery_status='discovered'`)、 verify=`reviewed` / dismiss=`dismissed` |

### 産業創出価値（BZM 3.0）

シーズをクリックして開く詳細に、**BZM 3.0 で産業創出価値 V を算出するパネル**を常時置く（2026-08-27〜）。
一覧の「産業創出価値(億円)」列と「現在地・型」列も同じ算出結果を出す。
それ以前の「一次選別スクリーニング帯（旧SPS）」は、シーズ詳細・PJコックピットのスコア詳細タブの両方から外した
（まさ「古いモデルの試算結果は、混乱の元になるのですべて削除してほしい」）。

パネルの中身は6ブロック。**式はモデルページの正本から、係数の値は参照実装から取り、画面が数字を書き起こさない。**

1. このシーズで式に入る値がいくつ埋まっているか（記号・値・出どころ・何を調べれば埋まるか）
2. スコアの定義と、金額になるまでの道筋（式3本 + 4段の手順）
3. 型 × 規制属性 × 証拠水準ごとの v（天井1円あたりの現在価値）
4. モデルの式17本
5. 式に入る係数73件（値・根拠レベル・正本の節・効く先）
6. 計算が置いている近似6件と数値の誤差

案件ごとの入力は3つのテーブルに持つ（migration 331）。用途ごとの天井は `seed_value_ceilings`、
工程の型・規制属性・評価日の証拠水準・観測状態は `seed_bzm30_inputs`、算出結果は `seed_bzm30_scores`。
算出は `model/tools/bzm30_score_seeds.cjs`（1件2〜3分かかるので画面のリクエストでは走らせない）。

**2026-08-27 時点で金額は伏せている。** 一度算出したが、OS にある資金繰り・議事録・契約・知財・
創業メンバーを読まずに XRL と月報1か月分だけで入力を決めていて、実データと大きくずれていたため
（`pwa/src/lib/bzm30/seed-inputs.ts` の `BZM30_SCORES_PUBLISHED`）。入力を埋め直して再計算したら戻す。
入力の充足の表・式・係数は伏せていない。

詳細仕様は `pwa/spec` の「4-8 BZM 3.0 スコアパネル」。

### Phase 進捗

| Phase | 状態 | 内容 |
|---|---|---|
| Phase 1 | ✅ 2026-05-08 完了 | migration 024、 旧 seeds drop + 新 schema、 Venture Map 切り離し、 list/modal/inbox |
| Phase 2 | 🟡 一部 | seeds-ingest cron 実装あり (= 但し 2026-05-22 以降停止)、 inbox バッジ、 既存 PJ 逆引き未実装、 HSFC 残 23 件 / さきがけ 175 件未収集 |
| Phase 3 | 🚧 TODO | researchmap / OpenAlex 発掘 cron、 つくよみ chat tool 群、 URA / EIR 公開、 機関別ダッシュボード |

### cron `/api/cron/seeds-ingest` (= 停止中)

旧 schedule: 毎週 月曜 09:00 JST。 Claude Sonnet + `web_search_20250305` で 7 ソース (= GAP / NEP / AMED / D-Global / CREST / 創発 / 先導研究) 巡回 → `discovery_status='discovered'` で投入。

2026-05-22 以降 LLM / web_search 課金回避で自動 schedule 停止。 route は残してるので手動 review batch から起動可能 ([6-1 章](6-1-operations-settings-spec.md))。

## PoC 案件化設計

PoC は Seeds の下流で、研究シーズとPoC先を一次入力として持ち、その掛け合わせからヒアリング・有償PoC・契約へ進めるための台帳。2026-07-09 のPoCサービスMTGを起点に追加し、同日に一次入力を `シーズ` / `PoC先` へ整理した。

### スキーマ

| table | 役割 |
|---|---|
| `seeds` | 研究シーズ正本。PoC画面からも追加でき、シーズ名、機関、研究者、領域、用途、キーワード、次アクションを持つ |
| `poc_companies` | PoC先マスタ。企業、事業所、組合、自治体、施設カテゴリなど、PoCを受ける側の名称、規模感、業界タグ、地域、PoC相性、過去PoC/紹介経路、謝礼メモ、担当、次アクション |
| `poc_matches` | シーズ x PoC先の案件候補。`seed_id`、`company_id`、任意の `project_id`、相性仮説、ヒアリング論点、PoC目標、謝礼、契約、資金、収益分配、状態、優先度 |

### 状態

PoC先:

```text
candidate -> listed -> contacted -> hearing -> poc_ready -> archived
```

案件候補:

```text
candidate -> hearing_design -> introduced -> hearing_done
  -> poc_design -> poc_running -> deal / archived
```

### UI

| パス | 役割 |
|---|---|
| `/poc` | PoC案件化 hub。上段メトリクス、検索、状態フィルタ、シーズ追加、PoC先追加、PoC先候補リスト、案件化キュー、案件候補一覧、PoC先一覧 |

### Source Hygiene

- Notion議事録、Gmail、Slack、Drive、Webの本文やURLを `poc_*` に保存しない
- `source_ref` / `source_note` は短い参照名だけにする
- 議事録由来の内容は、相性仮説、ヒアリング論点、契約/資金/収益分配メモ、次アクションへ変換して保存する

## VC 設計

### スキーマ

| table | UNIQUE / 主要列 | 役割 |
|---|---|---|
| `vcs` | UNIQUE `(name)`, UNIQUE `(slug)` | VC 本体 + `amd_rating` (= ★1-5) + `thesis` / `stage_focus` / `ticket_min_jpy` / `ticket_max_jpy` / `investment_constraints` |
| `vc_funds` | UNIQUE `(vc_id, fund_no)` | ファンド単位 + `dry_powder_jpy_low` / `_high` (= DPE 残)、 `dry_powder_source` (= `estimated` / `heard_from_contact` / `public_disclosure`)、 `dry_powder_heard_from` (= `vc_contacts.id`) |
| `vc_investments` | per investment | 出資イベント。 `our_project_id` で自社 PJ にリンク可 |
| `vc_contacts` | per contact | VC 担当者 |
| `project_vc_relations` | UNIQUE `(project_id, vc_id)` | PJ × VC のステータス管理 |
| `vc_news` | UNIQUE `(vc_id, source_url)` | VC ニュース。 `verified=true` で採用、 `dismissed=true` でノイズ |

### 「ファンドサイズ vs DPE 残」分離

公表値 (= `vc_funds.size_jpy`) と推定値 (= `dry_powder_jpy_low/high`) を別列で持つ。 「ファンドサイズは公表、 DPE は推定 or 直聞き」を明確に分離。

### `dry_powder_source` の値

| value | 意味 |
|---|---|
| `estimated` | こちらの推定 (= fund_no × 標準的な投資ペース 等) |
| `heard_from_contact` | 担当者から直接聞いた (= `dry_powder_heard_from=vc_contacts.id`) |
| `public_disclosure` | プレス / 公式発表 |

### UI

| パス | 役割 |
|---|---|
| `/vcs` | リスト。 default sort: 接点数降順 (= `project_vc_relations` 件数)。 他: 最終接触 / DPE 残 / ★ / vintage / 名前 |
| `/vcs/[id]` | 4 ペイン詳細 (= VC + ファンド + 接点 + ニュース) |
| `/vcs/[id]/edit` | 手入力 CRUD |
| `/vcs/inbox` | 未確認ニュース受信箱、 `vc_news.verified=false` |

### cron `/api/cron/vc-discover` (= 停止中)

旧 schedule: 毎週土 09:00 JST。 Claude Sonnet 4.6 + `web_search_20250305` (= max_uses 6) で「直近 7 日の国内 VC 業界ニュース」を業界横断で 10-18 件取得。

処理:

1. 取得ニュースの `vc_name` を既知 `vcs` リストと突合
2. 既知 VC → `vc_news` に追加 (= `ingested_by='discover_cron'` / `verified=false`)
3. 未知 VC → `vcs` に新規 stub 追加 + `vc_news` 追加 + `app_notifications` で「新 VC 発見」通知
4. `kind ∈ {fundraise, fund_close}` なら `suggested_fund_patch` JSONB に「このファンドをこう更新」を埋める
5. `/vcs/inbox` で人が verify / dismiss / 「ファンド反映」ボタン 1 クリック → `vc_funds` に反映

2026-05-22 以降 LLM / web_search 課金回避で自動 schedule 停止。

### 初期投入

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://amd-os-pwa.vercel.app/api/admin/seed-vcs
```

Claude + web_search に「国内ディープテック VC 25-40 社」を JSON 生成させて `vcs` / `vc_funds` / `vc_investments` を upsert。 重複 (= `name` 一意) は更新、 新規は insert。 `amd_rating` は人付与なので seed では触らない。

### つくよみ chat 統合

`/api/tsukuyomi/chat` に VC tool 群:

- `upsert_vc` / `upsert_vc_fund` / `update_vc_dry_powder`
- `add_vc_investment` / `add_vc_contact` / `add_vc_news` / `link_project_vc`

ページ context: `page_path` が `/vcs/[uuid]` で始まれば `loadVcContext()` で当該 VC を system prompt に同梱。

例: 「Abies の 2 号担当の田中さんから残り 30 億って聞いた」と書くと、 つくよみが:

1. `add_vc_contact(vc_name='Abies Ventures', name='田中')` (= なければ)
2. `update_vc_dry_powder(vc_name='Abies Ventures', fund_no=2, dry_powder_jpy_low=3000000000, dry_powder_jpy_high=3000000000, source='heard_from_contact', contact_name='田中')`

の 2 ステップで自動反映する。

## Scholar 設計

### `papers_log` 列

| column | 用途 |
|---|---|
| `lane` | ASPI 8 domain (= [`pwa/design/aspi_lanes.md`](../design/aspi_lanes.md)) |
| `observed_at` | 観測日 (= 四半期末日) |
| `paper_count` | 該当 lane × 期間の論文件数 |
| `source` | `openalex` / `pubmed` / 等 |
| `query_hash` | クエリの hash (= 同一クエリの再観測判定) |
| UNIQUE | `(lane, observed_at)` |

### cron `/api/cron/papers-quarterly-ingest`

- cadence: quarterly (= 四半期 1 回)
- input: OpenAlex API (= lane 別 keyword クエリ)
- output: `papers_log` insert
- Run Now: `/admin/settings` の Cron Control から admin がキック可能 ([6-1 章](6-1-operations-settings-spec.md))

### UI

`/scholar` は lane 別に paper_count の時系列を線グラフ + 四半期ごとの差分テーブル。 「どの lane が論文増えてる」を一目で見るための画面。

## RLS

4 アセット全テーブルで共通パターン (= `016_vc_list.sql` / `017_vc_rls_writes.sql` / `167_poc_matching.sql`):

- `anon_read` = SELECT 全開
- `authenticated_all` = `auth.uid() IS NOT NULL` なら ALL
- `service_role_bypass` = cron route 用

ただし、 admin-only restriction を 2026-05-20 以降 strengthen している (= 一部テーブル)。 詳細は migration を見る。

## 共通設計トレードオフ

| 論点 | seeds | vcs |
|---|---|---|
| 表記ゆれ | 機関 / PI 名 (= 「愛媛大」「愛媛大学」) | VC 名 (= `name` UNIQUE で吸収、 検出時に既存 stub 突合) |
| データソース | 公的採択 DB + web_search + 手入力 | web_search + chat + 手入力 |
| 公開 | Phase 1 = AMD 内部、 `is_public` で Phase 2 URA 拡張 | AMD 全員閲覧可、 role gate なし |
| ★ 評価 | `amd_rating` 1-5 | `amd_rating` 1-5 + 更新者 / 時刻記録 |

## トラブル時

| 症状 | 確認場所 |
|---|---|
| `/seeds/inbox` が空 | `discovery_status='discovered'` の有無、 `/api/cron/seeds-ingest` 実行履歴 |
| `/poc` の案件化キューが空 | `seeds` と `poc_companies` の有効データがあるか、PoC先タグ・検索・状態フィルタで絞りすぎていないか |
| 新 VC が `/vcs` に出ない | `vcs.slug` 重複、 `vc_news` 紐付け、 inbox での verify 漏れ |
| `/scholar` の paper_count が古い | 直近の `papers_log.observed_at`、 quarterly cron 実行履歴 |
| つくよみ chat で VC 自動更新が走らない | `/api/tsukuyomi/chat` の tool registration、 system prompt に context 注入 |
| 既存 PJ への spun_off 紐付けが効かない | `seeds.spun_off_project_id`、 `projects.project_id` の一致 |

## 関連

- 2-5 章 [探索系アセットの使い方](2-5-research-assets-quick-start.md) (= ユーザー視点)
- 設計: [`pwa/design/seeds.md`](../design/seeds.md)
- 設計: [`pwa/design/poc_matching.md`](../design/poc_matching.md)
- 設計: [`pwa/design/vc_list.md`](../design/vc_list.md)
- 設計: [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md) (= Atlas との分離経緯)
- 4-2 章 [Atlas / Macrotrend 詳細仕様](4-2-atlas-macrotrend-signal-spec.md)
- 5-2 章 [HUD / Venture Map 仕様](5-2-hud-and-venture-map-spec.md) (= 旧 seeds 切り離し履歴)
- 6-1 章 [Operations Settings](6-1-operations-settings-spec.md) (= cron 復活方法)
