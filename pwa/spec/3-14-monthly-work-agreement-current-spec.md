# 月初タスク・報酬合意 仕様

> **この章は何か**: メンバーが月初に OS 上で当月の遂行対象、予定到達点、予定報酬を確認し、合意 snapshot を残すフローの current contract。

## Current Truth

| item | contract |
|---|---|
| member route | `/monthly-agreement?ym=YYYYMM` |
| mypage entry | `/mypage` の当月報酬カード直下に「今月の遂行内容・報酬条件」カードを表示 |
| admin route | `/admin/monthly-work-agreements?ym=YYYYMM` |
| member API | `GET /api/monthly-work-agreement?ym=YYYYMM&memberId=IDxxx` |
| agree API | `POST /api/monthly-work-agreement/agree` |
| revision request API | `POST /api/monthly-work-agreement/request-revision` |
| revision request 管理API | `GET/PATCH /api/admin/monthly-work-agreements/revision-requests` |
| admin API | `GET /api/admin/monthly-work-agreements?ym=YYYYMM` |
| app entry gate | 未合意 / 条件更新ありで表示対象PJがある場合、開いた画面を背景に残したまま月初合意モーダルを前面表示。ヘッダー右上の閉じるボタン (`data-testid="monthly-agreement-modal-close"`)、`Escape` キー、背景クリックのいずれでもその表示だけ一時的に閉じられるが、合意状態は保存されない。未合意のまま同じ entry を開き直すと再表示され、合意完了後だけ gate が解決済みになる。gate 判定は `(app)/layout.tsx` の SSR では計算せず (2026-07-17 v3.44.8 以前は SSR で `buildMonthlyWorkAgreementBundle` を毎 route 実行し全 authenticated route の初回表示をブロックしていた)、`AppShell` mount 後に既存の member API `GET /api/monthly-work-agreement` を client fetch して判定する。判定ロジック (`tableReady && projectCount>0 && status in (pending, needs_reagreement)`) 自体は不変。ユーザーから見える gate 発火条件・表示内容は変わらない |
| DB | `member_monthly_work_agreements`, `member_monthly_work_agreement_requests`, `member_monthly_work_agreement_amount_change_reasons`, `member_monthly_work_agreement_payout_overrides` |
| migration | `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql`, `145_member_monthly_work_agreement_payout_overrides.sql`, `197_member_monthly_work_agreement_amount_change_reasons.sql` |

## Scope

月初合意は **月初計画の表示・合意 snapshot・未合意管理レイヤー**。報酬計算の入力や支払確定額を変更しない。

- 予定報酬は `/admin/payouts` の支払予定 (`reward_summary_json.members[].totalPay`) ではなく、当月の月次予算を当月の予定MS消化ptと担当shareで配分した **月初合意用の予定額** として算出する。
- `value_plan_cycles` / `value_milestones` / `milestone_responsibility` / `milestone_monthly_progress` から、当月の遂行対象、予定到達点、担当shareを読む。
- 進捗は `milestone_monthly_progress` の非確定行を正本にせず、D-2と同じアンカー方式の月割りデフォルトをコード計算する。PM locked 行があればそれをアンカーにする。
- `project_members` と `projects` から当月 active member / active project member を解く。`projects.status='frozen'` / `project_freeze_periods.status='active'` / `projects.freeze_from_ym <= ym` は報酬が発生しないため対象外。例: CTB p06 は `status='active'` だが 202605 から freeze overlay のため 202606 月初合意に出さない。
- `members.exclude_from_payout_notice=true` かつ `is_admin=false` のメンバーは月初合意対象外。例: りり / ID006 (NIMS 無償出向) と あき / ID029 (無報酬稼働) は報酬を受け取れないため `not_required` とし、admin一覧・合意保存・修正要望保存から外す。`is_admin=true` のメンバーは、テスト確認のため支払通知対象外でも月初合意対象に含める。
- 合意時点で本人へ表示した内容を `snapshot_json` と `snapshot_hash` で保存する。
- snapshot hash が変わったら本人/adminに「条件更新あり」と表示し、再合意対象にする。
- 報酬キャッシュを再計算しない。通常 GET は読むだけ。
- cap、carry-over、条件/前提、未確定・要確認などの精算/確認内部情報は本人向け月初合意画面に出さない。例外として、`reward_summary_json.members[].stockYen > 0` の場合だけ、当月支払とは分けて翌月以降へ繰り越される残額が本人に伝わるよう `今月末未払い残（今月は支払われない）` を read-only 表示する。月初合意は「どのPJのどのMSへコミットし、当月どこまで到達すべきか」と「その対価としての予定報酬」を示す。
- 当月報酬も担当MSもないPJは、月初合意の「何をすればいくら」に答えないため本人画面から非表示にする。

## Payout Gate

`/admin/payouts` は、支払対象の `member × source_ym × project` ごとに月初合意状態を read し、未合意のまま支払データ同期・支払通知書PDF生成・通知メール送信・送付済み確定へ進ませない。

2026年6月以前の稼働月 (`source_ym <= 202606`) は月初合意導入前/移行月のため、支払 gate 上は `agreed` 扱いで通す。6月は契約改定前かつシステム未完成期間だったため、合意条件として支払いを止めない。実際の `member_monthly_work_agreements` 行を偽造せず、gate の理由を「導入前/移行月のため合意済み扱い」として保持する。2026年7月以降の稼働月から通常どおり `pending` / `stale` / `revision_requested` を blocker にする。

移行月扱いの行だけで blocker が無い場合、`/admin/payouts` の gate panel は個別メンバー一覧を出さず、対象支払行数と「移行月スキップ」の summary だけを表示する。支払 gate の対象はあくまで「支払が発生する `member × source_ym × project`」なので、支払行が無い他メンバーを「合意済み一覧」に混ぜて見せない。

| status | meaning | payout behavior |
|---|---|---|
| `not_required` | 支払額 0、非adminの通知対象外、`frozen` / `lost` / `freeze_from_ym` 到達後 / active期間外PJなど | gate 対象外 |
| `pending` | 支払対象だが本人の active `agreed` row が無い、または支払対象PJが snapshot に無い | block |
| `agreed` | latest active `agreed.snapshot_hash === currentHash` | allow |
| `agreed` (移行月扱い) | `source_ym <= 202606` | allow。導入前/移行月なので合意済み扱い |
| `stale` | latest active `agreed` はあるが `snapshot_hash !== currentHash` | block (`条件更新あり`) |
| `revision_requested` | `member_monthly_work_agreement_requests.status='open'` が member全体または当該PJにある | block |
| `admin_override` | admin が理由を入れて server-side action を例外実行し、監査ログが残った | allow for that action |

gate は `/admin/payouts` の server action で実行する。UI の警告だけにはしない。

- `POST /api/admin/payouts` (`支払データ同期`) は blocker 付き member の支払行だけ同期対象から外し、残りを保存する。既存の `payout_notices` 行も消さない
- `PATCH /api/admin/payouts` の `issue_notice_pdf` / `preview_notice_pdf` は対象 member 自身が blocker のときだけ 409
- `PATCH /api/admin/payouts` の `bulk_issue_notice_pdf` / `bulk_preview_notice_pdf` は blocker 付き member を対象から外し、`agreement_gate` の skip として返す。全員 blocker のときだけ 409
- `PATCH /api/admin/payouts` の `send_notice_email`
- `PATCH /api/admin/payouts` の `update_notice` のうち `markSent=true`
- `POST/GET /api/cron/payout-notice-prebuild` は blocker 付き member を PDF 生成対象から外し、`agreement_gate` failure として返す

**gate は member 単位で止める。1人の blocker で支払月全体を止めない** (2026-08-28 修正)。
それ以前は `savePayoutDataSnapshot` が支払月の全対象をまとめて判定して 409 を返していたため、
上の member 単位の除外がどれも発火せず、無関係なPJのメンバーの支払通知書も cron prebuild も丸ごと止まっていた。

admin override は `agreementOverrideReason` が 8 文字以上かつ actor email がある場合だけ有効。override は `member_monthly_work_agreement_payout_overrides` に append-only で保存し、対象 action、理由、actor、支払月、稼働月、member、project、blocker status、snapshot hash / current hash、request id を残す。override は報酬計算や合意 row を変更しない。

`/admin/payouts` は gate と同じ画面で、報酬債務台帳を表示する。`stockYen` を単独の支払予定として見せず、`member × PJ × 稼働月` ごとに `carryInYen + (grossDueYen - carryInYen) - totalPay = stockYen` を表示し、原因を `契約前発生` / `繰越+今月発生` / `繰越のみ` / `cap不足` に分類する。先12か月表は `キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` の4表に分け、会社留保を支出扱いしない。報酬債務は月末残高なので、12か月合計ではなく各月残・ピーク・最終月残で読む。すべての plan cycle は終了月に `stockYen = 0` へ閉じることが必須だが、報酬計算側で最終月に自動精算枠を足してゼロに見せることは禁止する。最終月に `stockYen > 0` が残る場合、または `PJ予算 > (クライアント支払 - バッファ) × 65%` の原資超過がある場合は、`/admin/ms-overview` の保存前検算でクライアント支払額・バッファ・原資上限・PJ予算・メンバー支払額・不足額を表示し、MS編集保存を `blocked` にする。`/admin/ms-overview` は閲覧モードで cycle を開いた時点でも現行 MS 案を検算し、既存状態が `blocked` なら MS 一覧の上に赤い `MS編集停止中` 表示を出す。

### 契約レイヤー

業務委託契約上は、OS 月次合意を毎月の個別発注 / SOW / 条件確認として扱う前提で設計する。ただし hard guard を本番運用の法的拘束力として使うには、契約改定・メンバー同意・法務レビューが前提。この仕様は運用/システム設計であり、AI が法的助言として断定するものではない。

### 予定報酬の算定

```text
monthlyBudgetYen =
  billing_cycles.budget_yen                       # 明示値。0 も有効
  or projects.fee_amount × 0.65                   # monthly_fixed fallback
  or value_plan_cycles.budget_yen / cycleMonths   # cycle budget fallback

msMonthlyConsumedPt = points × max(0, currentDefaultCumPct - prevDefaultCumPct) / 100
memberEarnedPt      = msMonthlyConsumedPt × active-member normalized plannedShare
projectEarnedPt     = Σ all active members memberEarnedPt
msPlannedRewardYen  = round(monthlyBudgetYen × memberEarnedPt / projectEarnedPt)
projectPlannedRewardYen = Σ msPlannedRewardYen
```

これは月初合意用の「今月そのMSにコミットする対価」。`reward_summary_json` の capped 支払予定、carryIn、stockYen、現時点の支払確定状態は予定報酬計算には使わない。ただし SX のように `totalPay=0` でも `stockYen` が発生するケースを本人が見落とさないよう、表示専用に `totalPay` / `stockYen` / `grossDueYen` を読む。支払済み/保存済みの過去分は `monthly_reward_payout(project_id, ym, member_id).total_pay` を優先し、MS編集後に過去月の支払額表示が再計算値へ揺れないようにする。保存済み明細が無い protected 月は `billing_cycles.reward_summary_json` の保護済み cache を fallback として読む。`支払済み実績` として集計するのは、保存済み明細に加えて `billing_cycles.reward_paid_by` が `freee_wallet_txn_verified:` の証跡を持つ行だけ。`reward_paid_at` だけがある行は `要照合` として別枠にし、実績にも未来予定にも混ぜない。

## Snapshot Contract

`snapshot_json` は安定 JSON。hash に揺れる時刻を含めない。

| field | meaning |
|---|---|
| `schemaVersion` | `monthly_work_agreement.v1` |
| `ym` | 業務月 `YYYYMM` |
| `member` | `memberId`, `codeName`, `email`, `isAdmin` |
| `projects[]` | 当月参加中PJ |
| `projects[].milestones[]` | 担当MS、share、task description、progress、conditions |
| `projects[].expectedRewardYen` | 月初合意用の予定報酬 (= 当月月次予算 × 当月予定MS消化pt × share) |
| `projects[].payoutYen` / `stockYen` / `grossDueYen` / `carryInYen` | 表示専用の今月支払額 / 今月末未払い残 / 支払対象額 / 前月繰越。支払額は `monthly_reward_payout` の保存済み明細を優先し、無ければ `reward_summary_json.members[]` を読む。予定報酬計算や合意 gate 判定には使わない。支払月はメンバー支払条件から計算し、クライアント請求月である `billing_cycles.invoice_ym` では上書きしない |
| `projects[].payoutSchedule[]` | 稼働月ごとの `新規発生` / `支払対象` / `支払額` / `支払後残`。各行は税抜の `totalPayYen` と、freee銀行出金と照合する税込 `totalPayTaxIncludedYen` を持つ。`amountSource` (`actual_paid` / `unverified_paid` / `payout_snapshot` / `protected_reward_cache` / `reward_cache`) で、支払済み実績・実績未照合・保存済み・保護済み・予定を区別する |
| `projects[].reviewReasons[]` | 月次予算未設定、value plan未設定、MS/share未設定など admin 向け確認事項 |
| `totals` | PJ数、予定報酬合計、支払済み実績合計、これから支払予定合計、今月末未払い残合計、admin向け確認事項数 |

`currentHash = sha256(stableJson(snapshot_json))`。`latestAgreement.snapshotHash !== currentHash` のとき `needs_reagreement`。

### 再合意時の変更点表示 (`今回の変更点`)

`needs_reagreement` の画面には、hash が変わった理由を本人が読める形で表示する (2026-07-21 実装)。

- `buildMonthlyWorkAgreementBundle` は `member_monthly_work_agreements` select に `snapshot_json` を含め (`MonthlyWorkAgreementRecord.snapshotJson: unknown`)、latest agreed record の生 snapshot を保持する
- `src/lib/monthly-work-agreement-diff.ts` の `diffMonthlyAgreementSnapshots(previous: unknown, current: MonthlyWorkAgreementSnapshot)` が純粋関数として差分を計算する。React/Next への依存なし
  - `previous` が `schemaVersion === "monthly_work_agreement.v2"` かつ `projects` が配列の形 (`isV2Snapshot` type guard) でなければ `comparable:false` を返し、`note` に「前回合意時の記録が見つからない / 記録形式が古い」旨のフォールバック文言を入れる。旧 v1 snapshot や欠損データで例外を投げない
  - `comparable:true` のときは `member`/`totals` を「全体」グループ、PJ (`projectId`) 単位でそれ以外を比較する。両スナップショットの hash 対象フィールド (`ym` / `member.memberId` / `member.codeName` / `member.email` / `member.isAdmin` / `member.excludeFromPayoutNotice` / `totals.*` / project の全フィールド / milestone の全フィールド / `payoutSchedule` の全フィールド) をフルカバーで比較し、対象PJ・担当MS・支払予定エントリの追加/削除も検出する。文字列配列系フィールドは `Array.isArray` チェックで非配列値を安全に空配列へ正規化してから比較する。結果は `MonthlyAgreementChangeItem[]` (`label` / `before` / `after`、いずれも表示用に整形済み文字列。円は `¥100,000` 形式、割合は `%` 形式)
  - `MonthlyWorkAgreementBundle.changeSummary` (= `MonthlyAgreementSnapshotDiff | null`) は `status === "needs_reagreement"` のときだけ `diffMonthlyAgreementSnapshots(latestAgreement?.snapshotJson, snapshot)` の結果、それ以外は `null`
- UI (`MonthlyAgreementExperience.tsx`) は `bundle.status === "needs_reagreement" && bundle.changeSummary` のとき、ステータスバナー (`data-testid="monthly-agreement-status"`) の直後・`RequiredChecksSection` の直前に `ChangeSummarySection` (`data-testid="monthly-agreement-change-summary"`) を挿入する
  - 見出し「今回の変更点」+ `data-testid="monthly-agreement-change-count"` に件数 (`◯件`)
  - `comparable:false` のときは `note` のフォールバック文言のみ表示 (差分の詳細は出さない)
  - `comparable:true && count===0` のときは「前回合意時と現在の合意内容に差があります」と表示する (hash はフル比較対象なので、count===0 は原則 hash 一致=変化なしのケース。UI 側はこの文言を hash-mismatch のフォールバック表示として扱う。**記録ID/レコードIDには一切言及しない**)
  - `comparable:true && count>0` のときは PJ ごとにカード化し、各変更を「ラベル (stacked) → 前回/今回を並べた `min-w-0` グリッド (矢印区切り)」で表示。PJ名・ラベル・値はすべて `break-words` (モバイル最優先、`truncate` は使わない)。前回/今回グリッドはモバイルでは `grid-cols-1` の縦積みレイアウト (前回→矢印→今回)、`sm:` 以上で `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` の横並びに切り替える。矢印アイコンはモバイルで90度回転 (下向き)、`sm:` 以上で水平方向に戻す
  - 変更値は生の技術値 (`active` / `budget_confirmed` / `reward_cache` 等) をそのまま出さず、`monthly-work-agreement-diff.ts` の日本語ラベル関数 (project status / billing・payout status / allocation status / amountSource) で整形してから表示する
  - **生 JSON・生 hash 文字列は一切表示しない** (「参考情報」内の `記録ID {hash.slice(0,10)}` は既存仕様のまま変更なし)

### 再合意を求める条件

**合意の対象は「担当する仕事」と「その対価として受け取る額」の2つだけ。この2つが変わったときだけ再合意を求める** (まさ確定 2026-08-28「支払額が変わってないなら、わざわざ変更があったことをメンバーに伝えるのは、ただ混乱を招くだけだから止めたほうがいい」)。

- 判定は `hashMonthlyAgreementTerms()` = `monthlyAgreementTerms()` で抜き出した項目の hash で行う。抜き出すのは PJ構成 / PJ名 / 役割 / PM・PL / 今月受け取る額 / 定常業務 / MSの名称・pt・担当割合・役割・作業内容。
- 抜き出さない (= 変わっても再合意を求めない): 請求ステータス、入金確認、アロケーションステータス、進捗率、繰越額、ストック額、消化pt、確認状態、要確認理由、金額の根拠、過去月の payoutSchedule の内訳。
- 「今月受け取る額」は `payoutSchedule` の当月分 `totalPayYen` を優先して見る (`agreedPayYen()`)。`expectedRewardYen` は 2026-08-27 に意味が変わった (当月発生分 → 実際に払う額) ので、その前後をまたぐと受け取る額が同じでも「変わった」と出る。
- 担当割合は表示粒度 (1%) に丸めてから比べる。`0.153846 → 0.15` のような表示に出ない差で「15% → 15%」の変更点を出さない。
- 既存の合意を壊さないため、snapshot 全体の hash が一致する場合も従来どおり `agreed` として扱う。どちらか一方が一致すれば合意は生きている。
- メンバーへ見せる変更点も合意の対象だけ (`diffMonthlyAgreementTerms()`)。snapshot 全体の差分 (`diffMonthlyAgreementSnapshots()`) は監査用に残すが、メンバー画面には出さない。2026-08-28 以前は内部の状態の差分がそのまま並び、1人あたり71件出ていた。

### 支払通知書の対象外メンバーの表示

`members.exclude_from_payout_notice=true` のメンバーの割当は、65%枠の中の**非現金の内部配賦**であって外部への支払いではない (正本: `pwa/manual/7-1-reward-calc-spec.md`)。合意画面で「翌月以降の支払枠で順にお支払いします」「未払い残」と書かない。払われない額に払う約束を付けることになる。

- 予定額の欄には、現金では支払わないこと・会社の内部配賦として扱うことを明記する (`monthly-agreement-payout-excluded-note`)。
- 予定額が変わった理由の自動説明も、支払対象外なら「現金ではお支払いしません」「あなたへの未払いではありません」に切り替える。

### 予定額が変わった理由

`needs_reagreement` のうち、前回合意snapshotと比べて `projects[].expectedRewardYen` が変わったPJには、変わった理由を本人へ提示する。

**理由はまずOSが組み立てる。人間の入力を、支払を止める条件にしない** (2026-08-28 修正)。
予定額はMS消化pt・share・予算・繰越・支払枠から自動計算される値で、人が意図して動かした月ばかりではない。
変わるたびに管理者の理由入力を必須にすると、計算過程を知らない人が書けないまま合意が止まり、
合意が止まると支払通知書も発行できなくなる。
実際、2026-08-27 に合意額の定義を「当月発生分」から「実際に払う額（過去の未払いの返済分を含む）」へ変えた時点で、
全メンバー・全PJの hash が一斉に変わり、数十件の理由入力が同時に必要になって支払が止まった。この構造へ戻さない。

- `explainExpectedRewardChanges()` が前回合意snapshotと現在snapshotから要因を数値で組み立てる。拾う要因は、合意額の定義変更 / 当月発生分の変化 / 消化ptの変化 / 担当の変化 / 前月繰越の変化 / 支払対象額の変化 / 過去の未払いからの返済分 / 支払枠に収まらず翌月へ繰り越す分 / 今月末の未払い残。
- 要因を示せたPJ (`explained: true`) は、管理側の理由入力なしで本人が合意できる。`missingAmountChangeReasonProjectIds` に入れない。
- 前回合意snapshotが比較できない場合だけ `explained: false` とし、管理者の理由入力を必須にする。
- 管理者は補足を書ける。必須なのは `explained: false` のPJだけで、他は任意。書いた補足は8文字以上で `member_monthly_work_agreement_amount_change_reasons` へ保存し、メンバー画面ではOSの説明より上に出す。
- 1行は `ym × member_id × project_id × agreement_snapshot_hash` に一意に紐付け、`created_by` / `created_at` / `updated_by` / `updated_at` を監査用に残す。予定額を含むsnapshot hashが再び変われば、古い補足は再合意に使えない。
- メンバー画面では「今回の変更点」の中で、前回/今回の金額比較より先にPJ別の理由 (管理者の補足 → OSの説明の順) を表示する。どちらも無いPJだけ「変更理由を確認中」と表示し、修正要望は送れるが合意はできない。
- `POST /api/monthly-work-agreement/agree` も同じ判定を行う。表示だけを迂回しての合意保存はできない。一方、報酬計算・payout gateの算定値・非金額だけの再合意は変更しない。
- hash 計算式・`stableJson`・支払 gate ロジック (`monthly-work-agreement-payout-gate.ts`) には一切手を入れていない
- admin 一覧 API (`GET /api/admin/monthly-work-agreements`) は `latestAgreement.snapshotJson` をレスポンスから除去 (`snapshotJson: undefined`) する。`changeCount` フィールドは admin 画面で未使用のため API レスポンス・`AdminMonthlyWorkAgreementRow` 型から削除済み (`needs_reagreement` の件数は本人画面の `ChangeSummarySection` 側で表示)
- 単体テスト: `scripts/check_monthly_agreement_diff.mts` (`npm run test:monthly-agreement-diff`)。null/legacy previous のフォールバック、PJ/MS追加削除、各フィールド変更、完全一致、`snapshot`/`member`/`totals`/`project`/`milestone`/`payoutSchedule` 全フィールドの table-driven mutation coverage、壊れた nested v2 (member欠落・projects非配列・milestone欠損フィールド) の comparable:false フォールバック

## DB Contract

`member_monthly_work_agreements`:

| column | contract |
|---|---|
| `ym` / `member_id` | 合意対象 |
| `status` | `agreed` / `superseded` / `revoked` |
| `agreed_at` / `agreed_by` | 合意時刻と actor email |
| `snapshot_json` | 合意時表示内容 |
| `snapshot_hash` | 合意時の hash |
| `current_hash` | supersede 時などに保持する現在 hash |
| `invalidated_at` / `invalidation_reason` | `superseded` / `revoked` の理由 |

同一 `ym, member_id` の active `agreed` は 1 件だけ。再合意時は旧 `agreed` を `superseded` に更新してから新 snapshot を `agreed` で insert する。

`member_monthly_work_agreement_requests`:

| column | contract |
|---|---|
| `ym` / `member_id` / `project_id` | 修正要望の対象。`project_id` が null の場合は全体 |
| `request_type` | `scope_or_goal` / `reward` / `condition` / `other` |
| `body` | 本人が書いた修正要望 |
| `status` | `open` / `resolved` / `rejected` |
| `snapshot_hash` | 要望送信時に本人が見ていた current hash |
| `resolved_at` / `resolved_by` / `resolution_note` | admin/PM 側の処理結果 |

`member_monthly_work_agreement_payout_overrides`:

| column | contract |
|---|---|
| `payment_ym` | `/admin/payouts` の支払月 |
| `source_ym` | 報酬明細の稼働月 (`billing_cycles.ym` / `monthly_reward_payout.ym`) |
| `member_id` / `project_id` | override 対象 |
| `target_action` | 例外実行した server-side action |
| `blocker_status` | `pending` / `stale` / `revision_requested` |
| `reason` / `actor_email` / `created_at` | admin override の監査情報 |
| `snapshot_hash` / `current_hash` / `request_id` | どの blocker を越えたかを再現する補助キー |
| `metadata_json` | member/project label、支払額、blocker reason など |

## Authority / RLS

| actor | read | write |
|---|---|---|
| 本人 | 自分の合意 row | 自分の合意 insert |
| 本人 | 自分の修正要望 row | 自分の修正要望 insert |
| admin | 全件 read / update | admin API で一覧確認、修正要望の処理 |
| service_role | 全件 | API route 経由の insert/update |
| anon | 不可 | 不可 |

API route は logged-in user を `members.email` で解決する。本人以外の合意保存は禁止。admin は他メンバーの `/monthly-agreement?memberId=` を表示できるが、本人の代わりに合意保存はしない。

`member_monthly_work_agreement_payout_overrides` は admin/service_role のみ read/insert。update/delete は通常運用で使わず、append-only 監査ログとして扱う。

## UI Contract

### `/monthly-agreement`

- 上部に対象月、member、snapshot hash、合意状態を表示する。
- 合意状態は `未合意` / `合意済み` / `条件更新あり` / `対象外`。
- `exclude_from_payout_notice=true` でも `is_admin=true` のメンバーは、テスト確認のため通常メンバーと同じく合意保存・修正要望保存を有効にする。本人以外の代理合意は禁止のまま。
- `/monthly-agreement` ページと強制表示モーダルは同じ `MonthlyAgreementExperience` を使い、表示内容・合意保存・修正要望を分岐させない。
- ヘッダー直下に横幅いっぱいの状態欄を置き、`合意状態：未合意` / `合意状態：条件更新あり` / `合意状態：合意済み` / `合意状態：対象外` のいずれかを、理由の一文と一緒に表示する。状態値だけの `未確認` や、何の確認か分からない `確認不要` は使わない。
- 状態欄の直下に `確認して合意する内容` を置き、必須確認事項を独立した全幅の2セクションとして、`01 担当する仕事` → `02 その対価としての予定額` の順に表示する。`01` は全PJの `milestones[].taskDescription`（無い場合はMS名）を一覧し、`02` は予定額合計を先に強調したうえで、`01` と同じPJ順の予定額を一覧する。`milestones[].title` はMS名であり、月次の到達目標は現在の snapshot に無いため、目標として表示しない。現在 snapshot に独立した発注条件値はなく、抽象的な `必須2点` やPJ単位の横並び表へ戻さない。必須確認領域では番号を14px・見出しを18px以上・PJ名と担当内容を14px以上・PJ別予定額を16px以上・合計額を26px以上とし、補助文を含め12px未満の文字を使わない。未合意 / 条件更新ありでは、2セクションを読んだ後に `確認して合意` を置き、この操作まで当該稼働月の支払いに進めないことを明示する。
- 強制表示モーダルでは、参加PJ数、支払済み実績(税込)、実績未照合(税込)、これから支払予定(税込)、今月末未払い残合計を `参考情報: 支払い状況と対象PJ` の初期閉じの折りたたみへまとめる。開いたときだけ、PJごとの請求状態・今月支払・当該稼働月の支払予定・未払残を同じ領域に並べる。各PJの担当割合と今月のptは `参考情報: 予定額の根拠` にまとめる。支払い予定・未払残・予定額の根拠は、合意する担当内容や予定額そのものではなく、判断を助ける参考情報として扱う。支払済み実績は `reward_paid_at` ではなく、`monthly_reward_payout` の保存済み明細と `freee_wallet_txn_verified:` 証跡がそろった行だけを、税込額 (`round(total_pay × 1.1)`) で集計する。`reward_paid_at` はあるが実支払証跡とPJ別明細額が一致していない行は `実績未照合` へ分け、実績にも「これから支払予定」にも混ぜない。
- 強制表示モーダルの外枠は、背景を確実にクリックできる余白を残す。背景は `p-4 sm:p-8 lg:p-12` + `flex items-center justify-center`、本体は `max-h-full w-full max-w-4xl` とし、ウィンドウ幅にかかわらず上下左右へ最低16px (`sm:` 以上で32px、`lg:` 以上で48px) の背景クリック領域を残す。本体を `h-full` や `max-w-7xl` にして画面いっぱいに広げない。ヘッダーは `sticky` のまま、右上に常時見える閉じるボタンを置き、`Escape` キーでも閉じられるようにする。閉じる導線を背景クリックだけに依存させない。
- モーダルのヘッダーは sticky で常時表示されるため高さを抑える。表題は `text-[17px] sm:text-[20px]`、補助文は `text-[12px]` の1〜2行に収め、閉じ方 (`右上の × か背景のクリックで閉じます（合意は保存されません）。`) を書く。
- モーダルでは必須枠より下を、独立した説明カードにせず `参考情報` の短い区切りにする。担当内容は必須枠内へ集約するため、モーダル下段にPJカードを重複して表示しない。`修正要望` は `確認して合意` の右に小さく置き、押したときだけ同じ状態カードの中に入力欄を開く。`stockYen` は「今月は支払われない」別枠で強調し、必須枠の合意用予定報酬と同じ見え方にしない。
- PJカードには `/project/:projectId/cockpit?ym=YYYYMM` への「今シーズンのMSリストへ」リンクを置く。admin閲覧時は `/admin/ms-overview?projectId=...` への設計レビュー導線も出す。
- `未払いストックの流れ` は、月ごとに縦積みカードを増やさず、左に `前月残 / 当月発生 / 支払対象 / 支払 / 月末残`、右に稼働月列を並べる横長マトリクスで表示する。右側に余白を残さず、1つの月を複数行カードとして繰り返さない。狭い画面では横方向だけスクロールを許容する。支払額には税抜と税込を併記し、`支払実績` / `要照合` / `保存済み` / `保護済み` / `予定` の source badge を出し、過去実績・未照合・未来予定を混ぜない。
- MS別予定報酬は、当月月次予算を当月予定MS消化ptと active member 正規化 share で配分する。`reward_summary_json.members[].breakdown[].payYen` は使わない。
- 担当内容、予定報酬が違う場合は、合意とは別に修正要望を送信できる。
- 主要な概念には `Hint` を付ける。対象IDは `monthly-agreement.flow` / `monthly-agreement.project-count` / `monthly-agreement.expected-reward` / `monthly-agreement.payout` / `monthly-agreement.stock` / `monthly-agreement.stock-flow` / `monthly-agreement.ms-pt` / `monthly-agreement.ms-link` / `monthly-agreement.revision-request`。
- 保存テーブル未適用時は保存ボタンを無効化し、migration未適用として表示する。

### `/mypage`

- 当月報酬合計カードの直下に、当月の月初合意カードを表示する。
- `未合意` / `条件更新あり` のとき、`/monthly-agreement` へ誘導する。
- 当月の本人合意が `未合意` / `条件更新あり` かつ表示対象PJがある場合、OS内の他画面を開いても遷移先ページの上に月初合意モーダルを強制表示する。モーダル内には `/monthly-agreement` ページと同じコンテンツ全体を出し、別ページへのCTAだけを出して背景でページが開く状態は禁止。背景クリックではその表示だけ一時的に閉じられるが、合意した扱いにはしない。DB/cookie/localStorage には dismissal を保存せず、未合意のままダッシュボード等を開き直したらまた表示する。`/monthly-agreement` 自体は強制モーダル対象から除外する。合意完了後は次回以降の entry gate が解決済みになる。
- `/mypage` 本体の報酬表示や週次活動取得が失敗しないよう、合意カードのAPIエラーは主表示をブロックしない。

### `/admin/monthly-work-agreements`

- 対象月、対象メンバー数、合意済み、未合意、条件更新あり、修正要望数、今月支払合計、今月末未払い残合計を表示する。
- 対象月は日本語表記のプルダウンから選ぶ。2026年6月以前を選んだときは、月初合意の導入前・移行月であり、合意保存も未合意による支払い停止も不要だと一覧上部に明示する。
- member / PJ / status で検索できる。
- 各行は `予定報酬` だけでなく `今月支払` と `未払い残` を分けて表示し、stock が今月支払対象ではないことを admin 一覧でも判別できるようにする。`今月支払` は支払条件から見た現金支払月で集計し、`invoice_ym` は請求書発行月として扱う。
- 各行に open 修正要望数と最新要望時刻を表示する。
- 各行の下に修正要望の**本文**を出し、`対応済みにする` / `対応しない` / `未対応に戻す` で `status` を動かせる。対応メモは `resolution_note` に保存する (管理者だけが読む)。
  open の要望はその稼働月の支払 gate の blocker なので、閉じる手段がないと支払通知書を出せないまま復旧できなくなる。
  件数だけ表示して本文も解決経路も無かった 2026-08-28 以前の状態へ戻さない。
  ステータスを閉じても snapshot と金額は動かない。条件そのものを直すときは先にPJ側の金額・役割を直す (hash が変わり本人へ再合意が出る)。
- `条件更新あり` の行で予定額が変わったPJには、管理側がメンバー向け変更理由を入力・更新する欄を表示する。現在snapshotに紐付く理由だけを保存し、未入力ならメンバー側の再合意を止める。
- 各行から `/monthly-agreement?memberId=...&ym=...` と `/mypage?memberId=...` へ遷移できる。

## Failure Mode

| failure | behavior |
|---|---|
| 合意テーブル未適用 | API は `tableReady=false`、保存 API は 503。画面は表示だけ可能 |
| 報酬キャッシュ未生成 | `review_required` として表示。合意は保存可能だが admin/PM 要確認 |
| value plan / MS / share missing | `review_required` として表示 |
| admin が他人の合意保存を試す | 403 |
| 本人以外が修正要望を送る | 403 |
| snapshot hash changed | `needs_reagreement` |
| payout gate blockerあり | blocker の member だけ止める。個別発行はその member のとき 409、一括発行と cron prebuild は該当 member を `agreement_gate` として skip し残りを生成、支払データ同期は該当 member の行を書かずに残りを保存 |
| admin override 監査テーブル未適用 | override できない。通常 blocker は引き続き stop |

## Validation

- migration SQL check: `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql`, `145_member_monthly_work_agreement_payout_overrides.sql`
- `npm run lint`
- `npm run build`
- local browser: `/monthly-agreement`, `/mypage`, `/admin/monthly-work-agreements`
- intact smoke: `/dashboard`, `/admin/payouts`, `/admin/weekly`, `/spec/3-0-l2-data-list-current-spec`, `/project/p25/cockpit`

## 報酬計算との境界

月初合意は `reward-summary.ts`、`payout-reward-cache-refresh`、`/admin/payouts` の計算結果を変えない。未合意のまま支払確定できない guard は、合意 table を read する payout gate として `/admin/payouts` の保存/発行/送付 action の直前に置く。報酬計算式そのものへは混ぜない。
