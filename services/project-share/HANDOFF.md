# Project Share Handoff

Last updated: 2026-08-01 JST

Topic: 全PJ BOXのログインを、メールアドレス許可リスト＋既存パスワード方式へ変更

## Latest Session Summary

- VSX / CX / SE / SX / ZMP / KUTEの全6インスタンスで、ログインをパスワード単独方式から
  「メールアドレス許可リスト＋既存の共有パスワード」方式へ変更した。メール受信・所有確認を
  行う多要素認証ではない。
- 各PJに `<PJ>_ALLOWED_EMAILS` 環境変数を追加。カンマ・セミコロン・改行・空白区切りの
  完全一致メール一覧として解析し、trim+小文字化・重複除去・簡易妥当性検証を行う。
  未設定・空・不正値を1件でも含む場合は`503`（fail closed、既存の
  `ACCESS_PASSWORD`/`AUTH_SECRET`未設定時と同じ扱い）。
- セッションCookieの有効期限を12時間から30日へ延長し、署名対象にログイン時のメールアドレスと
  アクセスパスワードのダイジェスト（パスワード本体は含まない）を含めた。これにより、
  許可リストからの除外・パスワード変更・署名鍵変更のいずれかで既存セッションが次回
  リクエストから自動的に無効化される。
- ログイン失敗時のメッセージは「メールアドレスまたはパスワードが違います。」の共通表示に統一し、
  メールアドレスの許可可否とパスワード可否を両方評価してから判定する（メール存在有無を漏らさない）。
- 恒久仕様は[`SPEC.md`](SPEC.md)の「認証モデル（恒久）」に反映済み。各インスタンスの
  `README.md`と、ルート`README.md`の汎用機能説明も更新した。
- 全6インスタンスで`npm run build` / `npm run check` / `npm test`が成功（VSX 222件、他5インスタンス
  各216件、fail 0）。ルートで`git diff --check`も確認済み。

## Repo / Production State

- このセッションの変更はまだVercel本番へデプロイしていない。理由: `<PJ>_ALLOWED_EMAILS`に
  設定する実際の許可メールアドレス値がまだ提供されていない。実値が揃うまで、6インスタンスの
  いずれのVercelプロジェクトにも`<PJ>_ALLOWED_EMAILS`環境変数を追加しないこと（追加しない限り、
  新しいコードをデプロイしても`503`でBOX全体がログイン不能になる）。
- mainへのpushは完了。commit SHAとpush結果はセッション終了時の報告を参照（このファイルの
  更新と同じcommitに含む）。
- 公開URLは変更なし: `https://vsx.team-armada.jp`、`https://cx.team-armada.jp`、
  `https://se.team-armada.jp`、`https://sx.team-armada.jp`、`https://zmp.team-armada.jp`、
  `https://kute.team-armada.jp`。本番はまだ旧パスワード単独方式のまま稼働中。

## Unresolved Tasks

- **本番反映待ち**: 6インスタンスそれぞれについて、Vercelダッシュボードで
  `<PJ>_ALLOWED_EMAILS`環境変数（実際の許可メールアドレス一覧）を設定し、そのあと
  このセッションのcommitをデプロイする。環境変数設定とデプロイの順序を守らないと、
  設定漏れのまま新コードがデプロイされ`503`で全利用者がログインできなくなる。
- 許可メールアドレスの実値一覧は、各PJの現行共有パスワード利用者から個別に確認が必要
  （まさに確認）。確認済みメールアドレスをVercel環境変数へ設定する作業はえいみが実行できる。
- デプロイ後は、各BOXで新しいログインフォーム（メール＋パスワード）から実際にログインできること、
  30日Cookieが発行されること、既存の旧12時間Cookieを持つブラウザが再ログインを要求されることを
  本番で確認する。

## First Next Action

まさから許可メールアドレスの実値一覧を確認したら、各PJのVercelプロジェクトへ
`<PJ>_ALLOWED_EMAILS`環境変数を設定し、このセッションのcommitを対象Vercelプロジェクトへ
デプロイして、本番のログインフォームで許可済みメールアドレス＋パスワードでのログイン成功を
確認する。

## Pointers

- 恒久仕様: [`SPEC.md`](SPEC.md)
- 全体の運用・PJ境界: [`README.md`](README.md)
- PDF化の低レベルな注意: [`DEBUG.md`](DEBUG.md)
- VSXのデプロイ・検証履歴: [`vsx/README.md`](vsx/README.md)
- 次回用の依頼文: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## OS Manual Gate

- 対象外。Project Shareは`services/`配下の独立Vercelサービスで、AMD OS PWAの画面・利用者マニュアルを変更していない。恒久仕様は[`SPEC.md`](SPEC.md)に保存済み。
