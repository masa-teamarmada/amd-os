# AMD OS Handoff

最終更新: 2026-06-28 JST
対象: `/Users/masa/projects/AMD/amd-os`

## いまの結論

- local branch: `main`
- local HEAD / origin/main at functional base: `3b9a4ae6e6fc651f76c67f25030fd51e275dcaa5`
- 最新機能コミット: `fix(pwa): normalize bare member surnames`
- production deployment for `3b9a4ae6e6fc651f76c67f25030fd51e275dcaa5`: `dpl_ELcmUxd6L4waMs5C4KE9YGezFKs7`
- production `/api/build-info` checked 2026-06-28 JST: `v0.36.21` / `3b9a4ae6e6fc651f76c67f25030fd51e275dcaa5` / `dirty=false`
- staged はなし。
- working tree は mixed dirty。archive はまだ不可。
- 契約管理の最新設計は「契約書ファイル一覧」ではなく、`/admin/contracts` の契約台帳。1行は Drive file / folder / MTG / 議事録ではなく、1契約または契約ファミリー。

## 今回の handoff / closeout でやったこと

- 契約台帳の表示境界を正本化した。
- `pwa/spec/5-6-contracts-management-current-spec.md` に、台帳列、`registry_status`、`ledger` filter、Drive backfill時の folder/evidence/contract row の役割分担を追記。
- `pwa/manual/6-7-contracts-management-spec.md` に、ユーザー向けの契約台帳仕様と `metadata不足` filter を追記。
- `pwa/design/SPEC_pwa.md` の `/admin/contracts` route説明が、MTG/議事録/Drive folder を契約行にしない設計になっていることを確認。
- `pwa/BUGS.md` に、MTG/議事録/Drive folder が契約書リストへ混入した事故と再発防止策を追加。
- `pwa/design_log/sessions_2026-06.md` に、契約台帳正規化セッションを追記。

## 契約管理の current truth

- 実装済み bundle: `v0.28.12` / commit `b2277b5f` で契約台帳UIと migration `147_contracts_registry_metadata.sql` を deploy 済み。
- 本番DBには `contracts.canonical_title`、`registry_status`、発効日、満了日、更新通知日、契約金額、owner、notes 系metadataを追加済み。
- 既存 `contracts` 2,159件は再分類済み。通常台帳に出すのは `accepted` / `candidate`、周辺証跡は `evidence_only` / `rejected`。
- `pwa/src/lib/build-info.ts` の `v0.36.21` bump と bare member surname normalize は `3b9a4ae6e6fc651f76c67f25030fd51e275dcaa5` で main に入っている。

## Unresolved Tasks

1. `/admin/contracts` をログイン済み状態で開き、台帳表が `ledger` filter で MTG/議事録/folder を隠していることを確認する。
2. Drive上の契約書監査を続ける場合も、Drive folder / MTG / 議事録は `contracts` 行に昇格させず、`contract_documents` / `contract_signals` の evidence として扱う。
3. 現在の mixed dirty は契約作業と別bundleが多い。次回は `git status -sb --untracked-files=all` で再分類してから触る。

## Dirty / Untracked Classification

### own-necessary / carry-forward

- `HANDOFF.md`
- `SESSION_MIGRATION_PROMPT.md`
- `pwa/spec/5-6-contracts-management-current-spec.md`
- `pwa/manual/6-7-contracts-management-spec.md`
- `pwa/design_log/sessions_2026-06.md`

扱い: この handoff で追加した契約台帳ドキュメント。次回、他bundleと混ぜずに targeted staging / commit する。

### mixed preexisting + own

- `pwa/BUGS.md`: 既存の notification stop 追記に、今回の contracts bug entry を追加。

扱い: mixed dirty。commit時は既存差分の owner を確認し、同じ docs bundle として閉じるか、必要なら patch split する。

### preexisting / likely other-worker WIP

- notification stop / meeting flow / task notification bundle:
  - `gas/153_MeetingHourlyTrigger.js`
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
  - notification/task API and component files
  - migrations `155_skip_non_actionable_app_notifications.sql` / `156_skip_meeting_summary_notifications.sql`
- contract / monthly agreement docs WIP:
  - `pwa/proposals/monthly-work-agreement-contract-revision-and-rollout-draft-20260628.md`
- Atlas UI WIP: multiple `pwa/src/app/(app)/atlas/**` files.
- Admin/Kiyo / meeting-assets / project-label WIP:
  - `pwa/src/app/(app)/admin/kiyo/page.tsx`
  - `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts`
  - `pwa/src/lib/project-labels.ts`
  - `pwa/scripts/update_drive_file.mjs`
  - migration `153_project_venture_legacy_name_hygiene.sql`
- H-1 prep outbox markdowns under `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/`.
- local artifact: `gas-slack/.clasp.json`.

扱い: 契約台帳handoffとは別bundle。`git add .` 禁止。owner へ戻すか cleanup worker で分類。

## First Next Action

1. `HANDOFF.md` -> `pwa/spec/5-6-contracts-management-current-spec.md` -> `pwa/manual/6-7-contracts-management-spec.md` -> `pwa/BUGS.md` の順で読む。
2. `git status -sb --untracked-files=all` と `git diff --name-status` で mixed dirty を再確認する。
3. 契約 docs を閉じるなら、上の own/mixed docs だけを対象に patch split して commit する。
4. UI確認をするならログイン済みブラウザで `/admin/contracts` を開き、MTG/議事録/folder が初期台帳に出ないことを確認する。

## Archive 判定

do not archive / handoff required。

理由:

- handoff docs と既存WIPが mixed dirty。
- main / origin / production は一致しているが、uncommitted / untracked が大量に残っている。
- owner 未確定の WIP が残っている。
