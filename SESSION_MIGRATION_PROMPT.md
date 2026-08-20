# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` のPWA作業を引き継ぐ。今回の対象は左ナビ「ホーム」のアクティブPJ二段フライアウトで、実装と本番反映は完了済み。新しい依頼が来るまで追加変更はしない。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/design/README.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-1-member-quick-start.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
12. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-08.md`

読む前後に、`git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list`を実行する。本文より現在のGit状態を優先する。

## 状態スナップショット

- 正本checkout: `/Users/masa/projects/AMD/amd-os`、canonical branchは`main`のみ。
- 実装commit: `f7745b99 feat(pwa): add project surface flyout`。実装時の本番readbackは build `v3.83.12` / SHA `f7745b99c138ca8874c3f561c694aa0dcee90d03`。
- 実装箇所は `pwa/src/components/nav/GlobalNav.tsx`。ホームhoverでactive PJリストを出し、PJ行hover/focusで右側にPJ名・コックピット・ワークスペースの子メニューを出す。PJ行単体では遷移しない。
- canonical仕様は `pwa/design/FEATURE_REGISTRY.md` と `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`、利用者向け説明は `pwa/manual/2-1-member-quick-start.md`。開発履歴は `pwa/design_log/sessions_2026-08.md`。
- 実装時に `test:critical-ui`、`test:portfolio-home-contract`、対象ESLint、TypeScript、production buildを通した。ログイン済み外部Chromeの本番で `p00` のコックピット／ワークスペース遷移を実操作し、エラーなしを確認した。

## 次の作業の進め方

新しい依頼を受けて対象を決める。ナビ変更なら、既存のホームflyoutと子メニュー間でポインタ移動しても閉じないこと、keyboard focusでも子メニューへ到達できること、画面端で子メニューが見切れないことを維持する。遷移先は `/project/:projectId/cockpit` と `/project/:projectId/workspace` を使い、PJ行を直接遷移リンクへ戻さない。

本番UI確認は、まさが普段ログインしている外部Chromeセッションを使う。未ログインのローカルブラウザ画面を本番UIの根拠にしない。実装したら関連テスト、TypeScript、必要なbuildを実行し、対象ファイルだけをstageしてcommitする。PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 経由で`main`へpushし、Vercel Readyと`/api/build-info`を読戻す。main以外のbranchや直接Vercel deployは使わない。

仕様変更は同じcommitで design/spec/manual と changelog を同期し、開発履歴を `pwa/design_log/sessions_YYYY-MM.md` に追記する。個人情報・raw本文・秘密値を出力やログへ入れない。
