# DD本文の冒頭余白と初回NDA確認（2026-10-15）

## 反映

- コード: c80fd3f2f753f892a15941612920e7fac1d35ff2、main、v3.162.52。
- 通常deploy.shの全検査を通過し、main pushによる本番デプロイがReady。`/api/build-info`も同じSHA・版・dirty=false。
- deployment: dpl_2NA6MB4xkaUZGcxZuxxvbbRBY5Cu。ビルド完了まで2分18秒。

## 原因と変更

短期計画はwork区画の抜粋後も原本mainの上48pxとsectionの上20pxが残っていた。DDの画面用CSSだけmain上8px・work上0へ変更。長期計画も同じ枠を適用し、元資料の段落・日付表示は保持。原本・ガント内の図形・印刷スタイルは変更しない。関連ページがない時の空navを削除し、創業背景・製品説明の先頭h2の上marginだけ除去。

NDA回答のyesは既存監査表に保存されていたが、入場判定は1時間署名Cookieしか見ていなかった。毎回のDD個別認可後に、本人・project_id・package_id・answer=yesのdd_nda_confirmedを1件照合する。外部はuser_account_id、内部はuser_account_id IS NULLかつactor_member_id。過去回答・別ブラウザ・再ログイン・grant更新を引き継ぐ。新しい確認の記録方法、初回文言検証と保存失敗時の拒否を維持し、照会失敗も拒否。新規DDL・回答データの書換え・実ユーザーの申告代行なし。

## 検証

- `test:dd-package`、型検査、変更箇所ESLint、本番用ビルドを通過。通常deploy.shの全検査も通過。
- 新しい実サーバ関数へ本番DBを接続し、過去5件をCookieなしで回答済みと認識。別packageはすべてfalse。読取りだけで検証。
- 本番Chromeで再読み込み・別タブから開き直し。NDAモーダル0、短期計画の本文可視。回答POSTは行っていない。
- 41ページを変更前後で巡回。文書全体の横はみ出し0。未登録表示・関連ページ・操作欄・本文を確認。顧客リストと資本政策表は冒頭にフィルタ/選択欄があるため、最初の段落位置を空白量とはみなしていない。
- 1419×875の画面で短期計画のiframe内本文先頭68px→8px。共通本文枠は103.86px→95.87px。創業背景は関連リンク下の間隔24px→12px、製品説明は16px→4px。
- 長期計画はmainの上padding8px。先頭の日付段落に原本の上margin6pxがあり、文字ブロックは14pxから始まる。見出し前の日付・版は空白ではない。
- 秘密情報の指定は画面に1つ。計画の埋込みsandbox/CSP、資料の有効状態照合、原本/印刷の秘密表示を維持。
- 画面レビューは9/10（今回のPC対象）。冒頭余白・見出し・本文の整列と操作欄の区別を確認。狭幅の実画面は、ブラウザの幅指定がclientWidthに反映されないため今回の実画面検証に含めない。共通CSSは幅によらず適用し、既存の狭幅レイアウトを変更していない。

## 証跡と引き継ぎ

Drive: 共有ドライブ/ARMADA/a0_management/261015_DD表示改善/。

- short-term-before.jpg（203322 bytes）、short-term-after.jpg（222493 bytes）。
- long-term-after.jpg（170062 bytes）。
- spacing-before.json（7612 bytes）、spacing-after.json（7588 bytes）。

manual2-6・9-3、spec5-17・6-1、FEATURE_REGISTRY、ios/DESIGN、PWA/ネイティブhandoffを同期済み。理論変更なし。iOS/macOS/Androidの専用DD画面は未移植、既存ブラウザ運用。作業branch/worktreeの作成・削除0、mainのみ。個人学習用の会話材料は0件。
