# HANDOFF

最終更新: 2026-08-20 JST
対象: Seed → Cockpit導線と全PJのSXワークスペース仕様統一

## 今回の到達点

- `SeedDetailModal` の接続PJ導線は `/project/{projectId}/cockpit` だけ。モーダル内のworkspace直リンクは0件。
- workspaceはコックピットの「共有ワークスペースへ」から開く。
- 全PJの内部workspaceはSX先行の `SxWeeklyControlDashboard` を共通利用し、`週次差分 / ガント / 関係先 / 論点・仮説 / ドライブ` の5タブを持つ。
- ドライブは当該PJ scopeの既存 `WorkspaceDocumentRoom` を再利用する。PJ固有の名称・柱・レーン・実データ・外部権限は維持し、DB分類は変更していない。
- 実装commitは `a108b4c7 feat(pwa): unify project workspaces with SX`。後続の `f7745b99`（左ナビPJ二段フライアウト）にも祖先として含まれ、main・本番へ反映済み。
- 本番でSXと桑折先生PJの5タブ一致、桑折先生PJドライブ、Seedモーダルのcockpitリンク1件/workspaceリンク0件を確認した。

## 正本

- UI契約: `pwa/design/FEATURE_REGISTRY.md`、`pwa/design/seeds.md`
- workspace仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 利用者向け導線: `pwa/manual/2-3-pj-cockpit.md`
- 変更履歴: `pwa/spec/6-1-appendix-changelog.md`、`pwa/manual/9-3-appendix-changelog.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- バグ記録: `pwa/BUGS.md` の `workspace/sx-parity`

## Repo状態

- canonical checkout: `/Users/masa/projects/AMD/amd-os`、branchは`main`のみ。
- handoff着手時のHEAD/origin/main: `fdecd77a`。次セッション開始時は必ずlive stateを再取得する。
- 今回の実装・仕様・テストはcommit済み／push済み。今回由来の未commit差分はない。
- 別作業の未commit: SPS初期評価フロー一式（`pwa/bzm/9-5-appendix-changelog.md`、`pwa/design/seeds.md`、`pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`、`pwa/manual/9-3-appendix-changelog.md`、`pwa/package.json`、`pwa/supabase/.temp/cli-latest`、`pwa/scripts/migrations/301_sps_initial_assessment_review_flow.sql`、`pwa/scripts/sps_initial_assessment_tool.mjs`、`pwa/scripts/test_sps_initial_assessment_flow.mjs`）。本セッションでは変更・stage・破棄していない。

## 未解決

- 今回の機能に未解決なし。
- 上記SPS初期評価フロー9パスはowner側でcommitまたは破棄判断が必要。解消前はrepo全体のarchive不可。

## 次の最初の行動

新しい依頼から開始する。workspace関連の追加変更では、SXだけに分岐を足さず全PJ共通componentへ反映し、`test:project-workspace-route`、`test:seed-list-display`、TypeScript/build、本番のSX・非SX双方を確認する。
