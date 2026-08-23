# HANDOFF - AMD OS PWA

- 更新: 2026-08-23 JST
- セッション: 参照系データのキャッシュ既定化（シーズ一次選別帯）+ Vercelリージョン最適化 + シーズリスト障害修正
- 作業種別: development

## 今回の到達点

まさの依頼「シーズリストのモーダルを開いたとき、一次選別スクリーニング帯以下が出るまで遅い。頻繁に変更される内容じゃないから最初から設計上そうすべき。全アプリで繰り返し言ってるので、同じことを繰り返さない仕組みも作って」への対応。詳細は `pwa/design_log/sessions_2026-08.md`（2026-08-23節）、実測値は `pwa/spec/5-10-reference-data-caching-current-spec.md`。

1. **参照系データの3層キャッシュを既定化**（`a865b17c`）。サーバのプロセス内スナップショット（サマリ帯＋根拠Lvは並列1回・詳細行はシーズ単位）、`Cache-Control`、クライアントの `src/lib/reference-data-cache.ts`（peek/load/prefetch/invalidateの土台、全画面で使い回せる）を通した。一覧行のhoverで詳細を先読みし、モーダルを開いた瞬間に描画する。
2. **再発防止のguardを新設**（`a865b17c`）。`scripts/check_reference_data_cache_contract.mjs`（`npm run test:reference-data-cache`）を `deploy.sh` の本番反映前に組み込み。クライアントの素の `/api` fetchは `scripts/reference_data_cache_baseline.json` のラチェットで新規増加を検知する。規範は `spec/5-10-reference-data-caching-current-spec.md` + `AGENTS.common.md`/`AGENTS.common.reference.md`（全PJ共通）。
3. **本番実測で固定費（クエリではない）を発見して直した**（`af5ac182`）。Vercel関数のリージョン未指定（既定の米国東海岸で稼働）→ `vercel.json` に `"regions": ["hnd1"]`。`requireMember`/`requireAdmin` の`members`照合が毎回2往復→プロセス内30秒キャッシュ（`src/lib/supabase/api-auth.ts` の `lookupMember`/`invalidateMemberLookupCache`）。実測: 帯詳細1件 1081〜2126ms → 305〜543ms。
4. **`/seeds` 全体が「Bad Request」で表示できない障害を発見・修正**（`d3df67ff`）。`.in()` へ全735件のIDを一度に渡してURL長上限に当たっていた。200件チャンクへ分割して復旧。`pwa/BUGS.md` の `[seeds/in-filter-url-limit]` に教訓化済み。

3コミット全部push済み・本番反映済み（build v3.90.4〜v3.90.5）・まさのログイン済みChromeで実画面確認済み。branch/worktreeは作っていない。

## 前回までの到達点（Phase 3 待ち、今回は触っていない）

- 資料室HTML資料の「見たまま編集」。設計正本は `pwa/spec/2-8-workspace-document-deck-editor-plan.md`。全5フェーズのうち **Phase 0 / 1 / 2 が本番反映済み**（版履歴・楽観ロック / 見たまま編集の3ペイン案B / モデルJSON正本＋レンダラ配管）。**Phase 3（デッキエディタ本体UI）が丸ごと未着手**。
- 確定している設計の芯（Phase 3以降で守る）: 正本はモデル（HTML/PDFは生成物）／座標モデルは採らずコンポーネント＋スロット方式／レンダラは `workspace-deck-render.ts` 1本／既存資料を自動変換しない／編集フレームに `allow-same-origin` を付けない／モデルのsha256は正規化後の直列化に対して取る。
- 着手前に踏まないための杭（詳細は git 履歴の旧HANDOFF、または `spec/2-8` §7.1/§8）:
  migrationは不要（3表とも適用済み）／APIはもう在る（`deck`/`deck/publish`/`assets`）／`PUT /deck` の `expectedSha256` はモデルのsha256／キャンバスは `WorkspaceDeckView` を直接マウント（`innerHTML` 流し込み禁止）／`renderWorkspaceDeckDocument()` は async（`react-dom/server` を静的importするとApp Routerのビルドが止まる、2026-08-22に6連続で実際に踏んだ）／デッキ内でTailwind不可／画像は長辺1920px超をAPIが断る（縮小はブラウザ側）／deploy時の `BUILD_VERSION` はHEAD値を読んでから採る／新libを入れたcommitを積む前に `npm run build` を通す。

## 未解決

- **Phase 3（デッキエディタ本体、資料室HTML編集）が丸ごと残っている**。着手時は `pwa/spec/2-8-workspace-document-deck-editor-plan.md` §7.1/§8 を先に読む。
- 前セッションから継続の知財台帳の外部同期3件（`pwa/spec/3-19-project-ip-current-spec.md` §5）:
  ①特許庁 特許情報取得API と EPO OPS の利用者登録（申請内容は提出前にまさへ見せる）
  ②`project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線
  ③`/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合。
- このセッションで作った branch / worktree: **none**。

## 次の最初の行動

まさの優先度確認が必要。候補は上記「Phase 3」（資料室デッキエディタ本体、最も長く待たされている）と知財台帳の外部同期3件。今回対応した参照系キャッシュ・障害修正には残作業なし。

## 参照先

- 今回のセッションの規範: `pwa/spec/5-10-reference-data-caching-current-spec.md`（参照系/可変系の分類、固定費を先に疑う手順、実測値）
- 資料室デッキエディタの実装計画: `pwa/spec/2-8-workspace-document-deck-editor-plan.md`（§8 フェーズ定義と決定表、§9 契約テスト一覧）
- 設計変更履歴: `pwa/spec/6-1-appendix-changelog.md`
- バグ・教訓: `pwa/BUGS.md`（`[seeds/in-filter-url-limit]`、`[process/cross-session-messaging]`、資料室系は `[workspace-documents/deck-editor]` ほか）
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- 主要実装（今回）: `src/lib/reference-data-cache.ts` / `seed-screening-bands.ts` / `seed-screening-bands-client.ts` / `src/lib/supabase/api-auth.ts` / `vercel.json`
- 主要実装（資料室デッキ、Phase 0-2）: `src/lib/workspace-deck-model.ts` / `workspace-deck-render.ts` / `workspace-deck-css.ts` /
  `workspace-document-decks.ts` / `src/components/workspace-documents/WorkspaceDocumentDeckEditor.tsx` /
  `WorkspaceDocumentEditorWorkbench.tsx` / `src/lib/workspace-document-edit-agent.ts`
