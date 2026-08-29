# PJ別 利益構造ダッシュボード 現行仕様

> **この章は何か**: `/admin/project-profitability`（PJ別 利益構造）の contract。
> PJごとに、売上・外部メンバー支払・会社留保・稼働需要を年単位で並べ、
> 「どのPJが儲かっていて、どのPJがまさの持ち出しで回っているか」をデータで判定するための画面。

## 目的

まさ（非エンジニア）が毎月見て、次の2点を判定できることを要件にしている（2026-08-30 司令塔確定）。

1. PJごとの粗利率・配分枠に対する稼働需要の過不足が一目で分かる
2. 「まさが自分の配分を放棄してメンバー分を捻出している」PJを機械的に検知できる

`/admin/season-pl`（シーズン予実表）は plan_cycle 単位でバッファ・pt単価・stock収束まで厳密に検算する。
この画面はそこまでの精度は持たず、`billing_cycles.reward_summary_json`（月次報酬計算の確定スナップショット）を
**年単位でそのまま合算**するだけの軽量集計。目的は月次の整合性検証ではなく、年単位のPJ間比較。

## 入口

| 面 | route | 権限 |
|---|---|---|
| Admin | `/admin/project-profitability` | admin のみ（`AdminLayout` が `members.is_admin` を見て弾く） |

`ADMIN_SURFACE_GROUPS`（`src/lib/surface-catalog.ts`）の「契約・お金」グループに登録済み。左サイドバーの
「PJ別利益構造」から開く。

## データソース

計算ロジックは DB を持たない純粋な TypeScript 関数（`pwa/src/lib/project-profitability.ts`）。

| 入力テーブル | 用途 |
|---|---|
| `billing_cycles` | `budget_yen` / `extra_budget_yen`（売上）、`reward_summary_json`（外部支払・会社留保・稼働需要・メンバー別内訳）、`status` / `payment_confirmed_at`（実績/計画の判定） |
| `projects` | `project_id` → `project_name` の表示名解決 |
| `members` | `member_id` → `code_name`（表示名。`members.name` というカラムは存在しない） |
| `tally_weekly_effort_entries` | まさ（`member_id='ID001'`）の `development_hours` + `meeting_hours`（週次）を年内で合算 |

## 指標の定義（1行 = 1 PJ、年切替あり）

| 列 | 定義 |
|---|---|
| 売上 | Σ `(budget_yen + extra_budget_yen)`（実績月のみ） |
| 外部メンバー支払 | Σ `reward_summary_json.totalPaySum`（実際に現金で出ていく額） |
| 会社・役員留保 | Σ `reward_summary_json.companyReserveYen` |
| 稼働需要総額 | Σ `reward_summary_json.totalGrossDueYen`（cap前の請求可能稼働の総額） |
| 粗利率 | `(売上 − 外部メンバー支払) ÷ 売上`。売上0なら「—」 |
| 需要/枠 比率 | `稼働需要総額 ÷ (売上 × 0.65)`。1.0を超えるほど「配分枠に対して稼働が過剰」。売上0なら「—」 |
| まさ投下時間 | Σ `tally_weekly_effort_entries`（`member_id='ID001'`、`development_hours + meeting_hours`）、対象年の週のみ |
| まさ時間あたり売上 | `売上 ÷ まさ投下時間`。0時間なら「—」 |

`0.65` は `season-pl.ts` の `MEMBER_SHARE_RATE`（メンバー原資の按分比率）と同じ値を使う。

## 実績/計画の区別

`billing_cycles` には次のパターンが混在する。

- `reward_summary_json` が null の月（未処理）
- `budget_yen` が 0 の月
- `status='not_started'` の未来の計画月

この画面は **`status !== 'not_started'` かつ `reward_summary_json` が存在する月だけ**を「実績」として集計に含める。
それ以外は「計画」として除外し、行の小見出しに `実績Nヶ月 / 計画Mヶ月` を出して実績/計画の区別を明示する
（未来の計画月を実績と混ぜて年間売上を過大表示しない）。

## 警報表示（この画面の主目的）

| 警報 | 判定 | 表示 |
|---|---|---|
| 持ち出し警報 | まさ（`ID001`）の月次 `grossDueYen > 0` かつ `totalPay = 0` が**3ヶ月以上連続** | 赤バッジ「持ち出し Nヶ月」、行全体を薄い赤で強調 |
| 枠超過警報 | 需要/枠 比率が **1.5倍を超える** | 黄バッジ「枠超過」、需要/枠 の数値も黄色で強調 |

連続月数の判定は対象年の `ym` 昇順で最長連続run長を取る（年境界をまたぐ連続は追わない。年単位画面のため）。
一覧は警報ありの行を先頭に、次に売上の大きい順で並ぶ。

画面上部に、両警報の意味を専門語なしで1〜2行ずつ説明する固定の注記を出す
（「まさが本来受け取るはずの分を3ヶ月以上ゼロにして、そのぶんを他のメンバーの支払に回している状態」等）。

## メンバー別明細

行をクリックすると、その場でメンバー別内訳（コード名 / 稼働需要額 / 実支払額 / 差額）が展開される。
`members.code_name` を表示名に使う。まさ（`ID001`）の行には識別バッジを付ける。

一覧のレスポンス（`/api/admin/project-profitability`）は年内の全PJのメンバー内訳を最初から含んでいるため、
行クリックに追加の fetch は発生しない（＝「一覧から詳細を開く導線」がそもそも遅延ゼロ）。
年タブは hover / focus で次の年のデータを先読みする。

## API

`/api/admin/project-profitability`（`runtime = "nodejs"`）

- `GET ?year=2026` → `{ ok, year, rows: ProjectProfitabilityRow[] }`。`Cache-Control: private, max-age=60, stale-while-revalidate=600`
- `?fresh=1` で強制再読込（`Cache-Control: no-store`）。月次締め直後の確認用
- admin のみ（`requireAdmin()`）
- `loadProjectProfitabilitySnapshot(year)` を export しており、年単位でプロセス内に5分キャッシュ（同時アクセスは1本へ束ねる）

**参照系なので画面から素の fetch をしない。** 読み取りは `pwa/src/lib/project-profitability-client.ts` を通す。
`scripts/check_reference_data_cache_contract.mjs` の `REFERENCE_DATA_ENDPOINTS` に登録済みで、
違反すると `deploy.sh` が本番反映前に落とす。詳細は `5-10-reference-data-caching-current-spec.md`。

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `pwa/src/lib/project-profitability.ts` | 型・集計純関数・プロセス内スナップショット（server-only） |
| `pwa/src/lib/project-profitability-client.ts` | 参照系キャッシュ経由の読み取り（peek/load/prefetch/invalidate） |
| `pwa/src/app/api/admin/project-profitability/route.ts` | GET |
| `pwa/src/app/(app)/admin/project-profitability/page.tsx` | ページ shell |
| `pwa/src/components/admin/AdminProjectProfitabilityClient.tsx` | 画面本体（年タブ・一覧・警報バッジ・展開明細） |

## 意図的に持たない機能

- plan_cycle 単位の閉じ検算・pt単価整合・stock収束チェック（`/admin/season-pl` の担当）
- 手動入力・編集（つくよみ生データ自動構築の原則どおり、この画面は集計専用の読み取り画面）
- LLM を使った要約・解釈（純粋な集計）

## 検証

2026年データで KUTE (p25) / ZMP (p19) / SX (p21) / CX (p20) / SE (p10) の各行が表示されることをローカルで確認済み
（2026-08-30、service role 経由の認証セッションで `/admin/project-profitability` を desktop 1440px / mobile 375px で実見。
横スクロール発生 0px、行クリックでのメンバー内訳展開も動作確認）。本番デプロイ後に同一URLで再確認する。
