# Admin Projects / Members 台帳 仕様

`/admin/projects` (= PJ 台帳) と `/admin/members` (= AMD メンバー台帳) の仕様。 契約・請求・支払条件・人員稼働率の正本がここに集約される。

## /admin/projects

URL: `/admin/projects`。 全 PJ 台帳を編集する admin 専用画面。

### 表示構造

行: `projects` 全件 (= status フィルタは UI 上で切替)。 列:

| 列 | source / 用途 |
|---|---|
| project_id | `projects.project_id` (= `p07` 等の text PK) |
| project_name | 表示名 |
| project_category | `dtsu` / `new_business` / `ecosystem` / `advisor` chip |
| status | `draft` / `active` / `sales` / `ended` / `frozen` / `lost` chip |
| lane | `project_ventures.lane` (= ASPI 8 domain 単一指定) |
| lanes | `project_ventures.lanes` JSONB (= 複数 lane weighted) |
| outcome_pattern | `project_ventures.outcome_pattern` |
| client_name | 取引先名 |
| start_ym / end_ym | 期間 |
| 月次予算 (= 通常 cap) | `projects.fee_amount` |
| 契約条件 | `projects.contract_terms_json` (= 契約書/見積書から抽出した期間・月額・請求開始・実働開始・報酬原資) |
| 提出物 | `projects.contract_terms_json.deliverablesRequired` / `deliverablesNote` (= 契約書/見積書から抽出。`true`=あり、`false`=なし、null=不明) |
| 月次報告 | `projects.contract_terms_json.monthlyReportSubmissionRule` / `monthlyReportSubmissionNote` (= 契約書/見積書から抽出した月次報告書の提出ルール。null=不明、弱い根拠は要確認候補として表示) |
| 立替精算 | `projects.contract_terms_json.expenseReimbursementAllowed` / `expenseReimbursementNote` (= 契約書/見積書から抽出。`true`=可、`false`=不可、null=不明) |
| 請求条件 | `invoice_send_deadline_rule` / `payment_due_rule` / `payment_due_day` |
| 請求先メール | `invoice_to_emails` / `invoice_cc_emails` / `invoice_bcc_emails` |
| freee | `projects.freee_partner_id` |
| メンバー | `project_members` 紐付け |
| report_emails | 月次報告書送付先 (= chip 表示で個別削除 + 一括保存可) |
| 総会 / 役会 | D-14G の Gmail governance sweep 対象フラグ。`projects.governance_watch_shareholder_meetings` / `projects.governance_watch_board_meetings`。`report_emails` が空ならONでも検索対象なし |

`thead` は `sticky top-0 z-30` で固定 (= まさ #15 確定 2026-05-24)、 大量 PJ で下スクロールしてもヘッダーが見える。

### `projects.status` (= 契約・営業状態)

`projects.project_category` (= AMD OS 上の扱い / 事業モデル) と別軸。

| value | 色 | 意味 | 主な扱い |
|---|---|---|---|
| `draft` | gray | 台帳作成済だが契約・稼働・営業状態が固まってない | 通常運用には入れない |
| `active` | emerald | AMD が伴走中の PJ | cockpit / 月次確認 / 請求 / MS 進捗の標準対象 |
| `sales` | blue | 商談・受注前・提案中 | 台帳や資料生成に載せるが、 契約後に個別確認 |
| `ended` | gray | AMD の伴走・契約終了 | 履歴。 新規月次確認は出さない |
| `frozen` | amber | 明示的に休止中 | 新規月次確認停止。 `freeze_from_ym` / `restart_expected_ym` 併用可 |
| `lost` | red | 失注 / 破談 / 契約化しなかった | 支払原資なし、 個別合意ベース |

### freeze の扱い

複数回の凍結 / 再開履歴は `project_freeze_periods` が正本。 `projects.freeze_from_ym` / `restart_expected_ym` は現在表示用キャッシュ。

`project_freeze_periods` 列:

| column | 用途 |
|---|---|
| `period_id` | UUID PK |
| `freeze_from_ym` / `restart_ym` | 凍結期間 |
| `status` | `active` / `closed` |
| `reason` / `source` / `source_ref` | 凍結理由と根拠 |

凍結期間中の reports + meetings を Sonnet で再要約するのが `/api/cron/freeze-period-backfill` (= manual operation、 [6-1 章](6-1-operations-settings-spec.md))。

### `projects.project_category` (= status の右隣 chip)

| value | 表示 | 意味 | AMD Score | MS 進捗抽出 |
|---|---|---|---|---|
| `dtsu` | DTSU (cyan) | 学術発 SU 伴走 PJ (通常) | 対象 | 対象 |
| `new_business` | 新規事業創出 (emerald) | レガシー企業 DX + 研究シーズ取込 | 対象 | 対象 |
| `ecosystem` | Ecosystem (violet) | 研究機関の SU エコシステム構築業務 | 対象外 | 対象 |
| `advisor` | Advisor (amber) | まさが社外取締役 / 経営顧問として入る PJ | 対象 | 対象外 (= 月次ノート運用) |

詳細は [9-1 章 §5.6](9-1-decisions-and-history.md#56-project_category-に-new_business-追加--2026-05-25)。

### 契約・請求条件 (= projects 列)

| column | 用途 |
|---|---|
| `project_id` | `p00` (= AMD全体) / `p07` 等 |
| `fee_type` | `fixed` (= 月額固定 cap) / `point` (= ポイント従量) 等 |
| `fee_amount` | 月額 (= 通常 cap、 numeric) |
| `contract_terms_json` | 契約書/見積書から抽出した横断比較用 JSON。主キーは `monthlyFeeYen`, `contractStartYm`, `contractEndYm`, `actualWorkStartYm`, `billingStartYm`, `rewardPoolYen`, `monthlyRewardCapYen`, `deliverablesRequired`, `deliverablesNote`, `monthlyReportSubmissionRule`, `monthlyReportSubmissionNote`, `expenseReimbursementAllowed`, `expenseReimbursementNote`, `sourceTitle`, `sourceRef`, `notes` |
| `invoice_send_deadline_rule` | 送付期限ルール (= `"末締め翌月10日"` 等の文字列) |
| `payment_due_rule` | 支払サイト (= `"末締め翌月末払い"` 等) |
| `payment_due_day` | 支払日 (= 月末を 0 とする日付 integer) |
| `invoice_send_manual` | true なら自動送付しない (= まさ手動チェック必要) |
| `invoice_to_emails` / `cc_emails` / `bcc_emails` | 請求書送付先 |
| `freee_partner_id` | freee 連携用 partner ID |
| `report_emails` | 月次報告書送付先 (= 複数 csv) |
| `governance_watch_shareholder_meetings` | true なら D-14G が `report_emails` とのGmailやりとりから株主総会・招集通知・議決権・委任状などを検索する |
| `governance_watch_board_meetings` | true なら D-14G が `report_emails` とのGmailやりとりから取締役会・役会・書面決議などを検索する |

### 月次予算 cap と追加枠

`projects.fee_amount` は通常 cap。 OkuDoor 追加開発などで追加枠が出る月は、 admin が `billing_cycles.budget_yen = 通常 cap + 追加枠` を直接書き換える。PM月次確認には出さない。

例: ZMP の通常固定費は 300,000 円 × 65% = 195,000 円が cap。 追加分があるときは合意額を `cap外追加支払枠` に入れる。

### sales フェーズの扱い

`status='sales'` は契約前。 提案資料 / Atlas の Venture Map / `project_ventures` への登録は事前にできるが、 `billing_cycles` を `not_started` 以外に進めるのは契約締結後。 失注したら `status='lost'`。

## /admin/members

URL: `/admin/members`。 AMD 内部メンバー台帳。

codeName セルは admin 用マイページリンクを兼ねる。 コードネームをクリックすると `/mypage?memberId=<members.member_id>` を開き、編集はセル内の編集ボタンから行う。 `member_id` は `ID001` のような Supabase 上の値をそのまま使い、 `001` のように `ID` prefix を落とさない。

### `members` 列

| column | 用途 |
|---|---|
| `member_id` | text PK (= `ID001` / `ID002` 等) |
| `code_name` | AMD OS 内で使う識別名 (= `まさ` / `えいみ` 等) |
| `email` | Google Workspace email (= ログイン認証に使う) |
| `member_name` | 個人の法律名 |
| `contractor_name` | 契約者名 (= 支払通知書 / 契約書の宛名。既定は `member_name`、法人契約時だけ法人名へ手入力) |
| `member_address` | 住所 (= 支払通知書の宛先住所) |
| `invoice_registration_number` | インボイス登録番号 (= 支払通知書PDFの宛先ブロックに表示。未登録時はPDF上で未登録表示)。保存時とPDF生成時に全角T・キリル文字のT風文字・空白/ハイフンを正規化して `T` + 数字へ寄せる |
| `bank_info` | 振込先 (= 支払通知書) |
| `role` | `manager` / `engineer` 等 (= 自由 text) |
| `status` | `active` / `inactive` / `left` |
| `slack_id` | Slack ユーザー ID (= DM 送信先) |
| `is_admin` | admin 権限 (= true なら /admin/* / /notifications を開ける) |
| `is_officer` | 役員フラグ。UI 列名は「役員」。true のメンバーは支払通知書発行対象から除外しつつ、報酬計算上は会社留保 (`companyReserveYen` / `officerReserveYen`) として扱う |
| `slack_plan` / `google_plan` | Slack / Google Workspace の課金 plan |
| `google_calendar_status` | `missing` / `error` / `connected` (= calendar.readonly 共有状況) |
| `google_calendar_checked_at` / `_connected_at` / `_error` | calendar 共有のヘルスチェック |
| `last_login_at` | 最終ログイン (= middleware が 1h ごとに touch) |
| `join_ym` / `leave_ym` | YYYYMM 文字列 |
| `joined_at` / `left_at` | date |
| `exclude_from_payout_notice` | UI 列名は「支払対象」。true なら「対象外」と表示し、支払通知書発行を skip (= 例: りり / ID006 NIMS 無償出向)。非役員かつ対象外なら `/mypage` の金額表示も `ー` にする。役員かつ対象外なら金額は表示し、`（役員のため支払対象外）` を添える |

### `members.status` と `joined_at` / `left_at`

`status='active'` のみが reward 配分対象 (= GAS rv2 計算)。 `status='left'` でも過去 ym の reward 計算には参加 (= `join_ym <= ym <= leave_ym` を満たす月のみ)。

### google_calendar_status の意味

| value | 意味 |
|---|---|
| `missing` | Calendar API scope 未許可 / カレンダー共有してない |
| `error` | 共有はしてるが API call が失敗する (= revoke 等) |
| `connected` | Calendar 読み取り OK、 週次活動抽出の対象 |

Calendar 共有は **Google Workspace ログイン時に `calendar.readonly` を必須 scope として要求**、 callback で実 API call して確認。 未許可なら OS に入れず status を `missing` / `error` にする (= まさ #6 確定)。

`info` / `つくよみ` などのシステムアカウントは Calendar 共有対象外 (= human メンバー only)。

### 週次活動抽出との関係

`/api/cron/member-weekly-activities` (= 日次 18:00 JST) は:

- **読むカレンダー**: `google_calendar_status='connected'` のメンバーに限る
- **保存対象**: active な human メンバー全員 (= `info`/`つくよみ` のシステムアカウントは除外)
- 共有済カレンダーや議事録の参加者 email に未接続メンバーがいれば、 そのメンバーの `member_activities (source='member_weekly')` にも同じ活動を保存

未接続メンバー本人のカレンダーは読めないが、 他メンバーの共有カレンダー / `project_meeting_summaries` / `source_cache` に参加者として出ている活動は `/mypage` に出る。

## `project_members` (= PJ × メンバーの紐付け)

| column | 用途 |
|---|---|
| `project_id` / `member_id` | 紐付け (= UNIQUE) |
| `role` | 自由 text (= 「営業」「リード PM」 等) |
| `role_label` | 表示用 label |
| `is_active` | true なら現在 PJ に参加中 |
| `is_pm` | PJ Manager。OS 上の月次確認 TODO 表示条件には使わない |
| `is_pl` | PJ Lead (= PL 承認権限。`請求額確定` は通常nudgeとしては表示しない) |
| `is_closer` | クローザー (= 営業最終承認) |
| `join_ym` / `leave_ym` | 期間 |

### ロール判定と /mypage

| メンバーロール | /mypage 月次確認 TODO |
|---|---|
| `is_pm=true` | 出さない |
| `is_pl=true AND is_pm=false` | 出さない |
| 上記以外 | 出さない |

`/mypage` は PM/PL/参加メンバーのどのロールにも月次確認 TODO を出さない。報告書確認の軽い連絡は Slack 側で完結させ、OS 側の nudge / TODO / action queue へ同期しない。`請求額確定` は契約 apply 済みデータから自動確定する。契約書由来の金額や対象月の報酬額が見えない場合は、PM/PL の通常nudgeではなく契約台帳/報酬キャッシュの整備対象。請求書発行/送付はadmin業務。

詳細は [2-2 章 メンバーの日常ワークフロー](2-2-member-workflows-quick-start.md)。

## 編集と監査

PJ 台帳 / メンバー台帳の更新は admin 経由のみ:

- UI 上の編集 → `PATCH /api/admin/projects/{project_id}` または `PATCH /api/admin/members`
- すべて `members.is_admin=true` 必須
- メンバー台帳は browser から `members` を直接 update しない。`PATCH /api/admin/members` が `requireAdmin()` 後に service_role で更新し、DB から返った保存済み row で UI state を置き換える
- 支払通知書の宛名・住所・登録番号は `members.contractor_name` / `member_address` / `invoice_registration_number` が正本。支払通知書の再発行はこの DB 最新値を読み直して PDF を作る
- 変更履歴は現状 explicit な audit log なし (= `updated_at` のみ)
- 詳細監査は git の `pwa/design/db_schema.md` 履歴と Supabase Edge Function ログを併用

## トラブル時

| 症状 | 確認場所 |
|---|---|
| 新メンバー追加したのに `/mypage` に出ない | `members.status='active'`、 `members.email` が Google ログイン email と一致、 `project_members.is_active=true` |
| `/admin/billing` で PJ が出ない | `projects.status IN ('active','ended','frozen')`、 `ended` は `end_ym` 以前のみ表示 |
| 支払通知書に住所 / 登録番号 / 振込先が出ない | `members.member_address` / `invoice_registration_number` / `bank_info` の入力、 `exclude_from_payout_notice=false`。編集後は `/admin/members` の保存が `PATCH /api/admin/members` で成功していることを確認し、支払通知書を再発行する |
| 週次活動が出ない | `google_calendar_status='connected'`、 `last_login_at` が最近、 calendar.readonly scope |
| sticky thead が動かない | スクロールコンテナの overflow 設定、 `top-0 z-30` の値 |

## 関連

- 6-1 章 [Operations Settings](6-1-operations-settings-spec.md) (= cron / Run Now)
- 6-3 章 [Invoice / Billing Routine](6-3-invoice-and-billing-routine-spec.md) (= 請求書発行)
- 6-4 章 [Finance / Payment Confirm](6-4-finance-payment-confirm-spec.md) (= 入金確認)
- 6-5 章 [Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) (= 支払通知書発行)
- 2-6 章 [admin オペ](2-6-admin-ops.md) (= 月次確認/admin請求早見表)
- 9-1 章 [過去判断と経緯](9-1-decisions-and-history.md) (= status / project_category の経緯)
- 設計: [`pwa/design/aspi_lanes.md`](../design/aspi_lanes.md) (= `lanes` JSONB)
