# SESSION MIGRATION PROMPT - AMD OS MS change history closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/6-8-admin-ms-overview-spec.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- branch: main
- worktree: /Users/masa/projects/AMD/amd-os [main] only
- local main vs origin/main: closeout inventory時点で ahead 0 / behind 0
- production: https://amd-os-pwa.vercel.app/api/build-info は closeout deploy 後に git_branch=main / dirty=false / pushed origin/main と一致することを確認済み。再開時はこの endpoint と git rev-parse origin/main をもう一度合わせる。
- origin/main: MS変更履歴実装、backfill記録、closeout/handoff更新を含む。
- DB: milestone_change_events は 19件。すべて 2026-07-09 の既存MS backfill。backfillKey は 2026-07-09-ms-change-history-created-at-batches-v1。

完了内容:
- PJ cockpit の今期MS直下に、折りたたみ式 MS変更履歴を追加済み。
- /admin/ms-overview 保存成功時に milestone_change_events へ変更前後snapshot、MS差分、担当share差分、保存前支払検算サマリを保存する。
- 既存MSも backfill 済み。active / fixed の 11 plan cycle、110 MS を value_milestones.created_at ごとの作成バッチとして 19 event に分けて追加した。
- backfill event は source='migration'、changed_by_email='amd-os-backfill@teamarmada.local'。
- ログ導入前の pt/share 更新時刻はDBに残っていないため捏造しない。担当shareは backfill 実行時点の現行値。
- dirtyを理由にpush/deployを止めた運用ミスは、AGENTS.common.md、root CLAUDE.md、pwa/CLAUDE.md、pwa/BUGS.mdに再発防止を記録済み。

現在残っている別件dirty:
- invoice queue refinement 由来。MS履歴bundleでは触らない。
- 主なファイル: pwa/src/app/(app)/admin/invoices/page.tsx、pwa/src/components/admin/AdminInvoiceIssueQueue.tsx、pwa/src/lib/build-info.ts、pwa/design/SPEC_pwa.md、pwa/design/routine.md、pwa/design/FEATURE_REGISTRY.md、pwa/manual/2-6-admin-ops.md、pwa/manual/6-3-invoice-and-billing-routine-spec.md、pwa/manual/6-6-member-billing-prompts-spec.md、pwa/manual/9-3-appendix-changelog.md、pwa/scripts/check_pwa_critical_ui.cjs。
- 次セッションが invoice queue を扱うなら、このdirty groupだけを対象差分として stage / commit / push / deploy。MS履歴closeout差分と混ぜない。

検証済み:
- DDL 166_milestone_change_events.sql は本番DBに適用済み。
- 実装時に npm run test:critical-ui、npm run test:next-period-ui、npx tsc --noEmit、npm run build は passed。
- まさが「ローカルでテストするのやめて」と言った後は追加のローカルテスト/ローカルサーバー起動なし。
- DB read-back: milestone_change_events total 19 / backfill 19。

次タスク:
- MS履歴は既知の残タスクなし。
- 本番 cockpit で見るなら、任意PJの MS変更履歴トグルを開き、source='migration' の既存MS基準線と、今後の /admin/ms-overview 保存イベントが同じUIに並ぶことを確認する。
- invoice queue dirty が残っているので、別セッション/別workerで対象差分だけを処理する。

運用ルール:
- PWA本番反映は main push = Vercel自動deploy。直接 npx vercel deploy は使わない。
- dirtyを理由に stage / commit / push / deploy を止めない。既存dirtyは戻さず、今回の対象ファイルだけ明示して stage する。git add .は禁止。
- 「別件の未コミット差分があるので push/deploy していない」と報告しない。正規deploy scriptのhard-stop、まさの明示停止、真に破壊的な操作以外で止めたら未完了。
- まさが「ローカルでテストするのやめて」と言ったセッションでは、追加のローカルテスト・ローカルサーバー・ブラウザ確認を増やさない。
- closeout時は dirtyを 自分の分 / 他worker由来っぽい分 / 未判断 に分け、owner/action/deadline/risk を付ける。
```
