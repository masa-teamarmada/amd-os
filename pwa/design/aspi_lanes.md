# ASPI Critical Technology Tracker — AMD OS lane 正本

作成: 2026-05-11 (pensive-engelbart-7672ca セッション)
位置付け: AMD OS の **PJ lane / 観測量 lane の正本**。論文 / 国際統計と整合させるため、AMD 独自 5 lane (gx_energy / gx_circular / materials / life / robo) を **ASPI Critical Technology Tracker の 8 domains** に揃える。

## なぜ ASPI 8 domain を採用するか

旧 5 lane は AMD の 9 PJ retrofit に合わせて作った都合のもので、**論文世界の標準分類と整合しない**。観測量 (B 公募予算 / V VC 投資 / I_R 研究費) を取得するときに各機関 (KAKEN / NEDO / Crunchbase) の分類体系と接続できない問題がある。

ASPI Critical Technology Tracker は:

- 2023 launch、2024-08 で 21 年分データ (2003-2023) に拡張、2025-12 update で 64 → 74 tech に拡張
- Web of Science Core Collection の top 10% 被引用論文ベース
- 国別 / 機関別の研究 leader が公開ランキングで見える
- KAKEN 大区分 11 / NEDO TSC 14 / Crunchbase Industries との対応表が ASPI 自身で整備されてる
- deeptech / 安全保障 / 経済安保 文脈で 2024 以降の世界標準引用

→ **論文 (N) cron の集計、政策 (P) atlas、未取得の B / V / I_R を取りに行くときに「どの分類で API を叩くか」「lane に再マッピングするとき何を見るか」がすべて整合する**のが ASPI 採用の最大メリット。

参照:
- 公式 PDF: ASPI's two-decade Critical Technology Tracker (2024-08), Wong Leung / Robin / Cave
- 2025 update: <https://www.aspistrategist.org.au/aspis-critical-technology-tracker-2025-updates-and-10-new-technologies/>
- Methodology: <https://techtracker.aspi.org.au/methodology>

---

## 8 domains × 64 tech (2024 公式) + 10 tech (2025 update)

domain id (実装で使う snake_case) は AMD OS 内部の DB enum / TS LaneId として使う:

### 1. `advanced_ict` — Advanced information and communication technologies (7 + 3)

- Advanced optical communication
- Advanced radiofrequency communication
- Advanced undersea wireless communication
- Distributed ledgers
- High performance computing
- Mesh and infrastructure independent networks
- Protective cyber security technologies
- (2025 +) Cloud and edge computing
- (2025 +) Digital twins
- (2025 +) Extended reality

### 2. `advanced_materials_manufacturing` — Advanced materials and manufacturing (13)

- Additive manufacturing
- Advanced composite materials
- Advanced explosives and energetic materials
- Advanced magnets and superconductors
- Advanced protection
- Coatings
- Continuous flow chemical synthesis
- Critical minerals extraction and processing
- High-specification machining processes
- Nanoscale materials and manufacturing
- Novel metamaterials
- Smart materials
- Wide and ultrawide bandgap semiconductors

### 3. `ai_technologies` — AI technologies (6 + 3)

- AI algorithms and hardware accelerators
- Advanced data analytics
- Advanced integrated circuit design and fabrication
- Adversarial AI
- Machine learning
- Natural language processing
- (2025 +) Computer vision
- (2025 +) Generative AI

### 4. `biotechnology` — Biotechnology, gene technologies and vaccines (7 + 2)

- Biological manufacturing
- Genetic engineering
- Genomic sequencing and analysis
- Novel antibiotics and antivirals
- Nuclear medicine and radiotherapy
- Synthetic biology
- Vaccines and medical countermeasures
- (2025 +) Brain-computer interfaces
- (2025 +) Neuroprosthetics

### 5. `defence_space_robotics_transport` — Defence, space, robotics and transportation (7 + 1)

- Advanced aircraft engines
- Advanced robotics
- Autonomous systems operation technologies
- Drones, swarming and collaborative robots
- Hypersonic detection and tracking
- Small satellites
- Space launch systems
- (2025 +) Precision agriculture

### 6. `energy_environment` — Energy and environment (8 + 2)

- Biofuels
- Directed energy technologies
- Electric batteries
- Hydrogen and ammonia for power
- Nuclear energy
- Nuclear waste management and recycling
- Photovoltaics
- Supercapacitors
- (2025 +) Grid integration technologies
- (2025 +) Geoengineering

### 7. `quantum` — Quantum (4)

- Post-quantum cryptography
- Quantum communication
- Quantum computing
- Quantum sensors

### 8. `sensing_timing_navigation` — Sensing, timing and navigation (9)

- Atomic clocks
- Gravitational-force sensors
- Inertial navigation systems
- Magnetic field sensors
- Multispectral and hyperspectral imaging sensors
- Photonic sensors
- Radar
- Satellite positioning and navigation
- Sonar and acoustic sensors

### (cross-cutting) `aukus_unique` — Unique AUKUS-relevant technologies (3)

ASPI 自身は 8 domain の外に「AUKUS-relevant」として 3 tech を別建て。AMD OS では当面 cross-cutting タグ扱いで、PJ lane としては使わない。

- Air-independent propulsion
- Autonomous underwater vehicles
- Electronic warfare

---

## 旧 AMD lane → ASPI 8 domain mapping (1:1)

| 旧 5 lane | 新 ASPI 8 domain |
|---|---|
| `gx_energy` | `energy_environment` |
| `gx_circular` | `energy_environment` (まさ判断 2026-05-11、ASPI には circular 独立 domain なし、energy/env に統合) |
| `materials` | `advanced_materials_manufacturing` |
| `life` | `biotechnology` |
| `robo` | `defence_space_robotics_transport` |

旧 5 lane で取れていなかった新 domain (将来枠):

- `advanced_ict` ─ 通信・暗号領域、現状該当 PJ なし
- `ai_technologies` ─ AI/ML 領域、現状該当 PJ なし、ICT/AI を旧 robo に押し込んでた事故を解消
- `quantum` ─ 量子領域、現状該当 PJ なし
- `sensing_timing_navigation` ─ センシング領域、現状該当 PJ なし (将来 SX 環境センシングで関連の可能性)

---

## lanes は weight 付き多重所属 (まさ判断 2026-05-11)

PJ が**複数 domain にまたがる**ケースを表現するため、`project_ventures.lanes` を JSONB 配列で持つ:

```json
[
  {"domain": "advanced_materials_manufacturing", "weight": 0.5},
  {"domain": "energy_environment", "weight": 0.5}
]
```

制約:

- weight 合計 = 1.0 (± 0.001 で許容)
- weight ∈ [0, 1]
- domain は ASPI 8 domain enum の値のみ
- 配列長は 1 ~ 3 (4 以上は粒度過多)

観測量 (papers / atlas / 将来 B/V/I_R) の集計時は **weighted contribution で按分**:

```
domain D の papers count(t)  =  Σ_p ( papers_p(t) × weight_{p,D} )
```

これにより p07 LiSTie (国産リチウム + 核融合) は advanced_materials の N (論文) と energy/env の B (公募予算) の両方を 0.5 ずつ寄与する形で μ_A/I/G に効く。

---

## 10 PJ 確定 mapping (2026-05-11、まさ承認)

| project_id | display_name | 旧 lane | 新 lanes |
|---|---|---|---|
| p03 | ティエムファクトリ (透明断熱 PMSQ) | materials | `[{advanced_materials_manufacturing: 1.0}]` |
| p04 | 輝翠TECH (月面探査 → 農業ロボ) | robo | `[{defence_space_robotics_transport: 1.0}]` |
| p06 | CrestecBio (創薬) | life | `[{biotechnology: 1.0}]` |
| p07 | LisTie (国産リチウム + 核融合) | gx_circular | `[{advanced_materials_manufacturing: 0.5}, {energy_environment: 0.5}]` |
| p09 | JOYCLE (廃棄物 deep化) | gx_circular | `[{energy_environment: 1.0}]` |
| p11 | Blue Water Energy (RED 海水温度差発電) | gx_energy | `[{energy_environment: 1.0}]` |
| p18 | Yellow Duck (波力発電) | gx_energy | `[{energy_environment: 1.0}]` |
| p20 | CryoX (磁気冷凍 NIMS) | gx_energy | `[{advanced_materials_manufacturing: 0.5}, {energy_environment: 0.5}]` |
| p21 | SolvioraX (環境系 PSI) | gx_circular | `[{energy_environment: 1.0}]` |
| p24 | チャレナジー (垂直軸風車) | gx_energy | `[{energy_environment: 1.0}]` |

新規 PJ 起こすときは:

1. **LLM 推定**: PJ 概要・関連論文・関連政策を入力に、ASPI 8 domain × 64+10 tech のどれに該当するかを Sonnet が推定 → candidate を出す
2. **まさ承認**: PJ 台帳の lane 編集 UI で candidate を確認、必要なら weight を調整して保存

(この LLM 推定 cron は別セッションで実装、本セッションは手動 seed のみ)

---

## 影響範囲 (5 → 8 lane 移行で書き換えが必要なファイル)

このセッションで対応:

- [`pwa/scripts/migrations/041_project_lanes_aspi.sql`](../scripts/migrations/041_project_lanes_aspi.sql) (新規) ─ `project_ventures.lanes JSONB` 追加 + 10 PJ seed + check constraint
- [`pwa/src/components/admin/AdminProjectsTable.tsx`](../src/components/admin/AdminProjectsTable.tsx) ─ lanes 列追加 + cell 編集
- [`pwa/src/app/(app)/admin/projects/page.tsx`](../src/app/(app)/admin/projects/page.tsx) ─ project_ventures を fetch して lanes を渡す
- [`pwa/src/components/venture-map/AmdScoreList.tsx`](../src/components/venture-map/AmdScoreList.tsx) ─ lane 表示を lanes badge に変更
- [`pwa/src/lib/venture-map-data.ts`](../src/lib/venture-map-data.ts) ─ `LaneId` type を ASPI 8 domain に拡張、`VentureRow.lanes` 追加 (旧 lane TEXT は当面残す)

別セッションで段階対応 (5 lane 触ってる残り):

- `pwa/src/app/api/cron/papers-quarterly-ingest/route.ts` ─ OpenAlex キーワード集合を ASPI 64+10 tech ベースに置換
- `pwa/src/lib/triple-helix-observations.ts` ─ atlas domain → ASPI lane mapping を更新
- `pwa/src/app/api/cron/relearn-lane-weights/route.ts` ─ LANES 配列 (5 → 8) + Sonnet プロンプト更新
- `pwa/src/app/api/cron/macro-backfill-historical/route.ts` ─ lane 単位の backfill ロジック
- `pwa/src/components/venture-map/SuDetailView.tsx` / `Timeline3DView.tsx` / `VentureMapView.tsx` ─ UI 表示
- `pwa/src/lib/venture-status-data.ts` / `narrative-generator.ts` / `narrative-refresh.ts` / `amd-score-l2-extract.ts` ─ lane 文字列の使い回し
- `seeds-ingest` / `venture-xrl-refresh` cron ─ 同上
- `seeds` 関連 (LaneId 由来の filter) ─ 同上
- migration 006 / 007 / 008 / 024-032 / 035 の lane 値 (履歴 seed) ─ 過去履歴は触らない、新規分のみ ASPI で

---

## 観測モデルとの接続

`triple_helix_loading` (migration 038) は観測量行毎の C 行列 prior で **lane に依存しない** のでこの移行で変更不要。

ただし `papers_log` (lane × quarter) の lane 軸が 5 → 8 に拡張されるので、新 cron で 8 lane 分の N を取得して seed する必要がある。これは Phase 2 の作業として別セッション。

---

## Changelog

| 日付 | 変更 | 担当 |
|---|---|---|
| 2026-05-11 | 初版。ASPI 8 domain × 64+10 tech の正本化、旧 5 lane → 新 lane mapping 確定、10 PJ 確定 lanes JSONB seed | えいみ + まさ判断 |

---

## Phase 2 (2026-05-11、本 commit) — 完全実装

### 実装した cron 4 つ + lib / UI 更新

#### Phase 2-A: 既存 cron / lib を ASPI 8 domain 対応

| ファイル | 変更内容 |
|---|---|
| [`pwa/src/lib/aspi-lanes.ts`](../src/lib/aspi-lanes.ts) | `LEGACY_LANE_TO_ASPI` / `ASPI_TO_LEGACY_LANE` / `dominantDomain()` / `weightForDomain()` helper + `OPENALEX_QUERY_BY_DOMAIN` / `KAKEN_KEYWORDS_BY_DOMAIN` / `GRANT_KEYWORDS_BY_DOMAIN` (8 domain × tech) 追加 |
| [`migration 042`](../scripts/migrations/042_aspi_lane_observation_logs.sql) | papers_log / macro_index_log の旧 5 lane → ASPI 8 domain rewrite (合算 + DELETE)、macro_lane_weights を 8 domain で再 seed、observation_log + lane_suggestions 新規、triple_helix_loading.available を B/V/I_R 全 TRUE に |
| [`papers-quarterly-ingest`](../src/app/api/cron/papers-quarterly-ingest/route.ts) | LANE_QUERIES (旧 5 lane) → ASPI 8 domain × OpenAlex キーワードで fetch |
| [`triple-helix-observations.ts`](../src/lib/triple-helix-observations.ts) | lane を AspiDomainId 受け取り、`LANE_DOMAIN_PREFIXES` を ASPI 8 domain × atlas domain に対応、C_compete を lanes JSONB weighted で集計、observation_log (B/V/I_R) を読む |
| [`relearn-lane-weights`](../src/app/api/cron/relearn-lane-weights/route.ts) | LANES 配列を ASPI 8 domain に拡張、Sonnet プロンプトの domain priors を 8 domain × 日本政策コンテキストに更新 |
| [`macro-backfill-historical`](../src/app/api/cron/macro-backfill-historical/route.ts) | LANE_CONTEXT を 8 domain × Japan policy milestones (advanced_ict / advanced_materials_manufacturing / ai_technologies / biotechnology / defence_space_robotics_transport / energy_environment / quantum / sensing_timing_navigation) に書き換え |

#### Phase 2-B: 新規 PJ LLM lane 推定 cron + admin UI

- [`cron/lane-suggest`](../src/app/api/cron/lane-suggest/route.ts) ─ project_ventures.lanes IS NULL の PJ に対し Sonnet 4.5 で ASPI 8 domain weighted lane を推定 → `lane_suggestions` テーブルに status='pending' で保存 + `l2_notifications` (kind='lane_suggestion') に通知 push。weight 合計 1.0 正規化 + 端数吸収。
- [`admin/projects`](../src/app/(app)/admin/projects/page.tsx) ─ AdminProjectsPage で lane_suggestions (pending) を fetch、AdminProjectsTable の Lane セル内に「💡 LLM 提案 (badge + confidence% + reasoning + 採用/却下 ボタン)」を表示。採用ボタンで project_ventures.lanes 書き戻し + status='approved'、却下ボタンで status='rejected'。
- cron 登録: weekly (推奨 月曜 04:30 JST)。Vercel Hobby 制約のため当面 GAS trigger or 手動キックで起動。

#### Phase 2-C: KAKEN ingest (I_R 研究費)

- [`cron/kaken-ingest`](../src/app/api/cron/kaken-ingest/route.ts) ─ 各 ASPI 8 domain × 直近 16 quarter に対し Sonnet 4.5 + **Anthropic `web_search_20250305` tool (max_uses=3) で KAKEN / JSPS 科研費年次配分統計を 2-3 件 web_search → 桁感を実数値に anchoring** した上で配分額 (億円) を推定 → `observation_log` (key='I_R', source='kaken') に upsert。raw_meta に grant_count, estimator, quarter を保存。
- 注: KAKEN 公開 API は限定的なので Phase 2-C 初版は **web_search hybrid LLM 推定**で代替 (2026-05-11)。将来 Phase 2-C2 で `https://nrid.nii.ac.jp/opensearch/?format=json&kw=<keyword>` 等の OpenSearch endpoint 直接 fetch を追加可能。
- cron 登録: weekly (推奨 月曜 04:00 JST)。

#### Phase 2-D: NEDO/JST/AMED ingest (B 公募予算)

- [`cron/grant-ingest`](../src/app/api/cron/grant-ingest/route.ts) ─ 各 ASPI 8 domain × 直近 16 quarter に対し Sonnet 4.5 + **Anthropic `web_search_20250305` tool (max_uses=3) で NEDO / JST / AMED 採択ページを 2-3 件 web_search → 桁感を実数値に anchoring** した上で NEDO / JST / AMED / SIP / ムーンショット 採択額 (億円) を推定 → `observation_log` (key='B', source='grant') に upsert。raw_meta に adopted_count, agency_mix を保存。
- HTML scrape は機関ごとに構造異なるため、Phase 2-D 初版は **web_search hybrid LLM 推定**で代替 (2026-05-11)。将来 Phase 2-D2 で各機関の採択リスト scrape (cheerio 等) を追加可能。
- cron 登録: weekly (推奨 月曜 04:15 JST)。

#### Phase 2-E: VC 投資 ingest (V VC 投資)

- [`cron/vc-investment-ingest`](../src/app/api/cron/vc-investment-ingest/route.ts) ─ 既存 vc_news (直近 200 件) を context として Sonnet 4.5 に渡し、各 ASPI 8 domain × 直近 16 quarter の VC 投資総額 (億円) を推定 → `observation_log` (key='V', source='vc_news') に upsert。
- Crunchbase / INITIAL の有償 API が使えない期間の代替実装。Phase 2-E2 で Crunchbase 統合可能 (構造同じ)。
- cron 登録: weekly (推奨 月曜 04:45 JST)。

### Schema 拡張 (migration 042 で実装済)

#### `observation_log` (統合観測量テーブル、新規)

```
observation_log
- id UUID PK
- lane TEXT (ASPI 8 domain id)
- observed_at DATE (quarter 開始日)
- observation_key TEXT ('I_R' / 'B' / 'V')
- value NUMERIC (観測値)
- unit TEXT ('億円' / '件')
- source TEXT ('kaken' / 'grant' / 'vc_news')
- raw_meta JSONB (件数 / 機関別按分 / estimator 等)
- computed_at TIMESTAMPTZ
UNIQUE (lane, observed_at, observation_key, source)
```

#### `lane_suggestions` (LLM lane 推定 candidate、新規)

```
lane_suggestions
- id UUID PK
- project_id TEXT (FK projects.project_id)
- suggested_lanes JSONB ([{domain, weight}])
- reasoning TEXT
- model TEXT
- confidence NUMERIC (0-1)
- status TEXT ('pending'/'approved'/'rejected'/'superseded')
- created_at / reviewed_at / reviewer
```

### 観測量カバレッジ (Triple Helix M カード) — 7/7 完備

| 観測量 | データソース | 状態 |
|---|---|---|
| **N** (論文) | OpenAlex → papers_log (ASPI 8 domain × quarter, weekly) | ✅ |
| **P** (政策) | atlas_signals.source_type='policy' OR domain LIKE 'B.%' | ✅ |
| **R** (言及) | atlas_signals.source_type='news' (ASPI lane atlas prefix hit のみ) | ✅ |
| **C_compete** | project_ventures.lanes (weighted alive count) | ✅ |
| **B** (予算) | observation_log (key=B, source=grant) ← grant-ingest cron | ✅ Phase 2-D |
| **V** (VC) | observation_log (key=V, source=vc_news) ← vc-investment-ingest cron | ✅ Phase 2-E |
| **I_R** (研究費) | observation_log (key=I_R, source=kaken) ← kaken-ingest cron | ✅ Phase 2-C |

### cron 起動について

Vercel Hobby plan は daily 1 回まで cron 制限。新 cron 4 つ (`/api/cron/lane-suggest` `/kaken-ingest` `/grant-ingest` `/vc-investment-ingest`) は当面:

1. 本体 GAS の 154_PwaCronCaller.js 系に新 trigger function (例: `nav_pwa_pingLaneSuggest` 等) を追加して週次トリガー
2. または手動キック (curl) で運用検証 (推奨初手)

```sh
URL="https://amd-os-pwa.vercel.app"
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | sed 's/^CRON_SECRET=//' | tr -d '"')
curl -sL "$URL/api/cron/lane-suggest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/kaken-ingest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/grant-ingest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/vc-investment-ingest" -H "Authorization: Bearer $SECRET" | jq
```

