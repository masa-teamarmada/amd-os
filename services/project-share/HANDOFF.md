# Project Share Handoff

Last updated: 2026-07-31 JST

Topic: 全PJ BOXのHTMLファイルを、安全に日本語対応PDFとしてダウンロード

## Latest Session Summary

- VSX / CX / SE / SX / ZMP / KUTEのHTMLファイルは、通常のダウンロードではなく「PDF化ダウンロード」を表示する。
- 認証済みのprivate Blobだけをサーバー側でA4 PDFへ変換する。HTML内のJavaScriptと外部通信は実行しない。日本語フォントをページへ埋め込み、入力HTMLは8MB、返却PDFは4MBまでに制限する。恒久仕様は[`SPEC.md`](SPEC.md)。
- 全6インスタンスでビルド・構文確認・テストが成功した。KUTE本番で日本語HTMLのアップロード、PDF化、A4 1ページの日本語描画を確認し、検証用Blobは削除済み。
- Vercel Functionの日本語フォント同梱で起きた失敗と再発防止は[`DEBUG.md`](DEBUG.md)に記録した。Project Shareには既存の`design_log/`がないため、新設していない。

## Repo / Production State

- Project Shareの受入済み実装は`2ac93290`までmainにある。主要な実装commitは`35014681`（PDF化）、`8049bbeb` / `db5383a5` / `681992b3`（日本語フォントのVercel同梱・埋め込み修正）。
- 公開URLは `https://vsx.team-armada.jp`、`https://cx.team-armada.jp`、`https://se.team-armada.jp`、`https://sx.team-armada.jp`、`https://zmp.team-armada.jp`、`https://kute.team-armada.jp`。このセッションで各URLのHTTP 200を確認した。
- PDF化を反映したVercelデプロイは、VSX `dpl_55wXoE5ENNYTiQRYRKNHYL88kmoU`、CX `dpl_DexYZhmHbQ3BYjw3e7nffcHHiLTA`、SE `dpl_7DxsfY44WzUYZdfRCvX92ZJKpc49`、SX `dpl_6SCER4MGYUnZsc7dWVUyGY9tgqas`、ZMP `dpl_4MoMDFoy3HFArrGfcsEeHEcEGD9h`、KUTE `dpl_CCqsnomttDBcGyJzSFHsjFBeHqpx`。
- ルートのPWA配下には別作業の未コミット変更がある。Project Share配下にはこの引き継ぎ記録以外の未コミット実装を残さない。PWAの差分を読んだりstageしたり戻したりしない。

## Unresolved Tasks

- Project ShareのPDF化に未解決の実装はない。
- 次の利用者フィードバックでは、対象BOXでHTMLをPDF化して文字・レイアウト・ダウンロード名を確認する。フォントやChromium依存を変える場合は[`DEBUG.md`](DEBUG.md)の本番確認手順を守る。

## First Next Action

新しいBOX機能またはPDF化へのフィードバックが来たら、まず[`SPEC.md`](SPEC.md)と対象インスタンスの`README.md`を読み、6インスタンス共通仕様かPJ固有仕様かを分ける。共通変更なら全6インスタンスで`npm run build`、`npm run check`、`npm test`を通し、対象Vercelプロジェクトへ個別に反映して本番URLで確認する。

## Pointers

- 恒久仕様: [`SPEC.md`](SPEC.md)
- 全体の運用・PJ境界: [`README.md`](README.md)
- PDF化の低レベルな注意: [`DEBUG.md`](DEBUG.md)
- VSXのデプロイ・検証履歴: [`vsx/README.md`](vsx/README.md)
- 次回用の依頼文: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## OS Manual Gate

- 対象外。Project Shareは`services/`配下の独立Vercelサービスで、AMD OS PWAの画面・利用者マニュアルを変更していない。恒久仕様は[`SPEC.md`](SPEC.md)に保存済み。
