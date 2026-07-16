# SESSION MIGRATION PROMPT — Admin 裏wiki 人物文脈6項目化 closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md
11. /Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md
12. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
13. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
14. /Users/masa/projects/AMD/amd-os/pwa/design/db_schema.md
15. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- /admin/private-wiki の「tags」UI/API導線は削除済み。
- 代わりに、誕生日・出身地・居住地・接点・家族・タブーを追加済み。
- accepted implementation commit: 0d0cf4a0 Update admin private wiki person context fields。
- implementation baseline before the handoff-docs commit: 692db89b fix(pwa): contain score factor tables。
- production readback before the handoff-docs commit: build_version v3.41.16, git_sha 692db89b17fe8dec83466db184e17b697bc31ebe, dirty=false。
- このSESSION_MIGRATION_PROMPT保存自体でdocs-only commitが積まれる可能性があるため、次回は必ず /api/build-info を取り直す。
- 0d0cf4a0 は 692db89b の ancestor なので、private wiki変更は本番current lineに含まれている。
- DB migration 173 は production DB に適用済み。
- db_schema dump済み。private_wiki_entries は birthday_label / origin_label / residence_label / contact_context / family_note / taboo_note を持つ。
- stale Claude worktrees 2つは main-aligned だったため、証跡保存後に削除済み。残worktreeはroot checkoutのみ。

今回の仕様:
- private_wiki_entries の新列:
  - birthday_label text
  - origin_label text
  - residence_label text
  - contact_context text
  - family_note text
  - taboo_note text
- API:
  - POST/PATCH payload は birthdayLabel / originLabel / residenceLabel / contactContext / familyNote / tabooNote を受ける。
  - tags payload normalize は削除。
  - GET の tag query / contains("tags") filter は削除。
  - requireAdmin() + createAdminClient() + visibility="admin_private" は維持。
- UI:
  - 検索対象は人物名、所属、関係性、誕生日、出身地、居住地、接点、家族、タブー、本文メモ、source。
  - tag filter / tag chip / tags input は存在しない。
  - タブーは一覧上で rose tone 表示。
- DB互換:
  - 旧 tags 列はDBには残るが、UI/APIの主導線へ戻さない。

検証済み:
- python3 -X utf8 scripts/apply_ddl.py scripts/migrations/173_private_wiki_person_context_fields.sql -> OK (201)
- python3 -X utf8 scripts/dump_schema.py -> pwa/design/db_schema.md regenerated
- npm run test:critical-ui -> pass
- npx eslint 'src/app/(app)/admin/private-wiki/page.tsx' src/app/api/admin/private-wiki/route.ts src/components/admin/AdminPrivateWikiClient.tsx -> pass
- npm run build -> pass
- clean disposable cloneから AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh -> v3.41.15 / 0d0cf4a0 本番反映確認
- その後、別件 score fix v3.41.16 / 692db89b が本番currentになったが、private wiki commitは含まれる。
- unauthenticated GET https://amd-os-pwa.vercel.app/api/admin/private-wiki -> 401 Unauthorized
- 未確認: logged-in adminでの手操作smoke。auth-gatedのため、必要ならまさログイン状態で確認する。

次タスク:
1. 基本的には private wiki 実装の追加作業なし。
2. 手操作確認が必要なら、logged-in production adminで /admin/private-wiki を開き、dummy entryを作成/編集:
   - 誕生日 / 出身地 / 居住地 / 接点 / 家族 / タブーが入力・保存・再表示されること
   - tags UIがないこと
   - 確認後はdummy entryをarchiveする
3. 残dirtyのcloseoutを行う場合は private wiki とは別レーンで扱う:
   - pwa/design/atlas_routine.md = Atlas / D-8 routine lane
   - pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md = L6 meeting extract lane
   - pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md = H-1 meeting summary reviewer lane
   - pwa/scripts/check_h1_meeting_summary_reviewer.mjs = H-1 meeting summary reviewer lane
   - pwa/scripts/review_h1_meeting_summary.mjs = H-1 meeting summary reviewer lane
   - pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md = Book A frontmatter lane

次回開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git log -1 --oneline
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

確立済み運用ルール:
- まず /Users/masa/projects/AGENTS.common.md と AMD level memory を読む。
- branch/worktree作成は禁止。main直編集・main直push。
- dirtyを理由にbranchを切らない。対象ファイルだけ明示stageする。git add . 禁止。
- admin/private-wikiはadmin-only。通常cockpit、公開ページ、研究機関外部workspaceへ出さない。
- 個人情報・機微情報は最小限。raw本文、メール全文、議事録全文、secret、URLをdurable artifactに貼らない。
- PWA本番反映は clean checkout から AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。
- manual/spec/design/db_schema/FEATURE_REGISTRY/critical-ui/changelog の同期を崩さない。
```
