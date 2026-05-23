# PWA Feature Registry

AMD OS PWA の重要機能を、画面単位で「消してはいけない契約」として列挙する。

このファイルは実装の詳細仕様ではなく、回帰防止用の登録簿。画面・API・DBのいずれかから機能を削る場合は、同じ commit でこの登録を更新し、理由を残す。未更新のまま UI を削除しない。

## 運用ルール

- 新しい業務導線を追加したら、このファイルか該当 `pwa/design/*.md` に機能契約を残す。
- `design_log/` は作業ログであり正本ではない。恒久仕様は `pwa/design/` 配下へ入れる。
- `npm run test:critical-ui` は、この登録簿と実装内の重要 anchor を検査する。
- 重要 UI を置き換える場合は、旧 anchor を消す前に新 UI の anchor と仕様を登録する。

## /admin/payouts

目的: 支払月単位で、対象cycleの報酬確認、PJ別収支確認、支払データ保存、支払通知書発行、入金確認nudgeを一画面で運用する。

必須機能:

- 支払月選択: `ym=YYYYMM` で対象月を選び、`billing_cycles.invoice_ym` を優先する。未設定cycleは `/admin/projects` の `projects.payment_due_rule` から支払月を判定する。
- 高速初期表示: 通常GETは `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけにする。毎回 `syncRewardSummariesForBillingCycles()` を再計算しない。
- 報酬キャッシュ再計算: 明示的な「報酬キャッシュ再計算」操作または保存系処理だけが `refreshRewards=1` / `refreshRewards: true` で再計算する。
- 縦型PJ収支表: 「全体収支」列とPJ列を並べ、クライアント支払、バッファ、PJ予算、支払予定、役員分、役員相殺、最終収支、メンバー別支払を確認できる。
- 後追いPJ予算確定: 契約や支払額が後から確定したPJは、支払月画面から確定委託料とバッファを入れ、対象稼働月の `billing_cycles.budget_yen` / `budget_reported_amount` / `budget_buffer_amount` へ配分する。
- 支払データ保存: `monthly_reward_payout` に明細、`payout_notices.total_yen` にメンバー別通知額を保存する。役員または `exclude_from_payout_notice` のメンバーは通知対象外にする。
- 支払通知書発行: 支払対象メンバーごとに `payout_notices.notice_no` / `pdf_url` / `sent_at` を編集できる UI を持つ。番号発行、PDF URL保存、送付済み化、未送付戻しを画面からできる。
- 入金確認nudge: `payment-confirm-nudges` を手動実行でき、Slack DMの `/payment-confirm` とつながる。
- 月次モーダル導線: cycle明細やPJ収支表の稼働月から `CockpitMonthlyModal` を開き、報酬根拠に戻れる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/payouts` の支払通知書発行、報酬キャッシュ、縦型PJ収支表の anchor を検査する。
- この画面で UI を削る変更は、`FEATURE_REGISTRY.md` と `SPEC_pwa.md` を同時に更新する。
