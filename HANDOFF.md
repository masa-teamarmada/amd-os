# AMD OS Handoff

最終更新: 2026-06-28 JST
対象: `/Users/masa/projects/AMD/amd-os`

## いまの結論

- `main` / `origin/main` / production は一致済み。
- HEAD: `0f0a7dbc79085a39ceaed4d4a69c17711cdb0f4c`
- 最新コミット: `fix(pwa): exclude counterpart proactive todos`
- 本番 `/api/build-info`: `v0.36.19` / `0f0a7dbc79085a39ceaed4d4a69c17711cdb0f4c` / `dirty=false`
- 判定: `main aligned`
- staged はなし。ただし dirty / untracked が多いので、archive はまだ不可。

## 今回の closeout / handoff でやったこと

- closeout inventory を取り直した。
- `git fetch origin main --prune` 後、local `main` と `origin/main` が一致していることを確認した。
- production `/api/build-info` を確認し、本番も `0f0a7dbc / v0.36.19` まで追いついていることを確認した。
- mixed dirty / untracked を bundle ごとに分類した。
- product code、DB migration、GAS deploy、build、staging は実行していない。

## Open User Task

元の依頼は `/admin/payouts` の初期表示がまだ約15秒かかる件。

- まさの観測: 「まだデータが表示されるまでに15秒くらいかかってる」
- この closeout では payout 性能の追加調査・修正はしていない。
- 次セッションは、まず関連 md を読む:
  - `pwa/BUGS.md` の `[pwa/admin-payouts]` 2026-06-23 entries
  - `pwa/design/db_schema.md` の `billing_cycles` / `payout_agreement` / `payout_notices`
  - `pwa/design/management_score.md` の payout / reward cache 周辺
- その後、`/api/admin/payouts` の通常GETが本当に cache-only になっているか、SSR `loadTargetData(... includeAgreementGate:false)` と client-side revalidation / `gateOnly=1` のどこで15秒待っているかを切り分ける。

## Dirty / Untracked Classification

### 1. この handoff / closeout で扱ったもの

- `HANDOFF.md`
- `SESSION_MIGRATION_PROMPT.md`
- `pwa/design_log/sessions_2026-06.md`

扱い: handoff-doc bundle。commit / push 済みなら `git status` に出ない。まだ dirty に残る場合は、この 3 つだけを targeted staging / commit する。

### 2. notification stop / admin routing 系の既存 WIP

tracked modified:

- `gas/153_MeetingHourlyTrigger.js`
- `pwa/BUGS.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/l2_extract_claude_routine.md`
- `pwa/design/meeting_summaries.md`
- `pwa/design/notifications.md`
- `pwa/manual/2-6-admin-ops.md`
- `pwa/manual/3-1-system-architecture.md`
- `pwa/manual/3-3-notifications-and-tsukuyomi.md`
- `pwa/manual/6-1-operations-settings-spec.md`
- `pwa/manual/8-2-notification-review-and-strategy-signals-spec.md`
- `pwa/manual/8-3-l2-extraction-routines-spec.md`
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/spec/3-7-notifications-current-spec.md`
- `pwa/spec/5-5-cross-platform-gas-ios-current-spec.md`
- `pwa/spec/5-7-task-management-current-spec.md`
- `pwa/src/app/(app)/notifications/page.tsx`
- `pwa/src/app/api/meeting-workflow/finalize/route.ts`
- `pwa/src/app/api/notifications/feedback/route.ts`
- `pwa/src/app/api/task-calendar/register-tasks/route.ts`
- `pwa/src/app/api/tasks/route.ts`
- `pwa/src/components/admin/AdminSidebar.tsx`
- `pwa/src/components/nav/GlobalNav.tsx`
- `pwa/src/components/notifications/AppNotificationsSection.tsx`
- `pwa/src/components/notifications/CriticalRealtimeNotify.tsx`
- `pwa/src/lib/notifications-data.ts`
- `pwa/src/lib/operations-catalog.ts`

untracked related:

- `pwa/scripts/migrations/155_skip_non_actionable_app_notifications.sql`
- `pwa/scripts/migrations/156_skip_meeting_summary_notifications.sql`

扱い: pre-existing / likely other-worker WIP。notification bundle として targeted diff review する。Atlas / H-1 outbox / Kiyo と混ぜない。

### 3. Atlas visual / UI 系の既存 WIP

- `pwa/src/app/(app)/atlas/admin/themes/page.tsx`
- `pwa/src/app/(app)/atlas/decisions/page.tsx`
- `pwa/src/app/(app)/atlas/divergence/page.tsx`
- `pwa/src/app/(app)/atlas/inbox/page.tsx`
- `pwa/src/app/(app)/atlas/inbox/submit/page.tsx`
- `pwa/src/app/(app)/atlas/macrotrends/page.tsx`
- `pwa/src/app/(app)/atlas/map/page.tsx`
- `pwa/src/app/(app)/atlas/page.tsx`
- `pwa/src/app/(app)/hud/atlas/macrotrends/page.tsx`

扱い: pre-existing / likely Atlas UI worker WIP。notification bundle と混ぜない。

### 4. H-1 prep outbox 系の既存 WIP

- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/2026-06-24-upcoming-2fgest2loktp847bdngl26jhic-p26-vsx-prep-draft.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/2026-06-25-upcoming-2fgest2loktp847bdngl26jhic-p26-vsx-prep-rerun-status.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/2026-06-25-upcoming-2fgest2loktp847bdngl26jhic-p26-vsx-prep-worker-current-status.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/2026-06-25-upcoming-4so2kr7b2d19g67fk8ou181o9m-p21-sx-miura-prep-draft.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/2026-06-25-upcoming-ouf25bgoukki7ljafou1t0e13e-20260625T060000Z-p21-sx-internal-prep-draft.md`

扱い: H-1 prep worker artifact。消さない。owner に戻すか、outbox artifact として review / commit。

### 5. owner 未確定の既存 WIP / local artifact

- `gas-slack/.clasp.json`
- `pwa/scripts/migrations/153_project_venture_legacy_name_hygiene.sql`
- `pwa/scripts/update_drive_file.mjs`
- `pwa/src/app/(app)/admin/kiyo/page.tsx`
- `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts`
- `pwa/src/lib/project-labels.ts`

扱い: owner 未確定。quarantine owner は AMD OS cleanup worker。次回、file intent を読んで targeted commit / owner 返却 / まさ判断へ分ける。

### 6. ignored / local-only tooling

- `.vercel/project.json`: present / ignored。project は `amd-os-pwa`。
- `pwa/.next`, `pwa/node_modules`: present / ignored。
- `ios/supabase/.temp/linked-project.json`: ignored。
- `ios/supabase/.temp/project-ref`: local temp 系として注意。status に出る場合は ignore/local cleanup を検討。

## Design / Manual Coverage

この closeout / handoff セッションでは product behavior の新仕様は追加していない。

| 新仕様/仕様変更 | spec/design正本 | OSマニュアル章 | 状態 |
|---|---|---|---|
| closeout / handoff current truth refresh | `HANDOFF.md`, `SESSION_MIGRATION_PROMPT.md`, `pwa/design_log/sessions_2026-06.md` | 対象外: product仕様変更なし | ✅ |
| notification stop 既存WIP | `pwa/design/notifications.md`, `pwa/spec/3-7-notifications-current-spec.md` などに未commit dirty | `pwa/manual/*` に未commit dirty | ⚠️ 未検証。別bundleで扱う |
| Atlas visual / UI 既存WIP | Atlas app files | 未確認 | ⚠️ 未検証。別bundleで扱う |

## 次の最初の一手

1. `HANDOFF.md` -> relevant `SPEC*.md` -> `BUGS.md` の順で読む。
2. `git status -sb --untracked-files=all` と `git diff --stat` で dirty を再確認する。
3. dirty WIP は `git add .` しない。notification stop / Atlas UI / H-1 prep / Admin-Kiyo / meeting-assets / owner未確定 group を分ける。
4. まず閉じるなら notification stop bundle が最優先。DB migration 155/156 の適用有無、PWA表示除外、GAS writer 停止、manual/spec同期を1つの bundle として検証する。
5. deploy が必要なら `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。直接 `npx vercel deploy` は使わない。

## Archive 判定

do not archive / handoff required。

理由:

- main / production は揃ったが、uncommitted / untracked が大量に残っている。
- owner 未確定の WIP が含まれている。
- notification / Atlas / H-1 outbox / Admin-Kiyo / meeting-assets の bundle が混在している。
