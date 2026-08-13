# 月次試算表 / 予実管理 — OS 移植設計

最終更新: 2026-06-19
正本ステータス: GAS月次試算表のOS移植を正本にしつつ、admin finance台帳とPJ別入金タイミングを追加。

---

## まさの最新方針 (= 2026-05-18)

GAS で既に作ってある月次試算表を AMD OS に移植して使う。

- GAS Web App:
  - `https://script.google.com/a/macros/team-armada.jp/s/AKfycbw1XEhum3hEna5HizixyBAVw5iiLZUeoYb2CeLiL2qJkq7FcnWoS1MPZ1a1D4pa5gkNtA/exec`
- これは **予算 / 計画の数字** として扱う
- **実績は freee API から取得**する
- OS 上では、予算と実績を突き合わせて **予実管理** まで行う

```text
GAS 月次試算表     = 予算 / 計画の正本
freee API          = 実績の正本
AMD OS             = 予算・実績・差分・経営スコアを統合して見る場所
```

これにより、従来の「会話・議事録から PL 予測を抽出して試算表化する」設計は主導線ではなくなる。会話抽出は、予算表に未反映の予定・大型支出・売上見込みを補助的に検出するための L2 として残す。

---

## 何を解くか

AMD OS の財務ビューで、以下を見られるようにする。

- 月次予算
- 月次実績
- 予実差分
- 差分理由
- cash / runway
- PJ 別または費目別の収支
- AMD Management Score の `finance_score` への入力

目的は「PL表をきれいに再現すること」ではなく、経営判断に使える予実管理を OS の中で回すこと。

---

## 既存資産と役割

| 資産 | 役割 |
|---|---|
| GAS 月次試算表 Web App | 予算 / 計画の既存正本。まず現物 UI / source schema を確認して移植する |
| `project_pl_monthly` table | 既存の PJ 別 PL テーブル。今後は PJ 別予算/実績の一部として扱うか、後方互換テーブルとして残す |
| `CockpitPlMonthlyModal.tsx` | PJ cockpit 内の試算表表示。会社全体予実とは別に、PJ 単位 drilldown として使う |
| `CockpitPlHearingModal.tsx` | つくよみヒアリング。予算表にない予定の補助入力 / 修正導線として残す |
| `billing_cycles` | PJ 月次請求・入金・ルーティン状態。売上予算 / 請求予定 / 入金確認に使う |
| `pwa/src/lib/freee-client.ts` | freee API client。実績取得の基盤 |

### 掘り起こしメモ (2026-05-18)

まさ確認: 対象は Drive 検索で見つかる既存 Spreadsheet ではなく、上記 GAS Web App URL にしかない。

Apps Script project:

- title: `収支計算シート_AMD_OS`
- project id: `1uznZAZYjnKXfzUG9q1XosS8Gaxa3GLGkV5dvMLA65aNhnkfs2FeK4bTV`
- editor URL: `https://script.google.com/home/projects/1uznZAZYjnKXfzUG9q1XosS8Gaxa3GLGkV5dvMLA65aNhnkfs2FeK4bTV/edit`
- local source snapshot: [`../../_external_gas/monthly-pl-script`](../../_external_gas/monthly-pl-script)

`clasp` / Apps Script API は Workspace OAuth の `invalid_rapt` / access denied で直接取得できなかった。今回は、まさの Chrome ログイン済み Script Editor 画面から Apps Script initial data を inspect して source snapshot を保存した。

保存済み source:

| file | role |
|---|---|
| `010_SimConfig.gs` | `CFG_*` シート読み込み、シナリオ上書き、PJ売上・変動費・借入・スポット収支の解決 |
| `011_SimEngine.gs` | 月次 P/L・cash・runway シミュレーション本体 |
| `012_SimOutput.gs` | `OUT_Monthly` への書き出し |
| `013_SimApi.gs` | Web App / HTML UI からの API |
| `220_SimDashboard.html` | 既存ダッシュボード UI |
| `999_TempSetup.gs` | 初期シート作成・マイグレーション |
| `appsscript.json` | runtime / webapp 設定 |

Drive 検索で見つかった以下は **別物** として扱う:

| ファイル | URL | 見えたこと |
|---|---|---|
| `PJ収支表` | `https://docs.google.com/spreadsheets/d/1WDTDm5m2gAW_Tu4V1xeRnnqS1YinYfgDrPaVtjOG604` | 請求・配分・支払に加工された PJ 収支運用表。ナマの月次試算表ではない |
| `収支` | `https://docs.google.com/spreadsheets/d/1Q8cEnutfJzgdEXKIRDb4wUGAe6ON1MMiiz3irCrj1YA` | 個人/会社の収支 Spreadsheet だが、今回の GAS Web App 正本ではない |
| `きよ提案版_PJ収支表` | `https://docs.google.com/spreadsheets/d/1OqsvCQXSWhCTFLL-DL3_QainNU8I_SNyvgdDBHJ6w_o` | 別案 / 旧案の可能性。今回の対象ではない |

注意:

- `PJ収支表` の `PJ収支表_2604` は実読済みだが、まさ確認により対象外。
- Apps Script deployment id (`AKfy...`) だけでは `.gs` source は復元できない。今回の source snapshot は Script Editor URL から取得した。

### GAS 正本の構造

既存 GAS は「予算表」というより、会社全体の月次収支シミュレーター。入力シートを編集し、`runSimulation()` が月次の P/L・cash flow・runway を計算する。

| sheet | 役割 | 主な columns |
|---|---|---|
| `CFG_Params` | 全体パラメータ | `startYm`, `months`, `rateAmd`, `rateCloser`, `rateMember`, `initialCash`, `socialInsRate`, `corpTaxEffectiveRate`, `minCorpTax`, `carryforwardLoss`, `prevCorpTax`, `prevConsumptionTax`, `unpaidConsumptionTax`, `unpaidCorpTax`, `fiscalYearStartMonth` |
| `CFG_Projects` | PJ 別売上計画 | `projectId`, `projectName`, `monthlyRevenue`, `startYm`, `endYm`, `type`, `memo`, `internalMemberCost`, `closerInternal`, `status`, `billingType` |
| `CFG_ProjectRevenue` | PJ 別月次上書き | `projectId`, `ym`, `monthlyRevenue`, `internalMemberCost`, `memo` |
| `CFG_FixedCosts` | 固定費 | `costId`, `costName`, `monthlyCost`, `startYm`, `endYm`, `costType`, `memo` |
| `CFG_VarCosts` | 変動費 / 月次で変わる固定的費用 | `varCostId`, `costName`, `ym`, `amount`, `costType`, `memo` |
| `CFG_Loans` | 借入 / 返済 | `loanId`, `loanName`, `principal`, `annualRate`, `totalPayments`, `startYm`, `method`, `disbursementYm`, `memo` |
| `CFG_Spot` | 単発入出金 | `spotId`, `spotName`, `ym`, `amount`, `direction`, `costType`, `memo` |
| `CFG_Scenarios` | シナリオ上書き | `scenarioId`, `scenarioName`, `paramKey`, `paramValue` |
| `OUT_Monthly` | 計算結果 | `ym`, `revenue`, `costMember`, `costCloser`, `grossProfit`, `fixedCost`, `socialIns`, `operatingProfit`, `loanPayment`, `loanInterest`, `ctaxPayment`, `corpTaxPayment`, `netCashFlow`, `cashBalance`, `runway` |
| `ACT_Monthly` | 実績入力用の初期案 | `ym`, `actRevenue`, `actExpense`, `actCashBalance` |

計算結果の `rows` には、`OUT_Monthly` に出す列に加えて `loanDisbursement`, `spotIncome`, `spotExpense`, `cashInflow`, `cashOutflow`, `pjDetails`, `fixedCostDetails` も含まれる。OS 移植では、この detailed payload を捨てず、予実差分の説明に使う。

移植時の注意:

- `011_SimEngine.gs` では `profitAfterInterest` の計算が `spotIncome` / `spotExpense` 宣言より前にあり、JS の `undefined` により `fyProfitAccum` が `NaN` 化する可能性がある。OS 移植時はスポット収支集計を先に行う。
- `rateAmd` は `CFG_Params` にあるが、現行 simulation では主要計算に使われていない。AMD取り分の表現を OS で明示するなら、`revenue` / `costMember` / `costCloser` / `grossProfit` のどこに効かせるか再定義する。
- `CFG_ProjectRevenue` は `999_TempSetup.gs` の古い migration では `internalMemberCost` 列なしだが、現行 `010_SimConfig.gs` / `013_SimApi.gs` は同列を読む。OS 側では現行 source を優先する。

### 2026-05-21 追加: SX FY25 / FY26 と入金タイミング

SX FY2026 は Drive の見積書 `国立大学法人 愛媛大学御中_事業化に向けた事業開発および経営支援業務_見積書_Q-0000000065.pdf` を正本にする。見積書上は、業務期間が `2026-06-01` から `2027-03-31`、請求方法は月次請求、税抜小計 `10,480,000円` / 消費税 `1,048,000円` / 税込合計 `11,528,000円`。

注意: 既存 baseline の `2,570,000円` は FY25 の `11-3月分` であり、FY26 の月額ではない。2026-05-21 にまさ確認済み。

| 項目 | 値 |
|---|---|
| `pj13` | `SX_FY25_11-03`。`2,570,000円` を `202606` のスポット売上/入金として計上 |
| `pj14` | `SX_FY26`。税抜 `10,480,000円` を10か月で割り、`202606-202703` に `1,048,000円/月` を売上計上 |
| cash | FY26は2か月遅れ。6月発生分の初回cash inflowを `202608` とする |
| gross cash | FY26は税込 `1,152,800円/月` 相当がcash inflowに入る |

このため `MonthlyPlProject` は、売上発生月と cash inflow 月を分ける。

```ts
cashDelayMonths?: number | null;
cashStartYm?: number | null;
```

PL上の `revenue` は発生月で計上し、`cashInflow` / `netCashFlow` / `cashBalance` は `cashDelayMonths` を反映した月で計算する。live 月次試算表の売上原価は `/admin/payouts` の capped 外部支払予定を正本にし、旧GASの `rateMember` / `rateCloser` から理論原価を自動発生させない。これで「請求は6月から、最初の振込は8月末」のような案件別入金条件を月次試算表に入れつつ、支払通知に存在しない外注費・内製費を出さない。

別財布 (`billing_cycles.extra_revenue_json`) もこの境界を守る。`period_start_ym`〜`period_end_ym` はPLの発生配分だけに使い、cash には使わない。cash は entry の実入金月を最優先し、未確認時だけ `invoice_ym`、次に `billing_date` とPJ支払条件から予測月を解決して、その月に税抜総額を一括計上する。例えばp19のOkuDoor 200万円はPLでは202605〜202610に按分する一方、現金予測は請求日2026-03-31と翌月末条件から202604に200万円を置く。

### 報酬債務と PL / cash の境界

SX のように契約開始前の実働を後月支払へ回す PJ では、次の 4 つを別々のレイヤーとして扱う。

| レイヤー | 正本 | 画面上の読み方 |
|---|---|---|
| PL 売上/原価 | `/management-score` の月次収支シミュレータ | 売上は発生月ベース。売上原価は `/admin/payouts` の capped 外部支払予定に一致させる |
| cash | freee 実績 / cash inflow 予定 | 入金月・出金月ベース。runway と残高を見る |
| 支払予定 | `/admin/payouts` の capped 支払予定 | 実際に今月支払う金額。支払通知書の対象 |
| 報酬債務 | `reward_summary_json.members[].carryInYen / grossDueYen / totalPay / stockYen` | まだ払っていない月末残高。`前月残 + 今月発生 - 今月支払 = 月末未払い残` で見る |

`stockYen` は PL の原価でも cash out でもなく、非役員メンバーへの未払い残高。先12か月表や支払管理では `stock` とだけ表示せず、`未払い残` として支払予定から分ける。契約前稼働がある PJ は、契約開始前の月に発生した `stockYen` が契約開始後の `carryInYen` へ流れるため、金額だけを見ると大きく見える。admin は `/admin/payouts` の報酬債務台帳で原因ラベルと式を確認する。

会社留保・役員留保・報酬債務・旧GASのクローザー5%は、銀行から外へ出る支払ではない。live 月次試算表の `cost_member` は `reward_summary_json.externalRegularPayoutCapYen + externalExtraPayoutCapYen` の合計、`cost_closer` は外部支払予定に存在しない限り 0 円にする。報酬キャッシュが無い PJ/月や支払対象メンバーがいない PJ/月は 0 円を明示し、`fee_amount × 65%` や `budget_yen` へフォールバックしない。

先12か月のPJ表は `キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` を分ける。会社留保は支出ではなく `cap/売上枠 - 外部支払`。役員会社留保は留保の内訳であり、外部支払や報酬債務には入れない。各表は、その目的で確認したい主数字だけをセルの中心に置く。報酬債務は残高なので12か月分を足さず、ピークよりも最終月に未払い残がゼロ着地するかを最優先で見る。

---

## データの責務分担

### 0. SX（p21）BZM 2.2 月次PLの配賦境界（2026-08-13）

`project_pl_monthly` は BZM経済CFとは別の計画PLである。BZM 2.2の時間軸は、評価月M0から計算地平までこのテーブルを同じ月列に表示するが、$J/P$へ直接入るのはartifactの`monthlyEconomicCFMillionJpy`だけとする。

SXの初回投入は `scripts/backfill_sx_phase_monthly_pl.mts` が再現する。金額の正本はSXコックピットの`SX_ANNUAL_PROJECTION`、旧`SX_月次試算表_v1.0_260331.xlsx`は月別発生タイミングの配賦キーだけで、古い売上単価・導入前提を金額として再利用しない。Phase 0（2026-07〜2027-03）は月別一次内訳がないため、フェーズ内の人件費500万円、研究開発費4,000万円、マーケ費1,000万円、その他販管費500万円を**計画値/推定値（低精度）**として9か月均等按分する。以降のFY年次PLは原則として旧月次表の季節性へ正規化する。例外はFY2027研究開発費で、旧表に月別基準がないため12か月均等按分（低精度）とnotesへ明記する。

Phase budget、資本調達、補助金cash、CAPEX、PL売上は別物として扱う。資金調達・PSI・補助金の入金を`revenue_yen`へ入れず、CAPEXも現行テーブルの6費目へ無理に混ぜない。Phase budgetと月次PLは各々の範囲内でtie-outし、両者が一致しない場合は資本的支出・時点・モデル前提の差としてnotesと実行ログへ残す。

### 1. 予算 / 計画

GAS 月次試算表を移植し、OS 側に予算シミュレーターとして保存する。

予算は 2 層に分ける:

1. 入力計画
   - PJ 売上計画
   - PJ 月次上書き
   - 固定費 / 変動費
   - 借入 / 返済
   - 単発入出金
   - 税金 / 社保 / 初期 cash 等のパラメータ
2. 月次計算結果
   - 売上
   - メンバー原価
   - クローザー原価
   - 粗利
   - 固定費
   - 営業利益
   - cash inflow / outflow
   - net cash flow
   - cash balance
   - runway

`company_budget_monthly` は月次計算結果の正規化テーブルとして使う。入力計画は、後から編集・シナリオ比較できるように別テーブルへ保存する。

### 2. 実績

freee API から取得する。

取得候補:

- 損益計算書 / 月次推移
- 勘定科目別の発生額
- 取引 / 明細
- 入出金 / cash balance
- 未収 / 未払

freee 側の勘定科目 mapping は実装前に確認する。OS では freee の raw payload をそのまま UI 正本にせず、正規化 snapshot を保存する。

### 3. 予実差分

OS が計算する。

```text
variance_yen = actual_amount_yen - budget_amount_yen
variance_pct = variance_yen / budget_amount_yen
```

差分の表示は、金額差だけでなく「経営上見るべき差分」を優先する:

- 売上未達
- 支出超過
- 入金遅延
- 請求漏れ
- 予算にない大型支出
- 予算にない売上
- runway 悪化

### 4. 会話 / L2 抽出

旧設計の「生データから PL 関連数字を拾う」導線は、主予算表ではなく **差分理由 / 未反映予定の検出** に回す。

例:

- 「来月から月 X 円入る」
- 「500 万円の装置を買いたい」
- 「資金が何月に底を尽きる」
- 「請求が翌月にずれそう」

これらは予算表への直接上書きではなく、`budget_variance_notes` / evidence / notification 候補として扱う。

### 5. Admin finance台帳

月次試算表そのものに入れる前段として、経理オペレーション用の台帳を `/admin/finance` に置く。

| table | 役割 |
|---|---|
| `company_finance_recurring_items` | サブスク / 固定継続費 / 自動振替 / 引落口座 / budget forward-fill の管理 |
| `company_finance_receipt_events` | Gmail/freee/manual 由来の領収書イベント。実績同期と継続費候補の根拠 |

運用:

- GAS baseline に既に入っている固定費は `company_finance_recurring_items` に seed するが、二重計上防止のため `budget_forward_fill=false` で始める
- 新しいサブスクや自動振替を見つけたら `/admin/finance` に登録する
- 毎月発生しそうなものだけ `budget_forward_fill=true` にし、`source='finance_recurring_item'` の `company_budget_monthly` rows として24か月先まで同期する
- Gmail領収書は `company_finance_receipt_events` に保存し、confirm後に `company_actual_monthly` へ同期する導線を追加する

---

## データモデル案

### `company_budget_inputs`

GAS の `CFG_*` 入力を OS 側で保持する。最初は JSONB 併用で移植し、UI と freee 突合が固まったら必要なものから正規化する。

```sql
CREATE TABLE company_budget_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_kind TEXT NOT NULL, -- params / project / project_revenue / fixed_cost / var_cost / loan / spot / scenario
  source_id TEXT,
  ym TEXT,
  project_id TEXT NULL REFERENCES projects(project_id),
  label TEXT,
  amount_yen BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  version TEXT NOT NULL DEFAULT 'baseline',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `company_budget_simulation_runs`

GAS の `runSimulation()` 相当を OS 側で実行した結果を保存する。

```sql
CREATE TABLE company_budget_simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT,
  version TEXT NOT NULL DEFAULT 'baseline',
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  source_ref TEXT,
  engine_version TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `company_budget_monthly`

会社全体または PJ 単位の予算 / 計画を保存する。

```sql
CREATE TABLE company_budget_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NULL REFERENCES company_budget_simulation_runs(id),
  ym TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company', -- company / project
  project_id TEXT NULL REFERENCES projects(project_id),
  category TEXT NOT NULL,                -- revenue / cogs / personnel / rd / marketing / other_opex / cash_in / cash_out / etc
  account_name TEXT,
  budget_amount_yen BIGINT NOT NULL DEFAULT 0,
  cash_amount_yen BIGINT,
  runway_months NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  source_ref TEXT,
  version TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ym, scope, project_id, category, account_name, version)
);
```

### `company_actual_monthly`

freee から正規化した月次実績を保存する。

```sql
CREATE TABLE company_actual_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company', -- company / project if mapping possible
  project_id TEXT NULL REFERENCES projects(project_id),
  category TEXT NOT NULL,
  account_name TEXT,
  actual_amount_yen BIGINT NOT NULL DEFAULT 0,
  freee_account_item_id TEXT,
  freee_partner_id TEXT,
  source_ref TEXT,
  raw_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ym, scope, project_id, category, account_name, freee_account_item_id)
);
```

### `company_budget_actual_monthly` view

予算と実績を突合する view。

```sql
CREATE VIEW company_budget_actual_monthly AS
SELECT
  COALESCE(b.ym, a.ym) AS ym,
  COALESCE(b.scope, a.scope) AS scope,
  COALESCE(b.project_id, a.project_id) AS project_id,
  COALESCE(b.category, a.category) AS category,
  COALESCE(b.account_name, a.account_name) AS account_name,
  COALESCE(b.budget_amount_yen, 0) AS budget_amount_yen,
  COALESCE(a.actual_amount_yen, 0) AS actual_amount_yen,
  COALESCE(a.actual_amount_yen, 0) - COALESCE(b.budget_amount_yen, 0) AS variance_yen
FROM company_budget_monthly b
FULL OUTER JOIN company_actual_monthly a
  ON b.ym = a.ym
 AND b.scope = a.scope
 AND COALESCE(b.project_id, '') = COALESCE(a.project_id, '')
 AND b.category = a.category
 AND COALESCE(b.account_name, '') = COALESCE(a.account_name, '');
```

### `company_budget_variance_notes`

差分理由や L2 抽出根拠を保存する。全文保存は禁止。

```sql
CREATE TABLE company_budget_variance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL,
  project_id TEXT NULL REFERENCES projects(project_id),
  category TEXT,
  variance_kind TEXT NOT NULL, -- revenue_shortfall / cost_overrun / payment_delay / unbudgeted_revenue / unbudgeted_expense / timing_shift / other
  note TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  confidence SMALLINT,
  status TEXT NOT NULL DEFAULT 'candidate', -- candidate / confirmed / rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### legacy: `project_pl_monthly`

既存の `project_pl_monthly` はすぐ消さない。

扱い:

- 既存 Cockpit UI の互換レイヤー
- PJ 単位の手入力/ヒアリング結果
- 新テーブル移行後は `company_budget_monthly(scope='project')` へ寄せる

---

## UI

### 会社全体の予実管理

想定 route:

```text
/management-score/finance
```

または:

```text
/finance/budget-actual
```

表示:

- 月次サマリ: 売上 / 支出 / 利益 / cash delta / runway
- 予算 vs 実績: category 別 table
- 差分 top 10
- 入金遅延 / 請求漏れ alert
- 予算にない実績 / 実績がない予算
- freee 最終同期時刻
- GAS 予算表の最終 import 時刻
- freee 口座残高 (`wallet_txns.balance`) の最新反映月
- raw 収集 run と score snapshot の最終更新時刻

2026-07-16 更新: 日次更新は `/api/cron/management-score-refresh` に一本化する。
この route が freee PL、freee 口座残高、OS内部 raw signals、score snapshot を同じリクエスト内で順番に更新する。
現金残高は `company_actual_monthly.category='cash_balance'` として保存し、前月までの行が無ければ `/management-score` 上部の鮮度表示で警告する。
GAS baseline (`company_budget_inputs` / `company_budget_monthly`) は凍結 fallback として残し、通常の予算線は OS ライブテーブルから `source='os_live_monthly_pl'`, `version='os-live-current'` として `company_budget_monthly` に materialize する。
`company_budget_actual_monthly` は全versionを返す互換viewなので、通常表示・raw収集・finance score入力では `budget_version='os-live-current'` または実績のみの行だけを読む。
これにより旧GAS baselineに残る CTB などの古いPJ行は、fallbackとしてDBに残っていても月次試算表の現在値へ混ざらない。
順序は freee PL → freee 口座残高 (`wallet_txns.balance`) → OSライブ月次試算表 materialize → OS内部raw → score snapshot。
freee口座残高がある月以降のcash予測は、旧GASの初期残高ではなく最新実績残高をアンカーにして未来月の見込みCFを積む。

### PJ cockpit

PJ cockpit の `📊 試算表` は、会社全体予実から PJ 単位へ drilldown する位置づけにする。

表示:

- その PJ の budget / actual / variance
- `billing_cycles` の請求・入金状態
- freee partner が取れる場合は freee 実績
- 取れない場合は `billing_cycles` + 手入力 / ヒアリング補助

---

## 移植手順

1. GAS source snapshot の固定
   - `_external_gas/monthly-pl-script` を現時点の正本 snapshot とする
   - 以後の変更は OS 側に移植してから行う
   - backing Spreadsheet の現行データは別途 export/import する

2. Simulation engine を TypeScript へ移植
   - `010_SimConfig.gs` の input resolver
   - `011_SimEngine.gs` の `runSimulation()`
   - `spotIncome` / `spotExpense` 宣言順バグを修正
   - `pjDetails` / `fixedCostDetails` / `cashInflow` / `cashOutflow` を保持する

3. Supabase migration
   - `company_budget_inputs`
   - `company_budget_simulation_runs`
   - `company_budget_monthly`
   - `company_actual_monthly`
   - `company_budget_variance_notes`
   - view `company_budget_actual_monthly`

4. Import job
   - GAS 予算入力 → `company_budget_inputs`
   - OS simulation → `company_budget_simulation_runs` / `company_budget_monthly`
   - freee → `company_actual_monthly`

5. 予実管理 UI
   - 会社全体 view
   - PJ drilldown
   - variance notes

6. AMD Management Score 連携
   - `finance_score` の入力を `company_budget_actual_monthly` へ切り替える
   - 財務 cap / runway / variance alert を反映

7. 外部クライアント向け live cash API
   - KAGAMI など OS 外の画面で会社残高だけを使う場合は、保存済み view の `cash_amount_yen` を直読せず、`/api/finance/live-cash-balances` を使う。
   - API は `/management-score` と同じ live PL simulation を server-side で実行し、過去月は `category='cash_balance'` の実績残高を返す。実績残高がある場合、未来月の主 `cashBalance` は最新実績残高から以後の見込み月次CFを累積した `実績接続見込み` とし、当初計画は `budgetCashBalance` に残す。
   - レスポンスは月次残高・当初計画残高・runway・actual/forecast source に限定し、PJ別内訳や固定費・報酬内訳は返さない。

---

## 実装前に確認すること

- backing Spreadsheet の現行データをどう取得するか
  - GAS API を再認証して読む
  - まさ Chrome ログイン済み UI から export する
  - 一時的に GAS Web App へ JSON export を追加する
- freee のどの API endpoint を実績正本にするか
- freee 勘定科目を OS category にどう mapping するか
- cash / runway の cash 正本を freee のどの値にするか
- PJ 別実績を freee partner / tag / memo でどこまで分解できるか
- `project_pl_monthly` を段階移行するか、当面互換テーブルとして残すか
- `rateAmd` を経営スコア上の AMD 取り分指標として使うか、simulation 上の計算式に戻すか

---

## 関連

- [`management_score.md`](management_score.md) — AMD Management Score。`finance_score` は本予実管理を入力にする
- [`cockpit.md`](cockpit.md) — PJ cockpit / 試算表モーダル
- [`L2_DATA.md`](L2_DATA.md) — 5 生データと L2 抽出
- [`db_schema.md`](db_schema.md) — Supabase schema reference
