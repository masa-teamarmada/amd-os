# HANDOFF - AMD OS PWA

## 2026-08-31 月次報告書の書式復旧（全クライアント向け）

- SX 2026年8月の「本書」リンクを既存提出版帳票へ戻した（migration 357）。文書ID・保管場所・可視性を維持し、汎用Markdown readerへは送らない。新しい帳票・書式は追加していない。
- 社内版へ追加してしまった「主要成果物」見出し・表は既存の編集履歴付き保存経路で撤回し、元の8章構成を保持。ヒアリング結果の記述は既存の資料段落内に残した。
- DriveのSX 2026年8月PDFは8月29日に使用した既存生成経路で書式を復旧した。日付・リンク・ヒアリング事実の修正は保持。既存のPWA帳票CSSは変更していない。
- Native側にコード変更は不要。月次帳票は既存の専用画面へ誘導し、元のPDF・HTMLを書式のない本文から別デザインで再生成しない。
- 同期棚卸し: 新画面・新機能なし、manual/bzm変更対象外。復旧仕様と記録は `spec/3-2-monthly-reports-current-spec.md`、`spec/6-1-appendix-changelog.md`。

## 2026-08-31 KUTEタブ配置 / 他プラットフォームへの引き継ぎ

- PWAのKUTE (`p25`) だけ、年度内ロードマップの6工程を既存ガントの通常タスクへ移す。独立枠は廃止。2レーン・目的・全成果物・月単位の仮日程を保持し、実績は推測で補完しない。連携シーズ比較は「シーズ」タブのまま。
- iOS / macOS / Androidは未移植。他研究機関PJも現行配置を維持。次はKUTEの画面で設計を確認し、まさの合意後に横展開を検討する。自動で広げない。
- 正本: `spec/3-8-cockpit-current-spec.md`、`design/cockpit.md`、`../ios/DESIGN.md`。マニュアル: `manual/2-3-pj-cockpit.md`。回帰チェック: `npm run test:kute-seeds-tab-contract`。
- 同期棚卸し: 年度内ロードマップのガント統合とシーズタブは上記設計・マニュアルへ反映済み。共通DBの既存PJ管理台帳へKUTE計画を追加（data-only migration `20260831223000_kute_annual_roadmap_gantt.sql`）。新スキーマ・理論・外部共有の権限は変更なし。既存のAMDメンバー向けワークスペースも同じ計画を読む。

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


---

# 別セッション追記 — 2026-08-23 JST / SPS第3便の後追い

- 作業種別: mixed（開発=migration 306 + ツール修正 / 非開発PJ作業=SPS判断記録とドライブ通読）
- 上の「参照系データのキャッシュ既定化」セッションとは**別セッション・別領域**。互いに触ったファイルは重なっていない。

## 今回の到達点

まさの3つの指示への対応。判断記録の正本は `pwa/bzm/SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md`、実装履歴は `pwa/design_log/sessions_2026-08.md`（2026-08-23節）。

1. **#12（RF/DC WPT）の「情報薄」判定を撤回**（`0db15a41`）。まさの指摘どおり実体は株式会社翔エンジニアリング＝p10。p10のMTGサマリに国交省本格研究の日程・規模・座組が揃っていた。再評価候補 `bdd3dd43-908a-4742-b331-9b5f99a37fb0` を pending で作成（SPS中央値 2.26億→12.07億）。副産物として `sps_reassessment_tool.mjs` の `UUID_RE` がmigration 209由来の15/180 seedを再評価経路から締め出していた欠陥を修正。
2. **p10のデータ衛生を補修**（`909a3792` / migration 306、全文UPDATE）。シーズ逆リンク補完1件、CryoX由来の `project_knowledge` 12行と `project_strategy_signals` 5行をp20へ移送。
3. **ドライブ `p10_se` を通読**（`af259127`）。無線給電24年継続、2020年北見工大の8m電池レス実証、特許13件、競合28社（エイターリンクの実データ含む）、事業計画シミュレータ、資金戦略比較。`project_knowledge` へ8行保存（`source=drive:p10_se_archive_20260820`）。

3コミットともpush済み。**PWAのコード変更を含まないためVercel deployは走らせていない**（BUILD_VERSION bumpも対象外）。branch/worktreeは作っていない。

## 未解決（この領域）

- **まさの承認待ち**: 再評価候補 `bdd3dd43-908a-4742-b331-9b5f99a37fb0` が `status=pending` のまま。通知で「はい」と答えるまで凍結行にならない。**えいみが代わりに承認してはいけない**。
- **抽出側のガードが未実装**: migration 306はデータのみの補修。混入源（`eimi-daily` ナレッジ抽出 / `codex_automation` シグナル抽出）にPJ整合の検査が無く、同じ経路で再発しうる。`BUGS.md` の `[extract/pj-scope-contamination]`。
- **ドライブ未読分**: 業務委託システム台帳（11万字超でツール上限オーバー）、契約PDF、captable、株式譲渡、BO、SMS助成金、2026年2〜7月の月次進捗スライド群（OS由来の派生データ）、MTG関連3フォルダ（ドライブAPIの親フォルダ検索が使えず未展開）。
- **依頼範囲外で未算出**: 愛媛大3件・慶應3件のシーズ。

## 次の最初の行動

まさが通知で `bdd3dd43-…` を承認するかどうかの確認。承認されたら承認RPC経由で凍結行がappendされる（えいみ側の追加作業なし）。承認と独立に進められるのは、抽出側のPJ整合ガードの設計。

## 参照先（この領域）

- 判断記録の正本: `pwa/bzm/SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md`（§6 再評価候補 / §7 migration 306 / §8 ドライブ通読）
- 教訓: `pwa/BUGS.md` の `[extract/pj-scope-contamination]` と `[sps/reassessment-evidence-ceiling]`


---

# 別セッション追記 — 2026-08-23 JST / SPS初回評価「意味づけ欠落」是正ラウンド

- 作業種別: 開発（DB migration + CLI ツール改修 + データ投入）
- 上の「SPS第3便の後追い」（再評価候補・p10データ衛生）とも「モデル層」（`HANDOFF.md`）とも別領域。
  SPS領域の中でも**初回評価（`seed_screening_bands` の11因子ルーブリック）の品質**に特化した話で、
  再評価（`sps_reassessment_candidates`）とは別のテーブル・別のツール系統。

## 今回の到達点

735件の初回評価が全件完了した直後の全数点検で見つかった、**11因子すべての `assessment`（q根拠の
意味づけ）が空のまま入っている372件**を修理した。詳細は
`SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` §1 と `pwa/design_log/sessions_2026-08.md` の該当節。

- migration 318（`ea6c32fa`）で、凍結行を書き換えずに「同じ版タプルで追記して最新を差し替える」
  是正経路を新設。`sps_initial_assessment_tool.mjs` に `prepare --remediate` を追加。
- サブエージェント並列で372件のうち **202件を投入（ok 202 / ng 0）、残170件**。
- 投入分は `audit_remediation.mjs`（新設）で構造監査し、異常0件を確認。
- 実行中に2つの事故を踏み、`pwa/BUGS.md`（2026-08-22〜23節）に記録済み: (1) セッションを閉じている
  間にサブエージェント2体が死に、直前の未実測の「動いてる」報告のせいで23時間気づけなかった、
  (2) changelogへの追記commitが共有checkoutの他セッションのdirtyを巻き込んだ（`ef9abe58`、
  内容は正しいためrevertせず経緯のみ記録）。

## 未解決（この領域）

- **意味づけ欠落170件が残っている。** 再開手順は `SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` §1
  「再開の仕方」と `pwa/scripts/sps_batch/README.md`「是正ラウンド」節にすべて書いてある。
  `prepare --remediate --limit 100` から素直に始めてよい（pending候補は0件、途中状態は残っていない）。
- **サブエージェントは親セッションが閉じると死ぬ。** 起動して放置はできない。1ラウンド100件で
  おおよそ10分、まさが画面を見ていられる間に完走させる。

## このセッション終了時点の共有checkout状態（自分の変更ではない）

`git status -sb` で以下が dirty のまま残っている。**このセッションの変更ではないので触っていない**:

- `model/APPROVALS.md`（変更、+48行）
- `pwa/scripts/migrations/319_sps_reassessment_pgcrypto_resolution.sql`（新規、未追跡）

次セッションが SPS領域や model領域に触るなら、まず `git log` でこれが誰の作業か（別の並行セッションが
今も書いている途中か）を確認してから扱う。

## 次の最初の行動

`node scripts/sps_initial_assessment_tool.mjs status` で `defective` を確認し、170件を
`prepare --remediate --limit 100` から続ける。

## 参照先（この領域）

- 状態と件数の正本: `bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` §1
- 手順の正本: `pwa/scripts/sps_batch/README.md`「是正ラウンド」節
- 実装履歴: `pwa/design_log/sessions_2026-08.md`（2026-08-22〜23節「SPS初回評価『意味づけ欠落』…」）
- 教訓: `pwa/BUGS.md`（2026-08-22〜23節「SPS意味づけ欠落の是正ラウンドで…」）
- 変更履歴: `bzm/9-5-appendix-changelog.md`（248行目 migration 318、末尾付近に実行結果）
