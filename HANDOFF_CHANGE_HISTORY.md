# AMD OS データ変更履歴の引き継ぎ

更新日: 2026-11-05。仕事種別: 開発。

## 現在地

- AMD OSの変更履歴にL2M専用データが混入した問題は解消済み。L2M専用20表の監査を停止し、混入履歴226,744件を履歴本体から削除した。画面側の隠蔽フィルターはない。L2M本体データは変更していない。
- 新しい表は非公開のAMD OS監査対象台帳へ明示登録した場合だけ記録する。実装commit `57fcfea48`はmainへ統合・push済み。
- 本番適用済みmigration: `20261105015441`、`20261105021010`、`20261105021635`。再適用しない。
- DBではL2M履歴0件、有効なL2M監査trigger0件を確認。本番v3.165.16の画面をPCのAMD OS Chromeアプリで開き、AMD OS履歴の表示を確認。
- その後、別作業でmainは進んだ。引き継ぎ着手時のmain/origin/mainは`a1adb5c13`、作業ツリーはclean。現行本番版は未確認。

## 未完了と最初の行動

今回依頼分はなし。次の変更履歴関連作業ではfetch後にmain・本番の版とDBのL2M履歴0件を確認する。

## 正本と記録

- 仕様: `pwa/spec/5-2-development-operations-current-spec.md`「データ変更履歴の表示・保存契約」、`pwa/spec/2-1-pwa-runtime-routes.md`
- 操作: `pwa/manual/2-6-admin-ops.md`「データ変更履歴」
- 全画面設計: `ios/DESIGN.md`
- 実装履歴: `pwa/design_log/sessions_2026-11.md`
- 再発防止: `pwa/BUGS.md`
- 回帰: `cd pwa && npm run test:data-change-history`（今回成功）

Swift/iOS・macOS・Androidの専用画面移植は今回の対象外。
