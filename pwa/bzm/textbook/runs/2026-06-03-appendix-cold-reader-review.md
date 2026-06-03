# Appendix Cold-Reader Review

Date: 2026-06-03 JST

Worker: Textbook commander / cold-reader editor review

Scope:
- Review the current Model Notes and Method Appendix as a reader/editor.
- Do not edit public manuscript body in this pass.
- Do not deploy.

Source basis:
- Current Prologue-to-Epilogue story branch at `de37df5`
- `pwa/bzm/public-manuscript/16-readiness-axes-field-guide.md`
- `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `pwa/bzm/public-manuscript/26` through `34`
- `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`
- `pwa/bzm/textbook/runs/2026-06-03-public-notation-rewrite.md`

## Executive verdict

Conditional pass.

The Method Appendix now gives technical readers a real place to inspect the model without forcing formulas into the story. This is the right architecture. The story still closes at the Epilogue, Field Toolkit remains practical, and the model appendix is clearly a third layer.

The two Model Notes are acceptable as prototypes, but should not be expanded yet. Ch16's note is light and mostly harmless. Ch19's note is useful because it names the formula only after RESOURCE_SHIFT has already changed the room. Still, both notes slightly expose the book's scaffolding. Before adding more notes, the next pass should either style them visually as small optional inserts or move the "open the appendix" instruction into UI/link treatment rather than prose.

## What now works

### 1. The story is no longer responsible for carrying all theory

The Method Appendix solves the earlier strategic problem: the narrative had become interesting, but the model had not disappeared. It now has a separated public home.

This lets the book keep both promises:

- the main body reads as a story of consequences;
- the appendix shows that the judgment has formal structure.

### 2. The appendix does not feel like old internal theory pasted back in

The public rewrite avoids old internal chapter numbering and branded score framing. Integrated readiness is described as next action / uncertainty reduction. Founder function is framed as role fit. ERS is framed as responsibility pipeline.

That is the right public posture.

### 3. Ch19 is the strongest bridge between story and model

The Ch19 Model Note works because the reader has already seen a concrete A4 RESOURCE_SHIFT memo. The formula arrives after the artifact, not before it. This keeps the formula from feeling like an interruption.

Ch19 is the pattern to keep if future notes are added.

## Remaining risks

### 1. Model Note prose still says it is a note

Both notes are intentionally optional, but the phrase "このModel Noteは" and "巻末の..." makes the book briefly sound like it is managing the reader.

This is not fatal. It is a prototype issue.

Recommended next adjustment:
- keep the notes for now;
- later, render them visually as optional sidebars;
- reduce prose instructions such as "open the appendix" and rely on link/UI affordance.

### 2. The Method Appendix may be too long as navigation

Nine appendix files are useful for review and editing. In the public reader experience, M0 through M8 may feel like a second textbook appended to a story.

This is not a reason to collapse them yet. It is a route/TOC design risk.

Recommended next adjustment:
- keep file-level separation while drafting;
- decide later whether the public route groups them behind one "Method Appendix" landing page.

### 3. M2 and M5 introduce formulas before visual math styling exists

The formulas are currently inline code-style text. This is safe and readable enough for stubs, but not publication-grade.

Recommended next adjustment:
- when public formula prose is final, decide whether markdown rendering supports math blocks;
- avoid decorative math if it makes mobile reading worse;
- test rendered pages before final publication.

### 4. The appendix still needs a cold technical reader

The appendix is public-safe, but not yet technically reviewed for precision, notation consistency, and whether simplified formulas might confuse expert readers.

This should happen after route/main integration or in a dedicated `technical notation review`.

## Do not do next

Do not add Model Notes to every theory chapter yet.

Do not put formulas into Prologue, Ch01 through Ch14, or Epilogue.

Do not merge Field Toolkit and Method Appendix.

Do not turn M0 through M8 into tables just because the source notation file used tables.

Do not reintroduce branded score language.

## Next surgical orders

1. **Route/main integration review**
   - The branch now has story polish, Field Toolkit UI, Method Appendix manifest changes, public notation, and Model Notes.
   - Review merge order, build gate, and deploy bundling before main.

2. **Method Appendix layout/readability pass**
   - Check the public route visually after integration or with local env.
   - Make Model Note / Method Appendix / Field Toolkit visually distinct.

3. **Technical notation review**
   - Check formula consistency, symbol naming, simplified state-space wording, weights, and misuse warnings.

4. **Final publication readiness audit**
   - Evaluate story, Field Toolkit, Model Notes, Method Appendix, route/TOC, and sales-readiness together.

## Acceptance gate

Current state passes the architecture gate:

- Story body remains intact.
- Formula exposition lives in Method Appendix and two limited prototype notes.
- Model Notes are skippable.
- Appendix is public-facing and avoids internal positioning.
- Author directives around survival probability, earning body, delayed incorporation, and J-curve caution are preserved in M5/M8.

Current state does not yet pass final publication gate:

- Model Notes need visual treatment or prose softening.
- Appendix route/TOC readability has not been visually verified.
- Technical notation has not had expert cold review.
