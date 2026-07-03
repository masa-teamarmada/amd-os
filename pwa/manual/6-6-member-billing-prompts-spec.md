# Member Ops / Billing / Prompt 仕様

メンバーが直接触る `/mypage` / `/reimburse` と、 admin が運用する `/admin/billing` / `/admin/prompts` の開発者向け仕様。 メンバー視点の使い方早見表は [2-2 章](2-2-member-workflows-quick-start.md) を見る。

## /mypage

`/mypage` は **ログインユーザー個人画面**。 自分が関わる全 PJ の業務と報酬を集約する。

### データフロー

```mermaid
flowchart TD
  A[login email] --> B[members.id]
  B --> C[project_members 検索]
  C --> D[projects.project_name]
  C --> E[billing_cycles 直近 7ヶ月]
  E --> F[member_allocations_json &lpar;myMemberId&rpar;]
  C --> G[value_plan_cycles]
  G --> H[value_milestones]
  H --> I[milestone_monthly_progress]
  B --> J[member_activities source=member_weekly]
```

### 表示要素と source

| 要素 | source | 備考 |
|---|---|---|
| 当月 PJ 別報酬額 | `billing_cycles.member_allocations_json[memberId]` | 正本。 PWA は再計算しない |
| 月初合意カード | `/api/monthly-work-agreement` | `member_monthly_work_agreements` と当月 snapshot hash。API失敗時も `/mypage` 主表示はブロックしない |
| MS 進捗バー | `milestone_monthly_progress` | 累積 % + 当月増分 |
| 今週やったこと | `member_activities (source='member_weekly')` | 月-日 JST の今週 |
| 月別合計 | 過去 6 ヶ月分 × 当月、 chevron でトグル | |

### 報酬計算正本 (= GAS rv2_calcRewardSummary)

PWA 側で `member_allocations_json` を再計算しない。 正本ロジック:

- `gas-main/059_RewardV2_Ops.js` `rv2_calcRewardSummary`
- 入力: `value_milestones` (= MS × points × tag) + `milestone_monthly_progress` + `milestone_responsibility` (= per-MS のメンバーシェア)
- 出力: `billing_cycles.reward_summary_json` + `member_allocations_json`
- 再計算は `/api/cron/payout-reward-cache-refresh` (= 日次 03:05 JST) または手動 `Run Now` (= 6-1 章)

**計算式・進捗ソース優先度・月次キャップ・繰越の詳細**は [7-1 章 報酬計算ロジック 詳細仕様](7-1-reward-calc-spec.md) に集約。 この章は `/mypage` の表示側、 計算正本は 7-1 章を見る。

### 月初タスク・報酬合意

| item | contract |
|---|---|
| 本人画面 | `/monthly-agreement?ym=YYYYMM` |
| mypage導線 | 当月報酬合計カード直下 |
| 保存先 | `member_monthly_work_agreements` |
| 修正要望 | `member_monthly_work_agreement_requests` |
| admin確認 | `/admin/monthly-work-agreements?ym=YYYYMM` |
| hash差分 | 前回 `snapshot_hash` と現在 snapshot hash が違えば `条件更新あり` |

合意は「当月の遂行内容と報酬条件を確認した」監査 snapshot。`reward_summary_json`、`member_allocations_json`、MS進捗、担当shareを読むだけで、報酬計算を再実行したり値を書き換えたりしない。

月初合意画面は cap、carry-over、条件/前提、未確定・要確認などの精算/確認内部情報を出さない。本人には「どのPJのどのMSにコミットするか」「当月どこまで到達すべきか」「その対価としての想定報酬」を示す。MS別予定報酬は月初合意用の月次予算配分で算出し、PJ別想定報酬と合計が合うよう丸め差分を吸収する。`status='frozen'` / `freeze_from_ym <= ym` / active `project_freeze_periods` の PJ と、当月報酬も担当MSもないPJは対象外。`members.exclude_from_payout_notice=true` かつ `is_admin=false` のメンバー (= りり / ID006 NIMS 無償出向、あき / ID029 無報酬稼働) は月初合意も対象外。`is_admin=true` のメンバーは、テスト確認のため支払通知対象外でも月初合意対象に含める。報酬キャッシュがあるPJで担当MSにbreakdown行がない場合は、未確定ではなく `0円` と表示する。`reward_summary_json.members[].stockYen > 0` の場合だけ、支払予定とは分けて翌月以降へ繰り越される残額として `今月末未払い残（今月は支払われない）` を read-only 表示する。

当月の本人合意が未完了または条件更新ありで、表示対象PJがある場合、OS内の他画面を開くと、開いた画面を背景に残したまま月初合意の必須モーダルを前面に表示する。モーダル内に `/monthly-agreement` と同じ確認内容を出し、背景クリックや閉じる操作では先送りできない。合意完了後だけ、通常どおりマイページ、PJコックピット、admin画面などへ入れる。

表示内容に違和感がある場合、本人は「修正要望」から対象PJ、要望種別、本文を送る。要望は送信時点の snapshot hash と一緒に保存され、admin/PM側の確認キューとして扱う。

### OS 上の月次確認 TODO

| メンバーのロール (project_members) | 表示される TODO |
|---|---|
| `is_pm=true` の PJ | TODO 出さない |
| `is_pl=true AND is_pm=false` | TODO 出さない |
| `is_pm=false AND is_pl=false` | TODO 出さない |

OS 上では PM/PL/参加メンバーのいずれにも月次確認 TODO を出さない。報告書確認の軽い連絡は Slack 側で完結させ、OS の nudge / TODO / action queue へ同期しない。`請求額確定` は、全請求対象PJで契約書由来の金額が読み込まれ、対象月の報酬額が `billing_cycles.reward_summary_json` で見えていることを前提に、契約台帳/報酬キャッシュのデータ整備として扱う。契約未適用・報酬キャッシュ未作成が見つかった場合も、通常の PM 月次タスクへ戻さない。立替確認と請求書発行/送付もPM月次nudgeには出さず、請求書発行/送付はadmin業務に寄せる。

### 支払対象外メンバー特例

`members.exclude_from_payout_notice=true` かつ `members.is_officer=false` のメンバー (= 例: りり / ID006 NIMS 無償出向、あき / ID029 無報酬稼働) は `/mypage` / `/dashboard` 埋め込みの **報酬額表示が `ー`**。reward 計算キャッシュ自体は他メンバー集計の整合のため残すが、支払通知書・月初合意・支払 gate では `not_required` にする。

`members.is_officer=true` のメンバーは支払通知書発行対象から除外するが、報酬計算上は会社留保 (`companyReserveYen` / `officerReserveYen`) として金額を残す。`is_officer=true` かつ `exclude_from_payout_notice=true` の場合、`/mypage` は金額を隠さず表示し、`（役員のため支払対象外）` を添える。

### 月次集計の前提 ym レンジ

- `billing_cycles` / `member_activities` は **過去 6 ヶ月 + 当月 = 7 ヶ月**
- `milestone_monthly_progress` は **当月 + 前月** だけでなく **前月以前 1 ヶ月余分** (= 当月増分計算のため前月終端値が必要)

### admin 閲覧モード

admin (`members.is_admin=true`) は `/mypage?memberId=<member_id>` で他メンバーのページを見られる。 `member_id` は `ID001` のような `members.member_id` をそのまま使い、 `001` のように `ID` prefix を削らない。 メンバーコードネームを文中に出すときは共通 UI `LinkedMemberText` で `/mypage?memberId=` リンクにする。 `/admin/members` の codeName セルも同じURLへのリンクにする。

## /reimburse

メンバーが立替費用を申請する画面。

### 入力 → 承認フロー

```mermaid
flowchart LR
  A[member 申請] -->|status=submitted| B[reimbursements row]
  B -->|PM 承認| C[status=pm_approved]
  C -->|admin 承認| D[status=admin_approved]
  D -->|月次支払合算| E[billed_ym set]
  E -->|reward 合算| F[billing_cycles.member_allocations_json &lpar;memberId&rpar;.reimbursement_yen]
```

### `reimbursements` 列 (= 正本)

| 列 | 用途 |
|---|---|
| `reimbursement_id` | text PK (= `RB-YYYYMMDD-NNN` 形式) |
| `project_id` / `project_name` | PJ 紐付け (= `p00` = AMD 全体) |
| `date` | 領収書日付 (= 申請月でなく実支出日) |
| `category` | 交通費 / 会議費 / 書籍 / 接待 / その他 |
| `amount` / `tax_rate` | 税込金額と税率 |
| `description` | 用途記述 |
| `transport_mode` / `transport_from` / `transport_to` / `transport_trip` | 交通費の場合 |
| `receipt_storage_paths` / `receipt_file_names` | Supabase Storage path 配列 (= 領収書 PDF/PNG/JPEG) |
| `status` | `submitted` → `pm_approved` → `admin_approved` |
| `created_by` / `pm_approved_by` / `pm_approved_at` / `admin_approved_by` / `admin_approved_at` | アクター記録 |
| `billed_ym` | 月次支払に乗った ym (= NULL なら未払) |

### 添付ファイル

`receipt_storage_paths` は Supabase Storage の path 配列 (= `reimbursements/{reimbursement_id}/{filename}`)。 file の Storage bucket は `reimbursements` (= 非公開、 admin 経由でのみ DL)。 file 名は `receipt_file_names[i]` に対応 index で保持。

### 承認 API

| API | 役割 |
|---|---|
| `POST /api/reimburse` | 申請。 status=submitted で insert |
| `POST /api/reimburse/{id}/pm-approve` | PM 承認 |
| `POST /api/reimburse/{id}/admin-approve` | admin 承認 |
| `POST /api/reimburse/{id}/reject` | 却下 (= status='rejected') |

PM 承認は `project_members.is_pm=true AND project_id=reimbursement.project_id` のメンバーのみ。 admin 承認は `members.is_admin=true` のみ。

## /admin/billing

admin が全 SU × 月の請求マトリクスを見る画面 (= `pwa/src/app/(app)/admin/billing/page.tsx`)。

### 表示構造

- 縦軸: PJ (= `projects.status IN ('active','ended','frozen')`)
- 横軸: 直近 13 ヶ月 (= 現月 -11 〜 +1)
- セル: `billing_cycles.status` をアイコン表示 + `payment_confirmed_at` でハイライト

### セル状態

`billing_cycles.status` の遷移:

| status | 意味 | アイコン |
|---|---|---|
| `not_started` | 当月作業未開始 | ⚪️ |
| `budget_reported` | PJ 予算が PM/PL から報告された | 🟡 |
| `budget_confirmed` | admin が予算確定 | 🟢 |
| `report_fixed` | 月次報告書 FIX | 📄 |
| `invoice_issued` | 請求書発行済 | 📝 |
| `invoice_sent` | 請求書送付済 | 📤 |
| `payment_confirmed` | 入金確認済 | ✅ |
| `reward_paid` | 支払通知書発行 + 報酬支払済 | 💰 |

`ended` PJ は `end_ym` 以前のセルのみ表示 (= 終了 PJ の未来月は出さない)。 `frozen` PJ は freeze_from_ym 以降のセルに薄色表示。

### 立替セル

`reimbursements.date` から該当月 × 該当 PJ のセル右下に立替件数 badge を出す。 admin は何件たまってるかをここから把握できる。

## /admin/prompts

LLM プロンプトと、 つくよみの context (= スプシ由来の旧 system prompt) を一画面で管理する admin 画面 (= `pwa/src/app/(app)/admin/prompts/page.tsx`)。

### 設計原則 (= AGENTS.common.md の絶対ルール)

**プロンプトはコードに書かず DB で管理する**。 コード側の hardcoded prompt は fallback としてのみ存在、 DB に `is_active=TRUE` の row があればそちらが優先される。

### 二段構成

| ブロック | source | 役割 |
|---|---|---|
| LLM プロンプト | `llm_prompts` | PWA 側 LLM 機能 (= L2 抽出 / narrative / scoring 等) の prompt 本体 |
| 旧つくよみ context | `tsukuyomi_context` (= `status='active'` のみ表示) | GAS R172 がスプシから同期してきた旧 system prompt 群 |

### `llm_prompts` 列

| 列 | 用途 |
|---|---|
| `prompt_key` | LLM 機能識別子 (= `meeting_summary.extract` / `member_activities.extract` 等) |
| `description` | 1 行説明 |
| `body` | prompt 本文 (= Markdown、 placeholder 含む) |
| `model` | optional override (= 空なら呼び出し側 default) |
| `max_tokens` | optional override |
| `is_active` | true なら DB body を使う、 false ならコード fallback を使う |
| `notes` | 編集メモ |
| `updated_by` / `updated_at` | 監査 |

### `tsukuyomi_context` 列

| 列 | 用途 |
|---|---|
| `context_id` | text PK (= `ctx_xxx` 形式) |
| `tags` | 適用 scope (= `meeting`, `monthly_report` 等の csv) |
| `priority` | 注入順序 (= 小さい数字が先) |
| `system_prompt` | system prompt 本文 |
| `status` | `active` / `archived` |

つくよみ呼び出し側は `tags` をフィルタしながら `priority` 順に system_prompt を連結し、 LLM に system role として渡す ([8-1 章](8-1-knowledge-admin-tsukuyomi-spec.md))。

### 編集フロー

1. admin が `body` を編集 → `POST /api/admin/prompts/{id}` (= `members.is_admin=true` のみ)
2. `is_active` を true にすると次の LLM 呼び出しから反映
3. fallback に戻したいときは `is_active=false` (= code-side hardcoded prompt が使われる)
4. 監査: `updated_by` + `updated_at` が自動で記録

### よくある prompt_key (= 2026-05-26)

| prompt_key | 利用元 |
|---|---|
| `meeting_summary.extract` | H-1 MTG サマリ抽出 (= Windows MMO Codex Desktop automation + PWA event route) |
| `member_activities.extract` | D-1 先手力判定の `initiative_origin` 抽出 |
| `project_knowledge.extract` | D-3 PJ ナレッジ抽出 |
| `member_knowledge.extract` | D-4 メンバーナレッジ抽出 |
| `protocol.extract` | D-1 AMD Protocol 抽出 |
| `xrl_evidence.extract` | M-2 XRL 根拠抽出 |
| `strategy_signal.extract` | D-6 経営ハイライト抽出 |
| `monthly_report.narrate` | 月次報告書 narrative_md 生成 |
| `dialogue_meeting.narrate` | まさえいMTG 議事録の narrative 化 |

prompt_key 一覧の正本は DB の `llm_prompts` 自身。 コード側 fallback は `pwa/src/lib/llm-prompts/*.ts` に分散。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| `/mypage` の報酬額が出ない | `billing_cycles.member_allocations_json` の該当 ym 行、 `payout-reward-cache-refresh` 実行履歴 |
| 立替が `/mypage` に出るが支払に乗らない | `reimbursements.status` / `billed_ym` |
| `/admin/billing` で PJ 行が出ない | `projects.status IN ('active','ended','frozen')` の絞り条件、 `ended` の `end_ym` |
| 修正した prompt が反映されない | `llm_prompts.is_active=true` か、 呼び出し側のキャッシュ層 (= 該当 cron 再実行) |
| つくよみが「古い prompt 使ってる」と感じる | `tsukuyomi_context.status='active'` の row、 `priority` 順を確認 |

## 関連

- 2-2 章 [メンバーの日常ワークフロー](2-2-member-workflows-quick-start.md) (= 使い方早見表)
- 6-5 章 [Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) (= 報酬 → 支払通知書)
- 7-1 章 [報酬計算ロジック 詳細仕様](7-1-reward-calc-spec.md) (= 計算式・進捗ソース・キャップ正本)
- 6-3 章 [Invoice / Billing Routine](6-3-invoice-and-billing-routine-spec.md) (= billing_cycles 全体)
- 8-1 章 [Knowledge Admin / Tsukuyomi](8-1-knowledge-admin-tsukuyomi-spec.md) (= つくよみ context 詳細)
- 6-1 章 [Operations Settings](6-1-operations-settings-spec.md) (= cron 実行)
- 設計: [`pwa/design/mypage.md`](../design/mypage.md)
- 報酬計算正本: `gas-main/059_RewardV2_Ops.js`
