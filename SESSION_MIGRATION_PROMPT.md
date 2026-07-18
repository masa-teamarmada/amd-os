# SESSION MIGRATION PROMPT — 法人支払義務の自動DM停止 closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/manual/6-9-company-payment-obligations-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
10. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- 法人支払義務の初回日次同期が未確認・当月・期限超過の候補を経理担当へ一括DMし、2026-07-18に28件送信された。
- `81bc29e3` / production `v3.44.15` で、自動DMは既定OFFへ変更済み。台帳と月次試算表の同期は継続する。
- 日次DMは本番で `PAYMENT_OBLIGATION_AUTO_NUDGE_ENABLED=1` を明示しない限り送らない。管理画面からの手動送信は別の明示操作。
- まさはこのDMを依頼した記憶がない。検知・台帳化と人への通知を推論で一体化しないことが最重要の再発防止。

次タスク:
- 自動DMを勝手に再開しない。まさが必要だと言った場合だけ、候補件数・重複防止・送信文面をdry-runで確認してから、review-firstの設計bundleとして提案する。
- 通知関連を変更する時は、データ同期、候補表示、人への送信を別責務にし、送信は既定OFFにする。

次回開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git log -1 --oneline origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

確立済み運用ルール:
- local checkout、origin/main、production `/api/build-info` を並べてcurrent truthを決める。
- shared rootはmulti-writer。別レーンのdirty、branch、worktreeをstage・reset・削除しない。
- shared rootがdirtyならmainのdisposable clean cloneで対象ファイルだけをbundle化する。
- `git add .`は禁止。PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使い、CLI直接deployはしない。
- raw本文、個人情報、secret、private URLをdurable artifactへ残さない。
```
