# シーズン予実表 (Season Budget vs Actual) — 設計正本

> **目的 (まさ 2026-06-19)**: 「そのシーズン(= plan cycle)で合計いくら入ってきて、内訳がどうなってて、差し引きいくらになるか」を**全PJで常時確認**できる予実表。シーズン頭に「予算」を確定し、毎月の入金・支払で「実績」が埋まる予実ビュー。`pt単価バグ`・`役員取りこぼし`・`未割当pt`・`cap/原資の不整合(ZMP)` のような歪みを、まさが不安なく一目で検知できる安全網にする。
>
> 起点: 2026-06-19 SX 愛媛大契約の旅費別請求不可 → pt単価是正 → 役員stock繰越是正の一連で、「入金と配分が閉じているか」を全PJで見える化する必要が判明。

---

## 1. 何を出すか (1 PJ × 1 plan cycle = 1 予実表)

### ① 収入 (Revenue)
| 行 | 予算 | 実績 | ソース |
|---|---|---|---|
| 請求額 (税抜・シーズン合計) | `feeAmount × cycleMonths` (monthly_fixed) or 契約 schedule 合計 | 入金確認済み合計 | `projects.fee_amount`/`contract_terms` / `billing_cycles.payment_confirmed_at` 済みの税抜額 |

### ② 配分 (Allocation) — 予算 vs 実消化
| 行 | 予算 | 実績 | 算定 |
|---|---|---|---|
| バッファ: 営業費用 | 確定値 | 回収済み | `(請求額 − バッファ)×65%` を超える先取り分。**内訳は plan cycle メタに持たせる (下記 §3)** |
| バッファ: 旅費 | 確定値 | 回収済み | 同上 |
| バッファ: その他 | 確定値 | 回収済み | 同上 |
| **メンバー原資 (PJ予算)** | `(請求額 − バッファ) × 65%` = `value_plan_cycles.budget_yen` | 実支払 + 会社留保確定の累計 | reward_summary 集計 |
| AMD マージン (35%) | `(請求額 − バッファ) × 35%` | — | 派生 |
| **合計 (= 請求額)** | バッファ + 原資 + マージン | | **閉じ検算**: 合計 == 請求額 を必ず表示 |

### ③ メンバー別 (pt比 予算 vs 実績)
| 列 | 予算 | 実績 |
|---|---|---|
| 獲得pt (シーズン累計) | 計画pt | 実績pt |
| pt比予算取り分 = `earnedPt × pt単価` | ✓ | — |
| 実支払 (非役員=現金 / 役員=会社留保) 累計 | — | ✓ |
| 今月末 繰越stock (= 未払い債務) | — | ✓ |
| 差 (実績 − 予算) | — | 収束チェック (最終的に 0 が正) |

役員(`is_officer`)は「会社留保」列、非役員は「現金支払」列で分ける (6-5章の支払通知書対象と同じ区分)。

### 検知したい歪み (この表の目的)
- **閉じない**: `バッファ + 原資 + マージン ≠ 請求額` → 設定ミス。
- **未割当pt**: `total_points − Σ(MS points, goal_level≠monthly)` → MS未設定 / MS過剰配分の穴。
- **原資 ≠ Σ月cap**: `value_plan_cycles.budget_yen ≠ Σ billing_cycles.budget_yen` → cap/原資の不整合 (ZMP で検出)。
- **pt単価過大**: 本契約 `pt単価 ≠ (請求額−バッファ)×65% ÷ (シーズン期間の月数×10pt)` → バッファ未反映 / 分母汚染バグ。
- **役員取りこぼし**: 最終月で役員stockが0に収束しない → 役員繰越が効いてない。

---

## 2. データソース (既存・新規追加なしで作れる)
- `value_plan_cycles` (plan_cycle_id, project_id, status, period_start_ym, period_end_ym, total_points, budget_yen)
- `billing_cycles` (project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json, payment_confirmed_at)
- `projects` (fee_type, fee_amount, start_ym, end_ym)
- 計算は `src/lib/reward-summary.ts` の既存集計を流用 (各月 reward_summary_json の members[].{earnedPt, regularBasePay, totalPay, companyReserveYen, stockYen, payoutExcluded})。
- 請求額(税抜): monthly_fixed = `fee_amount × cycleMonths`。schedule_based は `contract_terms` の月別合計。
- pt単価: 本契約は `budget_yen ÷ (シーズン期間の月数×10pt)`。別財布は `Σextra_budget_yen ÷ Σcap_extra pt`。

---

## 3. 唯一の新規データ: バッファ内訳
現状 `billing_cycles.budget_buffer_amount` は月次の数値のみで**内訳(営業/旅費/その他)を持たない**。予実表の②バッファ行を埋めるには内訳が要る。

**方針 (最小)**: `value_plan_cycles` に `buffer_breakdown_json jsonb` を追加。
```json
{ "items": [
  {"label":"営業費用(PJ獲得)","amount":800000},
  {"label":"旅費(10万×10ヶ月)","amount":1000000}
], "total": 1800000 }
```
- pt単価の原資は引き続き `value_plan_cycles.budget_yen = (請求額 − Σbuffer_breakdown) × 65%` (= 既存ロジックそのまま、人がこの値を入れる)。
- `buffer_breakdown_json` は**表示専用**(原資計算には `budget_yen` を使う)。内訳の合計と `(請求額×65% − budget_yen)/0.65` が一致するか検算列を出す。
- migration: `scripts/migrations/NNN_value_plan_cycle_buffer_breakdown.sql` で列追加 → `dump_schema.py` 再生成。

> 恒久案 (別タスク): バッファを第一級入力にし、`deriveRewardBudgetForPt` が `(請求額 − Σbuffer) × 65%` を自動計算する。そうすれば `budget_yen` 手入力が不要になる。今回は表示のみ追加で先行。

---

## 4. 画面配置
- **新規 admin ページ `/admin/season-pl`** (= 全PJ一覧 + PJ選択でシーズン予実表)。
- 入口: `/admin/payouts` と `/admin/invoices` の近くにリンク (6-5/6-3章の admin 導線)。FEATURE_REGISTRY に登録。
- 一覧トップ: 全 active plan cycle を1行ずつ (PJ / 請求額 / バッファ / 原資 / pt単価 / 閉じ検算✓✗ / 未割当pt / 原資≠Σcap 警告)。
- 行クリック → そのシーズンの①②③フル予実表。
- 既存UIパターンは `/admin/payouts` (`AdminPayoutsClient.tsx` 等) を踏襲。

---

## 5. 実装ステップ (2026-06-19 実装完了 ✅)
1. ✅ migration `148_value_plan_cycle_buffer_breakdown.sql` で `value_plan_cycles.buffer_breakdown_json jsonb` 追加 + `dump_schema.py` 再生成。
2. ✅ 集計ロジック `src/lib/season-pl.ts` `computeSeasonPl` 純関数: plan cycle → {revenue, buffer items, member原資, AMDマージン, members[](pt比予実), 検算フラグ} を返す。`reward-summary.ts` の `buildRewardSummary` を cycle 全期間に集約 (cap + stock 繰越連鎖は内部で効く)。
3. ✅ API `GET /api/admin/season-pl` (`mode=list` 全 active cycle 一覧 / `?planCycleId=` で `mode=detail` 単一 cycle 詳細)。
4. ✅ ページ `/admin/season-pl` (一覧 + 詳細)。`AdminSeasonPlClient.tsx`。AdminSidebar に `シーズン予実` 導線。FEATURE_REGISTRY 登録 + `check_pwa_critical_ui.cjs` anchor。
5. ✅ SX `PC-p21-202604.buffer_breakdown_json` に {営業80万, 旅費100万} 投入済み。
6. ✅ build → deploy (v0.29.0)。

### 実装で確定した検算の定義 (設計時の文言を実データで修正)
- **未割当pt**: 設計の `Σ(earnedPt) < total_points` は期中だと必ず不足して誤検知するため、`total_points − Σ(MS points, goal_level≠monthly)` で判定する (= pt単価分母が MS で裏打ちされているか)。**SX で 120pt 設定 vs MS 119pt = 1pt 穴を実検出**。加えて担当者 share 合計 0 で points を持つ MS (宙吊り pt) も検出する。
- **収束差 (member delta)**: `(実支払 + 最終stock) − earnedPt×pt単価`。期中は支払が先行するので 0 にならないのが正常。最終月で 0 に収束するのが正。
- **実データ確認の発見 (要・別タスク監査)**:
  - SX: closes/原資=Σcap/pt単価/役員収束すべて ✅。未割当 1pt の穴のみ (要 MS 1pt 補完 or total_points を 119 に是正)。
  - ZMP: `原資≠Σ月cap` (Σcap 366万 > 原資 234万) + 役員stock非収束 (まさ stock 約4万残) + 未割当10pt。**設計が予言した ZMP cap/原資不整合をそのまま検出**。別財布(OkuDoor)cap が Σcap を押し上げている構造。
  - KUTE: `閉じない` + `pt単価不整合`。原資 720万 ≈ 請求額 720万 (= バッファ 0 だが (請求×65%) ではない)。budget_yen が (請求−バッファ)×65% の式から外れている設定異常。

---

## 5.1 ZMP (p19) 別財布不一致の解析と是正方針 (2026-06-20)

> **2026-07-09 正本更新**: 本契約 regular の pt 分母は **シーズン期間の月数×10pt** で固定する。別財布 cap_extra は原則 MS期間の月数×10ptだが、別財布原資や支払額が先に決まる金額ベース予算だけ `value_milestones.points > 0` の明示ptを優先する。ZMP 202601〜202612 は regular 120pt、OkuDoorシステム開発 202605〜202610 は金額ベース特例で cap_extra 130pt、`value_plan_cycles.total_points` は 250pt を保存する。以下の 2026-06-20 時点の 110pt / 177pt 記述は履歴として残すが、新規修正では使わない。

予実表が検出した ZMP の不一致を実コードで解析した結果、原因は2つに分離できた。

### 現状構造
- `PC-p19-202601-202612`: budget_yen=2,340,000 (本契約 30万×0.65×12), total_points=**187**。
- MS: 本契約系 (normal/routine) = 110pt、別財布 OkuDoor開発 (`tag=cap_extra`) = 67pt。**合計 177pt**。
- 別財布売上 OkuDoor = 税抜200万 (`billing_cycles.extra_revenue_json`、202605〜202610 を6ヶ月按分)。

### 原因 (2つ)
1. **total_points=187 が誤り** (正しくは 110+67=**177**)。10pt の phantom。`rewardPointBasis` は cap_extra pt を総ptから引くので regular pt単価分母 = 187−67=120 (正しくは110)。pt単価が 234万÷120 に薄まる。
2. **cap_extra プールに cap が無い**。`deriveMonthlyRewardCaps` は `extraCapYen` を常に0で返し、`applyRewardCapsForMonth` が `effectiveExtraCapYen = 需要全額` にフォールバックする。結果 OkuDoor 67pt は開発期間中 (202605〜202610) **毎月需要全額が即支払**われ (各月 extraStock=0)、Σ月cap を 218k×6 ≈ 130万 押し上げる。これが「原資≠Σcap」の正体。さらに 202609〜 で本契約 regular pool が逼迫し regStock が末月 129,675 残る (役員stock非収束)。
   - 補足: extra プールの pt単価は `extraPtUnit = regularPtUnit` で、OkuDoor 自身の売上原資 (130万÷67) ではなく regular pt単価を借りている。extra プールに独立 budget が無いのが根本。

### 是正方針 (まさ確定 2026-06-20: まずB案、足りなければ物理分離)
別財布を「同一 plan cycle 内の別プール (cap_extra)」として正しく扱う。物理的に別 plan cycle に分けると `choosePlanCycle` が1月1cycle前提のため period 重複 (202605〜202610) でエンジン大改修が要る。B案は period 重複なしでエンジン改修最小。
- **A. 本契約是正**: `total_points` 187→**177**。これで regular pt単価分母 = 177−67 = 110 となり 234万÷110=21,273 に正常化、Σcap も本契約分のみで原資と一致へ向かう。
- **B. 別財布 cap = 完了月一括**: cap_extra プールに月次 cap を持たせ、開発期間中 (202605〜202609) は extraCap=0 で全額 stock 繰越、**完了月 202610 に満額 cap (OkuDoor 売上原資 130万)** を置いて一括支払。`budget_yen=0 → 全額繰越` の既存契約 (spec 7-1) を extra プールにも適用する形。
- **C. OkuDoor pt単価独立化** (要検討): extra プールの pt単価を OkuDoor 売上原資 (130万÷67) から導出する。現状 regular と同単価で借用しているため、原資の閉じが extra 側でズレる。
- **要・新規データ**: extra プールの月次 cap (= 完了月だけ満額) をどこに持つか。billing に extra 用 budget 列が無いため、(1) `billing_cycles` に `extra_budget_yen` 追加、または (2) MS 期間 + 売上原資から「完了月一括」を自動導出、のいずれか。実装時に確定する。

> **未確定論点**: 上記 B/C はエンジン (`reward-summary.ts`) の cap_extra プールに budget/cap 機構を新設する改修。影響は reward-summary + season-pl + payouts の extra 表示。実装前に「extra cap をどこに持つか」を1つ選ぶ。

### 実装 (2026-06-20, まさ確定: extra cap は billing_cycles.extra_budget_yen)
- migration `149_billing_cycles_extra_budget.sql`: `billing_cycles.extra_budget_yen int4`。NULL=cap未設定(従来=需要全額即払い) / 0=全額stock繰越 / N=上限N円。
- `reward-summary.ts`:
  - `deriveMonthlyRewardCaps` が `extraCapYen` を `billing.extra_budget_yen` から導出 (`number | null`)。`applyRewardCapsForMonth` は `null`=従来フォールバック、明示値(0含む)=その額をcapにする。
  - **C (extra pt単価独立化) も同時実装**: `extraPtUnit = Σ(extra_budget_yen) ÷ Σ(cap_extra pt)`。これをしないと extra 需要 (67pt × regular単価21,273=142万) が extra原資130万を超え、完了月capで消化しきれず翌月へ溢れる。独立化で extra需要=130万=cap で過不足なく一括消化される。
- **DB是正で実証完了 (2026-06-20, total_points=177, extra cap 202610=130万満額, 他月0, OkuDoor share まさ0.6923/うめ0.1538/あび0.1538)**:
  - regular pt単価 = 234万÷110 = **21,273** (汚染解消 ✅)。
  - extra pt単価 = 130万÷67 = **19,403** (独立 ✅)。
  - OkuDoor: 202605〜202609 は extraStock 積立 (extraPaid=0)、**202610 に一括支払・extraStock=0** ✅ = 完了時一括。**うめ/あび各 199,850 (≈20万)・まさ役員分 会社留保900,298、OkuDoor総消化 1,299,998 ≈ 原資130万にぴったり閉じる**。
  - **完了月capは「満額130万」が正 (A案)**。当初「残額 (130万−既払218,205)」も検討したが、202605の既払い(うめ/あび各32,760・まさ会社留保152,685)は旧 pt単価19,500ベースで新原資配分と食い違い、保護したまま残額capにすると各23万に膨らむ (二重計上)。**202605の保護フラグ (reward_paid_at/notice) を一時解除して全期間を新ロジックで再計算 → 復元**することで既払いを新ロジックで打ち消し、完了月満額130万で各20万ぴったりに収束させた。202605は `monthly_reward_payout` (実支払記録) に行が無く現金未払いだったため上書き無害。
  - **予実表 `computeSeasonPl` も別財布対応に改修** (同 commit): pt単価を regular/extra 分離 (`regularPtUnitYen`=原資÷regular pt / `extraPtUnitYen`=Σextra_budget_yen÷extra pt)、member の `budgetShareYen` を `regularEarnedPt×regular単価 + extraEarnedPt×extra単価` で計算、検算④を regular 分母で突合。これをしないと予実表が別財布 pt も `原資÷total_points` で薄める旧汚染と同型になり、member の収束Δが全員大きくズレる。是正後は全member 収束Δ ±5円。
  - **別件の残課題 (本fix対象外, OS task `task_20260620015628_8lzmx`)**: regular プールが 202609〜 で単月需要 > 単月cap (195k) となり、フラットcapでは末月までに払い切れず年末 regStock 約21.3万 (役員stock まさ65,411+きよ15,216 = 80,627 含む) 残る。最終月で全員 extraStock=0 = OkuDoor別財布は完済済みで、残るのは全て regularStock。**OkuDoor とは無関係の、ZMP 本契約の MS スケジュールが後半に偏っているのに月次capがフラット**という timing 問題。別タスク (cycle 延長 or 翌cycleへ繰越許容 or 後半cap増) で扱う。

---

## 5.2 別財布 (cap_extra) 処理プレイブック (汎用・正本) — 2026-06-20 確定

> **このセクションが別財布処理の正本手順。新しい別財布案件が来たら、特殊計算を一切作らず、この3ステップに沿って既存の共通ルール (65%/pt単価/cap/繰越) に乗せる。** ZMP/OkuDoor で実証済み。

### 大原則 (まさ確定)
- **計算ルール (65%・pt単価・cap・繰越) は全PJ共通のまま不変**。別財布も特殊計算しない。
- 別財布は「**同一 plan cycle 内の別プール (cap_extra)**」として扱う。**物理的に別 plan cycle に分けない** (`choosePlanCycle` が「1月に period 内の1cycleだけ返す」前提なので、本契約と period が重なると本契約MSが報酬計算から消える事故になる。BUGS.md 2026-06-20 教訓1)。
- 別財布のメンバー支払いは「**先に支払額が確定** → それに合わせて pt と share を後付け調整」。原則は MS期間月数×10ptだが、原資や支払額が金額ベースで確定している場合だけ、割り切れる明示ptを使う (OkuDoor: 原資130万・130pt・extra単価10,000円/pt、share まさ0.692308 / あび・うめ各0.153846 で各20万円に閉じる)。

### 3ステップ
**① 別財布の売上を `billing_cycles.extra_revenue_json` に計上** (= PL/キャッシュの売上側)
- 計上月は **請求日ベースの billing 月** の1行に置く (例: OkuDoor は請求 2026-03 → ym=202603 の `extra_revenue_json`)。
- `{label, amount_tax_excl, billing_date, period_start_ym, period_end_ym, freee_invoice_number, memo}` を持たせる。`period_*` で開発期間に按分される (PL表示用。原価計算には使わない)。
- これは「売上が OS に存在する」ための計上。**pt単価原資 (extra_budget_yen) とは別物**なので混同しない。

**② 別財布の MS を `tag=cap_extra` で作り、期間と share を決める** (= 原価/配分側)
- 別財布の作業を表す MS を `value_milestones` に `tag='cap_extra'` で作る (`period_start_ym`〜`target_ym` = 開発期間)。`goal_level` は `monthly` 以外 (annual 等)。
- **pt は原則 MS期間の月数×10pt**。ただし金額ベースで原資や支払額が先に決まっている別財布だけ、`value_milestones.points` に明示ptを入れて優先する。例: OkuDoor 別財布は 202605〜202610 の6か月だが、130万円を割り切るため 130pt、extra pt単価は 130万÷130=10,000円/pt。`value_plan_cycles.total_points` には **シーズン期間月数×10pt + cap_extra effective pt** を入れる (ZMP 12か月 + OkuDoor130ptなら 120+130=250)。通常 MS の配分 pt 合計で本契約単価を動かさない。
- `milestone_responsibility.share` は「**先に決まった支払額 ÷ (cap_extra effective pt × extra pt単価)**」から逆算。extra pt単価 = `Σextra_budget_yen ÷ Σcap_extra effective pt` (③で確定)。役員は会社留保になるので share の残りを役員に寄せる。

**③ 別財布原資の「支払タイミング」を `billing_cycles.extra_budget_yen` で表現** (= 別プールの月次cap)
- 規約 (本契約 `budget_yen` と同じ): **NULL=cap未設定(従来=需要全額即払い・非推奨) / 0=その月は全額stock繰越 / N=その月の上限N円**。
- **完了時一括支払にしたい** (典型) → 開発期間中の月を全部 `0` (全額繰越)、**完了月に満額 (= 別財布売上原資)** を置く。これで開発期間は extraStock 積立 → 完了月に一括消化・extraStock=0。
- **分割支払にしたい** → 各支払月に按分額を置く。共通の cap+繰越ロジックがそのまま効く。
- extra pt単価は `Σ extra_budget_yen ÷ Σ cap_extra pt` で**自動的に独立化**される (regular pt単価を借用しない)。これにより別財布需要 (pt×単価) が別財布原資にちょうど一致し、過不足なく消化される。

### 既払い (過去に旧ロジックで払ってしまった月) がある場合
- 別財布対応前に「cap無し=需要全額即払い」で既に払われた月があると、その月の snapshot は旧 pt単価で固定されており新原資配分と食い違う。
- **対処**: その月が PAID保護 (reward_paid_at/payout_notice_uploaded_at/payment_confirmed_at) で sync からskipされるなら、**保護フラグを一時 NULL → `syncRewardSummariesForProject` で全期間再計算 → フラグ復元**する。これで既払い月も新ロジックで計算し直され、完了月capは**満額** (差し引かない) で正しく閉じる。
- **前提確認**: `monthly_reward_payout` にその月の実支払行が無い (= 現金未払い・通知書だけ) ことを確認してから保護解除する。
- **実支払い済みなら覆さない**: すでに送付済み/支払済みの金額は変更しない。現行ロジックより多く払っていた差額を調整する場合は `reward_member_liability_offsets` に同一メンバー本人の相殺額を記録し、以後の `buildRewardSummary` で本人の未払stockからだけ差し引く。会社留保・他メンバー未払・PJ全体バッファには押しつけない。小額差分を経営判断で許容する場合は台帳に入れない。別財布の保護月で `extraPaidYen=0` なら、未払い在庫の端数差だけを台帳化せず、未来の未保護月を現行ptで再計算して閉じる。

### 実支払い済み差分の本人別相殺台帳 (2026-07-02)
- テーブル: `reward_member_liability_offsets`
- 単位: `project_id × plan_cycle_id × member_id × pool × applies_from_ym`
- 意味: 送付済み/支払済みの金額が現行報酬正本より多い場合、その差額を同じ本人の未払stockから相殺する監査台帳。
- 計算: capped 計算後、対象月以降の本人 `regularStockYen` / `extraStockYen` から消化する。`pool='any'` は regular → cap_extra の順で、本人の未払残が足りなければ残額を翌月以降へ持ち越す。
- ZMP 2026シーズン: 2026年7月のポイント制移行より前に合意・支払済みだった月は、新制度との差額を支払控除に使わない。旧制度月由来の差額台帳は監査用に残しても、報酬計算では `voided` / 読み飛ばし対象にする。

### 適用後の検証 (必ず)
1. `reward-summary` 再計算後、最終月で **対象メンバーの extraStock=0** (= 別財布完済) を確認。
2. `computeSeasonPl` (予実表) で **①closes ②pt完全割当 ③原資=Σcap ④pt単価整合 が全✅**、member の **収束Δが±数円** を確認。
3. うめ・あび等の **extra現金累計が目標額 (例 各20万) に収束**、別財布総消化が**原資にぴったり閉じる**ことを確認。
4. ⑤役員収束が❌でも、残stockが全部 regularStock (extraStock=0) なら別財布は無関係 (本契約のcap timing 問題 = 別件)。

### 関連実装
- migration `149_billing_cycles_extra_budget.sql` / `reward-summary.ts` (`deriveExtraCapYen` / `sumExtraPoolBudgetYen` / extra pt単価独立化) / `season-pl.ts` (別財布 pt単価分離) / `BUGS.md` 2026-06-20 教訓。

---

## 6. 関連
- 報酬計算正本: [`manual/7-1-reward-calc-spec.md`](../manual/7-1-reward-calc-spec.md) (pt単価原資=(請求額−バッファ)×65% / 役員stock繰越)
- 請求: [`manual/6-3-invoice-and-billing-routine-spec.md`](../manual/6-3-invoice-and-billing-routine-spec.md)
- 支払/payouts: [`manual/6-5-admin-payouts-reward-notice-spec.md`](../manual/6-5-admin-payouts-reward-notice-spec.md)
- 起点の議論: 2026-06-19 SX 旅費別請求不可 → pt単価是正 → 役員繰越是正 (本セッション handoff)

## Changelog
| 日付 | 変更 | 誰 |
|---|---|---|
| 2026-06-19 | 初版。SX一連の議論から予実表を設計正本化。データソース・バッファ内訳列・画面配置・実装ステップを確定 | えいみ |
| 2026-06-19 | §5 実装完了 (v0.29.0)。migration 148 + `season-pl.ts` + `/admin/season-pl` + API + FEATURE_REGISTRY + critical-ui anchor。未割当pt 検算を `total_points − Σ(MS points)` に修正。SX 1pt 穴 / ZMP cap-原資不整合 / KUTE 非閉じ を実検出 (別タスク監査へ) | えいみ |
| 2026-06-20 | §5.1 別財布 cap_extra エンジン実装 (migration 149 + `reward-summary.ts` extra cap/extra pt単価独立化)。ZMP DB是正を実証完了 (total_points 177 / OkuDoor share 0.6923系 / extra_budget_yen 202610=130万)。完了月cap=満額130万 (A案: 202605保護一時解除→全期間再計算→復元で既払い打ち消し)。うめ/あび各20万・OkuDoor総消化130万にぴったり収束。§5.2 別財布処理プレイブック (汎用3ステップ) を正本化。`computeSeasonPl` を別財布対応 (regular/extra pt単価分離) に改修 | えいみ |
| 2026-07-02 | 実支払い済み差分の本人別相殺台帳を追加。支払済み通知書は変更せず、会社留保や他メンバー未払ではなく同一メンバー本人の未払stockからだけ差し引く方針を正本化 | えいみ |
| 2026-07-09 | 金額ベースで先に決まる別財布だけ、cap_extra の明示ptを期間×10ptより優先する特例を追加。ZMP OkuDoor は 130pt / extra単価10,000円 / total_points 250へ是正し、別財布未払い在庫だけの保護月差額は台帳化しない方針を追記 | えいみ |
