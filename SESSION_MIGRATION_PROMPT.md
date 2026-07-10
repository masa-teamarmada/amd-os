# SESSION MIGRATION PROMPT - AMD OS notifications closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/notifications.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/governance_action_items.md
11. /Users/masa/projects/AMD/amd-os/pwa/spec/3-7-notifications-current-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-10-l2-ms-progress-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/3-3-notifications-and-tsukuyomi.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
16. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- canonical branch: main。今回の通知修正では新規 branch / worker worktree は作っていない。
- closeout docs topic: /notifications 修正3件 closeout + 既存 proactive TODO lane の引き継ぎ。
- closeout開始時点の本番 baseline:
  - production build-info: v3.39.59 / 7da9c71a9ae54fd417a897681ac9158a699844ae / main / dirty=false
  - HEAD...origin/main: 0 / 0
- この通知 closeout で更新した docs:
  - HANDOFF.md
  - SESSION_MIGRATION_PROMPT.md
  - pwa/BUGS.md
  - pwa/design_log/sessions_2026-07.md

今回の主成果:
1. D-11 メディア掲載通知
   - 症状: 記事は既に project_media_mentions に保存済みなのに「抽出された行が見つかりませんでした」と出た。
   - 原因: notification detail が候補行前提で、保存済み正本や通知本文 fallback を十分に見ていなかった。
   - 修正: news_mention detail で project_media_mentions を確認し、候補行なしでも通知本文 fallback を表示。保存済み通知は「はい・確認済み」扱い。
   - deploy: v0.39.48。後続 production baseline v3.39.59 に ancestor として含まれる。
2. D-2 MS計画遅延
   - 症状: target_ym=202606 の100%済みMSが 202607 通知で「現在0%」の遅延として出た。
   - 原因: 通知実行月の current row / initial_zero を優先し、期限月までの累積進捗を見ていなかった。
   - 修正: progress-estimator を ym <= target_ym の累積参照へ変更。current row が無い場合は直近過去進捗、initial_zero は過去実績を下げない。
   - deploy: v0.39.49 / v0.39.50。production cron manual run で delayNotified:0、DB read-back で 202607:delay の残通知0件。
3. D-14 action_item feedback
   - 症状: BWE同意書提出 action_item 通知で「はい・確認済み」を押すと unknown l2_kind: action_item。
   - 原因: action_items/extract は l2_kind=action_item を作るが、notifications feedback route が未対応だった。
   - 修正: action_item を allowed kind に追加し、はい=action_items.review_status confirmed、いいえ=rejected へ配線。
   - deploy: v0.39.52。BWE対象通知は confirmed + feedback + tsukuyomi learning まで復旧済み。

closeout inventory:
- local branch: main
- local branches: main only
- registered worktrees:
  - /Users/masa/projects/AMD/amd-os (main)
  - /private/tmp/claude-501/-Users-masa-projects-AMD-before-zero--claude-worktrees-reverent-mclean-d84b4d/f4e3ceee-9903-479d-bcf8-02123ac87b34/scratchpad/wt-ch7 (detached at f370b136)
- detached /private/tmp worktree はこのセッションで作っていない。削除するなら明示承認を取って、archive-first で evidence を残してから remove/prune。
- unrelated local dirty:
  - pwa/src/components/admin/AdminProjectsTable.tsx
  - admin projects Slack setting lane と推定。通知 closeout では stage しない。

次タスク:
1. まず closeout inventory を再実行して、HEAD / origin / prod / dirty / worktree を取り直す。
   - bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os
   - https://amd-os-pwa.vercel.app/api/build-info
2. `pwa/src/components/admin/AdminProjectsTable.tsx` の owner lane を確認する。
   - 通知修正には混ぜない。
   - admin projects Slack setting lane として続けるか、ownerに返す。
3. detached `/private/tmp/.../wt-ch7` は、削除承認がない限り触らない。
4. D-11 Media Mentions の「専用 writer / review UI」をやるなら別フェーズ。
   - 今回は保存済み行の詳細 fallback を直しただけ。
   - まず spec に writer / detail / feedback の責務を足してから実装する。

運用ルール:
- PWA本番反映は main push = Vercel自動deploy。直接 `npx vercel deploy` は使わない。
- deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。
- dirtyを理由にbranch/worktreeを作らない。既存dirtyは戻さず、今回の対象ファイルだけ明示stageする。`git add .`は禁止。
- raw本文、URL、secret、個人情報は handoff / BUGS / design_log に残さない。
- 通知の新しい `l2_kind` を作るときは、表示・詳細 fallback・feedback yes/no・正本テーブル反映の4点を同時に spec/manual へ並べる。
- closeout時は `HANDOFF.md`、`SESSION_MIGRATION_PROMPT.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-07.md` を current truth として扱う。
```
