# 契約管理仕様

> 確定範囲: `/admin/contracts`、契約予定枠、契約書version metadata、押印版metadata、5生データ予兆dry-run、Slack nudge dry-run。実Slack送信、scheduler登録、Drive共有範囲変更はこのMVPでは行わない。

## Route / Authority

| surface | contract |
|---|---|
| page | `/admin/contracts` |
| authority | admin / backoffice / management 限定。PWA page と API は `members.is_admin=true` を要求する |
| admin sidebar | admin左メニューに `契約` を表示 |
| external write | 初期実装では Drive 共有変更なし、Slack実送信なし、scheduler変更なし |

契約書はPJ資料より機密度が高いため、PJ member readへ開かない。PJ cockpit資料機能と実装パターンは参照するが、保存先と権限は混同しない。

## DB Tables

| table | purpose |
|---|---|
| `contracts` | 契約予定枠、status、相手先、関連PJ、予兆confidence、nudge閾値、押印版有無 |
| `contract_documents` | Drive file metadata による version history。本文/ファイル本体はDB保存しない |
| `contract_signals` | 5生データから検知した契約予兆候補。raw本文ではなく短いsnippetとsource refだけ保存 |
| `contract_nudges` | 押印版未保存のnudge候補/履歴。初期はdry-run/review queue前提 |

status:

| value | meaning |
|---|---|
| `planned` | 予兆または手動で予定枠化 |
| `drafting` | 初稿/ドラフト作成中 |
| `under_review` | 修正案、赤入れ、法務確認中 |
| `awaiting_signature` | 押印/電子署名待ち |
| `signed` | 押印版metadataが保存済み |
| `stalled` | 押印版未保存のまま停滞 |
| `cancelled` | 中止/失注 |

## API

| route | method | write? | contract |
|---|---:|---:|---|
| `/api/contracts` | GET | no | 契約、documents、signals、nudges、projects、Drive保存先設定を返す |
| `/api/contracts` | POST | yes | admin手動で契約予定枠を作る |
| `/api/contracts/[contractId]` | PATCH | yes | status、相手先、予定日、nudge閾値などを更新 |
| `/api/contracts/documents` | POST | yes | 既存Drive link/file idをmetadata登録。`document_kind='signed'` なら契約を `signed` にする |
| `/api/contracts/signal-dry-run` | GET | no | 5生データから契約予兆候補を生成。DB writeなし |
| `/api/contracts/nudges/dry-run` | GET | no | 押印版未保存かつ閾値超過のSlack nudge候補を生成。Slack送信なし |

## 5生データの分類

| source | current input | signal例 |
|---|---|---|
| Gmail | `source_cache.source in ('gmail','gmail_message',...)` | 契約書送付、押印依頼、修正案、クラウドサイン通知 |
| Slack | `source_cache.source like 'slack%'` | PJ channelでの契約締結予定、修正依頼、押印確認 |
| Notion | `source_cache` + `project_meeting_summaries.notion_url` | 議事録上の契約合意、法務TODO、MOU/NDA論点 |
| Drive | `source_cache.source like 'drive%'` + MTGカードのDrive metadata | 契約書ドラフト、赤入れ、PDF/Docx |
| Calendar | `project_meeting_summaries` / Calendar由来MTGカード | 契約締結MTG、法務確認MTG、押印期限 |

判定語は `契約書`、`NDA`、`業務委託`、`共同研究契約`、`MOU`、`押印`、`電子署名`、`DocuSign`、`クラウドサイン`、`修正案`、`法務確認`、`redline` など。単に `契約` / `締結` が議事録本文に出るだけでは自動予定枠にしない。

## 自動予定枠化の品質境界

`D-13 Contract Signals` は、単に議事録やMTGタイトルの周辺文脈に「契約」「締結」が出るだけでは `contracts` に予定枠を作らない。`contract_signals` の review queue に止める。

自動で `contracts.status='planned'` を作れるのは、次のいずれかに限る。

1. Gmail / Drive などの `source_cache` 由来で、契約書・NDA・業務委託・MOU・発注書・DocuSign / クラウドサインなどの具体的な契約文書語と、押印・署名・送付・受領・修正案・法務確認・更新/延長などのアクション語が同時にある。
2. `project_meeting_summaries` 由来でも、MTG名そのものに `業務委託契約更新` / `NDA` / `MOU` / `契約書` などの具体的な契約種別・文書名が入っている。

`MTG` / `定例` / `キックオフ` / `取締役会` のような汎用meeting titleで、本文側にだけ契約語が出るものは false positive として候補化しない。meeting summary 由来は title 自体に具体的な契約種別・文書名があるものだけ候補化する。

## Drive

保存先正本:

```text
共有ドライブ/ARMADA/a3_backoffice/契約
```

MVPでは `CONTRACTS_DRIVE_FOLDER_ID` が設定されているかを画面に出す。PWAから新規共有や外部共有拡大はしない。契約書ファイルはDriveに置き、OSは `drive_file_id` / `web_view_link` / `mime_type` / `version_label` / `document_kind` だけを保持する。

## Nudge

`contracts.signed_at IS NULL` かつ `status NOT IN ('signed','cancelled')` の契約で、`last_activity_at` または `planned_at` から `nudge_after_days` 以上経過したものを候補にする。`projects.slack_channel_id` が無い場合は blocker として返す。

初期実装は `/api/contracts/nudges/dry-run` のみ。実送信に進む場合は、送信先PJ channel、文面、対象件数、送信タイミング、誤送信時の削除/rollback可否を確認した bundle が必要。

## 契約抽出 → projects / billing_cycles 反映 (Contract Apply)

> 2026-06-16 追記。契約は「抽出して `/admin/contracts` のレビュー queue に積む」だけでなく、**確定した契約条件を `projects` と `billing_cycles` に流し込んで初めて月次収支シミュレータ・予実表に効く**。この反映経路 (Contract Apply) を正本として定義する。手入力前提にしない (= つくよみが生データから自動構築する原則)。

### 反映先 3 層

契約書 (Drive PDF / Gmail / Slack 等) → `D-13 Contract Signals` 抽出 → `contract_terms` (`status='applied'`) になったら、次の 3 層へ反映する。**`contract_terms` が applied でも、この 3 層に書き戻らない限り OS の数字 (売上・予実・原価) は古いまま**。

| 層 | 反映先 | 列 | 用途 |
|---|---|---|---|
| ① 契約メタ正本 | `projects.contract_terms_json` (jsonb) | `monthlyFeeYen` / `contractStartYm` / `contractEndYm` / `actualWorkStartYm` / `billingStartYm` / `rewardPoolYen` / `monthlyRewardCapYen` / `sourceTitle` / `sourceRef` / `notes` | `/admin/projects` の契約カラム群が表示・編集する正本。`contract_terms` 抽出結果はまずここへ畳む |
| ② 売上計上パラメータ | `projects` | `fee_type` (`monthly_fixed` / `variable`) / `fee_amount` / `start_ym` / `end_ym` | 月次収支シミュレータ (`buildLiveMonthlyPlInputs`) が固定収益を立てる入力。**`end_ym` が null だと契約終了後も無期限で売上が立ち続ける** (CX 事故。契約は 2026-06〜09 なのに `end_ym=null` のまま 202702 以降も ¥290,000 を計上していた) |
| ③ 月別売上 (変動) | `billing_cycles` | `ym` ごとの `budget_yen` / `budget_reported_amount` | `billing_distribution='schedule_based'` 等で月により金額が違う契約は、②の `monthly_fixed` 一律ではなく月別 cycle に展開する。シミュレータは変動収益をここから取る |

### `/admin/projects` の契約カラム

`AdminProjectsTable` は `projects.contract_terms_json` を展開した編集列を持つ (`contract_monthly_fee_yen` / `contract_start_ym` / `contract_end_ym` / `contract_actual_work_start_ym` / `contract_billing_start_ym` / `contract_reward_pool_yen` / `contract_monthly_reward_cap_yen` / `contract_source_title` / `contract_source_ref` / `contract_notes`)。`contract_terms` フィールド群を保存すると `contract_terms_json` (①) に upsert される。`fee` / `start_ym` / `end_ym` (②) は別カラムとして個別に保存する。

✅ **実装済み (2026-06-18)**: `contract_terms` (D-13 抽出結果、`status='applied'`) から ①②③ へ自動反映する Contract Apply writer を実装した。

| 部品 | 場所 | 役割 |
|---|---|---|
| `deriveContractApplyPlan(term)` | `src/lib/contracts-apply.ts` | applied term から 3 層反映プランを導出する純粋関数 (DB は触らない)。値の出所は applied term だけで、ここで金額を作り変えない |
| `applyContractTerms(db, termId, actor)` | `src/lib/contracts-apply.ts` | plan を実際に ①②③ へ書き戻す。`billing_log` に `action='contract_applied'` を残す |
| `GET /api/contracts/apply?termId=...&dryRun=1` | `src/app/api/contracts/apply/route.ts` | 反映プランのプレビュー (DB write なし)。admin 限定 |
| `POST /api/contracts/apply { termId }` | 同上 | 3 層へ実反映。admin 限定 |

分岐ロジック:
- `billing_distribution='schedule_based'` (または `monthly[]` があり `monthly_average` でない) → `fee_type='variable'` / `fee_amount=null` にし、`billing_distribution_json.monthly[]` を ③ `billing_cycles.budget_yen` に月別展開する。各月の `budget_yen` は `reward_cap_yen` をそのまま使う (無ければ `round(amount_tax_excl × 0.65)`)。`contract_source_term_id` を各 cycle に刻む (= 後段の自動確定 cron が「契約由来」と判定する印)。
- `monthly_fixed` / `monthly_average` → `fee_type='monthly_fixed'` / `fee_amount = billing_distribution_json.monthly_tax_excl` (無ければ総額 ÷ 月数) を ② に立てる。③ は触らない (月次収支シミュレータが ② から固定収益を立てる)。
- どちらの場合も ① `contract_terms_json` に契約メタ (期間 / pool / cap / 出典) を畳む。

冪等性: ③ upsert は `onConflict='project_id,ym'`。既に `budget_confirmed` / `allocation_confirmed` / `invoice_sent` / `payment_confirmed` の月は `budget_yen` を上書きしない (人が確定した請求額確定を契約 apply で巻き戻さない)。

### apply 時の必須ガード

- `end_ym` を必ず設定する (契約終了月)。null のまま `monthly_fixed` を残さない (CX 無期限計上事故の再発防止)。
- 期間が複数 term に分かれる契約 (CX: 2025-11〜2026-03 コンサル + 2026-06〜2026-09 設立準備) は、term ごとに ②③ を分けて反映する。1 本の `monthly_fixed` に潰さない。
- `schedule_based` (月により金額が違う) は ② の一律額にせず ③ の月別 `budget_yen` に展開する。
- 本番データ (projects / billing_cycles) の書き換えを伴うため、自動 apply でもまさ確認を挟むか、`/admin/contracts` のレビューで人が承認した term だけを反映する。

## 月次請求額の自動確定 (つくよみ cron / ①案)

> 2026-06-18 まさ確定 (①案)。**契約書が抽出済み (= `contract_terms` を `applied` にした = 人 admin が金額をレビュー済み) なら、毎月の請求額確定は つくよみ が契約由来額を自動で `budget_confirmed` まで進め、PM には「契約通りこの額で確定したよ」と事後通知する**。PM は手入力不要、確認するだけ。これを全 PJ 共通の仕組みにする (KUTE 単発ではなく billing 確定システム全体の変更)。

### 設計の肝 (なぜ PM の月次 tap-confirm を廃止できるか)

`contract_terms` を `applied` にする操作そのものが「人 (admin) が契約金額を確認した」点。これが確認ポイント。以降の月次は契約から機械的に額が決まるので、毎月 PM に同じ額を tap-confirm させるのは無意味。よって applied 以降は つくよみ が自動で `reported → budget_confirmed` まで進め、PM は事後通知 DM を受け取るだけにする。今月だけ違う額になる場合だけ PM がコックピットから直す。

### cron

| 項目 | 値 |
|---|---|
| route | `GET/POST /api/cron/contract-billing-auto-confirm` |
| schedule | `0 22 1 * *` (UTC、毎月1日 22:00 = JST 2日 07:00)。`vercel.json` の crons に登録済み |
| 認証 | `CRON_SECRET` Bearer / `?secret=`。Vercel cron は env `CRON_SECRET` を自動添付。手動 POST は `requireAdmin()` |
| actor | `つくよみ(契約自動確定)` (billing_log / budget_confirmed_by に残る) |
| dry-run | `?dryRun=1` (GET) / `{ dryRun: true }` (POST) で actionable / skipped を返すだけ (write なし) |

### 当月候補の決定 (`src/lib/contract-billing-auto.ts`)

`collectAutoConfirmCandidates(db, ym)` が active な全 PJ から、その ym で契約由来額を確定できる候補を集める。`resolveContractBilling(project, cycle, ym)` の出所:

1. **schedule_based** … その ym の `billing_cycles.contract_source_term_id` が set かつ `budget_reported_amount > 0` または `budget_yen > 0` なら、`budget_reported_amount` を優先し、無ければ `invoiceYen = budget_yen ÷ 0.65` で請求額を逆算する (Contract Apply が ③ に月別 budget_yen を契約由来として刻んでいる)。
2. **monthly_fixed** … `projects.fee_type='monthly_fixed'` かつ `fee_amount > 0` なら `invoiceYen = fee_amount`。

`projects.contract_terms_json.companyReserveBufferYen` / `company_reserve_buffer_yen` / `initialCompanyReserveYen` などに会社回収バッファ総額がある場合、当月までの `billing_cycles.budget_buffer_amount` 消化済み額を差し引き、残額を `invoiceYen × 0.65` の範囲で当月 `bufferYen` として消化する。`companyReserveBufferMonthlyYen` / `company_reserve_buffer_monthly_yen` などの月次上限がある場合は、その金額までしか当月消化しない。`budgetYen = max(0, round(invoiceYen × 0.65) - bufferYen)` がメンバー支払/stock返済に回る当月 cap になる。これは SX 専用ではなく全 PJ 共通。

### 安全弁

- **契約期間ガード** (`isWithinContractPeriod`): `projects.start_ym ≤ ym ≤ end_ym` の月だけ対象。**`end_ym` が null の PJ は対象外** (無期限計上事故の再発防止。Contract Apply が必ず end_ym を埋めるので、apply 済みなら通る)。
- **冪等性**: その月の `billing_cycles.status` が既に `reported` 以降 (`reported` / `budget_confirmed` / `allocation_confirmed` / `invoice_sent` / `invoice_issued` / `payment_confirmed` / `budget_rejected`) なら一切触らない (= 人が触っている月を尊重)。
- **按分の尊重**: schedule_based は ③ の月別 budget_yen をそのまま使うので、月ごとに違う額 (CX: 202606=¥78,000 / 202607-09=¥274,000) が正しく確定される。特定月へのまとめ計上はしない。

### 確定の流れ (1 PJ あたり)

1. `billing_cycles` を upsert: `status='reported'` / `budget_reported_amount=invoiceYen` / `budget_buffer_amount=bufferYen` / `budget_reported_by=つくよみ(契約自動確定)`。
2. `decideBudgetApproval(db, {decision:'approve', actor:'つくよみ(契約自動確定)'})` で `budget_confirmed` まで進める。`budget_yen = 請求額 × 0.65 - budget_buffer_amount` (`calcPjBudget`)。`billing_log` に承認行が残る。
3. その PJ の PM (`project_members.is_pm=true AND is_active=true` → `members.slack_id`) へ Slack DM で事後通知 (つくよみ口調、「契約どおり自動で確定しておいたよ〜」+ コックピットボタン)。通知失敗は致命ではない (確定自体は済んでいる)。

### Contract Apply との関係

cron が機能するには、対象 PJ の契約が Contract Apply 済みであること (schedule_based なら ③ に `contract_source_term_id`、monthly_fixed なら ② に `fee_type/fee_amount/end_ym`) が前提。古い手編集で `contract_source_term_id` や `end_ym` が欠けている PJ は、新 writer で再 apply してから cron 対象になる (2026-06-18 に CX p20 / SX p21 を再 apply 済み)。

#### Contract Apply 適用済み PJ (2026-06-18 時点)

| PJ | 契約相手 | 期間 | distribution | ② fee_type / fee_amount(税抜月額) | term_id |
|---|---|---|---|---|---|
| p20 (CX) | NIMS | term ごと (2025-11〜2026-03 / 2026-06〜09) | monthly_fixed | term 分割 | 複数 |
| p21 (SX) | 愛媛大学 | 202606〜202703 (10ヶ月) | monthly_average | monthly_fixed / 1,048,000 | 8a95d2bd |
| p25 (KUTE) | 学校法人工学院大学 | 202605〜202703 (11ヶ月) | monthly_average | monthly_fixed / 654,545 | d35d3184 |

> 上表は **フル Contract Apply パイプライン (`contracts` 親行 + `applied` な `contract_terms` + ①②③ 反映) を通した PJ** のみ。p06 CTB は variable 契約で fee_amount を立てられないため term は作らず、`end_ym=202702` と `contract_terms_json` メタだけを直接反映した (= 下記「未 apply の契約保有 PJ 監査」の実施状況を参照)。
>
> SX p21 は、契約開始前の役員事前稼働分 800,000 円を AMD 回収バッファとして `projects.contract_terms_json.companyReserveBufferYen=800000` / `companyReserveBufferStartYm=202606` / `companyReserveBufferMonthlyYen=200000` に保存済み。契約自動確定は 202606〜202609 の4か月に 200,000 円ずつ `billing_cycles.budget_buffer_amount` として消化し、残った cap だけを役員会社留保・非役員支払/stock返済へ回す。
>
> KUTE p25 は **役員のみ PJ** (manual/7-1-reward-calc-spec.md L292)。Contract Apply は SX と同型の monthly_average → monthly_fixed 反映。② に税抜月額 654,545 を立て (報酬 cap は ×0.65 = 425,454 を fallback 導出)、③ billing_cycles は触らない。役員は payout から落ちる (再分配しない) ので capped 支払予定 = ¥0 が正しい結果。契約書 = Drive `00_契約_KUTE` の `260501_業務委託契約書(260501_270331)_工学院大学_AMD.PDF` (税込 7,920,000 / 税抜 7,200,000、第7条 毎月均等)。

#### active PJ 全件 Contract Apply カバレッジ監査 (2026-06-18)

> 「active PJ すべてに Contract Apply が行き渡っているか」を、**`projects.status='active'` の全件を母集団**にして監査した (まさ確認込み 2026-06-18)。母集団は SQL `SELECT project_id FROM projects WHERE status='active'` で機械的に確定する (= 「契約保有候補」のような恣意的サブセットで監査しない。当初 p07/p24/p26 を母集団から取りこぼした反省)。
>
> **active PJ 全 11 件の apply 状態 (2026-06-18 時点):**
>
> | PJ | 名前 | category | apply 状態 | 判定 |
> |---|---|---|---|---|
> | p00 | AMD | dtsu | — | 会社本体。契約対象外 |
> | p06 | CTB | dtsu | end_ym=202702 + terms_json (variable, fee_amount=null) | ✅ 反映済 (覚書根拠、無期限リスククローズ) |
> | p07 | LST | advisor | 未 (fee 全 null / billing_cycles 0 / 実契約 PDF なし) | ⏸ 対象外。請求実体ゼロ = 無期限リスクなし。顧問契約/請求が始まったら apply |
> | p10 | SE | advisor | monthly_fixed / ¥100,000 / end_ym=null | ✅ 確定 (満了月未定 = end_ym=null が最終状態) |
> | p19 | ZMP | new_business | monthly_fixed / ¥300,000 + 別財布 extra_revenue_json / end_ym=null | ✅ 確定 (本契約 + 単発 OkuDoor の 2 契約反映済) |
> | p20 | CX | dtsu | applied term×1 + billing_cycles×4 (③ src 付与) | ✅ フル apply 済 (variable, 202606〜202609) |
> | p21 | SX | dtsu | applied term×1 / monthly_fixed ¥1,048,000 / 202606〜202703 | ✅ フル apply 済 |
> | p24 | CLG | advisor | 未 (fee 全 null / billing_cycles 0 / 実契約 PDF なし。contracts は取締役会 cancelled シグナルのみ) | ⏸ 対象外。請求実体ゼロ = 無期限リスクなし。請求が始まったら apply |
> | p25 | KUTE | ecosystem | applied term×1 / monthly_fixed ¥654,545 / 202605〜202703 | ✅ フル apply 済 (役員のみ PJ、payout ¥0 が正) |
> | p26 | VasculaX | dtsu | 未 (fee 全 null / billing_cycles 0 / active member 0 / drive_folder なし) | ⏸ 対象外。立ち上げ直後の枠 PJ。請求実体ゼロ = 無期限リスクなし |
>
> **結論: active PJ で apply すべき契約が残っている PJ は無い。** 契約があって請求が立っている PJ (p20/p21/p25 = フル apply / p06 = variable で end_ym のみ / p10/p19 = monthly_fixed DB 反映済) はすべて反映済み。p07/p24/p26 は **請求実体ゼロ・apply できる契約書なし**で、無期限計上リスクも無い (end_ym=null でも計上対象月が存在しない)。これらは契約締結 → 請求開始の時点で apply する (= 当面 `⏸ 対象外`)。
>
> 終了済 (非アクティブ) の p09/p11/p22/p23 は status≠active なので本監査の母集団外。以前の調査結果は下表に残す (いずれも無期限リスクなしで対象外)。
>
> 値の出所は契約書 + 算定正本 (manual/7-1) + 過去セッションの抽出記録のみとし、生データから budget の意味を再導出しない方針。CX 型の無期限計上事故 (有限契約に end_ym=null) は p06 でクローズ済みで、p10/p19 の null は「実際に満了月が未確定」なので別物。p07/p24/p26 の null は「請求実体が無いので計上対象月が存在しない」ので、これも CX 型とは別物。

| PJ | 契約相手 (DB) | source_cache の契約書 | 契約金額 | end_ym 現況 | 判定 |
|---|---|---|---|---|---|
| **p10 SE** | 翔エンジニアリング | PDF 無し。ただし請求イベント (`業務委託費 税抜 100,000/月`) + Slack「成功報酬明記の業務委託契約書を作成」で月額 ¥100,000 を裏取り済み。DB も既に `monthly_fixed / 100,000` | 月額 ¥100,000 (税抜) | **null = 無期限 (= まさ確定: 満了月未定のため endless で計上)** | ✅ DB は既に正しい (`monthly_fixed / 100,000`)。**満了月は未定 = end_ym=null が最終確定状態** (CX 型事故とは別物。CX は有限契約に null が入っていた誤りだったが、SE は実際に満了月が未確定)。追加 apply 不要 (触らない) |
| **p06 CTB** | CrestecBio | `250926_業務委託契約書_CTB-armada` + `260323_業務委託契約変更覚書` | **金額記載なし**。第3条「業務委託料は都度見積で決定」= variable。料金表 (COO 240,000/月 等) は price list であって契約額ではない | **null**。覚書で有効期間が **2025/9/1〜2027/2/13 (= end_ym 202702)** に延長 | ⚠️ variable のまま。fee_amount は立てられない。**end_ym=202702 を埋める**のみが安全な反映。月別請求は都度見積なので ③ schedule 展開も不可 |
| **p19 ZMP** | 葛飾ロード | **2 契約を過去セッションで抽出済み**: ① 月額 advisory 本契約 (¥300,000/月)、② OkuDoor システム開発 単発 (¥2,000,000 税抜、開発期間 202605〜202610) | ① 本契約 月額 ¥300,000 (税抜) = DB に反映済み (`monthly_fixed / 300,000`)。② 単発開発 ¥2,000,000 は `extra_revenue_json` (別財布) で 202605〜202610 を一定按分 (≈¥333,333/月) | **null = 無期限 (= まさ確定: 契約期間は現状確認できないため endless で計上)** | ✅ DB は既に正しい。① 本契約 ¥300,000 と ② 単発 ¥2,000,000 (別財布) は別契約として両方反映済み。**追加 apply 不要 (触らない)**。本契約capは常に ¥300,000×65%=¥195,000 を基準にし、OkuDoor分は `tag='cap_extra'` の別財布支払として分離する。開発期の `budget_yen` 増額で通常capに混ぜる運用は使わない |
| **p11 BWE** | NIMS | `業務委託契約書_AMD_250716` だが当事者が **Blue Water Energy** (甲乙とも山地正洋)、期間 **2025/7/16〜2025/10/31** で DB 記録 (NIMS / end 202603) と不一致 | variable、金額記載なし | 202603 (終了済) | ❌ **対象外 (まさ確定: 非アクティブ)**。Drive 契約書はグループ内 BWE 契約 (期間 202510 で終了)。終了済 + 請求実体ほぼゼロ。apply 不要 |
| **p09 JC** | JOYCLE | サービス料金表のみ (実契約 PDF 無し) | — | 202603 (終了済) | ❌ **対象外 (まさ確定: 非アクティブ)**。終了済 + 契約書無し + 請求実体ほぼゼロ |
| **p22 OQC** | OptQC | `drive_folder_id` null、契約書無し | — | 202512 (終了済) | ❌ **対象外 (まさ確定: 非アクティブ)**。契約書無し + 請求ゼロ |
| **p23 UST** | 東京科学大 | 契約書無し。請求イベントは `業務委託費 税抜 1円` (名目額) | ¥1 (名目) | 202601 (終了済) | ❌ **対象外 (まさ確定: 非アクティブ)**。名目契約 + 契約書無し |

> **結論 / 実施状況 (2026-06-18 まさ確認込み)**:
> - **(済) p06 CTB**: variable のまま `end_ym=202702` を反映済み (覚書根拠)。`fee_amount=null` 維持 (都度見積)。`contract_terms_json` に sourceTitle / counterpartyName / billingDistribution='per_quote_variable' を格納。**無期限計上リスクを 1 件クローズ**。
> - **(確定・触らない) p10 SE**: DB は既に正しい (`monthly_fixed / 100,000`)。**満了月は真に未定 = end_ym=null が最終確定状態** (まさ確定)。追加 apply 不要。
> - **(確定・触らない) p19 ZMP**: **2 契約構造を過去セッションで抽出済みで両方反映済み** — ① 本契約 月額 ¥300,000 (`monthly_fixed`)、② 単発 OkuDoor システム開発 ¥2,000,000 (税抜) を `extra_revenue_json` (別財布) で 202605〜202610 を一定按分 (≈¥333,333/月)。**¥300,000 は単発ではなく月額本契約**。end_ym=null は endless (まさ確定: 契約期間は現状確認できない)。本契約capは ¥195,000 固定で確認し、OkuDoor分は別財布として分ける。**追加 apply 不要・触らない**。
> - **(対象外) p09 JC / p11 BWE / p22 OQC / p23 UST**: いずれも **非アクティブ (まさ確定で対象外)**。終了済 + 該当 PJ の有効契約書なし (p11 の Drive 契約書はグループ内 BWE 契約で期間 202510 で終了)、または名目額 (UST ¥1)。**無期限計上リスクなし**のため追加 apply 不要。
>
> ⚠️ **過去の監査ミス記録 (2026-06-18)**: 当初このセッションで p19 ZMP の ¥300,000 を「単発/契約書根拠なし → apply 保留」と誤認した。原因は、過去セッションが既に抽出して DB に反映済みの 2 契約構造を、コード/source_cache 探索で再発見しようとしたこと ([feedback_read_spec_before_exploring_code] / [feedback_findings_must_become_docs] の典型的失敗)。**自分や過去のえいみが作った仕組みは、コード探索で再発見せず正本 doc / 抽出履歴を先に確認する**。

## Verification

- `npx tsc --noEmit --pretty false`
- `npm run build`
- `/admin/contracts` local browser確認
- `git diff --check`
- migrationは非破壊DDLのみ。`DELETE` / `TRUNCATE` / `DROP` は使わない
