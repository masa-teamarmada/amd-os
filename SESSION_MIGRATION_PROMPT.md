# SESSION MIGRATION PROMPT — AMD OS proactive TODO deadline closeout

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
9. /Users/masa/projects/AMD/amd-os/pwa/spec/2-4-proactive-todo-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md
11. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/README.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

現在の本番:
- https://amd-os-pwa.vercel.app/api/build-info
- closeout中に v3.39.62 / git_sha=84e6b2f4541e2bfbdbf32ce87ed500d7f2d895f0 / main / dirty=false を確認済み。
- 先手TODO修正 commit c3c92229 はこの baseline の ancestor。
- この handoff docs-only bundle が後でpushされている場合、最終チャットの production proof と fresh /api/build-info を exact latest SHA として扱う。

直近で完了したこと:
1. 問題
   - KUTE の proactive TODO が「2026-08-04次回MTGまでに提示資料を作成」なのに、期限が 2026-07-01 になっていた。
   - 原因は `meeting_next_action` の期限を `meeting_date + 7日` 固定fallbackで決め、action本文中の明示日付を優先していなかったこと。
2. 実装修正
   - `pwa/src/lib/proactive/meeting-action-due.ts` を追加。
   - `pwa/src/app/api/cron/proactive-todo-extract/route.ts` の `meeting_next_action` due_at を helper 経由へ変更。
   - 明示日付例: `2026-08-04次回MTGまで`, `8/4まで`, `次回MTGまでに`。
   - 明示期限が取れない場合だけ従来の `meeting_date + 7日` fallback を使う。
3. 回帰テスト
   - `pwa/scripts/check_proactive_meeting_action_due.mts`
   - `npm run test:proactive-meeting-due`
4. docs / manual 同期
   - `pwa/spec/2-4-proactive-todo-current-spec.md`
   - `pwa/manual/2-6-admin-ops.md`
   - `pwa/scheduled-tasks/README.md`
   - `pwa/BUGS.md`
   - `/proactive` 画面の検知説明
   - `pwa/design_log/sessions_2026-07.md`
   - `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md`
5. production / DB
   - `c3c92229 fix(pwa): respect explicit proactive todo due dates` を `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。
   - 本番 `v3.39.61 / c3c92229... / dirty=false` を確認。
   - その後、本番は別セッションの `v3.39.62 / 84e6b2f4...` へ進んだが、先手TODO修正は含まれている。
   - open な KUTE TODO 2件は `due_at=2026-08-04T00:00:00+00:00` に補正済み。スクショ該当行は `a7e4f03a-de82-48ff-8748-9656cbd23771`。

repo / cleanup 状態:
- canonical branch は main。新規 branch / worktree は作らない。
- closeout authoring時点では `HEAD...origin/main = 0 / 0`、`git worktree list` は main checkout 1つだけ。
- root には `pwa/src/components/admin/AdminProjectsTable.tsx` の未コミット差分がある。これは admin projects Slack設定レーンなので、明示的にその作業を引き継ぐ場合以外は戻さず、stageにも混ぜない。
- `/tmp/amd-os-deploy-c3c92229` はこの先手TODO deployで使った一時clone。登録worktreeではない。削除はまさの明示承認後。

次に作業を始める前:
1. `git status -sb`、`git worktree list`、`git log -1 --oneline` を取り直す。
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` で production の sha / dirty を見る。
3. PWAコード変更では `pwa/src/lib/build-info.ts` をpatch bumpする。
4. 対象ファイルだけstageして commit。PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` のみを使う。
5. handoff時は manual/spec/design/changelog/BUGS/design_log を同期し、`HANDOFF.md` とこのファイルを更新する。

運用ルール:
- dirtyを理由にbranch/worktreeを作らない。既存dirtyは戻さず、今回の対象ファイルだけ明示stageする。`git add .`は禁止。
- raw本文、URL、secret、個人情報は handoff / BUGS / design_log に残さない。
- `meeting_next_action` は、action本文中の明示期限をdue dateの正本として扱う。fallbackは明示期限が無い場合だけ。
```
