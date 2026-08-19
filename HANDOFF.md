# HANDOFF

最終更新: 2026-08-20 JST
対象: SX外部資料共有のAMD OS統合・旧Project Share退役

## 今回の到達点

- SXの外部関係者は `/project/p21/workspace` の同じ入口から、PJ名と `workspace_shared` の資料室だけを利用する。内部の週次・ガント・関係先・論点・資金・管理画面は返さない。
- 外部の `contributor` は資料の閲覧に加え、file / folder / link の追加とHTML本文編集を行える。整理・共有範囲の変更は管理権限へ限定する。
- p21の外部利用者7件を、アカウント・愛媛機関ワークスペース所属・p21 contributorの3層で招待登録し、PJリストの関係先メールアドレスにも重複なく統合した。メール送信はしていない。
- 旧SX Project Shareのアプリ・Blob Store・専用ドメインを退役した。旧Blobに移行対象は無く、専用ドメインは404を確認済み。
- 資料室内でFinder / Explorerからファイルを落としても、空状態の追加先以外ではブラウザが開く・ダウンロードする既定動作を止める。既存の空状態drop、競合確認、権限確認を共通で使う。

## 正本

- 権限・外部面の設計: `pwa/design/institution_seed_project_model.md` §6、`pwa/design/FEATURE_REGISTRY.md` の「外部ワークスペースアクセス」
- 画面・資料室運用: `pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/9-3-appendix-changelog.md`
- route契約: `pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/6-1-appendix-changelog.md`
- SXの長期索引: `/Users/masa/projects/knowledge/sx.md`
- 実装判断の履歴: `pwa/design_log/sessions_2026-08.md`

## 運用上の残り

- 招待済みの7アカウントは、各人がメールリンクで初回認証を終えるまで `invited` のまま。送信は本人への案内を出すと決めた時だけ行う。
- 初回問い合わせでは、メール本文を共有せず、アカウント・機関所属・p21アクセスの3層とcallback後のactive化だけを読戻す。
- 外部面に新しい項目を足す時は、safe DTOとroute isolationを先に検査し、内部管理情報を流用しない。

## 次の最初の行動

新しい依頼から開始する。SXの外部利用で問題が出た場合は、上記正本と `npm run test:workspace-access-scope`、`npm run test:workspace-documents-contract` を読み、外部sessionで `/project/p21/workspace` の表示と資料追加だけを確認する。
