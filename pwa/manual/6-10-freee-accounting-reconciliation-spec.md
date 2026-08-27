# freee週次会計照合 / 会計照合レール 仕様

毎週木曜10:00 JSTに本実行する、freeeとAMD OSの財務データを突き合わせる deterministic cron。全役員を対象に、変な仕訳・口座ごとの登録残高と同期残高の差・役員報酬の未消込・内部振替の不整合を検出し、`/admin/finance` の「会計照合レール」でレビュー・承認する。

> **正本境界**: AMD OSの財務テーブル（`company_finance_recurring_items`の`item_kind='salary'`または`category='executive'`明示分類、`members.is_officer`）がSOT。freeeは実行先兼一次証跡（wallet_txns/walletables/manual_journalsの生データ）。きよが手作業する収支Googleスプレッドシートは read-only 参考資料で、正本を上書きしない（下記「収支スプシ参照」参照）。

> **freeeへの書込みは現時点で常にblocked固定**。findingの検出・4回review gate・5回目以降のallowlist判定はすべて実装済みだが、freee公式APIで安全に（二重計上せず、意味論が検証済みの形で）表現できる書込みendpointが確認できていないため、`isActionTypeSafelyExecutable()`は両action typeともfalseを返す。承認/却下はこのOS内の監査記録として保存されるだけで、freeeへは一切書き込まない。

## 画面と API

| URL / route | 役割 | 認可 |
|---|---|---|
| `/admin/finance`（会計照合レール） | 未解決差額・口座残高/同期・役員報酬・振替・仕訳・run履歴を表示、承認/却下、dry-runプレビュー実行 | admin |
| `GET /api/cron/freee-accounting-weekly` | 週次本実行（cron）。`dryRun=1`でpreview | `CRON_SECRET`（または admin セッション） |
| `GET /api/admin/finance/reconciliation` | 会計照合レールの表示データ取得 | admin |
| `POST /api/admin/finance/reconciliation` `{action:'run', dryRun}` | 手動re-run（既定dryRun=true） | admin |
| `POST /api/admin/finance/reconciliation` `{action:'review', findingId, decision, note?}` | finding承認/却下。**監査記録の保存のみ、freee書込みは発生しない** | admin |

## DBテーブル（migration 205）

| テーブル | 役割 |
|---|---|
| `freee_reconciliation_runs` | run単位（週窓、triggered_by、dry_run、status、phase、run_sequence、finding/auto_applied/blocked件数、summary_json） |
| `freee_reconciliation_findings` | 検出した issue の**occurrence単位**の行。`UNIQUE(run_id, finding_key)`で、週次runごとに新しい行をinsertし過去runの証跡を保持する（`finding_key`自体はrun非依存の安定ハッシュ）。review_status（pending/approved/rejected/auto_applied/blocked）、evidence_json、reviewed_by/at/note |
| `freee_reconciliation_actions` | freee mutation判定のaudit log。`idempotency_key`（`${finding_key}:${action_type}`、finding_key由来なのでrunをまたいで安定）で再実行防止、mode（dry_run/executed/blocked。現状は常にblocked）、before_state_json/after_state_json、blocked_reason |

RLSは`amd_os_current_user_is_admin()`（admin全操作）+ service_role bypass。anon/authenticated一般には非公開（役員報酬情報を含むため）。

`/admin/finance`の会計照合レール一覧は、同じ`finding_key`を持つ複数run分のoccurrenceのうち**最新1件だけ**を表示する（過去occurrence自体はDBに残り続け、週次監査証跡として参照できる）。

## 4回review gate → 5回目以降allowlist（`freee-reconciliation-engine.ts`の`computeRunPhase`が正本）

- `triggered_by='cron' AND status='completed'` の過去run数 + 1 = `run_sequence`。
- `run_sequence <= 4` → `phase='review_only'`。findingは検出・保存されるが、自動反映（executor）はそもそも呼ばれない。
- `run_sequence >= 5` → `phase='auto_apply_allowlist'`。**次の2種類の完全一致findingだけ**が`eligibleForAutoApply=true`になりうる（実際の書込みは下記「freee mutationの安全境界」参照）:
  - `officer_compensation_unreconciled`: 下記「役員報酬期待額の正本」の完全一致条件をすべて満たすときだけ。
  - `internal_transfer_candidate`: 別口座間で同額・許容日差（既定1日）以内・1対1の未紐付けexpense/incomeペアが一意に決まる場合のみ。
- 曖昧・分割・手数料混在・同額複数候補・残高差の直接補正・勘定科目の推測は、findingの型を問わず常に`eligibleForAutoApply=false`（`balance_delta`/`sync_stale`/`unprocessed_entry`/`anomalous_journal`は型として自動反映対象に一切含めない）。

## 毎月の給与仕訳は freee人事労務の「会計連携」を押すまで会計に入らない

**freee人事労務で給与を確定しただけでは、freee会計に給与仕訳は作られない。** 給与明細一覧の「会計連携」ボタンを押して初めて `役員報酬` / `法定福利費` / `預り金` の複合仕訳が会計へ送られる。押し忘れると試算表にその月の役員報酬が載らず、AMD OSの実績（`company_actual_monthly` の `fixed_cost`）も0円のままになる。

| 見分け方 | 状態 |
|---|---|
| ボタンが `会計連携` | **未実行**。その月の給与仕訳は会計に無い |
| ボタンが `会計連携の取消し` | 実行済み |

- 場所: freee人事労務 → 給与 → 給与明細一覧 → 対象月タブ（`https://p.secure.freee.co.jp/payroll_statements`）
- 仕訳の発生月は**支給月ではなく賃金計算期間の末日**。8月25日支給（7月勤務分）は `202607` に載る。
- 実行は取り消せる（`会計連携の取消し`）。
- 実行後、AMD OS へ取り込むには `GET /api/cron/management-score-raw-data?includeFreee=1&ym=YYYYMM` を対象月ぶん叩く。`includeFreee=1` が無いと試算表は同期されない。

**検知**: きよ「00 お金の流れ」（`6-11`）の役員報酬は、freee試算表の行はあるのに `役員報酬` 科目だけ無い月を欠測として注記に出す。ここに月が並んでいたら会計連携の押し忘れを疑う。

### 口座明細の消込は一覧画面からは見えない

振込明細を給与仕訳の `未払金` と突き合わせるのは、`自動で経理` の一覧に出ている「取引登録」ではなく、**明細の詳細を開いて「未決済取引の消込」タブ**で行う。一覧の「登録」を押すと新規に費用を立ててしまい、給与仕訳と二重になる。役員報酬の振込が複数人ぶんに分かれている場合は、1件の未決済取引（例: 830,783円 = まさ548,762 + きよ282,021）に対して `今回決済金額` を入れて部分消込する。

### 履歴

- 2026-08-27: 7月分・8月分の会計連携が未実行のまま放置され、`202606` `202607` の役員報酬・法定福利費が会計にもAMD OSにも載っていなかった。えいみがブラウザで両月の会計連携を実行し、`?includeFreee=1` で再同期。`202606` 役員報酬 1,040,000 / 法定福利費 153,842、`202607` 同額を確認。

## 役員報酬期待額の正本（`company_finance_recurring_items`。`billing_cycles.reward_summary_json`は使わない）

`billing_cycles.reward_summary_json`はPJ報酬reserve（`/admin/finance`の「AMD運営費へ残る役員除外分」= 既存`officer-compensation.ts`の`loadOfficerReserve`が使う別用途の正本）であり、役員報酬そのもののSOTではない。会計照合が使うのは`pwa/manual/4-5-management-score-and-finance-simulation-spec.md`が定める契約どおり、`company_finance_recurring_items`の`item_kind='salary'`または`category='executive'`の明示分類だけ（`freee-reconciliation-client.ts`の`loadOfficerRecurringMappings`）。

member紐付け（`buildOfficerRecurringMappings`、純関数）:

1. `payload.memberId` / `payload.member_id` が対象役員の`member_id`と一致する行が**1件だけ**あれば`mappingStatus='explicit'`。2件以上あれば`'explicit_conflict'`。
2. 明示指定が無い場合、`display_name`/`vendor_name`を正規化して`members.member_name`/`code_name`と完全一致する行を探す。1件だけなら`'name_match_single'`（レビュー候補として扱うが**auto eligibleにはしない**）、2件以上なら`'name_match_ambiguous'`。
3. どちらも無ければ`'missing'`。

`mappingStatus`が`missing`/`explicit_conflict`/`name_match_ambiguous`のいずれかの役員は、金額突き合わせの前に**即blocker finding**（全役員が必ずfinding上に現れる）。

`mappingStatus`が`explicit`または`name_match_single`の役員は、対象月（run日を含む月）内のexpense明細から、次を**すべて**満たす候補を照合する。条件一致するdeal紐付け済み明細が1件だけなら消込済みとしてfindingを出さない。deal済みと未処理の重複、複数deal、内部振替扱いは誤分類・二重支払いの可能性としてblockerにする。

- 金額完全一致（`amount_yen`と1円単位で一致）
- `withdrawal_account`が設定されていれば、明細のwalletable名と正規化一致/部分一致（未設定なら条件をスキップ）
- 摘要（description）に`member_name`/`code_name`/`vendor_name`/`display_name`のいずれかの正規化トークンが含まれる
- 新たな未消込候補として扱うのはdeal/振替どちらにも未紐付けの明細だけ
- 候補が1件だけ（複数候補・0候補はambiguous）

**`eligibleForAutoApply=true`になるのは、上記すべてを満たし、かつ`mappingStatus='explicit'`（氏名一致だけの`name_match_single`は除外）、かつ他役員の期待額と金額が衝突しないときだけ**。金額が1件一致しているだけでは`exact`にしない。

## freee mutationの安全境界（`isActionTypeSafelyExecutable`が正本、両action typeとも現状false）

freee公式APIの制約を2026-07時点で確認済み:

- **wallet_txnの「消込/処理済み」状態を変更する公開APIは存在しない**（[freee/freee-api-schema#541](https://github.com/freee/freee-api-schema/issues/541)で未実装と明言）。
- 内部振替を事後的に`transfer_id`で正式リンクする公開APIも存在しない。manual_journal（振替伝票）での代替は、既存の銀行明細行と二重計上になるリスクを排除できない。→ **`internal_transfer_reconcile`は常に`blocked`固定**。
- `wallet_txn`の`account_item_id`更新（`PUT /api/1/wallet_txns/{id}`）が「役員報酬の消込」を正しく表現する（二重計上しない・freee上で実際に消込として扱われる）ことは、公式ドキュメント上で検証できていない。issue #541が確認しているのは「処理済み/無視」状態変更APIの不在のみで、account_item_id更新の意味論はそれとは別問題として未検証。→ **`officer_compensation_reconcile`も現状は`blocked`固定**。
- そのため2026-07時点では、4回review gate・5回目以降allowlistの判定ロジックは完成しているが、**freeeへの実書込みはどちらのaction typeも一切発生しない**。`eligibleForAutoApply=true`かつ`phase='auto_apply_allowlist'`のfindingは、executorが`freee_reconciliation_actions`に`mode='blocked'`のレコードを残し、finding自体も`review_status='blocked'`へ遷移する（人がfreee UI上で処理する前提）。
- `FREEE_RECONCILIATION_WRITES_ENABLED=1`は将来、安全な公式endpointが確認・実装されたときのための予備の安全弁（`isActionTypeSafelyExecutable`が構造的にfalseを返す限り、このenvを立てても何も実行されない）。
- 管理者の手動承認（`POST .../reconciliation {action:'review'}`）もfreee書込みを一切トリガーしない。承認/却下は「このOS内でどう扱うと決めたか」の監査記録に限定する。

## 検出ロジック（`freee-reconciliation-engine.ts`、純関数）

| finding_type | 検出内容 | 自動反映 |
|---|---|---|
| `balance_delta` | freee `walletable_balance`（freee登録残高）と`last_balance`（銀行同期残高）の差 | 不可（残高差の直接補正は絶対に自動化しない） |
| `sync_stale` | `sync_status`が失敗系、または`last_synced_at`が3日以上前 | 不可 |
| `unprocessed_entry` | freee公式`wallet_txn.status=1`（消込待ち）の明細が3日以上経過 | 不可 |
| `audit_source_unavailable` | freeeアプリ権限不足などで監査ソースを取得できない。対象範囲は検査済みとみなさずblocker | 不可 |
| `anomalous_journal` | manual_journalsの貸借不一致・勘定科目未設定・金額0円 | 不可 |
| `officer_compensation_unreconciled` | `company_finance_recurring_items`由来の役員報酬期待額とfreee明細の突合。単一deal紐付け済みは解消済み、重複/内部振替扱いはblocker | 判定上はeligibleになりうるが、実書込みは常にblocked |
| `internal_transfer_candidate` | 別口座間の同額・同日/許容日差の未紐付けexpense/incomeペア | 判定上はeligibleになりうるが、実書込みは常にblocked |

**freee公式フィールドの意味**（取り違え注意）:`last_balance`＝銀行同期の実残高（同期残高）、`walletable_balance`＝freee帳簿上の登録残高。`balance_delta`は`walletable_balance - last_balance`で計算する。

口座一覧は`with_balance=true`を明示しないと`last_balance`/`walletable_balance`が返らない。口座明細の処理状態は非標準の`deal_id`/`transfer_id`ではなく、freee公式`status`（1=消込待ち、2=消込済み、3=無視、4=消込中、6=対象外）を正にする。同期状態は`unsupported`を検査対象外、`disabled`を同期未設定のinfo、`token_refresh_error`/`other_error`をblockerとして扱う。

freeeアプリに`manual_journals`の参照権限が無い場合、その403だけはrun全体を失敗させず、`audit_source_unavailable`のblockerを残して他の照合を継続する。この間、振替伝票の異常検査は**未実施**であり、0件と解釈しない。403以外の取得エラーは従来どおりrunをfailedにする。

## cron / 週窓

- `pwa/vercel.json`: `{ "path": "/api/cron/freee-accounting-weekly", "schedule": "0 1 * * 4" }`（UTC木曜01:00 = JST木曜10:00）。
- 週窓は run日を末日とするtrailing 7日間（`weekWindowForRunDate`）。役員報酬照合の対象月（`targetYm`）は`weekEndDate`（≒run日、`jstRunDate`パラメータ指定時はそれを使う。実運用の`now()`には依存しない）が属する月。
- 同一週内の`triggered_by='cron'`完了runは`run_key=freee-weekly:{weekStartDate}`の一意制約で二重実行しない。`status='running'`のまま30分（`STALE_RUNNING_THRESHOLD_MINUTES`）を超えたrunはクラッシュとみなし、同じrunを安全に再開する（`isRunStale`）。30分以内の`running`は本当に並行実行中の可能性があるためskipする。
- freee読み取りウィンドウは週窓ではなく直近60日（`LOOKBACK_DAYS`）: 役員報酬・内部振替の照合は支払タイミングが週窓とずれるため、広めに見る。findingは週次runごとに新規occurrenceとしてinsertされる（`finding_key`は安定なので過去との対応は追える）。
- 今回正常に評価できたfinding typeで再現しなかった過去の`pending`/`blocked` occurrenceは、削除せず`resolved`へ閉じる。監査ソースがunavailableなtype（現在はmanual_journalsの`anomalous_journal`）は未検査なので自動解消しない。

## 収支スプシ参照（read-only、正本ではない）

きよが手作業する収支Googleスプレッドシートは、`AMD_FINANCE_REFERENCE_SHEET_ID`（対象spreadsheetId）と`AMD_FINANCE_REFERENCE_SHEET_RANGES`（カンマ区切りのA1 range一覧）が設定されているときだけ、既存`src/lib/sources/google.ts`の`getGoogleAuthAsync()`（`GOOGLE_OAUTH_*` / `GOOGLE_SERVICE_ACCOUNT_JSON`）を使ってread-onlyで取得する。

- **AMD OS/freeeへは絶対に書き込まない**。この機能は参考情報の取得のみ。
- セル値そのものはfinding本文にもDBにも保存しない。range毎の`rowCount`（行数）と`nonEmptyCellCount`（非空セル数）だけを`summarizeSheetRangeValues`でsanitizeし、run の`summary_json.sheetReference`に保存する。
- env未設定・Google OAuth未設定・取得失敗のいずれでも、run summary_jsonに必ず`sheetReference:{status:"skipped", reason:"..."}`を残す（`decideSheetReferenceSkip`）。設定済みで取得できれば`{status:"ok", spreadsheetId, fetchedAt, ranges:[...]}`。
- 会計照合の判定（finding検出・eligible判定）はこのスナップショットを一切参照しない。あくまで人がrun履歴を見るときの参考情報。

## 監視/トラブル時

| 症状 | 確認場所 |
|---|---|
| 今週runが無い/failed | `/admin/finance`「run履歴」、`freee_reconciliation_runs.error_message` |
| 想定よりfindingがeligibleにならない | `officer_compensation_unreconciled`のfinding `evidence_json.mappingStatus`（`missing`/`explicit_conflict`/`name_match_ambiguous`ならrecurring itemの紐付けを直す） |
| `audit_source_unavailable`が出る | freeeアプリの振替伝票一覧参照権限を確認する。解消まで「変な仕訳」のmanual_journals検査は未実施 |
| 「auto-apply対象のはずなのにfreeeに反映されない」 | 仕様どおり。2026-07時点でfreee書込みは常にblocked（上記「freee mutationの安全境界」参照）。`freee_reconciliation_actions.blocked_reason`に理由が入る |
| 収支スプシ参照が毎回skipped | run summary_jsonの`sheetReference.reason`（env未設定 or Google OAuth未設定） |

## 関連環境変数

| 変数 | 役割 |
|---|---|
| `CRON_SECRET` | cron route認可 |
| `FREEE_RECONCILIATION_WRITES_ENABLED` | 将来、安全な公式endpointが実装されたときの予備の安全弁。現状は`isActionTypeSafelyExecutable`がfalse固定のため無効 |
| `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_REFRESH_TOKEN` / `FREEE_COMPANY_ID` | 既存`freee-client.ts`のトークン管理（`freee_oauth_tokens`テーブルが優先、env はfallback） |
| `AMD_FINANCE_REFERENCE_SHEET_ID` / `AMD_FINANCE_REFERENCE_SHEET_RANGES` | きよの収支スプシread-only参照（任意、未設定ならskip） |
| `GOOGLE_OAUTH_*` / `GOOGLE_SERVICE_ACCOUNT_JSON` | 収支スプシ参照用のGoogle認証（既存`src/lib/sources/google.ts`と共有） |

## 関連

- [`6-4-finance-payment-confirm-spec.md`](6-4-finance-payment-confirm-spec.md) — `/admin/finance`の既存構成（支払義務台帳・継続支払い・領収書イベント・役員除外分）
- [`4-5-management-score-and-finance-simulation-spec.md`](4-5-management-score-and-finance-simulation-spec.md) — `company_finance_recurring_items`の`item_kind='salary'`/`category='executive'`明示分類の契約元
- `pwa/src/lib/finance/officer-compensation.ts` — `/admin/finance`本体が使う別用途の役員除外分計算（会計照合とは別正本）
- `pwa/src/lib/finance/freee-reconciliation-engine.ts` — 純関数の検出/フェーズ/実行判定ロジック（`pwa/scripts/check_freee_reconciliation_engine.mts`でテスト）
- `pwa/src/lib/finance/freee-reconciliation-client.ts` — freee I/O + orchestration + admin overview読み出し
