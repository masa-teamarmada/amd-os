# HANDOFF - ZMP 2026年6月稼働分の事前合意額

- 更新: 2026-11-07 JST
- 作業種別: development（完了済み案件のcloseout）
- 状態: 完了。新しい不具合報告がない限り再開不要
- 正本: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`

## 完了内容

ZMP (`p19`) の2026年6月稼働分は、ポイント制移行前に合意済みだった次の税抜額を支払レイヤーだけへ固定した。

| メンバー | member_id | 税抜額 |
|---|---|---:|
| こう | ID004 | 0円 |
| あび | ID009 | 40,000円 |
| うめ | ID008 | 5,000円 |
| しん | ID026 | 55,000円 |

`legacy_reward_payout_amount_override_events` のappend-only eventを使い、`source_ym <= 202606` をDBとコードの両方で強制している。支払snapshotと未送付の支払通知書PDFには反映するが、MS、pt、share、`billing_cycles.reward_summary_json`、stock/carry、将来月の差額には書き戻さない。こうの0円は監査snapshotだけ残し、未送付の旧PDFを削除して新しい0円通知書は発行しない。

## 証跡

- 初回実装: `ad893d055` (`fix(pwa): honor legacy June payout agreements`)
- 0円表示補正: `d77c83fb5` (`fix(pwa): show zero payout agreement explicitly`)
- DB定義・4件のevent: `pwa/scripts/migrations/199_legacy_reward_payout_amount_override_events.sql`
- 運用仕様: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- 計算境界: `pwa/manual/7-1-reward-calc-spec.md`
- 再発防止記録: `pwa/BUGS.md` の `[finance/reward] 旧制度の事前合意額を支払通知書だけへ固定する経路がなかった`
- 変更履歴: `pwa/manual/9-3-appendix-changelog.md` の2026-07-28行
- 現行支払仕様: `pwa/spec/3-27-payout-notice-current-spec.md`

## 再開条件

次のいずれかが起きた場合だけ再開する。

1. 2026年6月稼働分の表示額または正式PDFが上の4額と一致しない。
2. 6月の固定額が7月以降のMS、報酬cache、stock/carry、差額へ波及する。
3. 送付済みPDFが上書きされる、またはこうの0円通知書が新規発行される。

再開時もMSや`monthly_reward_payout`を手で合わせない。migration 199を再適用せず、event読取・支払同期・PDF生成境界から原因を追う。

## 今回のcloseout

- 2026-11-07に現行manual、spec、migration、BUGSを再読し、限定例外と4額が正本に残っていることを確認した。
- 新しいコード、DB、PDF、外部送信の変更は行っていない。
- ルートの `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` は別の未完了案件（請求書の立替税率）が使用中なので上書きしていない。
- `design_log` 更新なし。今回の作業は既存完了案件の読取closeoutだけで、実装・設計の新事実はない。
