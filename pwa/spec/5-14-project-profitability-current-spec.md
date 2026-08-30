# PJ別 利益構造ダッシュボード 現行仕様

> **この章は何か**: `/admin/project-profitability`（PJ別 利益構造）の contract。
> PJのシーズンごとに、決まっている原資が「外部メンバーへの現金支払」と「会社に残る分」へ
> どう分かれたかを並べ、どのPJが利益を残せているかを判定する画面。

## 目的

まさが見て、次を判定できることを要件にする。

1. どのシーズンが利益を残せていて、どこから現金が出ていっているか
2. ポイントの消化量が、シーズン原資に対して過大になっていないか
3. 原資はあるのに報酬計算がまだ動いていないシーズンはどれか

`/admin/season-pl`（シーズン予実表）は plan_cycle 単位でバッファ・pt単価・stock収束まで厳密に検算する。
この画面はそこまでの精度を持たず、`billing_cycles.reward_summary_json` をシーズン期間で合算する軽量集計。
目的は月次の整合性検証ではなく、シーズン間の収益率比較。

## なぜ年ではなくシーズン単位か

> **2026-08-30 まさ確定**: 「そのシーズンで払うべき額は最初から決まっているわけなので、
> シーズン全体で試算した方がよくない？ 現状未払かどうかって、そのPJの収益率を見るうえでは
> 邪魔な情報だと思う。」

そのとおりで、シーズンで払う総額は `value_plan_cycles.budget_yen` として最初から確定している。
月ごとの cap 按分は**いつ払うか**を決めているだけで、**いくら払うか**ではない。
だから月末時点の未払残は収益率を見るうえでノイズにしかならない。

実際、配分が進んだシーズンでは **外部支払 + 会社留保 = シーズン原資** にぴったり一致する。

| シーズン | 原資 | 外部へ現金 | 会社に残る | 合計 |
|---|---|---|---|---|
| KUTE 202605-202703 | 4,679,994 | 0 | 4,679,994 | 4,679,994 |
| CX 202606-202609 | 585,000 | 0 | 585,000 | 585,000 |

総額は固定で、変わるのは外部と社内の**配分比だけ**。それが収益率そのもの。

シーズンは年をまたぐ（SX は 202604-202703、KUTE は 202605-202703）。
1つのPJが複数シーズンを持つこともある（SX は 202601-202603 と 202604-202703）。
年で切ると1シーズンが分断され、比較の単位として成立しない。

## 前提となる報酬モデル

計算正本は [`pwa/manual/7-1-reward-calc-spec.md`](../manual/7-1-reward-calc-spec.md)。前提として重要なのは4点。

1. **シーズン原資 =（請求額 − 契約バッファ）× 65%**（= `value_plan_cycles.budget_yen`）。
   残り35%は AMD運営費30% + クローザー報酬5% の外枠で、`reward_summary_json` には入らない。
2. メンバーはマイルストーンのポイントを消化して**稼働需要**（`grossDueYen`）を発生させ、原資を按分する。
3. `payoutExcluded`（= `members.exclude_from_payout_notice = true`）のメンバーへ按分された分は
   現金支払されず、`companyReserveYen` として**会社に残る**。まさ・きよはこの区分。
4. したがって **まさがポイントを多く消化するほど、外部メンバーへ配る額が減り、会社に残る額が増える**。
   まさへの現金支払が0円なのは設計どおりであり、配分の放棄でも持ち出しでもない。

> **これまでの読み違い（3件、いずれも 2026-08-30 にまさが指摘）**
> 1. `billing_cycles.budget_yen` を「売上」として扱い、比率の分母へさらに `× 0.65` を掛けた。
>    budget_yen は既に65%後の額なので二重適用になる。ZMPを2.78×、CXを1.67×と誤表示して誤警報を出した。
> 2. まさの `grossDueYen>0` かつ `totalPay=0` を「持ち出し警報」として赤で出した。意味が逆。
> 3. 年で切り、月次の未払残を列に出した。上記のとおりシーズンで見るのが正しい。

## 入口

| 面 | route | 権限 |
|---|---|---|
| Admin | `/admin/project-profitability` | admin のみ（`AdminLayout` が `members.is_admin` を見て弾く） |

`ADMIN_SURFACE_GROUPS`（`src/lib/surface-catalog.ts`）の「契約・お金」グループに登録済み。

## データソース

集計は DB を持たない純粋な TypeScript（`pwa/src/lib/project-profitability.ts`）。

| 入力テーブル | 用途 |
|---|---|
| `value_plan_cycles` | **行の単位**。`budget_yen`（シーズン原資）、`period_start_ym` / `period_end_ym`、`status`（active / fixed） |
| `billing_cycles` | `reward_summary_json`（外部支払・会社留保・稼働需要・メンバー別内訳）を期間で合算、`status`（未確定月の判定） |
| `projects` | `project_id` → `project_name` の表示名解決 |
| `members` | `member_id` → `code_name`（表示名。`members.name` というカラムは存在しない） |
| `tally_weekly_effort_entries` | まさ（`member_id='ID001'`）の `development_hours + meeting_hours` をシーズン期間で合算 |

`budget_yen` が 0 または期間の入っていないシーズンは、収益率を出せないので行にしない。

## 指標の定義（1行 = 1シーズン）

| 列 | 定義 |
|---|---|
| 請求額(推定) | `シーズン原資 ÷ 0.65`。契約バッファを引く前の額なので、実際の請求額より小さく出る |
| シーズン原資 | `value_plan_cycles.budget_yen`。**月次 `budget_yen` の合計ではなく、シーズン正本の確定値** |
| 外部へ現金 | Σ `reward_summary_json.externalPayoutCapYen`（支払対象メンバーへ出る現金） |
| 会社に残る | Σ `reward_summary_json.companyReserveYen`（支払対象外メンバーへの非現金配賦） |
| 配分 | 原資を100としたときの「外部へ現金」「会社に残る」「未配分」の内訳バー |
| 残る率 | `会社に残る ÷ シーズン原資`。**高いほど利益が出ている** |
| まさ時間 | Σ `development_hours + meeting_hours`（`member_id='ID001'`、シーズン期間の週） |
| まさ1時間あたり | `請求額(推定) ÷ まさ時間` |

**未払残（`stockYen`）はこの画面では扱わない。** 月次の支払タイミングの差であって、
シーズン総額は動かないため。期末の未払残を検算したいときは `/admin/season-pl` を使う。

### 進行中シーズンの扱い

シーズン全体の試算なので、`status='not_started'` の未確定月の見込みも合算する。
副題に「未確定Nヶ月を含む見込み」と出して、確定値でないことを明示する。
配分が済んでいない分は「未配分」として内訳バーと金額で見せる。

### メンバー別内訳（行クリックで開く）

| 列 | 定義 |
|---|---|
| メンバー | `members.code_name`。`payoutExcluded` のメンバーには「会社に残る区分」を表示 |
| 稼働需要額 | Σ `members[].grossDueYen` |
| 現金で支払 | Σ `members[].totalPay` |
| 会社に残る | Σ `members[].companyReserveYen` |

3つとも0のメンバー行は出さない。

## 警報

| 警報 | 条件 | 意味 |
|---|---|---|
| 需要 N× | `稼働需要 ÷ シーズン原資 > 1.5` | ポイントの消化量が原資に対して大きすぎる。マイルストーン設定の見直し対象 |
| 報酬計算まだ | `原資 > 0` かつ `稼働需要 = 0` | 原資はあるが、このシーズンの報酬計算が動いていない |

並び順は「進行中を上、その中で原資の大きい順」。警報は並び順に混ぜず、PJ名の横にラベルで出す。

## 参照系キャッシュ

`billing_cycles` / `value_plan_cycles` は月次締めでしか更新されない参照系。規範は
[`5-10 参照系データのキャッシュ`](5-10-reference-data-caching-current-spec.md)。3層すべてを通す。

| 層 | 実装 | TTL |
|---|---|---|
| 1. サーバのプロセス内スナップショット | `src/lib/project-profitability.ts`（全シーズン1本、single-flight、`.range()` でページ読み） | 5分（`PROJECT_PROFITABILITY_CACHE_TTL_MS`） |
| 2. HTTP キャッシュ | `src/app/api/admin/project-profitability/route.ts` の `Cache-Control` | `max-age=60, stale-while-revalidate=600` |
| 3. クライアントのモジュールキャッシュ | `src/lib/project-profitability-client.ts`（`@/lib/reference-data-cache` 経由） | 既定5分 |

シーズン数は十数件なので1回で全件返す。年やPJでの分割読みはしない。

- `?fresh=1` で 1 層を強制再読込し、`Cache-Control: no-store` を返す（月次締め直後の確認用）。
- 月次締め・報酬再計算の書き込み経路からは `invalidateProjectProfitabilityCache()` を呼ぶ。
- guard（`scripts/check_reference_data_cache_contract.mjs`）の `REFERENCE_DATA_ENDPOINTS` に登録済み。

## 関連

- [`7-1 報酬計算ロジック 詳細仕様`](../manual/7-1-reward-calc-spec.md) — 65%・pt単価・cap按分・`payoutExcluded` の正本
- [`5-10 参照系データのキャッシュ`](5-10-reference-data-caching-current-spec.md)
- `/admin/season-pl` — plan_cycle 単位の厳密な予実検算（期末未払残の収束はこちら）
