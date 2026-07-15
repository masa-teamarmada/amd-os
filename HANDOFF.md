# AMD OS Handoff

Last updated: 2026-07-16 JST
Target: `/Users/masa/projects/AMD/amd-os/pwa/bzm`
Topic: Book A 組版技術検証 closeout / 出版準備ストリームK

## Latest Session Summary

- Book A 出版準備ストリームKで、`book-a-ch-8.md` を数式最重量級サンプルとして read-only 検証した。
- A5 PDF は pandoc + LuaLaTeX + `ltjsbook` で生成成功、実測28ページ。MathML EPUB も生成成功。
- webtex EPUB は生成自体は成功したが、長い日本語入りの交換効率式1本が外部画像化に失敗した。
- 結果は `pwa/bzm/BOOK_A_PUBLISHING_PLAN.md` §4、`pwa/bzm/COMMANDER_TASKS.md` Stream K、`pwa/bzm/9-5-appendix-changelog.md` に反映済み。
- 生成PDF/EPUBは repo 外 `/tmp/book-a-typesetting-verification-20260715/` に置き、commit していない。
- 詳細 handoff: `pwa/bzm/HANDOFF_BOOK_A_2026-07-16.md`。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の「Book A 組版技術検証」。

## Repo State

- Canonical branch: `main`。
- Book A 組版検証 commit: `1fdbf21b docs(bzm): Book A組版技術検証ログを記録`。push 済み。
- Handoff 作成時点の local main / origin/main: aligned。最新の production readback は `v3.41.4` / `71e63060` / `git_branch=main` / `dirty=false`。
- この handoff 自体の commit が後続で積まれるため、次回開始時は `git log -1 --oneline` と `https://amd-os-pwa.vercel.app/api/build-info` を再照合する。
- このセッションで作った branch / worktree: none。

## Verification Run

- `pdfinfo /tmp/book-a-typesetting-verification-20260715/ch8-a5-ltjsbook.pdf` -> 28 pages / A5。
- `unzip -p ch8-mathml.epub EPUB/content.opf | grep mathml` -> `properties="mathml"` 確認。
- `unzip -p ch8-webtex.epub EPUB/text/ch001.xhtml | grep 交換効率` -> 交換効率の本文は残るが式画像は欠落。
- `git diff --check` passed for the three Book A docs before commit。
- Full PWA build/test は未実施。対象は BZM 出版準備 md の記帳であり、アプリUI/API変更なし。

## Dirty State

| path | status | class | owner guess | resolution action | next judgment condition | risk |
|---|---:|---|---|---|---|---|
| `pwa/design/atlas_routine.md` | M | other-worker | Atlas / routine lane | Do not mix into Book A closeout. Owner should commit/deploy or revert as its own bundle. | Before next Atlas/routine closeout. | medium |
| `pwa/scripts/check_contracts_ledger_grouping.mts`, `pwa/scripts/check_pwa_critical_ui.cjs`, `pwa/src/app/api/contracts/**`, `pwa/src/components/contracts/ContractsClient.tsx`, `pwa/src/lib/contracts-ledger.ts`, `ios/supabase/migrations/20260716113000_contracts_operational_answers.sql` | M / ?? | other-worker | contracts operational answers lane | Do not stage here. Contracts owner should verify schema/API/UI/critical guard, then commit/deploy or revert as one bundle. | Before next contracts deploy/closeout. | high |
| `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` | ?? | preexisting / other-worker | Book A frontmatter lane | Keep. BZM/frontmatter owner should decide register/move/delete after Masa review. | Before next Book A frontmatter closeout. | low-medium |

## Unresolved Tasks

- Book A Stream K: 高品質印刷所への見積り取得準備、ISBN/JAN申請情報整理、Kindle Previewer / epubcheck 確認。
- 組版 pipeline: 長い数式2本の折り返しルール、図プレースホルダの実画像差し替え、本番テンプレ (柱・ノンブル・目次・奥付)。
- repo hygiene: 上記 unrelated dirty は各 owner lane で別 closeout。

## First Next Action

1. Run:
   ```bash
   cd /Users/masa/projects/AMD/amd-os
   git fetch origin main
   git status -sb --untracked-files=all
   git log -1 --oneline
   curl -fsS https://amd-os-pwa.vercel.app/api/build-info
   ```
2. If continuing Book A publication work, read `pwa/bzm/COMMANDER_TASKS.md` Stream K and `pwa/bzm/BOOK_A_PUBLISHING_PLAN.md` §4 first.
3. Start with quote-prep / ISBN-JAN prep / EPUB real-device checks. Do not edit chapter body while doing publication pipeline work.

## Pointers

- BZM handoff: `pwa/bzm/HANDOFF_BOOK_A_2026-07-16.md`
- Publication plan: `pwa/bzm/BOOK_A_PUBLISHING_PLAN.md`
- Commander ledger: `pwa/bzm/COMMANDER_TASKS.md`
- BZM appendix changelog: `pwa/bzm/9-5-appendix-changelog.md`
- Session migration prompt: `SESSION_MIGRATION_PROMPT.md`
- PWA / AMD OS rules: `CLAUDE.md`, `pwa/AGENTS.md`, `pwa/CLAUDE.md`

## Guardrails

- BZM出版準備の生成物 (PDF/EPUB/TeX/render PNG) は repo に入れない。
- Chapter body (`book-a-ch-*.md`) は出版パイプライン検証では read-only。
- `git add .` 禁止。対象ファイルだけ stage。
- Branch/worktree 作成は禁止。main 直 commit / push。
- PWA本番反映対象の実装変更は deploy script 経由。今回の Book A docs はアプリ仕様変更なし。
