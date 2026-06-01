# AMD Management Score — 経営状況スコア設計

作成: 2026-05-18
正本ステータス: 初版設計。実装時はこの md と同じ commit で migration / UI / cron を更新する。

---

## 何を解くか

AMD Score は PJ / SU 単位の価値評価であり、Before Zero Theory v3.2 の 7 軸 Cobb-Douglas 指標。

本設計の `AMD Management Score` は、それとは別に **株式会社チームアルマダ全体の経営状態** を見る。足元の月次収支だけでなく、AMD が先手を打てているか、既存 PJ が続くか、新規案件が増えるか、そして AMD が目指す方向へ近づいているかを 1 画面で評価する。

目的は「いい点数を出すこと」ではなく、毎月まさが次の問いに答えられること:

- 今月の AMD は、経営状態として良くなったか / 悪くなったか
- 何が点数を上げ、何が点数を下げたか
- 次にどこへ介入すれば一番効くか
- 足元の売上は良くても、長期の方向性からズレていないか

---

## 基本方針

### 1. 既存 AMD Score を潰さない

`AMD Score` は PJ / SU の価値評価として使い続ける。`AMD Management Score` は会社全体の経営スコアであり、必要に応じて PJ 別 AMD Score を入力の一部として参照する。

```text
AMD Score              = PJ / SU の価値・成熟度
AMD Management Score   = AMD 会社全体の経営健康度
```

### 2. 総合点より根拠ログを重視する

総合点は 0-100 で表示する。ただし、日常運用で重要なのは内訳と根拠:

- 5 軸の breakdown
- 上げ要因 / 下げ要因
- 根拠 source refs
- 次の一手

「なぜその点か」を追えないスコアは使わない。

### 3. GAS 月次試算表は予算、freee は実績、OS は予実管理を担当する

既存 GAS Web App の月次試算表を OS に移植し、予算 / 計画の正本として扱う。freee API は会社全体の月次収支実績を取るのに使う。AMD OS は両者を突き合わせ、予実差分・差分理由・runway を見る場所にする。

```text
GAS 月次試算表     = 予算 / 計画
freee API          = 実績
AMD OS             = 予実管理 + 経営スコア
```

PJ 別の未来収支・継続予測は、`billing_cycles` / project L2 / meeting summary も併用する。会話抽出は主予算表ではなく、予算に未反映の予定・大型支出・売上見込みを検出する補助線に回す。

2026-05-18 時点で、GAS source snapshot は `_external_gas/monthly-pl-script` に保存済み。既存 GAS は単なる月次表ではなく、PJ 売上・固定費・変動費・借入・スポット収支・税金・cash / runway まで含むシミュレーターなので、`finance_score` は `company_budget_actual_monthly` だけでなく、`company_budget_simulation_runs` の runway / cash forecast も入力にする。

### 4. ルールベースから始め、あとで LLM/統計を足す

初期実装は説明可能なルールベースで良い。根拠ログを保存しておけば、後から重み・確率・LLM 評価を差し替えられる。

### 5. スコア算出前に raw signal を保存する

スコア計算は既存テーブルをその場で直接読むのではなく、まず `amd_management_score_raw_signals` に月次の raw signal として取り込む。

理由:

- 5軸ごとの入力データ欠損を見える化できる
- スコア式を変更しても、当時の根拠 payload を追える
- freee / OS内L2 / Atlas / Seeds / billing など source の鮮度と失敗を分けて扱える
- LLM による根拠要約を後段に置ける

取り込み実行ログは `amd_management_score_source_runs` に保存する。freee が token 期限切れなどで失敗しても、OS 内部データの取り込みは `partial` として残す。

---

## 5 軸

| 軸 | 意味 | 初期重み | 主な入力 |
|---|---|---:|---|
| 先手力 | AMD が受け身ではなく、案件・PJ・交渉を前に動かしているか | 25% | `member_activities.initiative_origin / impact / depth` |
| 財務耐久 | 月次収支、予実差分、請求、入金、バーン、runway が健全か | 25% | GAS 月次試算表, freee, `billing_cycles`, `company_budget_actual_monthly`, `company_finance_*` |
| 既存 PJ 継続/伸長 | いまの売上・支援 PJ が続くか、伸びるか、落ちそうか | 20% | `projects`, `value_*`, `milestone_monthly_progress`, `project_meeting_summaries`, freeze 履歴 |
| 新規案件獲得 | 次の売上・SU候補・相談が増えているか | 15% | `seeds`, `project_registry_diffs`, `project_knowledge`, Gmail/Slack/Notion/Calendar/Drive L2 |
| 戦略接近度 | AMD が目指す方向、Deeptech startup studio としての勝ち筋へ近づいているか | 15% | `amd_score_inputs`, `protocols`, `project_ventures`, `seeds`, Atlas / macro signals |

## Raw Data Intake

実装:

- API: `/api/cron/management-score-raw-data`
- local command: `npm run collect:management-score-raw -- --ym=YYYYMM`
- freee も含める場合: `npm run collect:management-score-raw -- --ym=YYYYMM --include-freee`

保存先:

| table | 役割 |
|---|---|
| `amd_management_score_source_runs` | raw data intake の実行ログ。`success` / `partial` / `failed` と source 別件数・エラーを保存 |
| `amd_management_score_raw_signals` | スコア算出前の月次 signal。axis / source_table / source_id / signal_key / value / payload / source_hash を保持 |
| `company_actual_monthly` | freee 試算表APIから正規化した月次実績 |

初期 intake source:

| axis | source |
|---|---|
| initiative | `member_activities` |
| finance | `company_budget_actual_monthly`, `company_actual_monthly`, `billing_cycles`, `company_finance_recurring_items`, `company_finance_receipt_events`, freee `trial_pl` |
| retention | `projects`, `milestone_monthly_progress`, `project_freeze_periods`, `project_meeting_summaries`, `project_knowledge` |
| pipeline | `seeds`, `seed_contact_log`, `project_registry_diffs`, `project_knowledge` |
| direction | `amd_score_inputs`, `protocols`, `project_ventures`, `atlas_signals`, `macro_index_log` |

初期式:

```text
total_score =
  0.25 * initiative_score
+ 0.25 * finance_score
+ 0.20 * retention_score
+ 0.15 * pipeline_score
+ 0.15 * direction_score
```

### 財務による足切り

財務は通常の重み計算だけではなく、足切りも持つ。runway が短い、請求遅延が多い、入金見込みが薄い場合、他軸が良くても総合点を上げすぎない。

初期案:

| 条件 | cap |
|---|---:|
| runway < 2 ヶ月 | total_score max 45 |
| runway < 4 ヶ月 | total_score max 60 |
| 請求/入金の重大遅延あり | total_score max 70 |
| freee / billing の主要データ欠損 | confidence を下げ、score は暫定表示 |

---

## 軸別設計

### 1. 先手力

すでに `member_activities` には `initiative_origin`, `impact`, `depth` がある。これを会社全体に月次集計する。

初期式:

```text
event_value = impact * depth

initiative_score =
  100 * sum(event_value where initiative_origin = amd_proposed)
      / sum(event_value where initiative_origin != rejected)
```

`initiative_origin` の扱い:

| origin | 解釈 | score への扱い |
|---|---|---|
| `amd_proposed` | AMD 起点の提案・先回り | 加点 |
| `co_decided` | 共同決定。AMD も関与 | 中間加点 |
| `client_requested` | クライアント要望起点 | 受け身寄り |
| `partner_proposed` | 外部パートナー起点 | 受け身寄り |
| `external` | 外部環境起点 | 受け身寄り |
| `unknown` / NULL | 判定不能 | confidence 減点 |

初期実装では `amd_proposed` を主加点、`co_decided` を 0.5 加点として扱う。

```text
initiative_numerator =
  sum(value * 1.0 for amd_proposed)
+ sum(value * 0.5 for co_decided)

initiative_denominator =
  sum(value for known non-rejected events)
```

表示:

- 今月の先手率
- 先手イベント top 5
- 受け身イベント top 5
- unknown が多い場合の警告
- PJ 別 breakdown

### 2. 財務耐久

財務は「予算」と「実績」を分け、差分を見る。

```text
予算 = GAS 月次試算表を OS に import
実績 = freee API
予実差分 = OS が計算
```

見るもの:

- 当月売上
- 当月支出
- 営業利益 / cash delta
- 予算 vs 実績の差分
- 差分理由
- 3 ヶ月 rolling burn
- runway
- 請求済 / 未請求 / 入金済 / 入金遅延
- 3 ヶ月先の expected revenue
- 大型支出予定

初期式:

```text
finance_score =
  30% runway_score
+ 25% budget_actual_variance_score
+ 20% billing_collection_score
+ 15% forecast_visibility_score
+ 10% data_freshness_score
```

予実管理の詳細は `project_pl_monthly.md` を正本にする。`project_pl_monthly` 既存テーブルは互換レイヤーとして残し、会社全体の予算/実績は `company_budget_monthly` / `company_actual_monthly` / `company_budget_actual_monthly` へ寄せる。

2026-05-21 追加:

- PJ売上は発生月と入金月を分けられるようにする。例: `SX_FY25_11-03` はFY25 11-3月分 `2,570,000円` を `202606` スポットとして扱い、`SX_FY26` は見積書Q-0000000065の税抜小計 `10,480,000円` を10か月で割って `202606-202703` に `1,048,000円/月` を売上計上する。FY26 cash inflow は2か月遅れで `202608` から始める。
- サブスク / 自動振替 / 引落口座は月次試算表の行に直接混ぜず、`/admin/finance` と `company_finance_recurring_items` で管理する。
- Gmail等で届く領収書は `company_finance_receipt_events` に保存し、confirm後に `company_actual_monthly` の実績へ同期する。毎月発生する支払いは `budget_forward_fill=true` のものだけ `company_budget_monthly` に forward-fill する。

### 3. 既存 PJ 継続/伸長

既存 PJ を「確度付き MRR / value」として見る。

```text
retention_value =
  sum(project_monthly_value * continuation_probability)
```

初期の `continuation_probability` はルールベース:

| シグナル | 影響 |
|---|---|
| `projects.status='active'` かつ期間内 | baseline high |
| `end_ym` が近いが次期 plan cycle なし | 減点 |
| `milestone_monthly_progress` が大幅遅延 | 減点 |
| MTG サマリに継続・拡大・次期相談あり | 加点 |
| MTG サマリに失注・停止・予算難あり | 減点 |
| `project_freeze_periods` active | 大きく減点 |
| 請求/報告ルーティンが滞留 | 減点 |

表示:

- 継続確度付き売上
- continuation probability 下位 PJ
- 今月の要注意 PJ
- 伸長見込み PJ
- 根拠 snippets

### 4. 新規案件獲得

新規案件は件数ではなく、期待額・確度・戦略適合度・近さで見る。

```text
pipeline_score_input =
  sum(expected_value_yen * probability * strategic_fit * time_discount)
```

初期の source:

- `seeds`: 研究シーズ候補、接触状態、AMD rating
- `project_registry_diffs`: OS に未反映の新規関係者 / 新規案件候補
- `project_knowledge`: PJ から派生した相談・紹介・次案件
- `project_meeting_summaries`: nextActions / risks / decided
- Gmail / Slack / Notion / Calendar / Drive 由来 L2
- VC / 事業会社 relation

候補 stage:

| stage | 意味 | probability 初期値 |
|---|---|---:|
| `signal` | 兆しだけある | 0.05 |
| `lead` | 会話・紹介・接触あり | 0.15 |
| `qualified` | 課題/予算/担当が見えている | 0.35 |
| `proposal` | 提案中 | 0.55 |
| `verbal` | ほぼ合意 | 0.80 |
| `won` | 契約・PJ化済み | 1.00 |
| `lost` | 見送り | 0.00 |

新規テーブル候補は `management_pipeline_items`。ただし初期実装は既存 `seeds` / `project_knowledge` / `project_registry_diffs` の集計から始めて良い。

### 5. 戦略接近度

足元の売上ではなく、AMD が目指す Deeptech startup studio に近づいているかを見る。

初期シグナル:

- AMD Score が伸びている SU 系 PJ の数
- 戦略対象 lane / ASPI domain の PJ / seed 比率
- `protocols` の candidate / confirmed 数と質
- Before Zero 的な再現可能プロトコルの蓄積
- founder / PI / 事業会社 / VC ネットワークの増加
- 低単価受託・短期作業への偏り
- Atlas / macro signals とポートフォリオの整合

初期式:

```text
direction_score =
  30% amd_score_momentum
+ 25% strategic_lane_alignment
+ 20% protocol_accumulation
+ 15% network_expansion
+ 10% low_fit_work_penalty_inverse
```

ここは最初から厳密化しすぎない。まさが見て「これは方向性として合ってる / 違う」を修正し、その feedback を `l2_feedbacks` / `tsukuyomi_learnings` に回す。

---

## データモデル案

### `amd_management_score_snapshots`

月次または日次でスコア snapshot を保存する。まずは月次 `ym` で良い。

```sql
CREATE TABLE amd_management_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL,
  evaluated_on DATE NOT NULL DEFAULT CURRENT_DATE,

  total_score NUMERIC NOT NULL,
  initiative_score NUMERIC NOT NULL,
  finance_score NUMERIC NOT NULL,
  retention_score NUMERIC NOT NULL,
  pipeline_score NUMERIC NOT NULL,
  direction_score NUMERIC NOT NULL,

  confidence NUMERIC,
  finance_cap_applied TEXT,
  weights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by TEXT NOT NULL DEFAULT 'system',

  UNIQUE (ym, evaluated_on)
);
```

### `amd_management_score_evidence`

各軸の根拠を短く保存する。全文保存は禁止。source ref / hash / short snippet を持つ。

```sql
CREATE TABLE amd_management_score_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES amd_management_score_snapshots(id) ON DELETE CASCADE,
  axis TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  project_id TEXT,
  evidence_text TEXT NOT NULL,
  impact TEXT NOT NULL,      -- positive / negative / neutral
  confidence SMALLINT,
  weight NUMERIC,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### future: `management_pipeline_items`

新規案件獲得を本格化する時に追加する。初期 MVP では既存テーブル集計で代替可能。

```sql
CREATE TABLE management_pipeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_project_id TEXT,
  stage TEXT NOT NULL,
  expected_value_yen BIGINT,
  probability NUMERIC,
  strategic_fit NUMERIC,
  expected_start_ym TEXT,
  owner_member_id TEXT,
  source_type TEXT,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## UI

想定 route:

```text
/management-score
```

または HUD 系に統合する場合:

```text
/hud/management
```

初期画面:

```text
┌──────────────────────────────────────────────┐
│ AMD Management Score  72 / 100                │
│ 今月の結論: 財務は安定、先手力は改善、PJ継続に注意 │
├──────────────────────────────────────────────┤
│ 5 axis cards                                  │
│ - 先手力                                      │
│ - 財務耐久                                    │
│ - 既存PJ継続                                  │
│ - 新規案件獲得                                │
│ - 戦略接近度                                  │
├──────────────────────────────────────────────┤
│ 上げ要因 / 下げ要因                           │
├──────────────────────────────────────────────┤
│ 次の一手                                      │
├──────────────────────────────────────────────┤
│ PJ別 breakdown / evidence                     │
└──────────────────────────────────────────────┘
```

UI で必ず出すもの:

- score と前月差分
- 5 軸の内訳
- score total と 5 軸それぞれの月次推移グラフ
- 財務耐久の内訳として、対象月の前後 12 か月を横断する予実グラフと、GAS 月次試算表の `OUT_Monthly` に近い行構成の月次予実表
  - 表の基本順: 売上計 / PJ明細 / 売上原価 / 粗利 / PJ粗利 / 固定費 / 固定費明細 / 社保 / 臨時収入 / 臨時支出 / 営業利益 / 融資実行 / 借入返済 / 利息 / 税 / 月次CF / キャッシュ
  - 予算は `company_budget_monthly` の GAS 移植結果、実績は freee `trial_pl` 由来の `company_actual_monthly`
  - 入金実績は `billing_cycles.payment_confirmed_at` を正本にし、`invoice_ym` / `payment_due_rule` で入金月へ寄せる。金額は発行済み請求明細 (`invoice_base_lines_json`) → 確定請求額 (`budget_reported_amount`) → 互換 fallback (`budget_yen / 0.65`) の順で税抜を取り、税込にして表示する
  - 支払通知書は `payout_notices.sent_at` / `total_yen` を正本にし、送付済み税抜額と cash outflow 用の税込相当を分ける。報酬振込済みの反映有無は `billing_cycles.reward_paid_at` を見る
- キャッシュ判断パネル
  - 過去実績: freee PL 売上、入金確認済み、支払通知書送付済み、実績差引
  - 当月着地見込み: 試算上の入金・支出・月次CF
  - 先3か月: 入金予定、支出予定、通常月CF (= 一括入金除き)、月末Cash、最低Cash
  - source/confidence label: `実績` (`payment_confirmed_at` / `sent_at` / freee PL), `予定` (budget simulation), `未確認` (invoice未送付/入金未確認/支払済み未反映)
- confidence / data freshness
- finance cap がかかった場合の表示
- 上げ要因 top 5
- 下げ要因 top 5
- 次の一手
- evidence への drilldown

出さないもの:

- 根拠のない断定
- full email / full meeting transcript
- 謎の AI コメントだけの score

---

## Cron / 更新タイミング

初期:

| タイミング | 処理 |
|---|---|
| daily 06:30 JST | GAS 予算 snapshot / freee 実績 snapshot / L2 / billing を使って当月 score 再計算 |
| 月初 | 前月確定 snapshot を保存 |
| 手動 | `/management-score` から再計算 |

GAS 月次試算表 import と freee API 取得は token / rate limit / 勘定科目 mapping を別 md または implementation note に分ける。

---

## MVP 着手順

1. `amd_management_score_snapshots` / `amd_management_score_evidence` migration
2. 先手力集計: `member_activities` から `initiative_score` を計算
3. 財務耐久: GAS 月次試算表 import + freee 実績 import + 予実差分集計
4. 既存 PJ 継続: `projects` / `value_plan_cycles` / `milestone_monthly_progress` / `project_freeze_periods` のルールベース
5. 新規案件獲得: `seeds` / `project_knowledge` / `project_registry_diffs` の件数・stage 仮集計
6. 戦略接近度: AMD Score momentum + protocols + strategic lane alignment の仮集計
7. `/management-score` UI
8. evidence drilldown
9. まさ feedback を `l2_feedbacks` / `tsukuyomi_learnings` に接続

---

## 未確定 / 実装前に決めること

- 表示名: `AMD Management Score` / `Studio Health Score` / `経営スコア`
- route: `/management-score` か `/hud/management` か
- GAS 月次試算表の source project / backing Spreadsheet / JSON export path
- freee の勘定科目 mapping
- runway の cash 正本を freee のどの値にするか
- 新規案件 pipeline を既存 `seeds` 拡張で持つか、`management_pipeline_items` を作るか
- 戦略接近度の「低フィット仕事」判定をどう扱うか

---

## 関連

- [`amd_score.md`](amd_score.md) — PJ / SU 単位の AMD Score
- [`project_pl_monthly.md`](project_pl_monthly.md) — PJ 別 PL / 未来予測抽出
- [`L2_DATA.md`](L2_DATA.md) — AMD OS L2 データ正本
- [`cockpit.md`](cockpit.md) — PJ cockpit / 月次 / MS / 試算表
- [`db_schema.md`](db_schema.md) — Supabase schema reference
