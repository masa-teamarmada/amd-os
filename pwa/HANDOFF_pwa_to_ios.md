## 2026-11-05 データ変更履歴の可読化

PWAのAMD OS変更履歴を「対象名・変更項目・変更前→変更後」の共通形式へ変更。AMD OS対象の表と列の表示名・制約値・参照先を解決し、一括処理にも差分を表示する。詳細の項目数制限を外し、元番号と生の差分は「記録情報」に保持。共通DBにはrecord_contextを追加し、各クライアントからの今後のAMD OS変更も対象名・所属を変更前後で保存する。L2M専用20表の監査を停止し、誤混入した過去記録226,744件を履歴本体から削除。新しい表はAMD OS監査対象として明示登録した場合だけ記録。画面/APIは保存済み履歴をそのまま読む。migrations `20261105012202`・`20261105015441`・`20261105021010`・`20261105021635` は適用済み、再適用不要。Swift/iOS・macOS・Android専用画面は未移植。表示仕様はspec5-2、操作はmanual2-6、回帰はtest:data-change-history。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 全履歴の対象名・項目名・値・集約差分 | spec5-2 / spec2-1 / SPEC_pwa | manual2-6 | 同期済み |
| 変更時の対象名保存・台帳追加の検査 | spec5-2 / db_schema | manual2-6 | migration適用済み・同期済み |
| Swift/iOS・macOS・Androidの専用履歴UI | ios/DESIGN / macos/PARITY | 対象外 | 未移植 |
| 理論・数式 | 変更なし | 対象外 | 表示・記録方式だけの変更 |

# PWAからiOSへの引き継ぎ

## 2026-11-05 契約凍結の独立状態

共通DBの適用済みmigration `20261105122042`で`contracts.execution_status`（`standard` / `frozen`）、`execution_frozen_from_ym`、`execution_status_note`を追加。CTBの契約`82b57da5-a2ab-508e-afbe-58ac9b8cb9cb`は202605から`frozen`。締結証跡`status=signed`と原本満了日2027-02-13は保持。PWAのPJ台帳・契約一覧は`契約凍結`と表示し、Admin月次報告は凍結開始月以降を生成しない。Swift/iOS・macOS・Androidの専用UIは未移植。仕様はpwa/spec/5-6・5-9、操作はpwa/manual/2-6・6-7。

## 2026-11-05 CTBの凍結表示と契約期間の名称

PWAの`/admin/projects`は`projects.status=active`でも現在月が`freeze_from_ym`以降ならPJ状態を`凍結`と表示し、件数・絞り込みも合わせる。契約期間状態`in_effect`の表示名は`契約期間内`。CTBは2026年5月からPJ凍結、契約原本の満了日は2027年2月13日。契約終了への変更・DB schema変更はない。Swift/iOS・macOS・Androidの専用UIは未移植。仕様はpwa/spec/5-6、操作はpwa/manual/2-6・6-2・6-7。

## 2026-11-05 契約期間状態と月報予定

PWAの`/admin/projects`にPJ伴走状態と別の`業務契約`列、`/admin/contracts`に契約ごとの`期間状態`列を追加。採用済みAMD当事者契約の締結状態、開始・終了日、更新条件から当日計算し、CXはPJ稼働中・NIMS業務契約終了と表示する。月報予定は締結済み業務契約の確定した開始・終了月だけ生成し、期間不明は1件の確認項目とする。共通DB schemaと契約原本は変更なし。Swift/iOS・macOS・Androidの専用画面は未移植。正本はpwa/spec/5-6・5-9、操作はpwa/manual/2-6・6-7。

## 2026-11-05 管理カレンダーの報告期限

PWAの月次報告予定は契約の開始月・終了月で区切る。NIMS連携覚書の「有償活動時に提出」は月ごとの定期義務として生成しない。共通DBのschemaは変更しない。Swift/iOS・macOS・Androidに管理カレンダーの専用画面はないため、Native画面変更と端末検証は今回の対象外。仕様はpwa/spec/5-9、操作はpwa/manual/2-6。

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

## 2026-11-26 支払通知書の月別予定

PWA月別表は選択支払月の前月から表示する。入金確認日と、通知額・全PJ報酬額が照合済みの実支払日を優先し、未確認分は予定月へ残す。表示専用の変更でDB・共通の支払条件計算・通知書は変更なし。Swift側は今回対象外。正本はspec3-27「実績月による月別入出金」。

## 2026-11-27 支払通知額の個別確定

共通DBに追記専用の `member_payout_amount_confirmation_events` を追加し、2026年11月支払分・ZMP 10月稼働分のあび40,200円、うめ0円をまさの確定額として保存。PWAの支払通知書、月別収支予定、月次試算表はこの額を優先する。`monthly_reward_payout` のあび40,200円・うめ0円と、あびの未発行 `payout_notices` 40,200円も本番へ同期済み。未納品のOkuDoor追加開発分は今回の通知額から除外し、確認待ちとして台帳の監査情報へ記録。報酬発生・未払残の計算と送付済み通知書は維持。しんの送付済み55,200円は履歴に残し、画面に今回支払0円を表示し、追加支払合計から除く。Swift/iOS・macOS・Androidの専用表示は未移植。migration `20261127105908` は本番適用済みで再適用しない。

PWA v3.165.32では保存済み支払額と明示確定額が一致する場合、旧計算の別財布内訳との差による「未計算」を解消した。保存額の欠損・不一致は引き続き確認対象にする。Nativeへ移植するときもこの照合条件を使う。

PWA v3.165.33では支払通知書の初期支払月を日本時間の当月とし、きよ画面の埋め込みでもURLの `ym` 指定を引き継ぐ。11月の通知額を確認する画面で12月の列が青くなる問題を解消する。Native側の専用画面は未変更。

| 新仕様/仕様変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 確定額の追記台帳・0円の通知書抑止 | spec3-27、ios/DESIGN | manual6-5 | 共通DB適用済み・PWA反映対象 |
| 月別収支・月次試算表の確定額 | spec3-27 | manual6-5 | PWA反映対象、Native未移植 |
| 報酬発生・将来繰越の数式 | 変更なし | manual7-1 | 計算元は維持 |
