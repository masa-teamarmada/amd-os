# HANDOFF - AMD OS PWA

- 更新: 2026-08-22 JST
- セッション: 資料室 HTML資料の「見たまま編集」— Phase 0 / 1 / 2 が本番稼働
- 作業種別: development

## 現在地

- まさの依頼「資料室のHTML編集がソースコード編集で全く使えない。パワポと同じように編集できるUIを」に対し、設計から起こして
  **`pwa/spec/2-8-workspace-document-deck-editor-plan.md` を正本**にした。全5フェーズのうち **Phase 0 / 1 / 2 が本番反映済み**。
- **Phase 0（版履歴と競合検知）**: 3表を `scripts/migrations/310_workspace_document_decks.sql` で**適用済み**。
  `content_sha256` の楽観ロック（不一致で409）と、上書き前の内容を残す追記のみの版履歴。
- **Phase 1（見たまま編集 = 案B）**: 別タブ `/workspace-document/{documentId}/edit` の3ペイン。build **v3.89.4**。
  本番の実資料（293101B、p10 SE）で全経路を実操作確認済み。
- **Phase 2（モデルとレンダラ）**: build **v3.90.0**。モデルJSONを正本にする配管とレンダラまで。**UIはまだ無い**ので、
  資料室からデッキを作る導線は存在しない（それがPhase 3）。入ったものは:
  - `src/lib/workspace-deck-model.ts` — schema v1 + 手書きvalidator + 正規化。ブロック8種。
  - `src/lib/workspace-deck-render.ts` / `workspace-deck-css.ts` / `workspace-deck-logo.ts` / `workspace-deck-assets.ts`
  - API 3本 `.../[documentId]/deck` (GET/PUT) / `deck/publish` (POST) / `assets` (GET/POST) と、
    3本が共有する `src/lib/workspace-document-decks.ts`
  - 契約テスト `scripts/check_workspace_deck_model.mts` / `check_workspace_deck_render.mts`（`npm run test:workspace-deck-*`）
  - publish出力は render route と同じCSP（`default-src 'none'; img-src data:`、script不可）+ JS無効 + 外部通信遮断で
    実際に開いて確認済み。CSP違反0件・外部リクエスト0件・PDF化まで通った。**本番の実資料での往復はPhase 3の導線と一緒に**。

## 確定している設計の芯（Phase 3 以降で守る）

1. **正本はモデル**。`workspace_document_decks.model`（JSON）が正本で、HTML / PDF / 将来のPPTX は生成物。生成物からモデルへ逆流させない。
2. **座標(x,y,w,h)モデルは採らない**。コンポーネント＋スロット方式。自由度の脱出口は `freeCanvas`（固定16:9のみ・Phase 4）と `rawHtml` の2つだけ。
3. **レンダラは1本だけ**（`workspace-deck-render.ts`）。エディタのキャンバス・publish・PDF が同じ関数を通る。
   CSSは `workspace-deck-css.ts` の文字列1本。**デッキ内でTailwindのユーティリティを使わない**（publish先にTailwindが無く必ずズレる）。
4. **既存資料を自動でモデルへ変換しない**。生HTML資料はPhase 1の案Bのまま使い続ける。
5. 編集フレームに **`allow-same-origin` を付けない**。親との通信はリクエストごとに発行した合言葉で照合する。
6. **モデルのsha256は必ず正規化後の直列化に対して取る**。jsonbはキー順を保存しないので、DBから読み直したJSONを
   そのまま直列化すると同じ内容でも別のshaになり、楽観ロックが誤検知する。

## 未解決

- **Phase 3（デッキエディタ本体）が丸ごと残っている**（下記「次の最初の行動」）。
- 前セッションから継続の知財台帳の外部同期3件（`pwa/spec/3-19-project-ip-current-spec.md` §5）。
  ①特許庁 特許情報取得API と EPO OPS の利用者登録（申請内容は提出前にまさへ見せる）
  ②`project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線
  ③`/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合。
- このセッションで作った branch / worktree: **none**。

## 次の最初の行動 — Phase 3（デッキエディタ = 案A本体）

`pwa/spec/2-8-workspace-document-deck-editor-plan.md` の §7.1 / §8 Phase 3 と、§8 Phase 2 の決定表を読んでから着手する。作るもの:

- 3ペインUI（スライド一覧 / キャンバス / プロパティ）。置き場所は既存の `/workspace-document/{documentId}/edit`。
  いまは `WorkspaceDocumentEditorWorkbench` が見たまま編集を常時下敷きにしているので、
  **デッキがある資料はデッキエディタ、無い資料は見たまま編集**へ分岐させる（`GET /deck` の `hasDeck`）。
- ブロック挿入ライブラリ（`WORKSPACE_DECK_BLOCK_SPECS` の `implemented: true` だけ出す）、スロット編集、バリアント切替、DnD並べ替え
- 発表者メモ欄（本文と分離。publish出力には出ない）
- 固定16:9／フロー切替、はみ出し警告、推定publishサイズの常時表示（4MB超で警告）
- 画像アップロードの**ブラウザ側縮小**（長辺1920px、canvas）。APIは超過を断るだけなので、ここが無いと画像を入れられない
- 「この資料をデッキにする」導線（`createWorkspaceDeck()` で種を作って `PUT /deck`）
- `rawHtml` ブロックの中身編集はPhase 1のエージェントを再利用

着手前に踏まないための杭:

1. **migration は不要**。3表とも適用済み。`310_workspace_document_decks.sql` を再適用しない。
2. **API はもう在る**。`deck` / `deck/publish` / `assets` を新設し直さない。認可は `loadEditableWorkspaceHtmlDocument()`、
   現物の差し替えは `replaceWorkspaceHtmlSource()` の1本を通す（経路を増やすと楽観ロックが二重実装になる）。
3. `PUT /deck` の `expectedSha256` は **モデルの** sha256（HTMLのではない）。初回添付のときだけ省略でき、
   省略したのに既にデッキがあれば409で止まる。`POST /deck/publish` は `expectedSha256` 必須。
4. **キャンバスは `WorkspaceDeckView` を直接マウントする**。`renderWorkspaceDeckDocument()` を毎回 `innerHTML` へ流し込むと
   contenteditable のcaretが飛ぶ。publish出力と同じ絵になるのは、同じ木を描いているから。
5. `renderWorkspaceDeckDocument()` は **async**（`react-dom/server` を動的importしている）。
   静的importへ戻すとApp Routerのビルドが止まる（2026-08-22 に本番ビルドを6連続で赤くした）。
6. デッキ内でTailwindを使わない。契約テストが publish出力の class を全走査して `deck` 接頭辞を要求する。
7. 画像は長辺1920px超をAPIが断る。**縮小はブラウザ側の責任**（サーバにsharpが無い）。
8. デッキの版は `kind='deck_model'` で `workspace_document_revisions` へ積まれる。
   既存の版履歴UIはHTMLの版を前提にしているので、デッキの版を並べるなら表示と復元の分岐が要る
   （復元は `GET /revisions/{no}` でモデルを取り、`PUT /deck` として積み直す。HTML復元POSTは400で断る）。
9. deploy 時の `BUILD_VERSION` は **v3.91.0**（新UI）。採る前に必ずHEAD値を読む。
10. **新libを入れたcommitを積む前に `npm run build` を通す**。型検査だけでは App Router の制約に引っかかるものを見逃す。

## 参照先

- 実装計画の正本: `pwa/spec/2-8-workspace-document-deck-editor-plan.md`（§8 にフェーズ定義と決定表、§9 に契約テスト一覧）
- 利用者マニュアル: `pwa/manual/2-3-pj-cockpit.md` の資料室セクション / 変更履歴 `pwa/manual/9-3-appendix-changelog.md`
  （Phase 2 は利用者から見える変化が無いので未更新。Phase 3 の導線と一緒に書く）
- 設計変更履歴: `pwa/spec/6-1-appendix-changelog.md`
- DB実列名: `pwa/design/db_schema.md`（`workspace_documents` / `_revisions` / `_decks` / `_assets`）
- 適用済みmigration: `pwa/scripts/migrations/310_workspace_document_decks.sql`（冒頭コメントに不変条件5点）
- 主要実装: `src/lib/workspace-deck-model.ts` / `workspace-deck-render.ts` / `workspace-deck-css.ts` /
  `workspace-document-decks.ts` / `src/components/workspace-documents/WorkspaceDocumentDeckEditor.tsx` /
  `WorkspaceDocumentEditorWorkbench.tsx` / `src/lib/workspace-document-edit-agent.ts` / `workspace-document-html-editing.ts` /
  `workspace-document-editing.ts`
- 契約テスト: `pwa/scripts/check_workspace_deck_model.mts` / `check_workspace_deck_render.mts` /
  `check_workspace_document_edit_frame.mts` / `check_workspace_document_html_editing.mts` / `check_workspace_document_revisions.mts` /
  `check_workspace_documents_core.mts` / `check_workspace_documents_contract.mjs`
- バグ・教訓: `pwa/BUGS.md`（`[workspace-documents/deck-editor]` の永久ローディング事故、`[ui/dialog]` の幅潰れ）
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
