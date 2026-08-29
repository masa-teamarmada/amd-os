# PJ別 利益構造ダッシュボード 現行仕様

> **この章は何か**: `/admin/project-profitability`（PJ別 利益構造）の contract。
> PJごとに、メンバー配分枠のうちいくらが外部メンバーへの現金支払として出ていき、
> いくらが会社に残ったかを年単位で並べ、PJ間で比較するための画面。

## 目的

まさが毎月見て、次を判定できることを要件にする。

1. どのPJが現金を残せていて、どのPJから現金が出ていっているか
2. 発生した稼働が、配れる枠に対して過剰になっていないか
3. 配分枠はあるのに報酬計算がまだ動いていないPJはどれか

`/admin/season-pl`（シーズン予実表）は plan_cycle 単位でバッファ・pt単価・stock収束まで厳密に検算する。
この画面はそこまでの精度を持たず、`billing_cycles.reward_summary_json`（月次報酬計算の確定スナップショット）を
**年単位でそのまま合算**する軽量集計。目的は月次の整合性検証ではなく、年単位のPJ間比較。

## 前提となる報酬モデル

計算正本は [`pwa/manual/7-1-reward-calc-spec.md`](../manual/7-1-reward-calc-spec.md)。この画面を読む前提として重要なのは次の4点。

1. **クライアントへの請求額 × 65% がメンバー配分枠**（= `billing_cycles.budget_yen`）。
   残り35%は AMD運営費30% + クローザー報酬5% の外枠で、`reward_summary_json` には入らない。
2. メンバーはマイルストーンのポイントを消化して**稼働需要**（`grossDueYen`）を発生させ、配分枠を按分する。
3. `payoutExcluded`（= `members.exclude_from_payout_notice = true`）のメンバーへ按分された分は
   現金支払されず、`companyReserveYen` として**会社に残る**。まさはこの区分。
4. したがって **まさがポイントを多く消化するほど、外部メンバーへ配る枠が減り、会社に残る額が増える**。
   まさへの現金支払が0円なのは設計どおりであり、配分の放棄でも持ち出しでもない。

> **2026-08-30 まさ訂正**: 初版はこの4点目を取り違え、「まさの `grossDueYen>0` かつ `totalPay=0` が
> 3ヶ月続く」ことを *持ち出し警報* として赤で出していた。これは経営上の意味が逆で、実際には
> 「まさが枠を取って現金流出を抑えられている」望ましい状態を異常として表示していた。警報ごと削除した。

## 入口

| 面 | route | 権限 |
|---|---|---|
| Admin | `/admin/project-profitability` | admin のみ（`AdminLayout` が `members.is_admin` を見て弾く） |

`ADMIN_SURFACE_GROUPS`（`src/lib/surface-catalog.ts`）の「契約・お金」グループに登録済み。

## データソース

集計は DB を持たない純粋な TypeScript（`pwa/src/lib/project-profitability.ts`）。

| 入力テーブル | 用途 |
|---|---|
| `billing_cycles` | `budget_yen` / `extra_budget_yen`（配分枠）、`reward_summary_json`（実効枠・外部支払・会社留保・稼働需要・メンバー別内訳）、`status`（実績/計画の判定） |
| `projects` | `project_id` → `project_name` の表示名解決 |
| `members` | `member_id` → `code_name`（表示名。`members.name` というカラムは存在しない） |
| `tally_weekly_effort_entries` | まさ（`member_id='ID001'`）の `development_hours + meeting_hours` を対象年で合算 |

## 指標の定義（1行 = 1 PJ、年切替あり）

| 列 | 定義 |
|---|---|
| 請求額(推定) | `配分枠 ÷ 0.65`。契約バッファを先取りしている月はやや過大に出る |
| 配分枠 65% | Σ `(budget_yen + extra_budget_yen)`（実績月のみ）。**請求額ではなく65%後の額** |
| 外部へ支払 | Σ `reward_summary_json.externalPayoutCapYen`（支払対象メンバーへ実際に出た現金） |
| 会社に残った | Σ `reward_summary_json.companyReserveYen`（支払対象外メンバーへの非現金配賦） |
| 残った率 | `会社に残った ÷ 配分枠`。高いほど現金が出ていっていない |
| 需要/枠 | `稼働需要総額 ÷ 実効枠`。実効枠 = Σ `effectiveCapBudgetYen`（前月からの未使用枠繰越を含む按分上限） |
| まさ時間 | Σ `development_hours + meeting_hours`（`member_id='ID001'`、対象年の週） |
| まさ1時間あたり | `請求額(推定) ÷ まさ時間` |

> **需要/枠 の分母に `budget_yen × 0.65` を使わない**。`budget_yen` は既に65%後の額なので、
> 掛けると65%を二重に適用することになる。初版はこの誤りにより 2026年 ZMP を 2.78×、CX を 1.67× と
> 表示して両方に枠超過警報を点けていたが、正しくは 1.01× と 1.08× でどちらも枠内。
> 分母は `effectiveCapBudgetYen`（繰越込みの実際の按分上限）を使う。

### メンバー別内訳（行クリックで開く）

| 列 | 定義 |
|---|---|
| メンバー | `members.code_name`。`payoutExcluded` のメンバーには「会社に残る区分」を表示 |
| 稼働需要額 | Σ `members[].grossDueYen` |
| 現金で支払 | Σ `members[].totalPay` |
| 会社に残った | Σ `members[].companyReserveYen` |

3つとも0のメンバー行は出さない。

## 警報

| 警報 | 条件 | 意味 |
|---|---|---|
| 稼働が枠超え | `需要/枠 > 1.5` | 発生した稼働が配れる枠の1.5倍超。誰かの分が翌月以降へ繰り越されている |
| 報酬計算まだ | `配分枠 > 0` かつ `稼働需要 = 0` | 配分枠はあるが、この年の報酬計算が動いていない |

どちらも並び順には混ぜず、PJ名の横にラベルで出す。並び順は配分枠の降順。

## 実績/計画の区別

`billing_cycles` には次が混在する。

- `reward_summary_json` が null の月（未処理）
- `budget_yen` が 0 の月
- `status='not_started'` の未来の計画月

`status='not_started'` または `reward_summary_json` が null の月は**計画月として集計から除外**し、
行の副題に「実績Nヶ月 / 計画Mヶ月」と両方を出す。配分枠も稼働需要も 0 の PJ は行ごと出さない。

## 参照系キャッシュ

`billing_cycles` は月次締め処理でしか更新されない参照系。規範は
[`5-10 参照系データのキャッシュ`](5-10-reference-data-caching-current-spec.md)。3層すべてを通す。

| 層 | 実装 | TTL |
|---|---|---|
| 1. サーバのプロセス内スナップショット | `src/lib/project-profitability.ts`（年単位、single-flight、`.range()` でページ読み） | 5分（`PROJECT_PROFITABILITY_CACHE_TTL_MS`） |
| 2. HTTP キャッシュ | `src/app/api/admin/project-profitability/route.ts` の `Cache-Control` | `max-age=60, stale-while-revalidate=600` |
| 3. クライアントのモジュールキャッシュ | `src/lib/project-profitability-client.ts`（`@/lib/reference-data-cache` 経由） | 既定5分 |

- 年タブは hover / focus で `prefetchProjectProfitability` を叩き、切替時に待たせない。
- `?fresh=1` で 1 層を強制再読込し、`Cache-Control: no-store` を返す（月次締め直後の確認用）。
- 月次締め・報酬再計算の書き込み経路からは `invalidateProjectProfitabilityCache()` を呼ぶ。
- guard（`scripts/check_reference_data_cache_contract.mjs`）の `REFERENCE_DATA_ENDPOINTS` に登録済み。

## 関連

- [`7-1 報酬計算ロジック 詳細仕様`](../manual/7-1-reward-calc-spec.md) — 65%・pt単価・cap按分・`payoutExcluded` の正本
- [`5-10 参照系データのキャッシュ`](5-10-reference-data-caching-current-spec.md)
- `/admin/season-pl` — plan_cycle 単位の厳密な予実検算
