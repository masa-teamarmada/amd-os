# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` のPWA作業を引き継ぐ。Seed詳細からPJへ進む導線と、全PJ workspaceのSX仕様統一は実装・本番反映済み。新しい依頼が来るまで追加変更しない。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/design/seeds.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-08.md`

読む前後に `git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list` を実行し、本文よりlive stateを優先する。

## 状態スナップショット

- canonical checkoutは `/Users/masa/projects/AMD/amd-os`、canonical branchは`main`のみ。
- 実装commitは `a108b4c7 feat(pwa): unify project workspaces with SX`。後続の `f7745b99` とhandoff更新commitにも含まれる。
- `SeedDetailModal` の接続PJリンクは `/project/{projectId}/cockpit` だけ。モーダルからworkspaceへ直接飛ばさない。workspaceはコックピットの「共有ワークスペースへ」から開く。
- 全PJの内部workspaceは `SxWeeklyControlDashboard` を共有し、`週次差分 / ガント / 関係先 / 論点・仮説 / ドライブ` の5タブを持つ。ドライブは各PJ scopeの `WorkspaceDocumentRoom`。
- PJ名、管理柱・レーン、実データ、外部workspace権限はPJ固有のまま。p30等のDB分類をSXの3レーンへ変換していない。
- 本番でSXと桑折先生PJのタブ一致、桑折先生PJドライブ、Seedモーダルのcockpitリンク1件/workspaceリンク0件、コックピットのworkspace導線を確認済み。
- 別commit `f7745b99` により、左ナビのPJ二段フライアウトにはコックピット／ワークスペースの両選択肢がある。これはSeedモーダルのcockpit-only契約とは別の入口なので混同しない。
- handoff作成時、別作業のSPS初期評価フロー9パスが未commit。`HANDOFF.md`のRepo状態を読み、owner不明のままstage・削除・上書きしない。

## 次タスクの進め方

まさの今回の判断は「モーダルから飛べるのはコックピットだけでよい。ワークスペースはコックピットから飛べればよい。すべてのワークスペースは、最初に作ったSXと同じ仕様にする」。workspaceをPJ別dashboardへ分岐させたり、Seedモーダルへ簡易cockpitを戻したりしない。

新しい変更では兄弟PJも横断確認する。関連テストは少なくとも `npm run test:seed-list-display`、`npm run test:project-workspace-route`、`npm run test:workspace-documents-contract`、`npm run test:critical-ui`、`npx tsc --noEmit`、必要なproduction buildを実行する。本番UIはログイン済み外部ChromeでSXと非SX PJの双方を確認する。

対象ファイルだけをstageし、mainへcommitする。PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` だけを使い、Vercel Readyと `/api/build-info` のSHAをreadbackする。main以外のbranch、直接Vercel deploy、他workerのdirty変更の混載は禁止。仕様変更時はdesign/spec/manual/changelogと `pwa/design_log/sessions_2026-08.md` を同じ成果単位で同期する。
