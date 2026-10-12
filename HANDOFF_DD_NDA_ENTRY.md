# DD入場確認

2026-10-12: NDA締結済み申告の保存成功後だけDDへ進む。個別付与を先に毎回検証。会社名は設立済み正式商号のみ。adminに本人・日時・対象会社名を表示。契約台帳は変更しない。詳細pwa/spec/5-17。

| 変更 | 設計正本 | OSマニュアル | 状態 |
|---|---|---|---|
| 入場確認/会社名/直接入口 | spec/5-17、ios/DESIGN、FEATURE_REGISTRY | manual/2-6 | 同期済み |
| 記録/API/署名cookie/ログアウト | spec/5-17 | manual/2-6 | 同期済み |
| 履歴 | spec/6-1 | manual/9-3 | 同期済み |
| 理論・DB schema | 変更なし | 対象外 | 対象外 |

NDA回帰・従来DD検査成功。8GB指定の型検査・対象lint・project-space-loading成功。本番確認は末尾。独立DDネイティブは未移植。

本番監査表の既存schema（event_type=text、本人ID nullable、created_at=now()、RLS有効）を確認。検査用の一時dd_nda_confirmedを同一トランザクション内でINSERT→日時/回答readback→自分のUUIDだけDELETEし成功。実ユーザーの締結申告は代行していない。
実コンポーネント/共通Dialog/Reactを使う検証で1636pxと320px、確認文全文・ボタン44px・横はみ出しなし。保存失敗時のエラー表示とEscapeによる非閉鎖を確認。資料室の261012_DD入場確認へ直接保存。品質9/10。

最終管理UI: 締結済み申告の意味へ説明を修正。既存の表内横スクロールにより日時・回答者・対象会社名の列を保つ。最終版v3.162.32。

完了（2026-10-12 JST）: fb0d413b / v3.162.32を正規deployで反映。Ready・本番build-info SHA/版一致。型検査・対象lint・NDA/従来DD・全deploy検査成功。管理画面の説明を締結済み申告へ同期し、記録表は最小幅640px・既存の表内スクロールで比較列を保持。

本番1487px/291px: NDA確認文・赤スタンプ・ボタン44px・横はみ出しなし。確認前の会社概要本文DOMなし。「いいえ・戻る」でDD一覧へ戻ることを確認。最終版管理画面の「入場確認・閲覧記録」と申告の説明を確認。検証用の実AdminPanelでは回答者/日時/会社名を表示し、320pxでも表内だけスクロール（ページ幅320px）。実ユーザーの「はい」は締結済み申告のため代行していない。API成功/保存失敗/署名cookieは実routeの依存置換検査、DB保存/時刻readbackは自分の一時検査行で確認して片付けた。

確認画像・HTML/JSはDriveのAMD OS資料室/261012_DD入場確認へ直接保存。folder ID 1NVkPTFCIlL1GB7KEDyxteV8myFYGjTAW、本番PC/スマホと管理表示画像の同期を接続ツールで確認。検証サーバ・一時タブを終了、viewportを戻した。mainのみ／追加worktreeなし／すべてpush済み。

反映bundle: 入場モーダル・自己申告POST・既存監査表への記録・署名確認・logout消去・直接入口/資料/APIの確認・admin表示・仕様/マニュアル。原本・契約台帳の締結状態・権限付与・DB schema・理論は対象外。戻す場合は該当差分をmainで戻して版を上げ、正規deployで反映。旧版全体を再配信しない。
