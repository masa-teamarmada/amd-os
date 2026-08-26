# Project Share 退役仕様

## 決定

独立サブドメイン、PJ別共有パスワード、許可メール一覧、HMAC Cookie、PJ別Vercel project、PJ別Vercel Blobで構成していたProject Shareは、2026-08-26に全廃した。

今後の資料共有はAMD OSのPJワークスペースへ統一する。正本は`workspace_documents`とprivate Storage `workspace-files`で、閲覧・追加・管理権限は既存のAMD OS認可で毎request判定する。

## 不変条件

- `services/project-share/<pj>`を新設・復元しない。
- `*.team-armada.jp`の旧資料室ホスト名を再利用しない。
- 旧Project Shareの共有パスワードや許可メール一覧を新しい認可経路へ持ち込まない。
- 外部共有はworkspace accountとPJ個別grantを使い、メールdomain一致や機関所属からPJ権限を推定しない。
- 資料移行後も既存の`workspace_documents`を正本として扱い、旧Blobを復元用の並行正本にしない。

## 退役確認

2026-08-26にVSX / CX / SE / KUTEの旧Blob内容と移行先をreadbackした。VSX 4 object、KUTE 6 objectは移行済み行・Storage pathと一致し、CX / SEの旧Blobは空だった。その後、4つのBlob storeと4つのVercel projectを削除し、旧URLの404を確認した。SX / ZMPは先行退役済み。

履歴上の実装詳細はGit履歴だけに残し、このファイルを再構築手順として使わない。

## 変更履歴

- 2026-07-23〜2026-08-01: VSX / CX / SE / SX / ZMP / KUTEへ展開。
- 2026-08-19: SXを退役し、AMD OSへ統合。
- 2026-08-26: ZMPを退役し、旧Blob 28件をp19へ移行。
- 2026-08-26: VSX / CX / SE / KUTEも退役し、Project Shareを全廃。
