# SESSION MIGRATION PROMPT — 月次報告書の紙面上編集

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。月次報告書は、確認する紙面と編集する場所を分けない。社内版・提出版とも印刷プレビューから、見えている見出し・段落・表をその場で編集し、そのままPDF保存できるようにする。社内版の通常保存はdraftだけで、確定版を変えるのは明示確認つきの `確定版に反映` だけ。提出版の本文も月次報告書の本文であり、入口名は `提出版を確認・編集` を使う。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-2-monthly-reports-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md の月次報告書節
11. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の `[monthly-reports/review-edit]` 項目
12. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「月次報告書を紙面上で確認・編集」節

## 状態スナップショット

- canonical cwd / branch: `/Users/masa/projects/AMD/amd-os` / `main`。紙面編集のプロダクト実装は `bfc12a1efc764e102cc1589678507ab437c43ac9`（`v3.52.8`）。その後の月末writer移管 `b21518d9973cea4f573a1354a2cc56f89130d8f7` が現在のmain / production `v3.52.9`。開始時は必ず `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git rev-list --left-right --count HEAD...origin/main`、`git worktree list --porcelain`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで取り直す。
- 月次モーダルには `社内版を確認・編集` と `提出版を確認・編集` の2入口があり、それぞれprint routeを `template=internal` / `template=external` で開く。旧 `SubmissionReportEditor.tsx` は削除済み。
- print pageは `編集する` で表示中のMarkdown blockを編集できる。社内版の保存はdraft、確定版への上書きは `確定版に反映` のconfirm後だけ。APIも既存finalがあるとforceなしの上書きを拒否する。提出版は `monthly_reports_external.body_md` を保存する。
- PDFの紙面は左メニューを印刷対象から除外する。画面上で崩れていないことと、PDF出力でサイドメニューが混ざらないことは別々に確認する。
- 作業開始時点の未コミット変更として `pwa/scripts/ms_progress_review_tool.mjs`（+251 / -24）と `pwa/scripts/test_monthly_report_quality.mjs`（+40 / -4）がある。このセッションの提出版UXとは別レーン。所有者を特定するまで読んだりstageしたり戻したりせず、次のroot stage/deploy前に作成者のcommitまたはまさの明示判断を待つ。上記2件がある現時点で `npm run test:monthly-report-quality` は「9章・表・十分な本文を持つ提出版は通る」のassertionに失敗し、`test:critical-ui` / `test:deploy-version-guard` は成功。失敗を紙面編集や `b21518d9` へ帰属させず、上記変更の作成者が整合を確認する。

## 次タスク

未解決の実装はない。まさから追加フィードバックが来たときだけ、該当PJ・対象月のprint pageを開き、指摘された紙面上の位置から編集できることを実データで確認して直す。ログイン済み画面では、社内版の編集→draft保存→必要時だけ確定版に反映→PDF保存、提出版の編集→保存→PDF保存を通す。モーダルへ戻って文章を探す導線、社内版と提出版で「確認」と「編集」の意味を分ける導線、確定版の無確認上書きは作らない。

## 確立済みの運用ルール

- main一本。branch/worktreeを新規作成しない。対象ファイルだけを明示stageし、`git add .` / `git add -A` は使わない。
- PWAコードまたはユーザー表示を変えるときは `pwa/src/lib/build-info.ts` をpatch bumpし、関連するspec・design・manual・changelog・BUGS・development design logを同じ変更単位で同期する。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。生の `git push` や `npx vercel` 直接deployは使わない。deploy後はVercel Readyとproduction `/api/build-info` のSHAを確認する。
- 月次の`monthly_reports.final_content`は、既存の確定内容があるとき、明示forceなしに上書きしない。通常編集はdraftとして保存する。
- UI変更はDOMやlintだけで閉じず、ログイン済み実画面とPDFで、紙面上の修正点から迷わず編集できること、サイドメニューがPDFに入らないこと、console errorがないことを確認する。
```
