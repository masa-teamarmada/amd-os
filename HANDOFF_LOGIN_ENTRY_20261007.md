# 共通ログイン入口（2026-10-07）

まさの確定意図：利用者に社内・外部・PJを選ばせず、メールdomainで認証方法だけを振り分ける。メール入力と「続ける」を１つにする。

設計：読む人は招待された研究者・PJ関係者・DD閲覧者と社内メンバー。領域語は招待、メール、共有URL、PJ、３スペース、閲覧権限。既存の紙の白、文字の黒、補助説明の灰、罫線の淡灰、入力フォーカスのring色を使う。署名要素は招待メールから既存の３スペースへ戻る共通入口。利用者種別の３ボタンは単一フォーム、英語の副題は入力手順、長い注意書きは同じブラウザで開く１文へ置換。白い面と細い境界だけで構成し影・装飾カードなし。既存書体、4px単位、max384px、主操作と入力48px、入力16pxでスマホの自動拡大を防ぐ。

方式判定は`login-entry.ts`のtrim/lowercase・厳密domain比較。Googleは既存Calendar/Gmail readonly、offline/consent、入力メールのlogin_hint、callbackのportfolio scopeを維持。外部は既存email-startへ正規化済みメールとnextだけを渡す。方式をdomainで選ぶことと認可は別で、callback・DB・RLS・通知・付与・PKCEは既存のまま。書斎は既存Google専用入口。旧project callbackも維持。本番active内部メンバーのproject scopeは0件と読取りで確認。nativeログインUIは未変更。

検証：`check_login_entry.mjs`が実ページのsubmit/Google handlerを抽出してtransport doubleで実行。社内/外部、正規化、似たdomain/subdomain除外、invalid入力、重複submit、共有URL保持、Google scope/login_hint、外部メールのみ、通信失敗、OAuth失敗、書斎を確認。メールやOAuthの実操作を行わず検証する。既存メール送信契約とcritical UI検査も通過。

| 同期対象 | 正本 | 状態 |
| --- | --- | --- |
| 共通入口の使い方 | manual/2-1、9-3 | 同期済み |
| domain選択・next・認可境界 | spec/2-1、6-1、design/SPEC_pwa | 同期済み |
| プラットフォーム境界 | ios/DESIGN.md | 同期済み、native UI未変更 |
| 理論・数式 | model/BZM | 対象外 |

ローカルChrome確認：PC1532×963とスマホ390×800で単一主操作。入力とボタン48px、入力文字16px。mobileのpage scrollWidth=390、scrollHeight=800、フォーム342pxで横溢れ・スクロール不要・重なりなし。不正メールはnative形式検証で停止し、メール実送信なし。UI確認評価8.5/10、残る表示blockerなし。TypeScript全体検査も通過。

追加実行した既存`check_workspace_documents_contract.mjs`は資料の同名raceエラーメッセージの固定regex（235行）で失敗。資料登録API・同検査scriptはHEADから変更しておらず、ログイン差分とは無関係。入口・メール認証契約・next sanitization・critical UIの必要検査は通過している。

本番反映とPC/スマホの画面確認結果は完了時に追記する。
