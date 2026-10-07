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

本番反映：実装`0e5c1cd5785e3be188744067cd29d224fc584019`、v3.161.14。clean main cloneから正規deploy.shでmain push、必須gate通過、2分6秒で本番aliasのSHA一致。Vercel project amd-os-pwa、production `dpl_7uD6hbuJP32q752mdBM8MBEGzB4e` / `https://amd-os-29u3pryts-armada0130.vercel.app`をReadyと確認。

本番Chrome：PC1392×824・mobile390×800のどちらもメール入力と「続ける」だけ。mobileのpage scrollWidth=390、scrollHeight=800、入力/ボタン約48px、フォーム342px、入力16pxを確認。既存audience=institution/workspace/next付きURLでも同じフォーム。書斎hostは「書斎」見出しと管理者用Google１ボタンの既存入口を維持。ログインメール・Google認証は実行せず、DOM/画面・通信代替検証を分けて確認した。

証拠：`/Users/masa/.codex/visualizations/2026/10/07/01a11471-c176-7972-8339-7eecea332656/login-entry-desktop.png`と`login-entry-mobile.png`。viewportはreset、ローカルserverは停止、使い捨てcloneはclean/pushedを照合して削除。正規checkoutをfetchしてHEAD/origin main 0/0、今回の未commit変更なし。既存の別作業のCockpitBusinessPlanとproject-business-planの4ファイル、既存未追跡3ファイルを保持。native UI変更なし。完了後のこの確認記録だけをdocs-only commit/pushする。
