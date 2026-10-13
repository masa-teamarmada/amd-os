# DD秘密情報表示・入場確認 — 現在の引き継ぎ

最終更新: 2026-10-13。仕事種別: development。まさ受入済み、依頼の残件なし。

## 現在地

- 全DDページと資料出力に秘密指定を表示。生成した赤いスタンプは閲覧画面で160px、狭幅100px、右端で下のコンテンツへ軽く重ねる。
- DD入口でNDA締結済みか確認。「はい」の記録保存成功後だけ本文へ進み、管理画面で本人・日時・対象会社名を確認できる。
- 会社概要の設立済み正式商号だけを表示。既存のDD個別付与を維持し、契約台帳の締結状態は変更しない。
- 実装/素材/出力/認可/確認セッションの恒久仕様は [spec/5-17](pwa/spec/5-17-dd-package-current-spec.md)。履歴は [10月開発ログ](pwa/design_log/sessions_2026-10.md) の2026-10-13終了節。

## 状態・検証範囲

引き継ぎ前のmain/origin/main/本番はf349b6f7、v3.162.35で一致。DD最終実装fb0d413bは祖先で、対象ソースに後続差分なし。終了文書のcommitはこのsnapshotより後。未保存・未push・conflictなし、local branchはmainのみ、登録worktreeは本体だけ。

既に成功した検証: 対象lint、8GB指定の型検査、DD/NDA/全deploy検査、実Chromeの広幅/狭幅、確認前の本文非表示、いいえで一覧へ戻る操作。本人/PJ/版/署名・保存失敗・直接入口を実route依存置換で検査。本番監査表は一時検査行の保存/日時readback/同一transaction内の片付け成功。

未確認: 実ユーザー自身による本番「はい」から入場・同人の管理記録までの一連の操作。締結済み申告を代行していない。ネイティブ独立DDは未移植。PDF実体の生成/描画とChrome内蔵PDFビューアの目視は別に扱う。

## 残件・最初の次の行動

依頼の残件なし。新しいユーザー指示を待つ。追加修正時はfetch・dirty・本番build-infoを取り直し、現行仕様を先に読む。旧版へ戻さない。実ユーザーのNDA申告は本人の操作と記録を照合する。

## 素材・確認物

- コード素材: pwa/public/dd/confidential-stamp-20261012.png / .webp。生成由来は同README。
- Drive AMD OS資料室: 261012_DD秘密情報スタンプ、261012_DD入場確認。生成素材・PDF/Excel検査物・画面画像・HTML/JSが保存済み。
- 一時サーバ/検証タブ停止、viewport復帰済み。旧一時clone/previewは終了アーカイブへ復元可能な形で退避（Git登録worktreeではない）。

## 正本と同期

| 変更 | design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 秘密指定/スタンプ/原本保持と出力 | spec/5-17、public/dd/README、ios/DESIGN | manual/2-6 | 同期済み |
| 入場確認/会社名/記録/直接入口/認可/cookie | spec/5-17、FEATURE_REGISTRY、ios/DESIGN | manual/2-6 | 同期済み |
| 仕様履歴 | spec/6-1 | manual/9-3 | 同期済み |
| 失敗・検証上の境界 | BUGS、10月開発ログ | 新しい仕様なし | 対象外 |
| DB schema/理論/環境変数 | 変更なし | 変更なし | 対象外 |

関連: [終了用プロンプト](SESSION_MIGRATION_PROMPT.md)、[BUGS](pwa/BUGS.md)。新しい戦略/個人特性の保存はなし。
