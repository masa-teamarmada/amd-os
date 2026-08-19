# HANDOFF

最終更新: 2026-08-20 JST
対象: 資料室のFinder / Explorer追加導線

## 今回の到達点

- SXの外部関係者は `/project/p21/workspace` の同じ入口から、PJ名と `workspace_shared` の資料室だけを利用する。内部の週次・ガント・関係先・論点・資金・管理画面は返さない。
- 外部の `contributor` は資料の閲覧に加え、file / folder / link の追加とHTML本文編集を行える。整理・共有範囲の変更は管理権限へ限定する。
- p21の外部利用者7件を、アカウント・愛媛機関ワークスペース所属・p21 contributorの3層で招待登録し、PJリストの関係先メールアドレスにも重複なく統合した。メール送信はしていない。
- 旧SX Project Shareのアプリ・Blob Store・専用ドメインを退役した。旧Blobに移行対象は無く、専用ドメインは404を確認済み。
- 資料室は、追加権限があり検索中でない場合、現在folderの資料一覧全体（空状態を含む）をFinder / Explorerのfile drop先にする。既存のupload・同名確認・権限処理を使い、資料行からパンくずへの内部移動dragとは混同しない。
- 修正はcommit `70024d1a`（build v3.83.7）でmainへ反映済み。このhandoff自体は`70c622fd`（build v3.83.8）までの正本へ反映済み。次セッションは開始時にmainと`/api/build-info`を再確認する。

## 正本

- 権限・外部面の設計: `pwa/design/institution_seed_project_model.md` §6、`pwa/design/FEATURE_REGISTRY.md` の「外部ワークスペースアクセス」
- 画面・資料室運用: `pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/9-3-appendix-changelog.md`
- route契約: `pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/6-1-appendix-changelog.md`
- SXの長期索引: `/Users/masa/projects/knowledge/sx.md`
- 実装判断の履歴: `pwa/design_log/sessions_2026-08.md`
- バグ記録: `pwa/BUGS.md` の `workspace-documents/drop`

## 運用上の残り

- `pwa/bzm`で進行中のBZM作業が、seeds / cockpit / sps関連と`build-info.ts`へ未コミット差分を持つ。資料室修正の対象外なので、次担当は削除・stage・rebaseせずBZM担当のcommitを待つ。
- 招待済みの7アカウントは、各人がメールリンクで初回認証を終えるまで `invited` のまま。送信は本人への案内を出すと決めた時だけ行う。
- 初回問い合わせでは、メール本文を共有せず、アカウント・機関所属・p21アクセスの3層とcallback後のactive化だけを読戻す。
- 外部面に新しい項目を足す時は、safe DTOとroute isolationを先に検査し、内部管理情報を流用しない。

## 次の最初の行動

新しい依頼から開始する。資料室の追加に不具合が出た場合は、上記正本と `npm run test:workspace-documents-contract`、`npm run test:workspace-documents-core` を実行し、ログイン済み本番で「資料があるfolderの一覧へFinder fileを落とす」操作を確認する。検索結果へは追加させず、内部資料行のパンくず移動を壊さない。
