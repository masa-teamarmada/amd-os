# L2M-1 v2 実装 Handoff (2026-07-01)

Last updated: 2026-07-01 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: L2M-1 月次業務報告書生成 routine v2 — Codex(gpt-5.5 daily) → Claude routine(opus-4-8 + ultracode / 月末最終日 03:00 JST) 移植 + 内部/対外 2 段生成 + プロンプト DB管理化 + admin/projects 4列追加

> **並列 HANDOFF について**: 本 handoff は L2M-1 v2 実装セッションの引き継ぎ。同時期に別 worker (KENQ AMD Score cockpit 統合) の HANDOFF.md / SESSION_MIGRATION_PROMPT.md が active なので、L2M-1 v2 の詳細は本ファイルに分離。KENQ 系は `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` 参照。

## Latest Session Summary

- まさ「KUTE で固めた月次業務報告書PDFフォーマットを AMD OS の月次報告書雛形として実装」の依頼で開始。参考成果物は `/Users/masa/projects/AMD/kute/output/monthly_reports/KUTE_月次業務報告書_202605-202606.md`。
- 旧 M-1 primary writer は Codex `~/.codex/automations/amd-os-l2` (name="AMD OS M-1 月次報告抽出") が gpt-5.5 + reasoning_effort=high で **daily 05:30 JST** に動いていた。品質不足のためまさ確定で「月1回、月末最終日 03:00 JST、opus-4-8 + ultracode に品質を上げる」ため Claude routine へ移植。
- 8 commit + snippet 削除 1 commit を main に push 済み (`8b877306` 〜 `9b6e6021` 及び `5f7f15bd`)。DB migration 159 + 160 反映済み、llm_prompts 完成形 body 反映済み、Claude routine 登録済み (Next run: **Tue Jul 28 03:04 JST**)、旧 Codex `amd-os-l2` PAUSED 済み。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の 2026-07-01 セクション。

## Repo State

- Canonical branch: `main`。
- L2M-1 関連 accepted commits (すべて `origin/main` 反映済):
  - `8b877306` L2M-1 monthly report v2 skeleton (SKILL.md 初版 + migration 159)
  - `4a4ff80f` Slack を `send-eimi-slack.mjs` + まさ DM 集約
  - `bae00be4` `monthly_report_scope` enum (migration 160) + SKILL 更新
  - `afeeee3b` admin/projects row mapper + ProjectRow 型 4 列
  - `83f50bbe` admin/projects UI 完全実装 (th + td + edit form) + BUILD_VERSION v0.36.37
  - `d5dc34c3` spec/manual 同期 (spec/3-2 v2 + changelog)
  - `69d01a02` CX (p20 NIMS) を internal_and_external に変更
  - `9b6e6021` SKILL.md 実行環境記述訂正 (cloud sandbox → mac local)
  - `5f7f15bd` `extractReportSnippets` 削除 + BUILD_VERSION v0.36.42
- 別 worker WIP (触らない):
  - `pwa/design/atlas_routine.md` / `pwa/design_log/sessions_2026-07.md` (私も append したが別 worker append と共存)
  - `pwa/manual/6-7-contracts-management-spec.md` / `pwa/spec/5-6-contracts-management-current-spec.md`
  - `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` / `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md`
  - `pwa/scripts/check_h1_meeting_summary_reviewer.mjs` / `pwa/scripts/review_h1_meeting_summary.mjs`
  - `pwa/src/components/contracts/ContractsClient.tsx` / `pwa/src/lib/supabase/middleware.ts`
  - `pwa/manual/9-3-appendix-changelog.md` (別 worker が追記中、私も追記済み)
  - `pwa/spec/6-1-appendix-changelog.md` (同上)
  - `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` / `pwa/bzm/2026-07-16_mprs_theory_revision_proposal_v1.md` (新規、別 worker)
  - `pwa/src/app/mock/contracts-preview/` (新規、別 worker)
  - `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` (KENQ 系別 worker が全面書き換え中)
  - `pwa/BUGS.md` (別 worker 追記 + 私も L2M-1 系 2 エントリ追加、共存)

## Current Truth (L2M-1 v2)

- **DB**: migration 159 + 160 適用済 (production Supabase 反映済)。
- **PJ scope 割り当て** (2026-07-01 まさ確定、`projects.monthly_report_scope`):
  - `internal_and_external` (対外提出版 + PDF 生成): p25 KUTE / p21 SX / p20 CX (NIMS)
  - `internal_only` (内部保存版のみ): p00 AMD / p07 LST / p10 SE / p19 ZMP / p24 CLG / p26 VasculaX
  - `none` (routine 対象外): p06 CTB
- **llm_prompts**: `l2m1.monthly_report.internal.v2` (body 8,569 chars) と `l2m1.monthly_report.external.v2` (body 3,990 chars) は `is_active=true`。admin UI (`/admin/llm-prompts`) から編集可能。
- **Claude routine**: `amd-os-l2m1-monthly-report`、cron `0 3 28-31 * *` (LOCAL time = JST) + Phase 0 で当月最終日判定、実行環境はまさの mac local Claude Code アプリ (前提: mac 24 時間常時起動 + アプリ常時 open)。Next run: **Tue Jul 28 03:04 JST**。
- **旧 Codex `amd-os-l2`**: `status = "PAUSED"`、バックアップ `automation.toml.bak_20260701_disable_by_eimi`。復活禁止。
- **`monthly_report_required` bool 列**: backward compat のため残存、判定には使わない。削除は別 migration。

## Unresolved Tasks

1. **KUTE p25 / SX p21 / CX p20 で実走検証** (scope=internal_and_external の 3 PJ、対外版 + 禁止語チェック + PDF 生成まで確認)
2. **`scripts/strip_internal_jargon.py` と `scripts/generate_monthly_report.py` の実装** (SKILL.md references として登場するが未実装、対外版 PDF 生成を有効化する場合に必要)
3. **本番 routine の 2026-07-31 発火時の実走観察** (まさの mac が 03:00 JST に起動 + Claude Code アプリ open していれば発火、翌朝業務開始までに全 PJ の DB reflect + Slack 通知 + 副本ファイル出力の 3 セットが揃う想定)
4. **SX 202605 で dry-run** (task #6 pending、内部保存版のみで OK なら簡易確認)

## First Next Action

**KUTE (p25) の 2026-06 で本番 routine 実走**するのが最も検証情報密度が高い:
- `mcp__scheduled-tasks__create_scheduled_task` で 1 回きり fireAt task を作る (対象: p25 202606、scope 強制 = internal_and_external)
- または本番 routine を「今すぐ実行」で kick (ただし本番 routine は全対象 PJ を回るので実行時間長い)
- 完了通知 (Slack DM) + 月次モーダル (`https://amd-os-pwa.vercel.app/project/p25/cockpit?ym=202606`) + `monthly_reports_external.body_md` + `monthly_reports_external.pdf_drive_url` / `pdf_local_path` の 4 点を目視確認

## Deployment / Verification (this session)

- L2M-1 系 8 commit を main へ順次 push、各 commit の deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 経由で production 反映確認済 (最終 `v0.36.42` / `5f7f15bd`)
- Supabase 反映は Supabase MCP `apply_migration` (migration 159/160) と `execute_sql` (llm_prompts body 反映) で実施
- Claude routine 登録は MCP `create_scheduled_task`、fireAt テストは `update_scheduled_task` で再武装
- 旧 Codex disable は `automation.toml` 直接編集 + バックアップ保存

## Pointers

- 仕様正本: `pwa/spec/3-2-monthly-reports-current-spec.md` v2 (差分マトリクス + 対外提出版節 + 対象 PJ 表)
- SKILL.md 正本: `pwa/scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md` (Phase 0-3 + 1 PJ 完了条件 4 つ + 禁止事項)
- BUGS: `pwa/BUGS.md` の 2026-07-01 冒頭 2 エントリ (snippet extraction 削除、one-shot DB write skip 事故)
- design_log: `pwa/design_log/sessions_2026-07.md` の 2026-07-01 エントリ
- changelog: `pwa/spec/6-1-appendix-changelog.md` + `pwa/manual/9-3-appendix-changelog.md` の 2026-07-01 行
</content>
</invoke>