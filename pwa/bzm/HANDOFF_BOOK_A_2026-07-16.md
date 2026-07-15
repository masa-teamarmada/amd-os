# Book A Publication Handoff

Last updated: 2026-07-16 JST
Topic: Stream G / 図版インベントリ closeout + Stream K / 組版技術検証
Working root: `/Users/masa/projects/AMD/amd-os`
BZM root: `/Users/masa/projects/AMD/amd-os/pwa/bzm`

## Summary

- `BOOK_A_FIGURE_INVENTORY.md` を新設し、Book A 全16章の図版制作単位を棚卸しした。
- 総実制作見込みは41点。第1〜10章は本文プレースホルダ確認済み30点 (延べ31箇所)、第11〜16章はマスタープラン §9 由来の見込み11点。
- 制作方式の目安は matplotlib向き16点 / SVG手描き向き25点。優先度高は14点。
- `COMMANDER_TASKS.md` Stream G は「図リスト完成、次は実制作フェーズ」へ更新済み。
- Commit `2b56d19d docs: Book A 図版インベントリ作成` は `main` に push 済み。
- `book-a-ch-8.md` を数式最重量級サンプルとして、本文 read-only で組版技術検証した。
- A5 PDF は pandoc + LuaLaTeX + `ltjsbook` で生成成功。実測28ページ。
- EPUB MathML は生成成功。`content.opf` に `properties="mathml"` を確認。
- EPUB webtex は生成自体は成功したが、外部 Codecogs 画像化に依存し、長い日本語入りの交換効率式1本が欠落した。
- 結果は `BOOK_A_PUBLISHING_PLAN.md` §4、`COMMANDER_TASKS.md` Stream K、`9-5-appendix-changelog.md` に記帳済み。
- Commit `1fdbf21b docs(bzm): Book A組版技術検証ログを記録` は `main` に push 済み。

## Generated Artifacts

- Work dir: `/tmp/book-a-typesetting-verification-20260715/`
- Main files:
  - `ch8-a5-ltjsbook.pdf`
  - `ch8-mathml.epub`
  - `ch8-webtex.epub`
  - `ch8-ltjsbook.tex`
  - `rendered/` PNG render set
- These are verification artifacts only and are not committed.
- Local TeX environment installed outside repo: `/Users/masa/Library/TinyTeX` with Japanese packages (`collection-langjapanese`, `luatexja`, `jlreq`).

## Figure Inventory Facts

- Source: `BOOK_A_FIGURE_INVENTORY.md`.
- Confirmed figures: 30 production units from chapters 1-10.
- Placeholder appearances: 31, because 図1-1 appears twice but counts as one production unit.
- Estimated figures: 11 from chapters 11-16, based on `BOOK_A_MASTER_PLAN.md` §9 because those chapters are not fully drafted.
- Production type split: 16 matplotlib-friendly / 25 hand-drawn SVG-friendly.
- High-priority items: 14.
- Known production checks:
  - 図1-3 still says the journey is 15 times in the current placeholder context; production must reconcile this with the current 16-chapter structure.
  - 図10-2 appears before 図10-1 in text; production must decide whether to preserve text order or adjust numbering/order.
  - Existing public BZM figures may be useful as references, but Book A needs figure-numbered, caption-aligned, publication-ready versions.

## Verified Facts

- PDF page count: 28 pages.
- PDF page size: A5 (`419.528 x 595.276 pt`).
- Visual render check: pages rendered by Poppler; 表8-1 / 表8-3 / 主要数式 / references had no obvious clipping or overlap.
- PDF warnings: long underbrace formulas in 8.5 produced overfull hbox warnings (5.53pt / 20.26pt). Print pipeline should break or align them.
- Figures are still placeholder text (`[図8-x]`), not real images.
- Java was unavailable, so `epubcheck` was not run.
- Kindle Previewer was not found, so Kindle rendering is unverified.

## Page / Spine Estimate

- Ch8 actual A5 PDF: 28p.
- 16 chapters simple projection: 448p.
- With front/back matter ~25p: about 473p.
- Current quote cases remain valid: 480 / 520 / 550p.
- Provisional spine range with 0.10-0.11mm paper:
  - 480p: 24.0-26.4mm
  - 520p: 26.0-28.6mm
  - 550p: 27.5-30.3mm
- Printer must confirm exact spine after paper choice.

## Next Tasks

1. High-quality printer quote prep:
   - A5 / 480-520-550p / monochrome body / PUR perfect binding candidate / cover processing / 50-100-200 copies / spine 24-30mm class.
2. ISBN / JAN application prep:
   - Corporate Team Armada issuer, ISBN publisher code self-acquisition, book JAN for paper.
3. EPUB verification:
   - Install or use Java + epubcheck.
   - Check Kindle Previewer when available.
   - Treat MathML as the main candidate; webtex needs local math image generation or formula shortening before final use.
4. Print PDF pipeline:
   - Decide line-break rules for long equations.
   - Replace figure placeholders with real image assets.
   - Build final template for headers, page numbers, table of contents, colophon.

## Current Repo State

- Branch: `main`.
- Handoff creation snapshot: local main aligned with `origin/main`.
- Production readback at handoff start: `v3.41.4`, git sha `71e63060`, `git_branch=main`, `dirty=false`.
- Later handoff-doc commit may advance HEAD; next session must verify live state with `git log -1` and `/api/build-info`.
- Figure inventory commit `2b56d19d docs: Book A 図版インベントリ作成` added `BOOK_A_FIGURE_INVENTORY.md` to main. Read it before figure work.
- This session created no branch/worktree.

## Dirty State To Avoid Mixing

- Materials / research-assets docs and code are an unrelated active lane. This includes docs/spec/manual/build-info/materials view/data files when present in `git status`.
- Contracts ledger files, critical UI guard changes, middleware/preview scratch files, and `ios/supabase/migrations/20260716113000_contracts_operational_answers.sql` are an unrelated contracts lane when present in `git status`.
- `pwa/design/atlas_routine.md` is an unrelated Atlas/routine dirty file.
- `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` is a preexisting Book A frontmatter draft and should not be deleted or auto-committed without that lane's decision.
- The exact dirty list is volatile because other work is active in the same checkout. Re-run `git status -sb --untracked-files=all`; do not rely only on this prose.

## First Next Action

Run current-truth checks, then continue Stream G from `BOOK_A_FIGURE_INVENTORY.md` and `COMMANDER_TASKS.md`:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log -1 --oneline
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Then read:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `pwa/bzm/COMMANDER_TASKS.md`
4. `pwa/bzm/BOOK_A_FIGURE_INVENTORY.md`
5. `pwa/bzm/BOOK_A_PUBLISHING_PLAN.md`
6. `pwa/bzm/HANDOFF_BOOK_A_2026-07-16.md`
7. `pwa/bzm/SESSION_MIGRATION_PROMPT.md`

If continuing Stream G, decide whether to launch figure-production workers. Keep this inventory read-only unless chapter text, figure numbering, or the chapter-11-to-16 plan changes.

## Closeout Classification

- Main/default alignment: main aligned at handoff start.
- Production alignment: production matched `origin/main` at handoff start (`71e63060`, `v3.41.4`).
- Book A task state: committed success for the figure inventory and the technical verification; handoff required for figure production and publication operations.
- Archive state: do not archive as zero-trace while unrelated dirty files remain in the checkout.
