# 支払通知書・GAS移行 引き継ぎ

- 更新: 2026-11-10 JST。仕事種別: 開発。
- 2026-09-25、かるの9月通知書は立替2件82,500円を自動算入し、合計242,633円のPDFを発行。当時の正式ファイルIDは `1HhPVkFDaWejx7dN4xNtVHsK-qXqgp1vk`。A4・1ページを実ファイルで確認。画面の二重表示はPDF本体では再現しなかった。
- 当時の送付・振込は未実施。2026-11-10時点の送付・振込状況は未確認なので、次回はDBと実メールの読戻しから始める。えいみはメールを送信しない。
- GASを外すPDF描画・Drive保存・メール作成の候補コードは2026-09-25にmainへ反映済み。当時、正式発行・送付経路はGASのまま。現在の経路は未確認。専用Google送信認証と二重送信防止が切替条件。
- 現在の共有checkoutはmain `923fb71ba`、origin/mainと一致。ただし別作業の変更が3ファイル残る。この引き継ぎのために編集・消去しない。
- 次の最初の作業: 2026-11-10の現行specとコード、本番表示、9月通知書の送付・振込記録を再確認し、すでにGASから移行済みの範囲を特定する。未移行なら認証・二重送信防止を設計してから切り替える。
- 参照: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/spec/3-27-payout-notice-current-spec.md`、`pwa/spec/5-5-cross-platform-gas-ios-current-spec.md`、`pwa/BUGS.md`、`pwa/HANDOFF_pwa_rebuild.md`。
