# PWAからiOSへの引き継ぎ

## 2026-11-04 月次試算表の独立とAdmin閲覧順

PWA専用route `/admin/monthly-trial-balance`へManagementの財務ブロックを移設。通常左メニューとManagementに入口あり。Adminは`/api/admin/navigation-usage`で本人の既存閲覧行を集計し、多い順・検索・履歴なしの分類表示へ変更。RPC migration `20261104100247`適用済み、再適用不要。仕様はspec2-1・2-7、manual2-6・4-5。Swift/iOS・macOS・Androidの画面は未移植、今回は実装・実機確認の対象外。

| 新仕様 | 設計正本 | マニュアル章 | 状態 |
|---|---|---|---|
| 独立した全社月次試算表と入口 | ios/DESIGN、spec2-1、design/management_score | manual4-5・2-6 | PWA反映対象、Native未移植 |
| 本人の閲覧回数順・検索・履歴なし | spec2-1・2-7、FEATURE_REGISTRY | manual2-6 | PWA反映対象、Native未移植 |
| モデル・理論 | 金額・計算式を維持 | BZM更新対象外 | 移設と閲覧集計のみ |

2026-11-04 v3.165.8：PWAのみ、計画線の値をmodelCashBalanceへ保持し、実績接続残高cashBalanceと分離。再計算前後の表示を統一。共通DBの金額・schema変更なし。

## 2026-11-04 Management月次試算表

共通DBのos_live_monthly_pl/os-live-currentをengine v2で再計算。法人受取、保存済み外部報酬の支払月、融資台帳、給与手取り・カード等と社保の現金予算を反映。追加の現金内訳はnet_cash_flow.payloadにmemberCashPayment/operatingCashPayment/socialInsuranceCashPaymentとして格納。PWAの計算入力cashPlansと未確定支払の表示はNative未移植。DB schemaと既存列は変更なし。Swift/macOS/Androidの画面・実機確認は未実施。正本manual4-5とdesign/management_score.md。


## 2026-11-03 戦略余力

PWAに共通ページstrategic-resourcesを追加。仕様pwa/spec/3-24、型pwa/src/lib/project-strategic-resources.ts。既存page-runtimeの認可後にstrategicResourcesを返す。SOL登録試算は評価日2026-11-03/v0.2。3条件×利用対価2条件、数値の中間は金額内訳の平均。Swift・macOS専用画面の実装と端末確認は未実施。

## 2026-11-04 ManagementのAdmin移設

PWAの正本は `/admin/management-score`。通常左メニューのManagement項目を削除し、月次試算表との相互リンクも削除。AdminのManagementと月次試算表は独立ページ。本人の旧URL閲覧数は新項目に合算、DB更新なし。仕様spec2-1・2-7、使い方manual2-6・4-5、全画面正本ios/DESIGNと同期。Swift/iOS・macOS・Androidは未移植、今回は実装対象外。

| 新仕様 | 設計正本 | マニュアル章 | 状態 |
|---|---|---|---|
| ManagementのAdmin移設・相互リンク削除 | spec2-1・2-7、ios/DESIGN | manual2-6・4-5 | PWA反映対象、Native未移植 |
| 閲覧回数の旧URL合算 | spec2-1、admin-navigation-usage | manual2-6 | PWA反映対象、DB書換えなし |
| 理論・数式 | 既存値を維持 | BZM更新対象外 | ナビとURLの変更のみ |
