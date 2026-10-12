# DD入場確認

2026-10-12: NDA締結済み申告の保存成功後だけDDへ進む。個別付与を先に毎回検証。会社名は設立済み正式商号のみ。adminに本人・日時・対象会社名を表示。契約台帳は変更しない。詳細pwa/spec/5-17。

| 変更 | 設計正本 | OSマニュアル | 状態 |
|---|---|---|---|
| 入場確認/会社名/直接入口 | spec/5-17、ios/DESIGN、FEATURE_REGISTRY | manual/2-6 | 同期済み |
| 記録/API/署名cookie/ログアウト | spec/5-17 | manual/2-6 | 同期済み |
| 履歴 | spec/6-1 | manual/9-3 | 同期済み |
| 理論・DB schema | 変更なし | 対象外 | 対象外 |

NDA回帰・従来DD検査成功。8GB指定の型検査・対象lint・project-space-loading成功。ブラウザ/本番確認は反映後に記載。独立DDネイティブは未移植。

本番監査表の既存schema（event_type=text、本人ID nullable、created_at=now()、RLS有効）を確認。検査用の一時dd_nda_confirmedを同一トランザクション内でINSERT→日時/回答readback→自分のUUIDだけDELETEし成功。実ユーザーの締結申告は代行していない。
実コンポーネント/共通Dialog/Reactを使う検証で1636pxと320px、確認文全文・ボタン44px・横はみ出しなし。保存失敗時のエラー表示とEscapeによる非閉鎖を確認。資料室の261012_DD入場確認へ直接保存。品質9/10。

最終管理UI: 締結済み申告の意味へ説明を修正。既存の表内横スクロールにより日時・回答者・対象会社名の列を保つ。最終版v3.162.32。
