# PWAからiOSへの引き継ぎ

## 2026-11-04 Management月次試算表

共通DBのos_live_monthly_pl/os-live-currentをengine v2で再計算。法人受取、保存済み外部報酬の支払月、融資台帳、給与手取り・カード等と社保の現金予算を反映。追加の現金内訳はnet_cash_flow.payloadにmemberCashPayment/operatingCashPayment/socialInsuranceCashPaymentとして格納。PWAの計算入力cashPlansと未確定支払の表示はNative未移植。DB schemaと既存列は変更なし。Swift/macOS/Androidの画面・実機確認は未実施。正本manual4-5とdesign/management_score.md。


## 2026-11-03 戦略余力

PWAに共通ページstrategic-resourcesを追加。仕様pwa/spec/3-24、型pwa/src/lib/project-strategic-resources.ts。既存page-runtimeの認可後にstrategicResourcesを返す。SOL登録試算は評価日2026-11-03/v0.2。3条件×利用対価2条件、数値の中間は金額内訳の平均。Swift・macOS専用画面の実装と端末確認は未実施。
