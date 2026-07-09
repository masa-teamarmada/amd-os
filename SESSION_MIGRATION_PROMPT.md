# SESSION MIGRATION PROMPT - AMD OS cockpit MS design amounts closeout

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
11. /Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
14. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
15. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
16. /Users/masa/projects/AMD/amd-os/pwa/design/cockpit.md
17. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
18. /Users/masa/projects/AMD/amd-os/pwa/spec/6-1-appendix-changelog.md
19. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
20. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- branch rule: 新規branch禁止。dirtyを理由にbranch/worktreeを作らない。
- accepted deployed commits:
  - d9d38833 Show MS design budgets in cockpit
  - aaa19ac3 Show member design amounts in cockpit MS chips
- later origin/main also includes `79d84375 fix(pwa): compact monthly agreement modal` from a separate lane. It was fast-forwarded because the local copies of those files matched origin.
- production build-info after accepted work:
  - build_version: v0.39.20
  - git_sha: aaa19ac354f323dc38c2d22cece1e765fcbbd203
  - branch: main
  - dirty: false
- final handoff docs were committed and pushed after accepted product work. At resume, run `git log -1 --oneline` and `/api/build-info`; expected product version is v0.39.21 or newer / dirty=false after the later monthly-agreement lane.
- HEAD and origin/main were aligned at closeout inventory: ahead 0 / behind 0.
- registered worktree: /Users/masa/projects/AMD/amd-os [main] only.
- local branch: main only.

このセッションで完了したこと:
- PJ cockpit / HUD cockpit の今期MSリストに、MS単位の `設計額` を追加した。
- バー上のメンバー chip に担当者ごとの `担当設計額` を追加した。
- 表示は短く `まさ 65% / 4.6pt / 12.3万円` のようにし、正確な円額は hover title で確認できる。
- 通常MSは plan cycle の本契約予算、cap_extra は同期間の billing_cycles.extra_budget_yen 合計から按分する。
- これは支払確定額ではなく、/admin/ms-overview と同じ設計額の目安。
- pwa/manual/2-3-pj-cockpit.md、pwa/spec/3-8-cockpit-current-spec.md、pwa/design/cockpit.md、pwa/design/FEATURE_REGISTRY.md、manual/spec changelog、critical UI guard を同期済み。
- 検証: tsc、critical-ui、next-period-ui、targeted eslint、build。
- 本番反映: deploy.sh で main push / Vercel Ready まで確認済み。

今の重要注意:
- この checkout は clean ではない。accepted work の後に、別件の未コミット変更が出ている。
- 代表的な dirty:
  - pwa/scripts/migrations/166_milestone_change_events.sql
  - pwa/src/components/cockpit/CockpitMsChangeHistory.tsx
  - pwa/src/app/api/admin/ms-overview/[planCycleId]/route.ts
  - pwa/src/lib/supabase-data.ts
  - pwa/src/components/cockpit/CockpitView.tsx
  - pwa/src/components/cockpit/CockpitHeader.tsx
  - pwa/src/app/api/admin/payouts/route.ts
  - pwa/src/components/admin/AdminPayoutsClient.tsx
  - pwa/src/app/(app)/admin/billing/page.tsx
  - pwa/src/app/(app)/admin/invoices/page.tsx
  - pwa/src/components/admin/AdminBillingMatrix.tsx
  - pwa/src/components/admin/AdminInvoiceIssueDialog.tsx
  - pwa/src/components/admin/AdminInvoiceIssueMatrix.tsx
  - pwa/src/components/admin/AdminProjectsTable.tsx
  - pwa/manual/7-1-reward-calc-spec.md
- この dirty bundle は accepted product commits や final handoff docs commit には含まれず、本番にも未反映。deploy.sh は tracked dirty があるため hard-stop する。
- 次セッションは最初に以下を実行して、dirty bundle の owner/action を確定する:
  - git status -sb --untracked-files=all
  - git diff --stat
  - git diff --name-status
  - curl -fsS https://amd-os-pwa.vercel.app/api/build-info

次タスク:
1. まず dirty bundle を分類する。
   - MS変更履歴を進めるなら、migration適用、schema更新要否、API/types/UI、manual/spec/design/changelog、critical-ui、tsc、build、deployまで1 bundleで閉じる。
   - stale/誤生成なら、archiveを取ってから、まさ承認のうえで対象だけrevert/removeする。
   - 月初合意/支払通知/請求issue系の変更はMS変更履歴と混ぜない。
2. 必要なら login-capable browser で /project/<projectId>/cockpit を開き、MS bar chip の担当設計額が横幅内で読めるかを目視する。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下では AMD level memory /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md も冒頭で読む。
- dirty は branch/worktree 作成理由にしない。
- git add . は使わず対象ファイルだけstageする。
- PWAコード変更時は build version を bump する。
- PWA本番反映は main push = Vercel自動deploy。通常は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh を使い、最後に /api/build-info で current sha / dirty=false を確認する。
- deploy.sh が dirty hard-stop する場合は、対象bundleだけをcleanにするか、別件dirtyを owner/action 付きで整理する。未分類dirtyを理由に完了報告しない。
- handoff時は恒久仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log に分け、HANDOFFだけに残さない。
```
