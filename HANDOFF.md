# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: MS変更履歴 cockpit 表示 / 既存MS履歴 backfill / closeout

## Summary

- PJ cockpit の今期MS直下に、折りたたみ式 `MS変更履歴` を追加済み。メンバーが必要な時だけ、変更日時・記録者・MS差分・担当share差分・保存前支払検算を確認できる。
- `/admin/ms-overview` 保存成功時に `milestone_change_events` へ変更前後snapshot・差分・検算サマリを保存する。
- 既存MS分も backfill 済み。active / fixed の 11 plan cycle、110 MS を、`value_milestones.created_at` ごとの作成バッチとして 19 event に分けて追加した。
- backfill は `source='migration'` / `metadata_json.backfillKey='2026-07-09-ms-change-history-created-at-batches-v1'`。ログ導入前の pt/share 更新時刻は復元せず、担当shareは backfill 実行時点の現行値。
- dirty を理由に deploy を止めた運用ミスは、`AGENTS.common.md`、root `CLAUDE.md`、`pwa/CLAUDE.md`、`pwa/BUGS.md` に再発防止を記録済み。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-09 — MS変更履歴 cockpit 表示 / 既存履歴 backfill / closeout`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Local main vs `origin/main`: closeout inventory時点で ahead `0`, behind `0`
- Worktree: `/Users/masa/projects/AMD/amd-os [main]` のみ
- Local branch: `main` のみ
- Production: `https://amd-os-pwa.vercel.app/api/build-info` は closeout deploy 後に `git_branch=main`, `dirty=false`, pushed `origin/main` と一致することを確認済み。再開時はこの endpoint と `git rev-parse origin/main` をもう一度合わせる。
- `origin/main` は MS変更履歴実装、backfill記録、closeout/handoff更新を含む。

## Dirty State

MS履歴 bundle では触らない別件 invoice queue refinement が残っている。owner guess は別セッションの請求書発行キュー worker。

- `pwa/src/app/(app)/admin/invoices/page.tsx`
- `pwa/src/components/admin/AdminInvoiceIssueQueue.tsx`
- `pwa/src/lib/build-info.ts`
- `pwa/design/SPEC_pwa.md`
- `pwa/design/routine.md`
- `pwa/design/FEATURE_REGISTRY.md` の invoice queue hunk
- `pwa/manual/2-6-admin-ops.md`
- `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
- `pwa/manual/6-6-member-billing-prompts-spec.md`
- `pwa/manual/9-3-appendix-changelog.md` の invoice queue hunk
- `pwa/scripts/check_pwa_critical_ui.cjs`

Resolution action: invoice queue workerが対象差分だけ stage / commit / push / deploy。MS履歴 closeout 側では巻き込まない。

## Verification / Deploy

実装時に実行済み:

- `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/166_milestone_change_events.sql`
- `npm run test:critical-ui`
- `npm run test:next-period-ui`
- `npx tsc --noEmit`
- `npm run build`
- production `/api/build-info` 確認
- closeout/handoff docs deploy 後の production `/api/build-info` 確認
- DB read-back: `milestone_change_events` total 19 / backfill 19

まさ指示「ローカルでテストするのやめて」以降は、追加のローカルテストやローカルサーバー起動なし。

## Unresolved Tasks

- MS変更履歴 / backfill: none known.
- Closeout archive status: `do not archive`。理由は invoice queue refinement の別件dirtyが残っているため。
- Invoice queue refinement: 別workerが継続。上記 dirty group を巻き込まずに完了させる。

## First Next Action

MS履歴について次に触るなら、本番 cockpit で任意PJの `MS変更履歴` を展開し、`source='migration'` の既存MS基準線と、今後 `/admin/ms-overview` 保存時に追加される実変更ログが同じUIに並ぶことを確認する。

## Pointers

- Cockpit UI: `pwa/src/components/cockpit/CockpitMsChangeHistory.tsx`
- Cockpit data: `pwa/src/lib/supabase-data.ts`
- Admin save route: `pwa/src/app/api/admin/ms-overview/[planCycleId]/route.ts`
- Migration: `pwa/scripts/migrations/166_milestone_change_events.sql`
- Manual: `pwa/manual/2-3-pj-cockpit.md`, `pwa/manual/6-8-admin-ms-overview-spec.md`
- Spec/design: `pwa/spec/3-8-cockpit-current-spec.md`, `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/db_schema.md`
- Process lesson: `pwa/BUGS.md`
