# SESSION MIGRATION PROMPT - AMD OS closeout after cockpit proactive queue removal

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
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/2-4-proactive-todo-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/6-8-admin-ms-overview-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
14. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- branch rule: 新規branch禁止。mainへ直接commit/push。
- product commit: 49c55af0 fix: remove retired proactive queue from cockpit
- production build-info after product push: v0.39.15 / 49c55af0fac1f2e2a7e9955bd5ae519d45b5d843 / main / dirty=false
- worktree registry after cleanup: /Users/masa/projects/AMD/amd-os [main] only
- stale detached worktree evidence archive: /Users/masa/.codex/cleanup_archives/amd-os-worktree-fa121987-20260709-134537
- final docs-only handoff commit may be newer than 49c55af0. Start by running:
  - git status -sb --untracked-files=all
  - git log -3 --oneline
  - curl -fsS https://amd-os-pwa.vercel.app/api/build-info

このセッションで完了したこと:
- 通常PJ / institution cockpit から旧 ProactiveQueuePanel を削除した。
- 削除対象は旧 proactive_outbox 由来のTODO枠。現行の先手TODO棚卸しは proactive_todos + /proactive + dashboard 上段バッジで扱う。
- CockpitView の右カラムは資料、経営ハイライト、ガバナンス、助成金、MTGサマリに絞った。
- HUD内 cockpit 説明文も「先手TODO」から「資料、経営ハイライト」へ更新した。
- 関連する spec/design/manual/changelog は更新済み。
- `npm run test:critical-ui`, `npx tsc --noEmit --pretty false`, `npm run build`, `npm run test:deploy-version-guard`, `git diff --check` は通過。
- ローカルブラウザでは cockpit 本体はログインで止まったが、login desktop/mobile と HUD mock は横はみ出しなし。

ZMP 実績合わせの current truth:
- ZMP project_id は p19。
- production Supabase read-back で 202601-202605 は全て verified。
- 202601: members=4, total_pay=255000, paid_at=2026-02-27T00:00:00+09:00, verified=true
- 202602: members=4, total_pay=169000, paid_at=2026-03-31T00:00:00+09:00, verified=true
- 202603: members=4, total_pay=170254.545455, paid_at=2026-04-30T00:00:00+09:00, verified=true
- 202604: members=4, total_pay=102180, paid_at=2026-05-29T00:00:00+09:00, verified=true
- 202605: members=4, total_pay=85410, paid_at=2026-06-30T00:00:00+09:00, verified=true
- unverified=[]

次タスク:
1. /admin/ms-overview に「実支払へ合わせる」admin UI を実装する。
2. 支払済み月で実支払証跡や明細が欠ける場合、member別の計算値、実支払額、差額、freee wallet transaction ids、予算影響を表示する。
3. 実支払合わせで (client payment - buffer) * 65% を超える場合、内部留保/会社留保を切り崩すことを許可するか確認ダイアログを出す。承認なしに reserve を消費しない。
4. 承認された場合だけ monthly_reward_payout / billing_cycles.reward_paid_at / billing_cycles.reward_paid_by / billing_log を同じ admin flow で更新する。
5. テストを追加し、pwa/manual/6-8-admin-ms-overview-spec.md、pwa/spec/3-14-monthly-work-agreement-current-spec.md、pwa/design/FEATURE_REGISTRY.md、manual/spec changelog、design_log を同期する。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下では AMD level memory /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md も冒頭で読む。
- dirty は branch/worktree 作成理由にしない。
- git add . は使わず対象ファイルだけstageする。
- PWAコード変更時は build version を確認し、必要なら bump する。
- PWA本番反映は main push = Vercel自動deploy。通常は deploy.sh を使うが、既存dirtyがある場合は理由を明記し、push後に /api/build-info で current sha / dirty=false を確認する。
- handoff時は恒久仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log に分け、HANDOFFだけに残さない。
```
