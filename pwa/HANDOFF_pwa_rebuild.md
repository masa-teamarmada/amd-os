# HANDOFF - AMD OS PWA

- 更新: 2026-08-22 JST
- セッション: 資料室 HTML資料の「見たまま編集」— 設計 → Phase 0 / Phase 1 本番稼働
- 作業種別: development

## 現在地

- まさの依頼「資料室のHTML編集がソースコード編集で全く使えない。パワポと同じように編集できるUIを」に対し、設計から起こして
  **`pwa/spec/2-8-workspace-document-deck-editor-plan.md` を正本**にした。全5フェーズのうち **Phase 0 と Phase 1 が本番稼働中**。
- **Phase 0（版履歴と競合検知）**: `workspace_document_revisions` / `workspace_document_decks` / `workspace_document_assets` の3表を
  `scripts/migrations/310_workspace_document_decks.sql` で**適用済み**。`content_sha256` の楽観ロック（不一致で409）と、
  上書き前の内容を残す追記のみの版履歴。
- **Phase 1（見たまま編集 = 案B）**: 別タブ `/workspace-document/{documentId}/edit` の3ペイン。
  レンダリング済みHTMLを不透明オリジンのiframeへ載せ、`contenteditable` で直接触る。build **v3.89.4** で本番反映済み。
- 本番の実資料（293101B、p10 SE）で全経路を実操作確認済み — スライド送り／要素選択／書式パネル／文字編集／保存往復／版履歴。
- **Phase 2 以降は未着手**（コードは1行も書いていない）。まさから着手の承認は得ている。

## 確定している設計の芯（Phase 2 以降で守る）

1. **正本を反転する**。いまはHTMLが正本だが、Phase 2 以降は **`workspace_document_decks.model`（JSON）が正本**で、
   HTML / PDF / 将来のPPTX はそこからの**生成物**。生成物からモデルへ逆流させない。
2. **座標(x,y,w,h)モデルは採らない**。コンポーネント＋スロット方式。自由度の脱出口は `freeCanvas`（固定16:9のみ）と `rawHtml` の2つだけ。
3. **レンダラは1本だけ**（`workspace-deck-render.tsx`）。エディタのキャンバス・publish・PDF が同じ関数を通る。
   CSSは `workspace-deck-css.ts` の文字列1本。**デッキ内でTailwindのユーティリティを使わない**（publish先にTailwindが無く必ずズレる）。
4. **既存資料を自動でモデルへ変換しない**。任意HTMLの逆パースは代償が大きい。生HTML資料はPhase 1の案Bのまま使い続ける。
5. 編集フレームに **`allow-same-origin` を付けない**。親との通信はリクエストごとに発行した合言葉で照合する。

## 未解決

- **Phase 2 が丸ごと残っている**（下記「次の最初の行動」）。
- 前セッションから継続の知財台帳の外部同期3件（`pwa/spec/3-19-project-ip-current-spec.md` §5）。
  ①特許庁 特許情報取得API と EPO OPS の利用者登録（申請内容は提出前にまさへ見せる）
  ②`project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線
  ③`/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合。
- このセッションで作った branch / worktree: **none**。作業ツリーはクリーン（dirty・未push commit ともに無し）。

## 次の最初の行動 — Phase 2（モデルとレンダラ）

`pwa/spec/2-8-workspace-document-deck-editor-plan.md` の §3.2 / §3.3 / §4 / §6 / §8 を読んでから着手する。作るもの:

- `src/lib/workspace-deck-model.ts` — schema v1 + validator + normalizer（**ここから書く**）
- `src/lib/workspace-deck-render.tsx` / `src/lib/workspace-deck-css.ts`
- API 3本: `.../[documentId]/deck` (GET/PUT) / `.../[documentId]/deck/publish` (POST) / `.../[documentId]/assets` (GET/POST)
- ブロック第1弾8種: `heading` / `bullets` / `table` / `twoCol` / `callout` / `image` / `kpiRow` / `rawHtml`
- 契約テスト2本: `scripts/check_workspace_deck_model.mts` / `scripts/check_workspace_deck_render.mts`
- publish → 既存の render / pdf / project-share がそのまま動くことを確認

着手前に踏まないための杭:

1. **migration は不要**。3表とも適用済み。`310_workspace_document_decks.sql` を再適用しない。
2. **列名は `pwa/design/db_schema.md` の3表からコピーする**。spec §3.1 のDDL記述は実体とズレている
   （`assets.storage_bucket` / `assets.content_sha256` / `decks.published_at` / `decks.created_at` / `revisions.storage_bucket` が
   spec側に無い）。
3. `workspace-deck-model.ts` は **`server-only` を import しない**。契約テストが素のNodeから読んで振る舞いを検査するため。
4. **zod は入っていない**。validator は手書き。sha256 の形式検査は既存の `isWorkspaceDocumentSha256()` を再利用する
   （DBの CHECK `model_sha256 ~ '^[0-9a-f]{64}$'` と一致する）。
5. `workspace-documents-core.ts` へ足す定数は **4件**（`..._DECK_SCHEMA_VERSION` / `..._DECK_MODEL_MAX_BYTES` /
   `..._ASSET_MAX_BYTES` / `..._ASSET_MAX_EDGE_PX`）。spec §3.3 は5件書いてあるが `..._REVISION_KEEP_COUNT` は既存。
6. publish の書き込みは既存の `replaceWorkspaceHtmlSource()` を通す。`auditAction` はリテラルunionなので
   `"replace_html"` + `auditDetail: { editor: "deck" }` で通す。
7. publish出力は**自己完結HTML**（画像はdata URI、外部参照ゼロ）。既存 render route の `default-src 'none'; img-src data:` を通すため。
   5MB上限があり base64 は約1.33倍なので、画像実バイト合計 約3.5MB が事実上の天井。
8. deploy 時の `BUILD_VERSION` は **v3.90.0**（新APIルート3本＋新lib3本なので minor）。採る前に必ずHEAD値を読む。

## 参照先

- 実装計画の正本: `pwa/spec/2-8-workspace-document-deck-editor-plan.md`（§8 にフェーズ定義と決定表、§9 に契約テスト一覧）
- 利用者マニュアル: `pwa/manual/2-3-pj-cockpit.md` の資料室セクション / 変更履歴 `pwa/manual/9-3-appendix-changelog.md`
- 設計変更履歴: `pwa/spec/6-1-appendix-changelog.md`
- DB実列名: `pwa/design/db_schema.md`（`workspace_documents` / `_revisions` / `_decks` / `_assets`）
- 適用済みmigration: `pwa/scripts/migrations/310_workspace_document_decks.sql`（冒頭コメントに不変条件5点）
- 主要実装: `src/components/workspace-documents/WorkspaceDocumentDeckEditor.tsx` / `WorkspaceDocumentEditorWorkbench.tsx` /
  `src/lib/workspace-document-edit-agent.ts` / `workspace-document-html-editing.ts` / `workspace-document-editing.ts`
- 契約テスト: `pwa/scripts/check_workspace_document_edit_frame.mts` / `check_workspace_document_html_editing.mts` /
  `check_workspace_document_revisions.mts`
- バグ・教訓: `pwa/BUGS.md`（`[workspace-documents/deck-editor]` の永久ローディング事故、`[ui/dialog]` の幅潰れ）
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
