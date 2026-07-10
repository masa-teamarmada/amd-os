# SESSION MIGRATION PROMPT — AMD OS notifications / action queue closeout

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
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
13. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/3-3-notifications-and-tsukuyomi.md
15. /Users/masa/projects/AMD/amd-os/pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
17. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

現在の本番:
- https://amd-os-pwa.vercel.app/api/build-info
- closeout開始時点では v3.39.59 / git_sha=7da9c71a9ae54fd417a897681ac9158a699844ae / main / dirty=false を確認済み。
- この docs closeout bundle の最終 commit / production proof は、閉じたチャットの最終報告を current truth として見る。

直近で完了したこと:
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
4. 要対応キューUX
   - 症状: `/dashboard` と `/notifications` の「対応済にする」で、対象外の要対応まで一度消えて再表示された。
   - 原因: 保存成功後に一覧全体を再読込し、ローディング中にリスト全体を非表示にしていた。
   - 修正: 押した行だけを楽観的に外し、保存失敗時だけ元の位置へ戻す。ほかの要対応は表示し続ける。
   - deploy: v3.39.59 / 7da9c71a。

docs / handoff 同期:
- HANDOFF.md
- SESSION_MIGRATION_PROMPT.md
- pwa/BUGS.md
- pwa/design_log/sessions_2026-07.md
- pwa/manual/2-3-pj-cockpit.md

repo / cleanup 状態:
- canonical branch は main。新規 branch / worktree は作らない。
- root には `pwa/src/components/admin/AdminProjectsTable.tsx` の未コミット差分がある可能性がある。これは admin projects Slack設定レーンなので、明示的にその作業を引き継ぐ場合以外は戻さず、stageにも混ぜない。
- `/private/tmp/claude-501/-Users-masa-projects-AMD-before-zero--claude-worktrees-reverent-mclean-d84b4d/f4e3ceee-9903-479d-bcf8-02123ac87b34/scratchpad/wt-ch7` は detached `f370b136` の古い登録worktree。削除は destructive なので、まさが明示承認した時だけ `git worktree remove --force <path>` と `git worktree prune` を行う。
- 退避 stash がある場合は中身を確認してから扱う。`stash pop/drop` は勝手にしない。

次に作業を始める前:
1. `git status --short`、`git worktree list --porcelain`、`git log -1 --oneline` を取り直す。
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` で production の sha / dirty を見る。
3. PWAコード変更では `pwa/src/lib/build-info.ts` をpatch bumpする。
4. 対象ファイルだけstageして commit。PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` のみを使う。
5. handoff時は manual/spec/design/changelog/BUGS/design_log を同期し、`HANDOFF.md` とこのファイルを更新する。

運用ルール:
- dirtyを理由にbranch/worktreeを作らない。既存dirtyは戻さず、今回の対象ファイルだけ明示stageする。`git add .`は禁止。
- raw本文、URL、secret、個人情報は handoff / BUGS / design_log に残さない。
- 通知の新しい `l2_kind` を作るときは、表示・詳細 fallback・feedback yes/no・正本テーブル反映の4点を同時に spec/manual へ並べる。
```
