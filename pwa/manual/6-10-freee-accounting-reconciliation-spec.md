# freee週次会計照合 / 会計照合レール 仕様

毎週木曜10:00 JSTに本実行する、freeeとAMD OSの財務データを突き合わせる deterministic cron。全役員を対象に、変な仕訳・口座ごとの登録残高と同期残高の差・役員報酬の未消込・内部振替の不整合を検出し、`/admin/finance` の「会計照合レール」でレビュー・承認する。

> **正本境界**: AMD OSの財務テーブル（`billing_cycles.reward_summary_json` 経由の役員報酬期待額、`members.is_officer`）がSOT。freeeは実行先兼一次証跡（wallet_txns/walletables/manual_journalsの生データ）。きよが手作業する収支Googleスプレッドシートは read-only 参考資料で、このcronは一切書き込まない・参照もしない。

## 画面と API

| URL / route | 役割 | 認可 |
|---|---|---|
| `/admin/finance`（会計照合レール） | 未解決差額・口座残高/同期・役員報酬・振替・仕訳・run履歴を表示、承認/却下、dry-runプレビュー実行 | admin |
| `GET /api/cron/freee-accounting-weekly` | 週次本実行（cron）。`dryRun=1`でpreview | `CRON_SECRET`（または admin セッション） |
| `GET /api/admin/finance/reconciliation` | 会計照合レールの表示データ取得 | admin |
| `POST /api/admin/finance/reconciliation` `{action:'run', dryRun}` | 手動re-run（既定dryRun=true） | admin |
| `POST /api/admin/finance/reconciliation` `{action:'review', findingId, decision, confirmWrite?}` | finding承認/却下。承認がfreee即時書込みを伴う場合は`confirmWrite:true`必須＋サーバー側再検証 | admin |

## DBテーブル（migration 205）

| テーブル | 役割 |
|---|---|
| `freee_reconciliation_runs` | run単位（週窓、triggered_by、dry_run、status、phase、run_sequence、finding/auto_applied/blocked件数、summary_json） |
| `freee_reconciliation_findings` | 検出した issue 単位。`finding_key`一意でrun間idempotent upsert。review_status（pending/approved/rejected/auto_applied/blocked）、evidence_json、reviewed_by/at/note |
| `freee_reconciliation_actions` | freee mutation(候補含む)のaudit log。`idempotency_key`一意で再実行防止、mode（dry_run/executed/blocked）、before_state_json/after_state_json、blocked_reason |

RLSは`amd_os_current_user_is_admin()`（admin全操作）+ service_role bypass。anon/authenticated一般には非公開（役員報酬情報を含むため）。

## 4回review gate → 5回目以降allowlist（`freee-reconciliation-engine.ts`の`computeRunPhase`が正本）

- `triggered_by='cron' AND status='completed'` の過去run数 + 1 = `run_sequence`。
- `run_sequence <= 4` → `phase='review_only'`。findingは検出・保存されるが、自動でfreeeへは一切書き込まない。
- `run_sequence >= 5` → `phase='auto_apply_allowlist'`。自動反映されるのは次の2種類の**完全一致**findingだけ:
  - `officer_compensation_unreconciled`: 全役員（`members.is_officer=true AND status='active'`）の期待報酬額（`billing_cycles.reward_summary_json`由来、`officer-compensation.ts`の`loadOfficerReserve`が正本）に対し、freee側で単一のexpense wallet_txnが金額完全一致し、かつ他の役員の期待額とも衝突しない場合のみ`eligibleForAutoApply=true`。
  - `internal_transfer_candidate`: 別口座間で同額・許容日差（既定1日）以内・1対1の未紐付けexpense/incomeペアが一意に決まる場合のみ`eligibleForAutoApply=true`。
- 曖昧・分割・手数料混在・同額複数候補・残高差の直接補正・勘定科目の推測は、findingの型を問わず常に`eligibleForAutoApply=false`（`balance_delta`/`sync_stale`/`unprocessed_entry`/`anomalous_journal`は型として自動反映対象に一切含めない）。

## freee mutationの安全境界（`isActionTypeSafelyExecutable`が正本）

freee公式APIの制約を2026-07時点で確認済み:

- **wallet_txnの「消込/処理済み」状態を変更する公開APIは存在しない**（[freee/freee-api-schema#541](https://github.com/freee/freee-api-schema/issues/541)で未実装と明言）。
- 内部振替を事後的に`transfer_id`で正式リンクする公開APIも存在しない。manual_journal（振替伝票）での代替は、既存の銀行明細行と二重計上になるリスクを排除できない。
- そのため **`internal_transfer_reconcile`は常に`blocked`固定**（`isActionTypeSafelyExecutable`がfalseを返す）。findingの検出・レビューは行うが、承認してもfreeeへの自動書込みは発生しない。人がfreee UI上で処理する。
- **`officer_compensation_reconcile`だけ**、既存wallet_txnの`account_item_id`を役員報酬勘定へ更新する（`PUT /api/1/wallet_txns/{id}`）。これは新規のcash側計上を作らないため二重計上にならない、安全な表現。
- 上記に加えて、実行には `FREEE_RECONCILIATION_WRITES_ENABLED=1` の明示env opt-inが必要（allowlist phaseに入っていても、このenvが無ければ`blocked`のまま）。管理者が承認画面から手動approveした場合は、この env に関係なく `confirmWrite:true` を明示すればサーバー側再検証の上で即時実行される。
- すべてのfreee書込みはidempotency_key（`${finding_key}:${action_type}`、手動承認時は追加でactor+timestampを含める）で再実行防止し、before/after状態を再取得して`freee_reconciliation_actions`に保存する。

## 検出ロジック（`freee-reconciliation-engine.ts`、純関数）

| finding_type | 検出内容 | 自動反映 |
|---|---|---|
| `balance_delta` | freee `last_balance`（帳簿残高）と`walletable_balance`（登録/同期残高）の差 | 不可（残高差の直接補正は絶対に自動化しない） |
| `sync_stale` | `sync_status`が失敗系、または`last_synced_at`が3日以上前 | 不可 |
| `unprocessed_entry` | deal/transferどちらにも未紐付けの明細が3日以上経過 | 不可 |
| `anomalous_journal` | manual_journalsの貸借不一致・勘定科目未設定・金額0円 | 不可 |
| `officer_compensation_unreconciled` | 役員報酬期待額とfreee明細の突合 | 完全一致・単一候補のみ可 |
| `internal_transfer_candidate` | 別口座間の同額・同日/許容日差の未紐付けexpense/incomeペア | 完全一致・1対1のみ可（実書込みは常にblocked） |

## cron / 週窓

- `pwa/vercel.json`: `{ "path": "/api/cron/freee-accounting-weekly", "schedule": "0 1 * * 4" }`（UTC月曜=0火1...木=4、01:00 UTC = 10:00 JST）。
- 週窓は run日を末日とするtrailing 7日間（`weekWindowForRunDate`）。同一週内の`triggered_by='cron'`完了runは`run_key=freee-weekly:{weekStartDate}`の一意制約で二重実行しない（実行中に落ちた場合は`status='failed'`から同じrunを再開）。
- freee読み取りウィンドウは週窓ではなく直近60日（`LOOKBACK_DAYS`）: 役員報酬・内部振替の照合は支払タイミングが週窓とずれるため、広めに見る。findingの重複はfinding_keyのupsertで自然に収束する。

## 監視/トラブル時

| 症状 | 確認場所 |
|---|---|
| 今週runが無い/failed | `/admin/finance`「run履歴」、`freee_reconciliation_runs.error_message` |
| 想定より自動反映が起きない | run履歴の`phase`/`run_sequence`（4回まではreview_only）、`FREEE_RECONCILIATION_WRITES_ENABLED`のVercel env設定有無 |
| 承認したのにfreeeへ書き込まれない | finding一覧の`review_note`（再検証失敗理由が入る）、`freee_reconciliation_actions.error_message` |
| 役員報酬期待額が想定とズレる | `/admin/finance`「AMD運営費へ残る役員除外分」（同じ`loadOfficerReserve`を共有正本にしている） |

## 関連環境変数

| 変数 | 役割 |
|---|---|
| `CRON_SECRET` | cron route認可 |
| `FREEE_RECONCILIATION_WRITES_ENABLED` | `1`でallowlist phaseの自動freee書込みを許可（既定OFF）。管理者の手動承認はこのフラグと独立 |
| `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_REFRESH_TOKEN` / `FREEE_COMPANY_ID` | 既存`freee-client.ts`のトークン管理（`freee_oauth_tokens`テーブルが優先、env はfallback） |

## 関連

- [`6-4-finance-payment-confirm-spec.md`](6-4-finance-payment-confirm-spec.md) — `/admin/finance`の既存構成（支払義務台帳・継続支払い・領収書イベント・役員除外分）
- `pwa/src/lib/finance/officer-compensation.ts` — 役員報酬期待額の共有正本（`/admin/finance`本体と本機能が共有）
- `pwa/src/lib/finance/freee-reconciliation-engine.ts` — 純関数の検出/フェーズ/実行判定ロジック（`pwa/scripts/check_freee_reconciliation_engine.mts`でテスト）
- `pwa/src/lib/finance/freee-reconciliation-client.ts` — freee I/O + orchestration + admin overview読み出し
