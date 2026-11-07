AMD OSの「ZMP 2026年6月稼働分の事前合意額」を再開する。新しい不具合報告がない限り、変更せずに完了扱いのまま閉じる。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_ZMP_202606_PAYOUT_AGREEMENT_20261107.md`
4. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
5. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
6. `pwa/manual/7-1-reward-calc-spec.md`
7. `pwa/spec/3-27-payout-notice-current-spec.md`
8. `pwa/BUGS.md` の `[finance/reward] 旧制度の事前合意額を支払通知書だけへ固定する経路がなかった`
9. `pwa/scripts/migrations/199_legacy_reward_payout_amount_override_events.sql`

確定状態:

- ZMP (`p19`) の2026年6月稼働分は税抜で、こう0円、あび40,000円、うめ5,000円、しん55,000円。
- `legacy_reward_payout_amount_override_events` のappend-only eventを支払snapshotと未送付PDFにだけ適用する。
- 対象上限は `source_ym <= 202606`。MS、pt、share、`reward_summary_json`、stock/carry、将来差額は変更しない。
- こうの0円は監査snapshotを残すが、新しい0円通知書を発行しない。送付済みPDFは上書きしない。
- 初回実装は `ad893d055`、0円表示補正は `d77c83fb5`。migration 199は適用済みなので再適用しない。

再開条件と最初の作業:

1. 上の4額と画面・正式PDFが一致しない、6月の固定額が将来月へ波及する、送付済みPDFが上書きされる、のいずれかを具体的な証跡で確認する。
2. まずread-onlyでevent、`monthly_reward_payout`、`payout_notices`、現行報酬cacheを照合する。未確認を推測で埋めない。
3. MSや`monthly_reward_payout`を手編集しない。migration 199を再適用しない。
4. 修正が必要なら、event読取、支払同期、PDF生成の境界に限定して最小変更し、`npm run test:payout-amount-overrides` と `npm run test:critical-ui` を通す。
5. PDF作成・送信・DB writeは原因確認と別に扱い、外部送信はまさの明示承認なしに行わない。

運用:

- main一本。push前にremoteを確認し、対象ファイルだけ明示stageする。`git add .` は使わない。
- ルートの `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は請求書の立替税率案件が使用中。上書きしない。
- 現行仕様はmanual 6-5、manual 7-1、spec 3-27。古い会話だけを根拠にしない。
